import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendLesson } from "@/lib/engine";
import { sendSms } from "@/lib/sms";

const bodySchema = z.object({
  phone: z.string(),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { phone, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.verifyCode !== code) {
    return Response.json({ error: "Wrong code" }, { status: 400 });
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: { verified: true, verifyCode: null },
  });

  await sendSms({
    userId: user.id,
    to: user.phone,
    body: "🎉 You're in! Here's your first lesson — reply to tomorrow morning's quiz to build your streak.",
    kind: "other",
  });
  await sendLesson(verifiedUser, { includeNewWords: true });

  return Response.json({ ok: true });
}
