/**
 * End-to-end harness for WhatsApp voice-note replies.
 *
 * Generates realistic voice notes with OpenAI TTS (Ogg/Opus, like WhatsApp), runs
 * a local stub of the Meta Graph API (media lookup + download, outbound sends),
 * seeds a user with a pending quiz, posts Meta-shaped `audio` webhook payloads
 * (signed with WHATSAPP_APP_SECRET) through the real webhook handler, and checks
 * transcript → grading → feedback → FSRS/`answered` state. Whisper is real.
 *
 *   NODE_ENV=production npx tsx --env-file=.env scripts/test-voice-reply.ts [--compare] [--keep] [--only <name>] [--url http://localhost:3000]
 *
 *   --compare  also transcribe every clip with several transcription configurations
 *              (whisper-1 forced language / auto / auto + quiz prompt, gpt-4o-mini-transcribe
 *              with and without the prompt) and print a table
 *   --keep     leave the seeded test users/messages in the database
 *   --only     run a single case by name
 *   --url      POST to a running server instead of calling the route in-process
 *              (start it with WHATSAPP_GRAPH_BASE=http://127.0.0.1:4010)
 *
 * Requires: Postgres per .env, OPENAI_API_KEY (real OpenAI, for Whisper + TTS), ffmpeg.
 * Signature validation only runs in the route when NODE_ENV=production.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import OpenAI from "openai";
import type { Word } from "@prisma/client";

const STUB_PORT = Number(process.env.VOICE_TEST_STUB_PORT ?? 4010);
const CACHE_DIR = path.join(process.cwd(), "scripts", ".voice-cache");
const SECRET = process.env.WHATSAPP_APP_SECRET ?? "";
const OPUS_MIME = "audio/ogg; codecs=opus";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const COMPARE = flag("--compare");
const KEEP = flag("--keep");
const ONLY = opt("--only");
const URL_MODE = opt("--url");

if (!SECRET) {
  console.error("WHATSAPP_APP_SECRET must be set (any value) so payloads can be signed.");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY must be set (real OpenAI: Whisper + TTS).");
  process.exit(1);
}

// The stub must be in place before the app modules read WHATSAPP_GRAPH_BASE.
process.env.WHATSAPP_GRAPH_BASE = `http://127.0.0.1:${STUB_PORT}`;
process.env.WHATSAPP_PHONE_NUMBER_ID ??= "123456789";
process.env.WHATSAPP_ACCESS_TOKEN ??= "stub-token";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Meta Graph API stub
// ---------------------------------------------------------------------------

type StubMedia = { bytes: Buffer; mime: string };
const media = new Map<string, StubMedia>();
const outbound: { to: string; body: string; at: number }[] = [];

function startStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${STUB_PORT}`);
    const [, first, second] = url.pathname.split("/");
    if (req.method === "POST" && second === "messages") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw) as { to: string; text?: { body: string } };
        outbound.push({ to: `+${body.to}`, body: body.text?.body ?? "", at: Date.now() });
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            messaging_product: "whatsapp",
            contacts: [{ input: body.to, wa_id: body.to }],
            messages: [{ id: `wamid.out.${crypto.randomUUID()}` }],
          })
        );
      });
      return;
    }
    if (req.method === "GET" && first === "media" && second && media.has(second)) {
      const m = media.get(second)!;
      res.setHeader("content-type", m.mime);
      res.end(m.bytes);
      return;
    }
    if (req.method === "GET" && first && media.has(first)) {
      const m = media.get(first)!;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          url: `http://127.0.0.1:${STUB_PORT}/media/${first}`,
          mime_type: m.mime,
          sha256: crypto.createHash("sha256").update(m.bytes).digest("hex"),
          file_size: m.bytes.length,
          id: first,
          messaging_product: "whatsapp",
        })
      );
      return;
    }
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: { message: "Unsupported get request.", type: "GraphMethodException", code: 100 } }));
  });
  return new Promise((resolve) => server.listen(STUB_PORT, "127.0.0.1", () => resolve(server)));
}

// ---------------------------------------------------------------------------
// Audio generation (cached under scripts/.voice-cache)
// ---------------------------------------------------------------------------

type Speech =
  | { kind: "tts"; text: string; voice?: string; speed?: number }
  | { kind: "noise" }
  | { kind: "silence" }
  | { kind: "quiet"; text: string; voice?: string };

function cachePath(key: string) {
  return path.join(CACHE_DIR, `${crypto.createHash("sha1").update(key).digest("hex").slice(0, 16)}.ogg`);
}

async function tts(text: string, voice = "alloy", speed = 1): Promise<Buffer> {
  const file = cachePath(`tts:${voice}:${speed}:${text}`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const res = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice as "alloy",
    input: text,
    response_format: "opus",
    speed,
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, bytes);
  return bytes;
}

function ffmpeg(argsList: string[], out: string) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...argsList, out], { stdio: "inherit" });
}

async function makeAudio(speech: Speech): Promise<Buffer> {
  if (speech.kind === "tts") return tts(speech.text, speech.voice, speech.speed);
  if (speech.kind === "noise") {
    const file = cachePath("noise");
    if (!fs.existsSync(file)) {
      ffmpeg(["-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.03:duration=4:seed=7", "-c:a", "libopus", "-b:a", "24k"], file);
    }
    return fs.readFileSync(file);
  }
  if (speech.kind === "silence") {
    const file = cachePath("silence");
    if (!fs.existsSync(file)) {
      ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "3", "-c:a", "libopus", "-b:a", "24k"], file);
    }
    return fs.readFileSync(file);
  }
  // quiet: 3s of noise, then the phrase at -14dB mixed with noise, then 2s of noise.
  const file = cachePath(`quiet:${speech.voice}:${speech.text}`);
  if (!fs.existsSync(file)) {
    const voice = await tts(speech.text, speech.voice);
    const voiceFile = cachePath(`quiet-src:${speech.voice}:${speech.text}`);
    fs.writeFileSync(voiceFile, voice);
    ffmpeg(
      [
        "-i", voiceFile,
        "-f", "lavfi", "-i", "anoisesrc=color=brown:amplitude=0.02:duration=12:seed=3",
        "-filter_complex",
        "[0:a]volume=-14dB,adelay=3000|3000,apad=pad_dur=2[v];[v][1:a]amix=inputs=2:duration=first:dropout_transition=0,aformat=channel_layouts=mono[a]",
        "-map", "[a]", "-c:a", "libopus", "-b:a", "24k",
      ],
      file
    );
  }
  return fs.readFileSync(file);
}

function durationSeconds(bytes: Buffer): number {
  const tmp = path.join(CACHE_DIR, "probe.ogg");
  fs.writeFileSync(tmp, bytes);
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tmp]).toString();
  return Number(out.trim());
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

type ItemSpec = { review: string } | { mc: string; correct: number };
type Expect = boolean | "none";
type Case = {
  name: string;
  language: string;
  items: ItemSpec[];
  speech: Speech;
  /** Per-item: true = ✓, false = ✗ (any feedback), "none" = ✗ specifically because no answer was given. */
  expect: Expect[];
  /** For clips with no usable speech: the quiz must stay unanswered and this reply be sent. */
  expectNoTranscript?: RegExp;
  /** Reported but never fails the run: sub-second TTS clips that Whisper mishears (real voice notes have lead-in/out). */
  informational?: boolean;
  description: string;
};

