import type { Card, User, Word } from "@prisma/client";
import { prisma } from "./db";
import { review, Rating } from "./fsrs";
import { generateSentence, gradeAnswers, optimizeCadence, pickNextWords } from "./llm";
import { sendWhatsApp } from "./whatsapp";
import { LANGUAGE_NAMES, isRtl } from "./words";

/** Free-recall review of an existing card: English prompt → produce the target word. */
export type ReviewQuizItem = { type: "review"; cardId: string; prompt: string; answer: string };
/**
 * Guess-first introduction of an unseen word: the target word is shown and the
 * learner picks its English meaning from `options`. No card exists until graded.
 */
export type NewQuizItem = {
  type: "new";
  wordId: string;
  prompt: string;
  answer: string;
  options: string[];
  correctIndex: number;
};
export type QuizItem = ReviewQuizItem | NewQuizItem;

const MAX_QUIZ_ITEMS = 4;
const OPTION_LETTERS = ["a", "b", "c"];
const CLOSING_LINE = "Reply with your answers (text or voice note).";
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

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build the a/b/c meanings for a guess-first item: the real translation plus two
 * distractors from the same language (same `kind` when enough exist), chosen and
 * shuffled deterministically per word so re-sends show the same options.
 */
export function buildOptions(word: Word, pool: Word[]): { options: string[]; correctIndex: number } {
  const rand = seededRandom(word.id);
  const others = pool.filter((w) => w.id !== word.id && w.translation !== word.translation);
  const sameKind = others.filter((w) => w.kind === word.kind);
  const candidates = [...(sameKind.length >= 2 ? sameKind : others)].sort((a, b) => a.rank - b.rank);

  const distractors: string[] = [];
  while (distractors.length < 2 && candidates.length > 0) {
    const [picked] = candidates.splice(Math.floor(rand() * candidates.length), 1);
    if (!distractors.includes(picked.translation)) distractors.push(picked.translation);
  }

  const options = [word.translation, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, correctIndex: options.indexOf(word.translation) };
}

/** Render the outbound quiz body: optional streak line, numbered questions, closing line. */
export function formatQuiz(items: QuizItem[], words: Map<string, Word>, streak: number): string {
  const lines: string[] = [];
  if (streak >= 2) lines.push(`🔥 ${streak}-day streak`, "");
  items.forEach((item, i) => {
    if (item.type === "review") {
      lines.push(`${i + 1}. ${item.prompt}`);
      return;
    }
    const word = words.get(item.wordId);
    // One field per line: mixing RTL script with Latin text on a single line
    // scrambles the visual order in WhatsApp.
    lines.push(`${i + 1}. New — guess the meaning:`);
    if (word) {
      lines.push(word.term);
      if (word.transliteration) lines.push(word.transliteration);
    }
    lines.push(item.options.map((o, j) => `${OPTION_LETTERS[j]}) ${o}`).join("  "));
  });
  lines.push("", CLOSING_LINE);
  return lines.join("\n");
}

/**
 * Build and send the morning (or afternoon) quiz for a user. Quiz-only: due cards
 * are free-recall questions, unseen words are guess-first multiple choice. The
 * study material is the feedback the learner gets after replying.
 */
export async function sendLesson(user: User, opts: { includeNewWords: boolean }) {
  const now = new Date();
  const dueCards = await prisma.card.findMany({
    where: { userId: user.id, state: { not: 0 }, due: { lte: now } },
    orderBy: { due: "asc" },
    take: MAX_QUIZ_ITEMS,
    include: { word: true },
  });

  const quizItems: QuizItem[] = dueCards.map((c) => ({
    type: "review",
    cardId: c.id,
    prompt: `"${c.word.translation}" in ${LANGUAGE_NAMES[user.language] ?? user.language}?`,
    answer: c.word.transliteration ? `${c.word.term} (${c.word.transliteration})` : c.word.term,
  }));

  const newWords = opts.includeNewWords ? await selectNewWords(user) : [];
  if (newWords.length > 0) {
    const pool = await prisma.word.findMany({ where: { language: user.language } });
    for (const w of newWords) {
      const { options, correctIndex } = buildOptions(w, pool);
      quizItems.push({
        type: "new",
        wordId: w.id,
        prompt: w.transliteration ? `Meaning of ${w.term} (${w.transliteration})?` : `Meaning of ${w.term}?`,
        answer: w.translation,
        options,
        correctIndex,
      });
    }
  }

  if (quizItems.length === 0) return null;

  const body = formatQuiz(quizItems, new Map(newWords.map((w) => [w.id, w])), user.streak);
  const message = await sendWhatsApp({
    userId: user.id,
    to: user.phone,
    body,
    kind: "quiz",
    quizItems,
  });

  // New words get no Card until the reply is graded (see handleReply), so an
  // unanswered quiz doesn't consume words the learner never engaged with.
  // Per-new-word follow-ups after a confirmed send go here (`newWords`).
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

  const items = parseQuizItems(pending.quizItems!);
  const graded = items.length > 0 ? await gradeAnswers(user.language, items, text) : [];
  const now = new Date();
  const rtl = isRtl(user.language);

  // One block per item, one field per line (RTL script never shares a line with Latin text).
  const blocks: string[][] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { correct, feedback } = graded[i];
    const rating = correct ? Rating.Good : Rating.Again;
    const mark = `${i + 1}. ${correct ? "✓" : "✗"}`;

    if (item.type === "review") {
      const card = await prisma.card.findUnique({ where: { id: item.cardId }, include: { word: true } });
      if (card) await prisma.card.update({ where: { id: card.id }, data: review(card, rating, now) });
      const word = card?.word;
      if (!word) blocks.push(correct ? [`${mark} ${item.answer}`] : [`${mark} ${feedback}`, item.answer]);
      else if (correct) blocks.push(rtl ? [mark, ...termLines(word)] : [`${mark} ${word.term}`]);
      else blocks.push([`${mark} ${feedback}`, ...termLines(word)]);
      continue;
    }

    // Guess-first item: the reveal is the lesson. Create the card now (Good if
    // guessed right, Again if not) so it comes back as a free-recall review.
    const word = await prisma.word.findUnique({ where: { id: item.wordId } });
    if (!word) {
      blocks.push([`${mark} ${item.answer}`]);
      continue;
    }
    await prisma.card.upsert({
      where: { userId_wordId: { userId: user.id, wordId: word.id } },
      create: { userId: user.id, wordId: word.id, ...review(blankCard(user.id, word.id, now), rating, now) },
      update: {},
    });
    const { sentence, sentence_en } = await generateSentence(user.language, word.term, word.translation);
    blocks.push([
      ...(rtl ? [mark, ...termLines(word)] : [`${mark} ${word.term}`]),
      `= ${word.translation}`,
      sentence,
      sentence_en,
    ]);
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
  const multiLine = blocks.some((b) => b.length > 1);
  return [summary, ...blocks.map((b) => b.join("\n"))].join(multiLine ? "\n\n" : "\n");
}

/** Term (and transliteration) on their own lines — never mixed with Latin text. */
function termLines(word: Word): string[] {
  return word.transliteration ? [word.term, word.transliteration] : [word.term];
}

function blankCard(userId: string, wordId: string, now: Date): Card {
  return {
    id: "",
    userId,
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
  };
}

/** Parse persisted quiz items; entries from before `type` existed are reviews. */
function parseQuizItems(raw: string): QuizItem[] {
  const parsed = JSON.parse(raw) as (QuizItem | Omit<ReviewQuizItem, "type">)[];
  return parsed.map((item) => ("type" in item ? item : { type: "review", ...item }));
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
