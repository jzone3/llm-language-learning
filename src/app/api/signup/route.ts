import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";

const bodySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, e.g. +14155551234"),
  timezone: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { phone, timezone } = parsed.data;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const user = await prisma.user.upsert({
    where: { phone },
    create: { phone, timezone, verifyCode: code },
    update: { timezone, verifyCode: code, optedOut: false },
  });

  await sendSms({
    userId: user.id,
    to: phone,
    body: `VocabText code: ${code}\n\nReply STOP anytime to unsubscribe.`,
    kind: "verify",
  });

  return Response.json({ ok: true });
}
