import { NextRequest, after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findPendingQuiz, handleReply, parseQuizItems } from "@/lib/engine";
import { sendNewWordImages } from "@/lib/images";
import { sendWhatsApp, fetchWhatsAppMedia, validateWebhookSignature } from "@/lib/whatsapp";
import { transcribeAudio, transcriptionPrompt } from "@/lib/llm";

// Image generation for revealed words runs after the 200 (see `after`) and needs headroom.
export const maxDuration = 60;

/** Meta webhook verification handshake. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type InboundMessage = {
  from: string; // digits, no +
  id: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
};

type StatusUpdate = {
  id: string;
  status: string; // sent | delivered | read | failed
  recipient_id?: string;
  errors?: { code: number; title?: string; message?: string; error_data?: { details?: string } }[];
};

type ChangeValue = { messages?: InboundMessage[]; statuses?: StatusUpdate[] };

/** Message types a learner might send as an answer that we can't read; reactions etc. are ignored silently. */
const UNREADABLE_TYPES = new Set(["image", "video", "document", "sticker", "location", "contacts", "unsupported"]);

export async function POST(request: NextRequest) {
  const raw = await request.text();

  if (process.env.NODE_ENV === "production") {
    if (!validateWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
      return new Response("Invalid signature", { status: 403 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const entries = (payload as { entry?: { changes?: { value?: ChangeValue }[] }[] }).entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (status.status === "failed") {
          console.error("whatsapp delivery failed", {
            messageId: status.id,
            recipient: status.recipient_id,
            errors: status.errors,
          });
        }
      }
      for (const message of change.value?.messages ?? []) {
        try {
          await handleInbound(message);
        } catch (err) {
          console.error("webhook message handling failed", err);
        }
      }
    }
  }

  // Always 200 so Meta doesn't retry-storm; failures are logged above.
  return new Response("OK", { status: 200 });
}

async function handleInbound(message: InboundMessage) {
  const phone = `+${message.from}`;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return;

  let body = message.type === "text" ? (message.text?.body ?? "").trim() : "";

  // Meta redelivers a message when it doesn't get a timely 200. Inserting the inbound row first
  // claims the wamid (unique), so a redelivery — even a concurrent one — is a no-op from here on.
  let inbound: { id: string };
  try {
    inbound = await prisma.message.create({
      data: { userId: user.id, direction: "in", kind: message.type === "text" || message.type === "audio" ? "reply" : message.type, body, waMessageId: message.id },
      select: { id: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }

  if (UNREADABLE_TYPES.has(message.type)) {
    await reply(user.id, phone, "I can only read text or a voice note — reply with your answers that way. 🎙️");
    return;
  }

  // Voice-note reply: transcribe, then grade the transcript like a text answer.
  if (!body && message.type === "audio" && message.audio?.id) {
    try {
      const [media, pending] = await Promise.all([fetchWhatsAppMedia(message.audio.id), findPendingQuiz(user.id)]);
      const prompt = pending?.quizItems ? transcriptionPrompt(user.language, parseQuizItems(pending.quizItems)) : undefined;
      body = await transcribeAudio(media.data, media.contentType, prompt);
      await prisma.message.update({ where: { id: inbound.id }, data: { body } });
    } catch (err) {
      console.error("voice transcription failed", err);
      await reply(user.id, phone, "Couldn't process that voice note — try again or reply by text. 🎙️");
      return;
    }
    if (!body) {
      await reply(user.id, phone, "Couldn't hear anything in that voice note — try again or reply by text. 🎙️");
      return;
    }
  }

  if (!body) return;

  const upper = body.toUpperCase();
  if (["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT"].includes(upper)) {
    await prisma.user.update({ where: { id: user.id }, data: { optedOut: true } });
    await reply(user.id, phone, "You're unsubscribed. Reply START anytime to resume. 👋");
    return;
  }
  if (upper === "START") {
    await prisma.user.update({ where: { id: user.id }, data: { optedOut: false } });
    await reply(user.id, phone, "Welcome back! Your morning quizzes resume tomorrow. ☀️");
    return;
  }

  const { text: feedback, revealedWords } = await handleReply(user, body);
  if (!feedback) return; // quiz claimed concurrently by another reply
  const delivered = await reply(user.id, phone, feedback);
  // A picture of the meaning would give away the guess-first question, so the
  // illustration accompanies the reveal. Deferred past the response so Meta
  // gets its 200 quickly and doesn't retry the webhook.
  if (delivered && revealedWords.length > 0) after(() => sendNewWordImages(user, revealedWords));
}

async function reply(userId: string, to: string, body: string): Promise<boolean> {
  try {
    await sendWhatsApp({ userId, to, body, kind: "other" });
    return true;
  } catch (err) {
    console.error("webhook reply send failed", err);
    return false;
  }
}