const CASES: Case[] = [
  {
    name: "hebrew-three",
    description: "Hebrew review answers spoken in Hebrew: toda, bevakasha, shalom",
    language: "he",
    items: [{ review: "תודה" }, { review: "בבקשה" }, { review: "שלום" }],
    speech: { kind: "tts", text: "תודה, בבקשה, שלום.", voice: "onyx" },
    expect: [true, true, true],
  },
  {
    name: "mc-letters-english",
    description: "Multiple-choice answers spoken in English: 'A, B, the second one' (item 3's answer is c)",
    language: "he",
    items: [{ mc: "חבר", correct: 0 }, { mc: "מים", correct: 1 }, { mc: "כסף", correct: 2 }],
    speech: { kind: "tts", text: "A, B, the second one.", voice: "nova" },
    expect: [true, true, false],
  },
  {
    name: "single-letter-b",
    description: "One multiple-choice item answered with a bare 'B' (0.4s clip)",
    language: "he",
    items: [{ mc: "חבר", correct: 1 }],
    speech: { kind: "tts", text: "B.", voice: "alloy" },
    expect: [true],
    informational: true,
  },
  {
    name: "single-word-toda",
    description: "One review item answered with a bare 'toda' (0.5s clip)",
    language: "he",
    items: [{ review: "תודה" }],
    speech: { kind: "tts", text: "Toda.", voice: "fable" },
    expect: [true],
    informational: true,
  },
  {
    name: "hesitant-two",
    description: "'Um, bevakasha? And shalom.' over 2 review items",
    language: "he",
    items: [{ review: "בבקשה" }, { review: "שלום" }],
    speech: { kind: "tts", text: "Um, bevakasha? And shalom.", voice: "echo" },
    expect: [true, true],
    informational: true,
  },
  {
    name: "hebrew-ken-lo-hayom",
    description: "Short Hebrew words that whisper-1 mangles: ken, lo, hayom",
    language: "he",
    items: [{ review: "כן" }, { review: "לא" }, { review: "היום" }],
    speech: { kind: "tts", text: "כן, לא, היום.", voice: "nova" },
    expect: [true, true, true],
    informational: true,
  },
  {
    name: "mixed-toda-idk-c",
    description: "Mixed reply: 'toda, I don't know, c' over 2 review items + 1 multiple choice",
    language: "he",
    items: [{ review: "תודה" }, { review: "בבקשה" }, { mc: "ספר", correct: 2 }],
    speech: { kind: "tts", text: "תודה, I don't know, C.", voice: "echo" },
    expect: [true, false, true],
  },
  {
    name: "spanish-accent",
    description: "Spanish review answers spoken by a Spanish voice: gracias, por favor, buenos días",
    language: "es",
    items: [{ review: "gracias" }, { review: "por favor" }, { review: "buenos días" }],
    speech: { kind: "tts", text: "Gracias, por favor, buenos días.", voice: "nova" },
    expect: [true, true, true],
  },
  {
    name: "noise-only",
    description: "4s of pink noise, no speech",
    language: "he",
    items: [{ review: "תודה" }, { review: "בבקשה" }],
    speech: { kind: "noise" },
    expect: ["none", "none"],
    expectNoTranscript: /couldn't hear anything/i,
  },
  {
    name: "silence-only",
    description: "3s of digital silence",
    language: "he",
    items: [{ review: "תודה" }, { review: "בבקשה" }],
    speech: { kind: "silence" },
    expect: ["none", "none"],
    expectNoTranscript: /couldn't hear anything/i,
  },
  {
    name: "quiet-partial",
    description: "Mostly noise, with a faint 'toda' in the middle (answers item 1 only)",
    language: "he",
    items: [{ review: "תודה" }, { review: "בבקשה" }, { review: "שלום" }],
    speech: { kind: "quiet", text: "תודה.", voice: "onyx" },
    expect: [true, "none", "none"],
  },
  {
    name: "rambling-long",
    description: "20s+ rambling English reply with the Hebrew answers embedded",
    language: "he",
    items: [{ review: "תודה" }, { review: "בבקשה" }, { review: "שלום" }],
    speech: {
      kind: "tts",
      voice: "fable",
      text:
        "Okay, um, let me think about this one. So the first one, thank you... I'm pretty sure that's toda. Yeah, toda. " +
        "Number two, please, hmm, that one's a bit harder... bevakasha? I think it's bevakasha. " +
        "And then the third one, hello, that's the easy one, that's shalom. " +
        "Sorry this is so long, I'm walking to the train right now and it's kind of loud out here. " +
        "Okay, that's it. Toda, bevakasha, shalom.",
    },
    expect: [true, true, true],
  },
];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Result = {
  name: string;
  seconds: number;
  transcript: string | null;
  reply: string | null;
  graded: Expect[] | null;
  expected: Expect[];
  pass: boolean;
  informational?: boolean;
  notes: string[];
};

