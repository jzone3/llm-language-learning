import { prisma } from "./db";
import crypto from "crypto";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function accessToken() {
  return process.env.WHATSAPP_ACCESS_TOKEN ?? "";
}

/** Send a WhatsApp text message via the Meta Cloud API and log it. */
export async function sendWhatsApp(params: {
  userId: string;
  to: string; // E.164, e.g. +14155551234
  body: string;
  kind: string;
  quizItems?: { cardId: string; prompt: string; answer: string }[];
}) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to.replace(/^\+/, ""),
      type: "text",
      text: { body: params.body },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed: ${res.status} ${detail}`);
  }
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

/**
 * Send the verification code via an approved authentication template when
 * WHATSAPP_VERIFY_TEMPLATE is set. Business-initiated messages to numbers with no
 * open 24h window (i.e. every first-contact verification) require a template in
 * production; plain text works with Meta test numbers in dev.
 */
export async function sendVerifyCode(params: { userId: string; to: string; code: string }) {
  const template = process.env.WHATSAPP_VERIFY_TEMPLATE;
  if (!template) {
    return sendWhatsApp({
      userId: params.userId,
      to: params.to,
      body: `VocabText code: ${params.code}\n\nReply STOP anytime to unsubscribe.`,
      kind: "verify",
    });
  }
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: params.code }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: params.code }],
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp verify template send failed: ${res.status} ${detail}`);
  }
  return prisma.message.create({
    data: { userId: params.userId, direction: "out", kind: "verify", body: "(verification template)" },
  });
}

export type TemplateComponent =
  | { type: "header"; parameters: { type: "image"; image: { link: string } | { id: string } }[] }
  | { type: "body"; parameters: { type: "text"; text: string }[] }
  | {
      type: "button";
      sub_type: "url" | "quick_reply";
      index: string;
      parameters: { type: "text" | "payload"; text?: string; payload?: string }[];
    };

/**
 * Make a string safe to use as a template parameter value. The Cloud API rejects
 * parameters containing newlines, tabs, or more than 4 consecutive spaces
 * ("Param text cannot have new-line/tab characters or more than 4 consecutive spaces").
 */
export function templateParamText(text: string, lineSeparator = " | "): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, " ").replace(/ {2,}/g, " ").trim())
    .filter((line) => line.length > 0)
    .join(lineSeparator);
}

/**
 * Send an approved message template (e.g. a UTILITY template for the daily quiz)
 * and optionally log it as an outbound Message. Templates are the only way to
 * message a learner outside the 24h customer-service window.
 */
export async function sendTemplate(
  to: string,
  name: string,
  languageCode: string,
  components: TemplateComponent[],
  log?: { userId: string; kind: string; body: string; quizItems?: object[] }
) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: { name, language: { code: languageCode }, components },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp template "${name}" send failed: ${res.status} ${detail}`);
  }
  if (!log) return null;
  return prisma.message.create({
    data: {
      userId: log.userId,
      direction: "out",
      kind: log.kind,
      body: log.body,
      quizItems: log.quizItems ? JSON.stringify(log.quizItems) : null,
    },
  });
}

/** Download an inbound media file (e.g. a voice note) by its Cloud API media id. */
export async function fetchWhatsAppMedia(mediaId: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (!metaRes.ok) throw new Error(`WhatsApp media lookup failed: ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url: string; mime_type?: string };
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken()}` } });
  if (!fileRes.ok) throw new Error(`WhatsApp media download failed: ${fileRes.status}`);
  return {
    data: await fileRes.arrayBuffer(),
    contentType: meta.mime_type ?? fileRes.headers.get("content-type") ?? "audio/ogg",
  };
}

/** Validate the X-Hub-Signature-256 header on webhook posts (requires WHATSAPP_APP_SECRET). */
export function validateWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
