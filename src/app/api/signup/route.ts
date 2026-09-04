import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerifyCode } from "@/lib/whatsapp";
import { LANGUAGES } from "@/lib/words";
import { normalizePhone } from "@/lib/phone";

const bodySchema = z.object({
  phone: z
    .string()
    .transform((s, ctx) => {
      const normalized = normalizePhone(s);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid phone number, e.g. (415) 555-1234 or +44 20 7946 0958",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  timezone: z.string().min(1),
  language: z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]),
});

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { phone, timezone, language } = parsed.data;

  const cooldown = Response.json(
    { error: "A code was requested less than 30 seconds ago — wait a moment and try again." },
    { status: 429 }
  );

  const now = Date.now();
  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(now + CODE_TTL_MS);
  const fields = { timezone, language, verifyCode: code, verifyExpiresAt: expires, verifyAttempts: 0, optedOut: false };

  // Codes issued within the cooldown window expire after this instant.
  const issuedBeforeCooldown = new Date(now + CODE_TTL_MS - RESEND_COOLDOWN_MS);

  let user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (user) {
    const { count } = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ verifyExpiresAt: null }, { verifyExpiresAt: { lte: issuedBeforeCooldown } }] },
      data: fields,
    });
    if (count === 0) return cooldown;
  } else {
    try {
      user = await prisma.user.create({ data: { phone, ...fields }, select: { id: true } });
    } catch {
      return cooldown;
    }
  }

  try {
    await sendVerifyCode({ userId: user.id, to: phone, code });
  } catch (err) {
    console.error("verify message failed", err);
    // Undelivered code: release the cooldown so the user can retry immediately.
    await prisma.user.update({ where: { id: user.id }, data: { verifyExpiresAt: issuedBeforeCooldown } });
    return Response.json(
      { error: "Couldn't reach that number on WhatsApp — double-check it and try again." },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
}