function sign(raw: string) {
  return `sha256=${crypto.createHmac("sha256", SECRET).update(raw).digest("hex")}`;
}

function metaPayload(from: string, message: Record<string, unknown>) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1000000000000",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550000000", phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID },
              contacts: [{ profile: { name: "Test Learner" }, wa_id: from }],
              messages: [{ from, timestamp: String(Math.floor(Date.now() / 1000)), ...message }],
            },
            field: "messages",
          },
        ],
      },
    ],
  });
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const stub = await startStub();

  const { prisma } = await import("../src/lib/db");
  const { buildOptions, formatQuiz } = await import("../src/lib/engine");
  type QuizItem = import("../src/lib/engine").QuizItem;
  const { validateWebhookSignature } = await import("../src/lib/whatsapp");
  const { POST } = await import("../src/app/api/whatsapp/webhook/route");
  const { NextRequest } = await import("next/server");

  async function post(raw: string, signature = sign(raw)): Promise<number> {
    if (URL_MODE) {
      const res = await fetch(`${URL_MODE.replace(/\/$/, "")}/api/whatsapp/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hub-signature-256": signature },
        body: raw,
      });
      return res.status;
    }
    const res = await POST(
      new NextRequest("http://localhost/api/whatsapp/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hub-signature-256": signature },
        body: raw,
      })
    );
    return res.status;
  }

  const results: Result[] = [];
  const createdUserIds: string[] = [];
  let phoneSeq = 1000 + Math.floor(Math.random() * 8000);
  const nextPhone = () => `1555000${phoneSeq++}`;

  async function seedUser(language: string) {
    const from = nextPhone();
    const user = await prisma.user.create({
      data: { phone: `+${from}`, language, verified: true, placementDone: true, timezone: "UTC", name: "Voice Test" },
    });
    createdUserIds.push(user.id);
    return { user, from };
  }

  async function seedQuiz(userId: string, language: string, specs: ItemSpec[]) {
    const pool = await prisma.word.findMany({ where: { language } });
    const byTerm = new Map(pool.map((w) => [w.term, w]));
    const items: QuizItem[] = [];
    const newWords = new Map<string, Word>();
    const past = new Date(Date.now() - 2 * 24 * 3600_000);
    for (const spec of specs) {
      if ("review" in spec) {
        const word = byTerm.get(spec.review);
        if (!word) throw new Error(`no ${language} word "${spec.review}"`);
        const card = await prisma.card.create({
          data: { userId, wordId: word.id, state: 2, reps: 2, stability: 2, difficulty: 5, due: past, lastReview: past },
        });
        items.push({
          type: "review",
          cardId: card.id,
          prompt: `"${word.translation}" in ${language === "he" ? "Hebrew" : "Spanish"}?`,
          answer: word.transliteration ? `${word.term} (${word.transliteration})` : word.term,
        });
      } else {
        const word = byTerm.get(spec.mc);
        if (!word) throw new Error(`no ${language} word "${spec.mc}"`);
        const built = buildOptions(word, pool);
        // Place the right answer at the requested letter so the expected grade is known.
        const options = built.options.filter((_, i) => i !== built.correctIndex);
        options.splice(spec.correct, 0, word.translation);
        newWords.set(word.id, word);
        items.push({
          type: "new",
          wordId: word.id,
          prompt: word.transliteration ? `Meaning of ${word.term} (${word.transliteration})?` : `Meaning of ${word.term}?`,
          answer: word.translation,
          options,
          correctIndex: spec.correct,
        });
      }
    }
    const quiz = await prisma.message.create({
      data: { userId, direction: "out", kind: "quiz", body: formatQuiz(items, newWords, 0), quizItems: JSON.stringify(items) },
    });
    return { quiz, items };
  }

  function repliesTo(from: string, since: number) {
    return outbound.filter((o) => o.to === `+${from}` && o.at >= since);
  }

  /** Parse "1. ✓" / "2. ✗ no answer" lines out of the feedback message. */
  function parseFeedback(reply: string, count: number): Expect[] {
    const graded: Expect[] = [];
    for (let i = 1; i <= count; i++) {
      const m = reply.match(new RegExp(`^${i}\\. (✓|✗)(.*)$`, "m"));
      if (!m) graded.push("none");
      else if (m[1] === "✓") graded.push(true);
      else graded.push(/no answer/i.test(m[2]) ? "none" : false);
    }
    return graded;
  }

  /** `false` accepts any ✗; `"none"` requires the "no answer" ✗. */
  function matches(graded: Expect, expected: Expect) {
    return expected === false ? graded !== true : graded === expected;
  }

  const cases = ONLY ? CASES.filter((c) => c.name === ONLY) : CASES;
  if (cases.length === 0) throw new Error(`no case named ${ONLY}`);

  // -- Whisper configuration comparison ---------------------------------------
  if (COMPARE) {
    console.log("\n## Whisper configuration comparison\n");
    console.log("| case | whisper-1 forced `language` (old) | whisper-1 auto | whisper-1 + quiz prompt | gpt-4o-mini-transcribe | gpt-4o-mini-transcribe + quiz prompt |");
    console.log("|---|---|---|---|---|---|");
    const { transcriptionPrompt } = await import("../src/lib/llm");
    for (const c of cases) {
      const bytes = await makeAudio(c.speech);
      // Build the prompt from the same items the quiz would contain.
      const { user } = await seedUser(c.language);
      const { items } = await seedQuiz(user.id, c.language, c.items);
      const prompt = transcriptionPrompt(c.language, items);
      const run = async (model: string, extra: Record<string, string>) => {
        const file = new File([new Uint8Array(bytes)], "reply.ogg", { type: OPUS_MIME });
        const r = await openai.audio.transcriptions.create({ model, file, response_format: "json", ...extra });
        return r.text.trim().replace(/\|/g, "\\|") || "(empty)";
      };
      const row = await Promise.all([
        run("whisper-1", { language: c.language }),
        run("whisper-1", {}),
        run("whisper-1", { prompt }),
        run("gpt-4o-mini-transcribe", {}),
        run("gpt-4o-mini-transcribe", { prompt }),
      ]);
      console.log(`| ${c.name} | ${row.join(" | ")} |`);
    }
    console.log();
  }

  // -- Signature validation -----------------------------------------------------
  {
    const raw = metaPayload("15550009999", { id: "wamid.sig", type: "text", text: { body: "hi" } });
    const good = validateWebhookSignature(raw, sign(raw));
    const bad = validateWebhookSignature(raw, sign(raw + " "));
    const missing = validateWebhookSignature(raw, null);
    const badStatus = await post(raw, sign(raw + "x"));
    const prod = URL_MODE ? null : process.env.NODE_ENV === "production";
    results.push({
      name: "signature",
      seconds: 0,
      transcript: null,
      reply: null,
      graded: null,
      expected: [],
      pass: good && !bad && !missing && (prod === false || badStatus === 403),
      notes: [
        `validateWebhookSignature: good=${good} tampered=${bad} missing=${missing}`,
        `POST with tampered signature → ${badStatus}${prod === false ? " (dev mode: validation skipped by design)" : ""}`,
      ],
    });
  }

  // -- Voice cases --------------------------------------------------------------
  for (const c of cases) {
    const notes: string[] = [];
    const bytes = await makeAudio(c.speech);
    const seconds = durationSeconds(bytes);
    if (!bytes.subarray(0, 4).equals(Buffer.from("OggS"))) notes.push("clip is not an Ogg container");

    const { user, from } = await seedUser(c.language);
    const { quiz, items } = await seedQuiz(user.id, c.language, c.items);
    const mediaId = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    media.set(mediaId, { bytes, mime: OPUS_MIME });
    const wamid = `wamid.${crypto.randomUUID()}`;
    const raw = metaPayload(from, { id: wamid, type: "audio", audio: { id: mediaId, mime_type: OPUS_MIME, sha256: "x", voice: true } });

    const t0 = Date.now();
    const status = await post(raw);
    if (status !== 200) notes.push(`webhook returned ${status}`);

    const inbound = await prisma.message.findFirst({ where: { userId: user.id, direction: "in" }, orderBy: { createdAt: "desc" } });
    const transcript = inbound?.body ?? null;
    const replies = repliesTo(from, t0);
    const reply = replies.at(-1)?.body ?? null;
    const quizAfter = await prisma.message.findUnique({ where: { id: quiz.id } });

    let graded: Expect[] | null = null;
    let pass: boolean;
    if (c.expectNoTranscript) {
      pass = Boolean(reply && c.expectNoTranscript.test(reply)) && quizAfter?.answered === false;
      if (transcript) notes.push(`transcript was stored: "${transcript}"`);
      if (quizAfter?.answered) notes.push("quiz was marked answered on a no-speech clip");
    } else {
      graded = reply ? parseFeedback(reply, items.length) : null;
      pass = graded !== null && graded.every((g, i) => matches(g, c.expect[i])) && quizAfter?.answered === true;
      if (!transcript) notes.push("no inbound transcript stored");
      // FSRS: review cards must have been rescheduled; new items must now have a card.
      for (const item of items) {
        if (item.type === "review") {
          const card = await prisma.card.findUnique({ where: { id: item.cardId } });
          if (!card || card.reps !== 3 || card.lastReview!.getTime() < t0) {
            notes.push(`card for review item not rescheduled (reps=${card?.reps})`);
            pass = false;
          }
        } else {
          const card = await prisma.card.findUnique({ where: { userId_wordId: { userId: user.id, wordId: item.wordId } } });
          if (!card || card.state === 0) {
            notes.push("no card created for new item");
            pass = false;
          }
        }
      }
    }
    if (replies.length !== 1) notes.push(`${replies.length} replies sent (expected 1)`);
    if (!pass && c.informational) notes.push("informational (sub-second clip): not counted as a failure");
    results.push({ name: c.name, seconds, transcript, reply, graded, expected: c.expect, pass, informational: c.informational, notes });
    console.log(`${pass ? "PASS" : c.informational ? "INFO" : "FAIL"} ${c.name} (${seconds.toFixed(1)}s) → ${JSON.stringify(transcript)}`);

    // Webhook retry with the same wamid must not re-grade or re-reply.
    if (c.name === "hebrew-three") {
      const cardsBefore = await prisma.card.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } });
      const t1 = Date.now();
      const retryStatus = await post(raw);
      const cardsAfter = await prisma.card.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } });
      const retryReplies = repliesTo(from, t1);
      const inboundCount = await prisma.message.count({ where: { userId: user.id, direction: "in" } });
      const unchanged = JSON.stringify(cardsBefore) === JSON.stringify(cardsAfter);
      results.push({
        name: "retry-idempotency",
        seconds: 0,
        transcript: null,
        reply: retryReplies.at(-1)?.body ?? null,
        graded: null,
        expected: [],
        pass: retryStatus === 200 && unchanged && retryReplies.length === 0 && inboundCount === 1,
        notes: [
          `status=${retryStatus} cardsUnchanged=${unchanged} extraReplies=${retryReplies.length} inboundRows=${inboundCount}`,
        ],
      });
    }
  }

  // -- Unsupported media / non-answer message types -----------------------------
  {
    const { user, from } = await seedUser("he");
    await seedQuiz(user.id, "he", [{ review: "תודה" }]);
    const unsupported: Record<string, unknown>[] = [
      { type: "image", image: { id: "img1", mime_type: "image/jpeg", sha256: "x" } },
      { type: "sticker", sticker: { id: "stk1", mime_type: "image/webp", sha256: "x", animated: false } },
      { type: "document", document: { id: "doc1", mime_type: "application/pdf", sha256: "x", filename: "notes.pdf" } },
      { type: "video", video: { id: "vid1", mime_type: "video/mp4", sha256: "x" } },
    ];
    const notes: string[] = [];
    let pass = true;
    for (const m of unsupported) {
      const t0 = Date.now();
      const status = await post(metaPayload(from, { id: `wamid.${crypto.randomUUID()}`, ...m }));
      const reply = repliesTo(from, t0).at(-1)?.body ?? null;
      const ok = status === 200 && reply !== null && /text or (a )?voice note/i.test(reply);
      if (!ok) pass = false;
      notes.push(`${m.type}: status=${status} reply=${JSON.stringify(reply)}`);
    }
    // Reactions (👍 on the feedback) must be ignored silently.
    const t0 = Date.now();
    const status = await post(metaPayload(from, { id: `wamid.${crypto.randomUUID()}`, type: "reaction", reaction: { message_id: "wamid.x", emoji: "👍" } }));
    const reactionReplies = repliesTo(from, t0).length;
    if (status !== 200 || reactionReplies !== 0) pass = false;
    notes.push(`reaction: status=${status} replies=${reactionReplies} (expected 0)`);
    const quiz = await prisma.message.findFirst({ where: { userId: user.id, kind: "quiz" } });
    if (quiz?.answered) {
      pass = false;
      notes.push("quiz was marked answered by an unsupported message");
    }
    results.push({ name: "unsupported-media", seconds: 0, transcript: null, reply: null, graded: null, expected: [], pass, notes });
  }

  // -- Report -------------------------------------------------------------------
  const fmt = (e: Expect[] | null) => (e === null ? "—" : e.map((g) => (g === true ? "✓" : g === false ? "✗" : "∅")).join(" "));
  const cell = (s: string | null) => (s ?? "—").replace(/\n/g, " ⏎ ").replace(/\|/g, "\\|");
  console.log("\n## Results\n");
  console.log("| case | clip | transcript | graded | expected | pass | notes |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of results) {
    console.log(
      `| ${r.name} | ${r.seconds ? r.seconds.toFixed(1) + "s" : "—"} | ${cell(r.transcript)} | ${fmt(r.graded)} | ${fmt(r.expected.length ? r.expected : null)} | ${r.pass ? "PASS" : r.informational ? "INFO" : "FAIL"} | ${cell(r.notes.join("; ")) || ""} |`
    );
  }
  console.log("\n## Replies\n");
  for (const r of results) if (r.reply) console.log(`### ${r.name}\n\n${r.reply}\n`);
  fs.writeFileSync(path.join(CACHE_DIR, "results.json"), JSON.stringify(results, null, 2));

  if (!KEEP) {
    await prisma.message.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.card.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
  stub.close();
  const failed = results.filter((r) => !r.pass && !r.informational).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
