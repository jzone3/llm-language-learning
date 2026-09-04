import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendLesson } from "@/lib/engine";
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
    return Response.json({ error: "This signup session has expired — refresh the page and start again." }, { status: 403 });
  }
  if (user.placementDone) {
    return Response.json({ ok: true, level: user.level, sendHour: user.sendHour, language: user.language });
  }

  // Multiple-choice: an answer is known only if the picked option matches the
  // word's translation exactly. Skipped questions count as unknown.
  const attempted = answers.filter((a) => a.response.trim().length > 0);
  let knownWordIds: string[] = [];

  if (attempted.length > 0) {
    const words = await prisma.word.findMany({
      where: { id: { in: attempted.map((a) => a.wordId) }, language: user.language },
    });
    knownWordIds = attempted
      .filter((a) => {
        const w = words.find((x) => x.id === a.wordId);
        return w !== undefined && a.response === w.translation;
      })
      .map((a) => a.wordId);
  }

  const total = answers.length;
  const knownRatio = total > 0 ? knownWordIds.length / total : 0;
  const level = knownRatio >= 0.7 ? "advanced" : knownRatio >= 0.35 ? "intermediate" : "beginner";

  const totalWords = await prisma.word.count({ where: { language: user.language } });
  const queueCount = Math.max(0, totalWords - knownWordIds.length);

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

  let firstLessonSent = false;
  try {
    await sendWhatsApp({
      userId: user.id,
      to: user.phone,
      body: `🎉 You're in! Level: ${level}. Here's your first quiz — reply by text or voice note, and the feedback teaches you each word. Tomorrow morning's quiz builds your streak.`,
      kind: "other",
    });
    await sendLesson(updated, { includeNewWords: true });
    firstLessonSent = true;
  } catch (err) {
    console.error("first lesson send failed", err);
  }

  return Response.json({
    ok: true,
    level,
    knownCount: knownWordIds.length,
    totalAsked: total,
    queueCount,
    sendHour: updated.sendHour,
    language: updated.language,
    firstLessonSent,
  });
}
