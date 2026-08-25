import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendLesson } from "@/lib/engine";
import { gradePlacement } from "@/lib/llm";
import { sendWhatsApp } from "@/lib/whatsapp";

const bodySchema = z.object({
  phone: z.string(),
  token: z.string().min(1),
  answers: z.array(z.object({ wordId: z.string(), response: z.string() })),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { phone, token, answers } = parsed.data;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user?.verified || !user.placementToken || user.placementToken !== token) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  if (user.placementDone) return Response.json({ ok: true, level: user.level });

  const attempted = answers.filter((a) => a.response.trim().length > 0);
  let knownWordIds: string[] = [];

  if (attempted.length > 0) {
    const words = await prisma.word.findMany({
      where: { id: { in: attempted.map((a) => a.wordId) }, language: user.language },
    });
    const items = attempted.flatMap((a) => {
      const w = words.find((x) => x.id === a.wordId);
      return w ? [{ term: w.term, translation: w.translation, response: a.response, wordId: w.id }] : [];
    });
    const known = await gradePlacement(user.language, items);
    knownWordIds = items.filter((_, i) => known[i]).map((it) => it.wordId);
  }

  const total = answers.length;
  const knownRatio = total > 0 ? knownWordIds.length / total : 0;
  const level = knownRatio >= 0.7 ? "advanced" : knownRatio >= 0.35 ? "intermediate" : "beginner";

  const now = new Date();
  const graduatedDue = new Date(now.getTime() + 21 * 24 * 3600_000);
  for (const wordId of knownWordIds) {
    // Known words start as mature review cards so lessons don't reteach them.
    await prisma.card.upsert({
      where: { userId_wordId: { userId: user.id, wordId } },
      create: {
        userId: user.id,
        wordId,
        due: graduatedDue,
        stability: 21,
        difficulty: 5,
        reps: 1,
        state: 2,
        lastReview: now,
      },
      update: {},
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { placementDone: true, level, placementToken: null },
  });

  try {
    await sendWhatsApp({
      userId: user.id,
      to: user.phone,
      body: `🎉 You're in! Level: ${level}. Here's your first lesson — reply to tomorrow morning's quiz to build your streak. You can answer by text or voice note.`,
      kind: "other",
    });
    await sendLesson(updated, { includeNewWords: true });
  } catch (err) {
    console.error("first lesson send failed", err);
  }

  return Response.json({ ok: true, level });
}
