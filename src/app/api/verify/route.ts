import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import crypto from "crypto";

const bodySchema = z.object({
  phone: z.string(),
  code: z.string().regex(/^\d{6}$/),
});

const WRONG_CODE = "That code doesn't match — check the WhatsApp message and try again.";

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Enter the 6-digit code from the WhatsApp message." }, { status: 400 });
  }
  const { phone, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.verifyCode) {
    return Response.json({ error: WRONG_CODE }, { status: 400 });
  }
  if (user.verifyExpiresAt && user.verifyExpiresAt < new Date()) {
    return Response.json({ error: "That code has expired — tap “Resend code” to get a new one." }, { status: 400 });
  }
  if (user.verifyAttempts >= 5) {
    return Response.json(
      { error: "Too many wrong attempts — tap “Resend code” to get a fresh one." },
      { status: 429 }
    );
  }
  if (user.verifyCode !== code) {
    await prisma.user.update({ where: { id: user.id }, data: { verifyAttempts: { increment: 1 } } });
    return Response.json({ error: WRONG_CODE }, { status: 400 });
  }

  // Single-use token authorizing the website placement flow for this browser.
  const placementToken = crypto.randomBytes(24).toString("hex");
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      verified: true,
      verifyCode: null,
      verifyExpiresAt: null,
      verifyAttempts: 0,
      placementToken,
    },
  });

  // The first lesson is sent after the placement test (or when it's skipped).
  return Response.json({ ok: true, placementDone: updated.placementDone, placementToken });
}
