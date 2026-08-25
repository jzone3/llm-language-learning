import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleReply } from "@/lib/engine";
import { sendWhatsApp, fetchWhatsAppMedia, validateWebhookSignature } from "@/lib/whatsapp";
import { transcribeAudio } from "@/lib/llm";

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

  const entries = (payload as { entry?: { changes?: { value?: { messages?: InboundMessage[] } }[] }[] }).entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
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

  // Voice-note reply: transcribe, then grade the transcript like a text answer.
  if (!body && message.type === "audio" && message.audio?.id) {
    try {
      const media = await fetchWhatsAppMedia(message.audio.id);
      body = await transcribeAudio(media.data, media.contentType, user.language);
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

  const feedback = await handleReply(user, body);
  await reply(user.id, phone, feedback);
}

async function reply(userId: string, to: string, body: string) {
  try {
    await sendWhatsApp({ userId, to, body, kind: "other" });
  } catch (err) {
    console.error("webhook reply send failed", err);
  }
}
