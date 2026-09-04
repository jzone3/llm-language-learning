import OpenAI from "openai";
import { z } from "zod";
import { LANGUAGE_NAMES } from "./words";
import type { QuizItem } from "./engine";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

async function jsonCall<T>(schema: z.ZodType<T>, system: string, user: string, temperature = 0.4): Promise<T> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature,
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

const OPTION_LETTERS = ["a", "b", "c"];

/**
 * Grade a learner's free-text answers to a mixed vocab quiz.
 * Review items (produce the target word) are graded leniently: typos, missing
 * accents, transliterations, close synonyms. New items (multiple-choice meaning
 * of a shown word) accept the letter, the option text, or a paraphrase of it.
 */
export async function gradeAnswers(
  language: string,
  items: QuizItem[],
  userReply: string
): Promise<GradedAnswer[]> {
  const schema = z.object({
    results: z.array(z.object({ answer: z.string().nullable(), correct: z.boolean(), feedback: z.string() })),
  });
  const quiz = items.map((item, i) =>
    item.type === "review"
      ? { n: i + 1, type: "review", prompt: item.prompt, expected_answer: item.answer }
      : {
          n: i + 1,
          type: "multiple_choice",
          prompt: item.prompt,
          options: Object.fromEntries(item.options.map((o, j) => [OPTION_LETTERS[j], o])),
          correct_letter: OPTION_LETTERS[item.correctIndex],
          expected_answer: item.answer,
        }
  );
  const out = await jsonCall(
    schema,
    `You grade a ${LANGUAGE_NAMES[language] ?? language} vocabulary quiz answered over WhatsApp. Items are numbered and come in two types:
- "review": the learner must produce the ${LANGUAGE_NAMES[language] ?? language} word/phrase for an English prompt. Be lenient: accept misspellings and typos (a letter or two off, e.g. "grasias" for "gracias"), missing accents, romanized transliterations of non-Latin scripts, and reasonable synonyms. If a native speaker would clearly recognize the intended word, it is correct.
- "multiple_choice": a ${LANGUAGE_NAMES[language] ?? language} word was shown with lettered English meanings. Correct if the learner gives the correct letter (a/b/c), the correct option's text or any one of its alternatives (an option like "hello / peace" lists alternate meanings; "peace" alone is correct), or a synonym/paraphrase of it ("hi" for "hello"). A different letter, a different option's text, or "idk"/"?"/"no idea" is incorrect.
The learner may answer in order, separated by commas/newlines/numbers, or answer only some items; match answers to items by position (and by explicit numbers when present). A bare letter a/b/c is an answer to a multiple_choice item, never to a review item. For each item return {"answer": "<the learner's text for this item, verbatim, or null if they gave none>", "correct": bool, "feedback": "<= 8 words, e.g. '✓' or 'close: it's X'"}. An item with answer null is incorrect with feedback "no answer". Return JSON {"results": [...]} with exactly one result per item, in order.`,
    JSON.stringify({ quiz, learner_reply: userReply }),
    0
  );
  // Ensure one result per item even if the model misbehaves; multiple-choice
  // letters and option texts are checked deterministically, the model only
  // decides paraphrases.
  return items.map((item, i) => {
    const r = out.results[i];
    if (!r || r.answer === null || r.answer.trim() === "") return { correct: false, feedback: "no answer" };
    if (item.type === "new") {
      const picked = matchOption(r.answer, item.options);
      if (picked !== null) {
        return picked === item.correctIndex
          ? { correct: true, feedback: "✓" }
          : { correct: false, feedback: `it's ${OPTION_LETTERS[item.correctIndex]}` };
      }
    }
    return { correct: r.correct, feedback: r.feedback };
  });
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

/** Index of the option the answer names by letter or text (any " / " alternative), or null. */
function matchOption(answer: string, options: string[]): number | null {
  const a = normalize(answer);
  if (a.length === 1) {
    const idx = OPTION_LETTERS.indexOf(a);
    return idx >= 0 && idx < options.length ? idx : null;
  }
  for (let i = 0; i < options.length; i++) {
    const alternatives = options[i].split(" / ").map(normalize);
    if (alternatives.includes(a) || normalize(options[i]) === a) return i;
  }
  return null;
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
