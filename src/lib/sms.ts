import twilio from "twilio";
import { prisma } from "./db";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export type Channel = "sms" | "whatsapp";

function address(channel: Channel, phone: string) {
  return channel === "whatsapp" ? `whatsapp:${phone}` : phone;
}

function fromNumber(channel: Channel) {
  return channel === "whatsapp"
    ? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM ?? "+14155238886"}` // Twilio sandbox default
    : process.env.TWILIO_FROM_NUMBER;
}

export async function sendSms(params: {
  userId: string;
  to: string;
  body: string;
  kind: string;
  channel?: Channel;
  quizItems?: { cardId: string; prompt: string; answer: string }[];
}) {
  const channel: Channel = params.channel ?? "sms";
  await client.messages.create({
    from: fromNumber(channel),
    to: address(channel, params.to),
    body: params.body,
  });
  return prisma.message.create({
    data: {
      userId: params.userId,
      direction: "out",
      kind: params.kind,
      body: params.body,
      quizItems: params.quizItems ? JSON.stringify(params.quizItems) : null,
    },
  });
}

/** Download a Twilio-hosted media file (inbound MMS/WhatsApp media) using account auth. */
export async function fetchTwilioMedia(url: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Failed to fetch Twilio media: ${res.status}`);
  return { data: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "audio/ogg" };
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string) {
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN ?? "", signature, url, params);
}
