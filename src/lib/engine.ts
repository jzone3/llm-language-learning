import type { User } from "@prisma/client";
import { prisma } from "./db";
import { review, Rating } from "./fsrs";
import { generateSentence, gradeAnswers, optimizeCadence, pickNextWords } from "./llm";
import { sendWhatsApp } from "./whatsapp";
import { LANGUAGE_NAMES, isRtl } from "./words";

export type QuizItem = { cardId: string; prompt: string; answer: string };

const MAX_QUIZ_ITEMS = 4;
const STREAK_TO_UNLOCK_SECOND_MESSAGE = 4;

export function localParts(timezone: string, date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour) % 24, dayKey: `${parts.year}-${parts.month}-${parts.day}` };
}

function startOfLocalDayUtc(timezone: string, date = new Date()): Date {
  // Approximation: walk back from `date` until the local day key changes.
  const { dayKey } = localParts(timezone, date);
  let d = new Date(date);
  while (localParts(timezone, new Date(d.getTime() - 3600_000)).dayKey === dayKey) {
    d = new Date(d.getTime() - 3600_000);
  }
  d.setMinutes(0, 0, 0);
  return d;
}

/** Build and send the morning (or afternoon) lesson for a user. */
export async function sendLesson(user: User, opts: { includeNewWords: boolean }) {
  const now = new Date();
  const dueCards = await prisma.card.findMany({
    where: { userId: user.id, state: { not: 0 }, due: { lte: now } },
    orderBy: { due: "asc" },
    take: MAX_QUIZ_ITEMS,
    include: { word: true },
  });

  const quizItems: QuizItem[] = dueCards.map((c) => ({
    cardId: c.id,
    prompt: `"${c.word.translation}" in ${LANGUAGE_NAMES[user.language] ?? user.language}?`,
    answer: c.word.transliteration ? `${c.word.term} (${c.word.transliteration})` : c.word.term,
  }));

  const lines: string[] = [];
  if (quizItems.length > 0) {
    lines.push(`Quiz — reply with your answers:`);
    quizItems.forEach((q, i) => lines.push(`${i + 1}. ${q.prompt}`));
  }

  const newWordIds: string[] = [];
  if (opts.includeNewWords) {
    const newWords = await selectNewWords(user);
    if (newWords.length > 0) {
      lines.push("");
      lines.push(newWords.length === 1 ? "New word:" : "New words:");
      for (const w of newWords) {
        const { sentence, sentence_en } = await generateSentence(user.language, w.term, w.translation);
        // One field per line: mixing RTL script with Latin text on a single
        // line scrambles the visual order in WhatsApp.
        lines.push("");
        lines.push(w.term);
        if (w.transliteration) lines.push(w.transliteration);
        lines.push(w.translation);
        lines.push(sentence);
        lines.push(sentence_en);
        newWordIds.push(w.id);
      }
    }
  }

  if (lines.length === 0) return null;

  const streakBit = user.streak >= 2 ? ` 🔥${user.streak}` : "";
  const body = `☀️ VocabText${streakBit}\n${lines.join("\n")}`;
  const message = await sendWhatsApp({
    userId: user.id,
    to: user.phone,
    body,
    kind: "quiz",
    quizItems,
  });

  // Persist new-word cards only after the message is confirmed sent, so an
  // undelivered lesson doesn't consume words the user never saw.
  for (const wordId of newWordIds) {
    await prisma.card.create({
      data: {
        userId: user.id,
        wordId,
        // New words enter learning immediately so they show up in tomorrow's quiz.
        ...review(
          {
            id: "",
            userId: user.id,
            wordId,
            due: now,
            stability: 0,
            difficulty: 0,
            reps: 0,
            lapses: 0,
            learningSteps: 0,
            state: 0,
            lastReview: null,
            createdAt: now,
          },
          Rating.Good,
          now
        ),
      },
    });
  }
  return message;
}

/** Pick today's new items: prefer the weekly LLM-chosen queue, fall back to frequency order. */
async function selectNewWords(user: User) {
  const seen = await prisma.card.findMany({ where: { userId: user.id }, select: { wordId: true } });
  const seenIds = new Set(seen.map((s) => s.wordId));

  const queue: string[] = user.wordQueue ? JSON.parse(user.wordQueue) : [];
  const queuedUnseen = queue.filter((id) => !seenIds.has(id));
  if (queuedUnseen.length > 0) {
    const words = await prisma.word.findMany({ where: { id: { in: queuedUnseen.slice(0, user.newWordsPerDay) } } });
    // Preserve queue order.
    return queuedUnseen
      .slice(0, user.newWordsPerDay)
      .map((id) => words.find((w) => w.id === id))
      .filter((w): w is NonNullable<typeof w> => Boolean(w));
  }

  return prisma.word.findMany({
    where: { language: user.language, id: { notIn: [...seenIds] } },
    orderBy: { rank: "asc" },
    take: user.newWordsPerDay,
  });
}

/** Weekly: have the LLM pick next week's new items based on recent performance. */
export async function refreshWordQueue(user: User) {
  const cards = await prisma.card.findMany({
    where: { userId: user.id },
    include: { word: true },
    orderBy: { lastReview: "desc" },
    take: 30,
  });
  const candidates = await prisma.word.findMany({
    where: { language: user.language, id: { notIn: cards.map((c) => c.wordId) } },
    orderBy: { rank: "asc" },
    take: 40,
  });
  if (candidates.length === 0) return;

  const weekCount = Math.min(user.newWordsPerDay * 7, candidates.length);
  const wordIds = await pickNextWords({
    language: user.language,
    level: user.level,
    performance: cards.map((c) => ({
      term: c.word.term,
      translation: c.word.translation,
      kind: c.word.kind,
      lapses: c.lapses,
      reps: c.reps,
    })),
    candidates: candidates.map((c) => ({
      id: c.id,
      term: c.term,
      translation: c.translation,
      kind: c.kind,
      rank: c.rank,
    })),
    count: weekCount,
  });
  if (wordIds.length > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { wordQueue: JSON.stringify(wordIds) } });
  }
}

