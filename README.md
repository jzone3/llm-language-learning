# VocabText

Learn a language by answering one text a day. SMS-based vocabulary learning with real spaced repetition (FSRS), LLM-generated example sentences, lenient LLM grading of free-text replies, and an adaptive send cadence.

## How it works

1. User signs up on the landing page with their phone number (SMS code verification).
2. Every morning (default 8am local) they get one SMS: a short quiz of due words (active recall — they type the answer) plus 1–2 new frequency-ordered words with an example sentence.
3. They reply with their answers; an LLM grades leniently (typos/accents/synonyms OK), FSRS reschedules each word, and the reply includes instant feedback + streak.
4. Cadence rules:
   - One morning message per day to start.
   - A second (afternoon) message unlocks only after a 4+ day reply streak.
   - Never double-texts: no new quiz while one is unanswered (waits until next morning).
   - Weekly, an LLM reviews the user's reply timing and adjusts send hour / frequency.

## Stack

- Next.js (App Router) + Tailwind — landing page + API routes
- Prisma + SQLite (swap datasource for prod)
- Twilio — outbound SMS + inbound webhook (`/api/twilio/webhook`)
- OpenAI — sentence generation, grading, cadence optimization
- ts-fsrs — spaced-repetition scheduling
- Hourly cron (`/api/cron/tick`, wired for Vercel Cron in `vercel.json`)

## Setup

```bash
npm install
cp .env.example .env   # fill in keys
npx prisma migrate dev
npx tsx prisma/seed.ts # seed Spanish word list
npm run dev
```

Point your Twilio number's inbound SMS webhook at `POST /api/twilio/webhook` (use ngrok in dev). Trigger `GET /api/cron/tick` hourly (Vercel Cron does this in prod).

### Production notes

- US A2P 10DLC registration is required to send SMS at scale via Twilio.
- Swap the Prisma datasource to Postgres/Turso before deploying to serverless.
