import OpenAI from "openai";
import { z } from "zod";
import { LANGUAGE_NAMES } from "./words";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

async function jsonCall<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });
  return schema.parse(JSON.parse(res.choices[0].message.content ?? "{}"));
}

/** Generate a short example sentence for a word, SMS-friendly. */
export async function generateSentence(language: string, term: string, translation: string) {
  const schema = z.object({ sentence: z.string(), sentence_en: z.string() });
  return jsonCall(
    schema,
    `You write ultra-short beginner example sentences for ${LANGUAGE_NAMES[language] ?? language} vocabulary. Max 8 words. Use only very common words besides the target word. Return JSON {"sentence": "...", "sentence_en": "..."}.`,
    `Word: ${term} (${translation})`
  );
}

/** Transcribe a voice-note reply (WhatsApp/MMS audio) in the target language. */
export async function transcribeAudio(audio: ArrayBuffer, contentType: string, language: string): Promise<string> {
  const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mp4") ? "mp4" : contentType.includes("wav") ? "wav" : "mp3";
  const file = new File([audio], `reply.${ext}`, { type: contentType });
  const res = await openai.audio.transcriptions.create({
    model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1",
    file,
    language,
  });
  return res.text.trim();
}

export type GradedAnswer = { correct: boolean; feedback: string };

/**
 * Grade the website placement test: the learner saw target-language items and
 * typed English meanings (or left them blank). Lenient like quiz grading.
 */
export async function gradePlacement(
  language: string,
  items: { term: string; translation: string; response: string }[]
): Promise<boolean[]> {
  const schema = z.object({ known: z.array(z.boolean()) });
  const out = await jsonCall(
    schema,
    `You grade a ${LANGUAGE_NAMES[language] ?? language} placement test. For each item the learner saw the ${LANGUAGE_NAMES[language] ?? language} term and typed its English meaning. Mark it known (true) if the response shows they understand the word — accept typos, partial meanings, and synonyms. Empty or wrong responses are false. Return JSON {"known": [bool, ...]} with exactly one boolean per item, in order.`,
    JSON.stringify(items)
  );
  return items.map((_, i) => out.known[i] ?? false);
}

/**
 * Weekly word picker: given the learner's recent performance, choose which
 * unseen items they should learn next week (words, phrases, slang).
 */
export async function pickNextWords(input: {
  language: string;
  level: string;
  performance: { term: string; translation: string; kind: string; lapses: number; reps: number }[];
  candidates: { id: string; term: string; translation: string; kind: string; rank: number }[];
  count: number;
}): Promise<string[]> {
  const schema = z.object({ wordIds: z.array(z.string()) });
  const out = await jsonCall(
    schema,
    `You pick next week's vocabulary for a ${LANGUAGE_NAMES[input.language] ?? input.language} learner at ${input.level} level. Choose ${input.count} item ids from the candidates, ordered easiest-first. Mix words with phrases and slang. Prefer items related to ones the learner struggled with (high lapses) so they reinforce each other, and generally respect frequency rank. Return JSON {"wordIds": ["id", ...]} using only ids from the candidates.`,
    JSON.stringify({ performance: input.performance, candidates: input.candidates })
  );
  const valid = new Set(input.candidates.map((c) => c.id));
  return out.wordIds.filter((id) => valid.has(id)).slice(0, input.count);
}

/**
 * Grade a learner's free-text answers to a vocab quiz.
 * Lenient: accept typos, missing accents, close synonyms.
 */
export async function gradeAnswers(
  language: string,
  items: { prompt: string; answer: string }[],
  userReply: string
): Promise<GradedAnswer[]> {
  const schema = z.object({
    results: z.array(z.object({ correct: z.boolean(), feedback: z.string() })),
  });
  const out = await jsonCall(
    schema,
    `You grade a ${LANGUAGE_NAMES[language] ?? language} vocabulary quiz answered over WhatsApp. Be lenient: accept typos, missing accents, romanized transliterations of non-Latin scripts, and reasonable synonyms. The learner may answer in order, separated by commas/newlines/numbers, or answer only some items. For each quiz item return {"correct": bool, "feedback": "<= 8 words, e.g. '✓' or 'close: it's X'"}. If an item wasn't answered, mark it incorrect with feedback "no answer". Return JSON {"results": [...]} with exactly one result per item, in order.`,
    JSON.stringify({ quiz: items, learner_reply: userReply })
  );
  // Ensure one result per item even if the model misbehaves.
  return items.map((_, i) => out.results[i] ?? { correct: false, feedback: "no answer" });
}

/**
 * Timing/frequency optimizer: given a user's recent message history,
 * suggest the best morning send hour, whether to add an afternoon message, and why.
 */
export async function optimizeCadence(input: {
  timezone: string;
  streak: number;
  currentSendHour: number;
  currentSecondSendHour: number | null;
  history: { direction: string; kind: string; createdAt: string; answered: boolean }[];
  previousNotes: string | null;
}): Promise<{ sendHour: number; secondSendHour: number | null; notes: string }> {
  const schema = z.object({
    sendHour: z.number().int().min(6).max(12),
    secondSendHour: z.number().int().min(12).max(21).nullable(),
    notes: z.string(),
  });
  return jsonCall(
    schema,
    `You optimize the send schedule of an SMS vocab-learning service for one user. Rules:
- Default is one morning message. Only set secondSendHour (an afternoon/evening hour) if the user has a streak of 4+ days of consistent replies.
- If the user stopped replying to afternoon messages, set secondSendHour back to null.
- Shift sendHour toward the local time-of-day the user actually replies.
- Be conservative: change at most one thing at a time.
Return JSON {"sendHour": int (6-12), "secondSendHour": int (12-21) or null, "notes": "<= 40 words on the observed pattern"}.`,
    JSON.stringify(input)
  );
}
