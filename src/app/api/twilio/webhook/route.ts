import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleReply } from "@/lib/engine";
import { validateTwilioSignature, fetchTwilioMedia } from "@/lib/sms";
import { transcribeAudio } from "@/lib/llm";

function twiml(message: string) {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

const emptyTwiml = () =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  if (process.env.NODE_ENV === "production") {
    const signature = request.headers.get("x-twilio-signature") ?? "";
    const url = process.env.TWILIO_WEBHOOK_URL ?? request.url;
    if (!validateTwilioSignature(url, params, signature)) {
      return new Response("Invalid signature", { status: 403 });
    }
  }

  const from = (params.From ?? "").replace(/^whatsapp:/, "");
  let body = (params.Body ?? "").trim();
  if (!from) return emptyTwiml();

  const user = await prisma.user.findUnique({ where: { phone: from } });
  if (!user) return emptyTwiml();

  // Voice-note reply (WhatsApp audio / MMS): transcribe, then grade the transcript.
  if (!body && Number(params.NumMedia ?? "0") > 0 && (params.MediaContentType0 ?? "").startsWith("audio")) {
    try {
      const media = await fetchTwilioMedia(params.MediaUrl0);
      body = await transcribeAudio(media.data, media.contentType, user.language);
    } catch (err) {
      console.error("voice transcription failed", err);
      return twiml("Couldn't process that voice note — try again or reply by text. 🎙️");
    }
    if (!body) return twiml("Couldn't hear anything in that voice note — try again or reply by text. 🎙️");
  }

  const upper = body.toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(upper)) {
    await prisma.user.update({ where: { id: user.id }, data: { optedOut: true } });
    return emptyTwiml(); // Twilio also handles STOP at the carrier level
  }
  if (upper === "START" || upper === "UNSTOP") {
    await prisma.user.update({ where: { id: user.id }, data: { optedOut: false } });
    return twiml("Welcome back! Your morning quizzes resume tomorrow. ☀️");
  }

  const reply = await handleReply(user, body);
  return twiml(reply);
}
