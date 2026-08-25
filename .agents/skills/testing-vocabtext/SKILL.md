---
name: testing-vocabtext
description: How to run and test the VocabText SMS vocab app (Next.js + Prisma/SQLite + Twilio + OpenAI) locally without live Twilio/OpenAI.
---

# Testing VocabText locally

- Setup: `.env` needs `DATABASE_URL="file:./dev.db"`; run `npx prisma migrate dev` and `npx tsx prisma/seed.ts` (118 Spanish words). Start with `npm run dev` (port 3000).
- OpenAI: `src/lib/llm.ts` uses the OpenAI SDK with env `OPENAI_API_KEY` and optional `OPENAI_MODEL`. The SDK also honors `OPENAI_BASE_URL`, so if the OpenAI key has no credits you can point it at any OpenAI-compatible endpoint (e.g. Gemini compat: `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, `OPENAI_MODEL=gemini-2.5-flash`, key = GEMINI_API_KEY).
- Twilio: `src/lib/sms.ts#sendSms` calls Twilio directly and throws without valid creds. For engine tests, temporarily guard the `client.messages.create` call behind `process.env.SMS_STUB === "1"` (log instead of send), run scripts with `SMS_STUB=1`, and revert after. `handleReply` never sends SMS, so `/api/twilio/webhook` grading works without Twilio.
- Webhook: in dev (`NODE_ENV !== production`) the Twilio signature check is skipped — `curl -X POST localhost:3000/api/twilio/webhook -d "From=%2B1555..." -d "Body=hola"` returns TwiML.
- Engine tests: drive `src/lib/engine.ts` (`sendLesson`, `handleReply`, `runHourlyTick`) via `npx tsx` scripts importing `./src/lib/db`; manipulate `user.sendHour/secondSendHour/streak` and `card.due` directly with Prisma to trigger cadence branches for the current local hour.
- Signup UI quirk: typing into the phone input with automation can append rather than replace; clear via native setter + input event if needed.

## Devin Secrets Needed
- `OPENAI_API_KEY` (may be out of credits; fallback `GEMINI_API_KEY` via OPENAI_BASE_URL)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` only for live SMS (not needed with SMS_STUB)
