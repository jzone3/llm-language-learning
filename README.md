# VocabText

Learn a language by answering one WhatsApp message a day. WhatsApp-only vocabulary learning (words, phrases, and slang) with real spaced repetition (FSRS), LLM-generated example sentences, lenient LLM grading of text or voice-note replies, a website placement test, and an adaptive send cadence.

## How it works

1. User signs up on the landing page: pick a language (10 supported — Hebrew, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Mandarin, Russian), enter a phone number, verify via a WhatsApp code.
2. A quick placement test on the website (type the English meaning of ~12 items sampled across the frequency list, or skip if brand new). An LLM grades it, sets the level (beginner/intermediate/advanced), and marks known items as already-learned cards so lessons never reteach them.
3. Every morning (default 8am local) they get one WhatsApp message: a short quiz of due items (active recall) plus 1–2 new items — a curated mix of high-frequency words, everyday phrases, and common slang, with transliteration for non-Latin scripts.
4. They reply by text **or voice note** (transcribed with Whisper, then graded the same way); an LLM grades leniently (typos/accents/transliterations/synonyms OK), FSRS reschedules each item, and the reply includes instant feedback + streak.
5. Cadence rules:
   - One morning message per day to start.
   - A second (afternoon) message unlocks only after a 4+ day reply streak.
   - Never double-texts: no new quiz while one is unanswered (waits until next morning).
   - Weekly, an LLM reviews reply timing and adjusts send hour / frequency, **and** reviews quiz performance to pick next week's new words/phrases/slang (stored as a per-user queue) instead of pure frequency order.

## Stack

- Next.js (App Router) + Tailwind — landing page, placement test, API routes
- Prisma + SQLite (swap datasource for prod)
- Meta WhatsApp Cloud API — outbound messages (`src/lib/whatsapp.ts`) + inbound webhook (`/api/whatsapp/webhook`) with verify-token handshake and X-Hub-Signature-256 validation
- OpenAI — sentence generation, grading, placement grading, weekly word picking, cadence optimization, Whisper transcription
- ts-fsrs — spaced-repetition scheduling
- Hourly cron (`/api/cron/tick`, wired for Vercel Cron in `vercel.json`)

## Setup

```bash
npm install
cp .env.example .env   # fill in keys
npx prisma migrate dev
npx tsx prisma/seed.ts # seed all 10 language lists
npm run dev
```

### WhatsApp Cloud API setup

1. Create a Meta app at developers.facebook.com with the WhatsApp product; grab the access token, phone number ID, and app secret into `.env`.
2. Configure the webhook: callback URL `https://<host>/api/whatsapp/webhook`, verify token = your `WHATSAPP_VERIFY_TOKEN`, subscribe to the `messages` field.
3. In dev, use ngrok for the callback URL and the temporary access token + test number Meta provides.

### Production notes

- Business-initiated sends outside the 24h reply window require an approved WhatsApp message template (Meta business verification needed). The daily lesson will need a template once users stop replying within 24h; user-initiated replies keep the window open.
- The first 1,000 service conversations per month are free on the Cloud API.
- Swap the Prisma datasource to Postgres/Turso before deploying to serverless.