/** Handle an inbound reply: grade, update FSRS + streak, respond. */
export async function handleReply(user: User, text: string): Promise<string> {
  const pending = await prisma.message.findFirst({
    where: { userId: user.id, direction: "out", kind: "quiz", answered: false, quizItems: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  await prisma.message.create({
    data: { userId: user.id, direction: "in", kind: "reply", body: text },
  });

  if (!pending) {
    return "No quiz pending — your next words arrive tomorrow morning. 📚";
  }

  // Mark answered up front so a webhook retry can't re-grade the same quiz.
  await prisma.message.update({ where: { id: pending.id }, data: { answered: true } });

  const items = JSON.parse(pending.quizItems!) as QuizItem[];
  const graded = items.length > 0 ? await gradeAnswers(user.language, items, text) : [];
  const now = new Date();

  const feedbackLines: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const card = await prisma.card.findUnique({ where: { id: items[i].cardId }, include: { word: true } });
    if (card) {
      await prisma.card.update({
        where: { id: card.id },
        data: review(card, graded[i].correct ? Rating.Good : Rating.Again, now),
      });
    }
    const mark = graded[i].correct ? `${i + 1}. ✓` : `${i + 1}. ✗ ${graded[i].feedback}`;
    if (card && isRtl(user.language)) {
      feedbackLines.push(mark, card.word.term);
      if (card.word.transliteration) feedbackLines.push(card.word.transliteration);
    } else {
      feedbackLines.push(`${mark} ${items[i].answer}`);
    }
  }

  // Streak: increment once per local day.
  const todayStart = startOfLocalDayUtc(user.timezone, now);
  const answeredToday = user.lastAnsweredAt && user.lastAnsweredAt >= todayStart;
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600_000);
  const answeredYesterday = user.lastAnsweredAt && user.lastAnsweredAt >= yesterdayStart && user.lastAnsweredAt < todayStart;
  const newStreak = answeredToday ? user.streak : answeredYesterday ? user.streak + 1 : 1;
  await prisma.user.update({
    where: { id: user.id },
    data: { streak: newStreak, lastAnsweredAt: now },
  });

  const correctCount = graded.filter((g) => g.correct).length;
  const summary =
    items.length > 0
      ? `${correctCount}/${items.length}${correctCount === items.length ? " 🎉" : ""}`
      : "Got it!";
  return `${summary}\n${feedbackLines.join("\n")}`;
}

/** Called hourly by cron: send due lessons and periodically re-optimize cadence. */
export async function runHourlyTick() {
  const users = await prisma.user.findMany({
    where: { verified: true, optedOut: false, placementDone: true },
  });
  const results: { userId: string; action: string }[] = [];

  for (const user of users) {
    try {
    const now = new Date();
    const { hour } = localParts(user.timezone, now);
    const todayStart = startOfLocalDayUtc(user.timezone, now);

    const sentToday = await prisma.message.findMany({
      where: { userId: user.id, direction: "out", kind: "quiz", createdAt: { gte: todayStart } },
    });
    const unanswered = sentToday.some((m) => !m.answered);

    if (hour === user.sendHour && sentToday.length === 0) {
      const sent = await sendLesson(user, { includeNewWords: true });
      if (sent) results.push({ userId: user.id, action: "morning" });
    } else if (
      user.secondSendHour !== null &&
      hour === user.secondSendHour &&
      user.streak >= STREAK_TO_UNLOCK_SECOND_MESSAGE &&
      sentToday.length === 1 &&
      !unanswered // never double-text on top of an unanswered quiz
    ) {
      const sent = await sendLesson(user, { includeNewWords: false });
      if (sent) results.push({ userId: user.id, action: "afternoon" });
    }

    // Weekly-ish cadence re-optimization, run during the user's morning hour.
    if (hour === user.sendHour) {
      const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / (24 * 3600_000));
      if (daysSinceSignup > 0 && daysSinceSignup % 7 === 0) {
        const history = await prisma.message.findMany({
          where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 14 * 24 * 3600_000) } },
          orderBy: { createdAt: "asc" },
          select: { direction: true, kind: true, createdAt: true, answered: true },
        });
        const opt = await optimizeCadence({
          timezone: user.timezone,
          streak: user.streak,
          currentSendHour: user.sendHour,
          currentSecondSendHour: user.secondSendHour,
          history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
          previousNotes: user.cadenceNotes,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            sendHour: opt.sendHour,
            secondSendHour: user.streak >= STREAK_TO_UNLOCK_SECOND_MESSAGE ? opt.secondSendHour : null,
            cadenceNotes: opt.notes,
          },
        });
        results.push({ userId: user.id, action: "cadence-optimized" });

        // Weekly word picker: LLM reviews performance and queues next week's items.
        try {
          await refreshWordQueue(user);
          results.push({ userId: user.id, action: "words-picked" });
        } catch (err) {
          console.error(`word picking failed for user ${user.id}`, err);
        }
      }
    }
    } catch (err) {
      console.error(`hourly tick failed for user ${user.id}`, err);
      results.push({ userId: user.id, action: "error" });
    }
  }
  return results;
}
