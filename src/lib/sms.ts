import twilio from "twilio";
import { prisma } from "./db";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSms(params: {
  userId: string;
  to: string;
  body: string;
  kind: string;
  quizItems?: { cardId: string; prompt: string; answer: string }[];
}) {
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to: params.to,
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

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string) {
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN ?? "", signature, url, params);
}
