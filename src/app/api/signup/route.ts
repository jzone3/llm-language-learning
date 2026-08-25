import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerifyCode } from "@/lib/whatsapp";
import { LANGUAGES } from "@/lib/words";

const bodySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, e.g. +14155551234"),
  timezone: z.string().min(1),
  language: z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { phone, timezone, language } = parsed.data;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60_000);
  const user = await prisma.user.upsert({
    where: { phone },
    create: { phone, timezone, language, verifyCode: code, verifyExpiresAt: expires },
    update: { timezone, language, verifyCode: code, verifyExpiresAt: expires, verifyAttempts: 0, optedOut: false },
  });

  try {
    await sendVerifyCode({ userId: user.id, to: phone, code });
  } catch (err) {
    console.error("verify message failed", err);
    return Response.json(
      { error: "Couldn't reach that number on WhatsApp — double-check it and try again." },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
}
