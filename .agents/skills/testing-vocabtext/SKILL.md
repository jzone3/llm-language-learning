---
name: testing-vocabtext
description: How to run and test the VocabText WhatsApp vocab app (Next.js + Prisma/Postgres + Meta WhatsApp Cloud API + OpenAI) locally without live Meta credentials.
---

# Testing VocabText locally

- Setup: start Postgres (`docker run -d --name pg-vocab -e POSTGRES_PASSWORD=pg -p 5433:5432 postgres:16-alpine`, then `docker exec pg-vocab psql -U postgres -c "create database vocabtext"`); `.env` needs `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (both `postgresql://postgres:pg@localhost:5433/vocabtext`) and `OPENAI_API_KEY`; run `npx prisma migrate dev` and `npx tsx prisma/seed.ts` (seeds ~984 words/phrases/slang across 10 languages, Hebrew default). Start with `npm run dev` (port 3000).
- OpenAI: `src/lib/llm.ts` uses the OpenAI SDK with `OPENAI_API_KEY`, optional `OPENAI_MODEL`/`OPENAI_BASE_URL`. Whisper transcription (`transcribeAudio`) needs the real OpenAI API (`/audio/transcriptions`); compat providers often 404 there.
- WhatsApp (Meta Cloud API): `src/lib/whatsapp.ts#sendWhatsApp`/`sendVerifyCode` call the Graph API and throw without `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`. For testing, temporarily guard the fetch behind `process.env.WA_STUB === "1"` (log + still create the Message row), and stub `fetchWhatsAppMedia` to return a local audio file. Revert after.
- Webhook: POST Meta-shaped JSON to `/api/whatsapp/webhook`: `{"entry":[{"changes":[{"value":{"messages":[{"from":"1555...","id":"wamid.x","type":"text","text":{"body":"1. toda"}}]}}]}]}`. Audio replies use `type: "audio"` with `audio: {id, mime_type}`. Signature validation is skipped outside production; sender digits are normalized to `+E.164`.
- Placement flow: `/api/verify` returns a single-use `placementToken`; `/api/placement/start` and `/api/placement/submit` require `{phone, token}`. Placement gates lessons (`placementDone: true` required by cron). Level thresholds: known/total >= 0.7 advanced, >= 0.35 intermediate.
- Voice-note testing without a phone: generate real target-language audio with OpenAI TTS (`/audio/speech`), have the stubbed `fetchWhatsAppMedia` return it, then the webhook audio path transcribes via whisper-1 and grades the transcript.
- Engine tests: drive `src/lib/engine.ts` (`sendLesson`, `handleReply`, `runHourlyTick`, `refreshWordQueue`) via `npx tsx` scripts importing `./src/lib/db`; manipulate `user.sendHour/streak/wordQueue` and `card.due` with Prisma to trigger cadence/queue branches. `npx tsx` loads `.env` only with `--env-file=.env`.
- Lesson format (quiz-only, no header/lesson block): optional `🔥 N-day streak` line (streak >= 2), then numbered questions, then `Reply with your answers (text or voice note).`. Review items: `1. "thank you" in Hebrew?` (answer = term). New items: `3. New — guess the meaning:` / term line / transliteration line / `a) hello  b) bread  c) water` (deterministic per word id via `buildOptions`). `Message.quizItems` stores `QuizItem[]` with `type: "review" | "new"`; new items carry `wordId/options/correctIndex` and have **no Card until graded** (`handleReply` upserts it: Good if guessed right, Again if wrong).
- Feedback format: summary `2/3` (+ 🎉), then one block per item (blocks blank-line separated when any is multi-line). RTL languages put term/transliteration on their own lines. New items add `= <translation>`, example sentence, English sentence (`generateSentence`, called at grading). Grader (`gradeAnswers`) receives `type`, `options`, `correct_letter` per item; accepts letter/option text/paraphrase for new items. A quick mixed test: Hebrew user with 2 due cards + 1 new word, reply `toda, idk, a`.
- Quirks: first post-placement quiz has only new (multiple-choice) items unless placement marked words known. Signup phone input: automation typing may append; clear via native setter + input event.

## Devin Secrets Needed
- `OPENAI_API_KEY` (real OpenAI needed for Whisper; chat can fall back to a compat provider via `OPENAI_BASE_URL`)
- `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_APP_SECRET` / `WHATSAPP_VERIFY_TOKEN` only for live Meta sends (not needed with WA_STUB)
