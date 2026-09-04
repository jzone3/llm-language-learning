# VocabText

Learn a language by answering one WhatsApp message a day. WhatsApp-only vocabulary learning (words, phrases, and slang) with real spaced repetition (FSRS), LLM-generated example sentences, lenient LLM grading of text or voice-note replies, a website placement test, and an adaptive send cadence.

## How it works

1. User signs up on the landing page: pick a language (10 supported — Hebrew, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Mandarin, Russian), enter a phone number, verify via a WhatsApp code.
2. A quick placement quiz on the website: up to 10 multiple-choice questions, one at a time (pick the English meaning of items sampled across the frequency list, or skip if brand new). It sets the level (beginner/intermediate/advanced) and marks known items as already-learned cards so lessons never reteach them.
3. Every morning (default 8am local) they get one WhatsApp message: a short quiz of due items (active recall) plus 1–2 new items — a curated mix of high-frequency words, everyday phrases, and common slang, with transliteration for non-Latin scripts.
4. They reply by text **or voice note** (transcribed with Whisper, then graded the same way); an LLM grades leniently (typos/accents/transliterations/synonyms OK), FSRS reschedules each item, and the reply includes instant feedback + streak.
5. Cadence rules:
   - One morning message per day to start.
   - A second (afternoon) message unlocks only after a 4+ day reply streak.
   - Never double-texts: no new quiz while one is unanswered (waits until next morning).
   - Weekly, an LLM reviews reply timing and adjusts send hour / frequency, **and** reviews quiz performance to pick next week's new words/phrases/slang (stored as a per-user queue) instead of pure frequency order.

## Stack

- Next.js (App Router) + Tailwind — landing page, placement test, API routes
- Prisma + Postgres (Neon via Vercel Marketplace in prod; any Postgres locally, e.g. `docker run -e POSTGRES_PASSWORD=pg -p 5432:5432 postgres:16`)
- Meta WhatsApp Cloud API — outbound messages (`src/lib/whatsapp.ts`) + inbound webhook (`/api/whatsapp/webhook`) with verify-token handshake and X-Hub-Signature-256 validation
- OpenAI — sentence generation, grading, weekly word picking, cadence optimization, Whisper transcription
- ts-fsrs — spaced-repetition scheduling
- Hourly cron (`/api/cron/tick`, wired for Vercel Cron in `vercel.json`)

## Setup

```bash
npm install
cp .env.example .env   # fill in keys (DATABASE_URL must point at a Postgres DB)
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
- Deploy: Vercel project linked to this repo with a Neon Postgres store attached (injects `DATABASE_URL` / `DATABASE_URL_UNPOOLED`); `vercel.json` runs `prisma migrate deploy` and the idempotent word-list seed during build, so edits to `src/lib/words.ts` ship on the next deploy. Set `OPENAI_API_KEY`, `WHATSAPP_*`, `CRON_SECRET` as project env vars. Deployment protection must be off so Meta can reach the webhook.

### Going live

Moving from the Meta test number to a real production WhatsApp Business number (phone number, business verification, billing, utility template for the daily quiz, permanent token, webhook, Live mode): follow [docs/going-live.md](docs/going-live.md) step by step.
