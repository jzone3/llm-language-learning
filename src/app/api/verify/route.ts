import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";


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
  if (!user || !user.verifyCode) {
    return Response.json({ error: "Wrong code" }, { status: 400 });
  }
  if (user.verifyExpiresAt && user.verifyExpiresAt < new Date()) {
    return Response.json({ error: "Code expired — sign up again to get a new one." }, { status: 400 });
  }
  if (user.verifyAttempts >= 5) {
    return Response.json({ error: "Too many attempts — sign up again to get a new code." }, { status: 429 });
  }
  if (user.verifyCode !== code) {
    await prisma.user.update({ where: { id: user.id }, data: { verifyAttempts: { increment: 1 } } });
    return Response.json({ error: "Wrong code" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { verified: true, verifyCode: null, verifyExpiresAt: null, verifyAttempts: 0 },
  });

  // The first lesson is sent after the placement test (or when it's skipped).
  return Response.json({ ok: true, placementDone: updated.placementDone });
}
