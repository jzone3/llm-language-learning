# Going live: from Meta's test number to a production WhatsApp Business number

Follow this top to bottom. Every step says which page to open, what to click, what to paste where, and how to check it worked. Doc links are to Meta's official pages (checked September 2026 — Meta renames menus often; where a label may differ, the intent is given so you can find the equivalent).

**Where we start (test setup)**

| | Now (test) | After (production) |
|---|---|---|
| Meta app | `1434430461913022`, Development mode | same app, Live mode |
| Number | `+1 555-661-4386` (Meta test number) | a number you own |
| Token | temporary 24h user token from *API Setup* | permanent System User token |
| Recipients | 5-number allow list | anyone who opted in (250 unique users / 24h until verified) |
| Morning quiz | free-form text | approved UTILITY template (`WHATSAPP_QUIZ_TEMPLATE`) |
| Webhook | ngrok / dev URL | `https://vocabtext-jaredzoneraich-7255s-projects.vercel.app/api/whatsapp/webhook` |

**What changes in the app**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and (new) `WHATSAPP_QUIZ_TEMPLATE` (+ optional `WHATSAPP_QUIZ_TEMPLATE_LANG`). `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN` stay the same because the Meta *app* does not change. Nothing else in the codebase needs to change.

**Order matters.** Steps 1 → 7 are sequential (you can start business verification (2) right after adding the number (1) and do 3–6 while you wait). Budget: an afternoon of clicking plus up to ~2 weeks of waiting on Meta (business verification, template review, display-name review).

Terminology used throughout:
- **Business portfolio** (formerly "Business Manager" / "Business account"): the top-level Meta business entity at business.facebook.com.
- **WABA** = WhatsApp Business Account, lives inside the portfolio. Your app (`1434430461913022`) is connected to a WABA already (the one that holds the test number).
- **WhatsApp Manager**: business.facebook.com/wa/manage — where phone numbers, templates, billing, quality live.
- **App Dashboard**: developers.facebook.com/apps/1434430461913022 — where webhooks, app mode, app settings live.

---

## 1. Get a production phone number

Docs: [Business phone numbers](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers) · [Registration](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration) · [Help Center: connect your phone number](https://www.facebook.com/business/help/456220311516626) · [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names/)

### 1.1 Number requirements

From the [phone numbers doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers), the number must:

- be owned by you;
- have a country code and area code (short codes are not supported);
- be able to receive **a voice call or SMS** (that is how Meta verifies it — one time, at registration);
- **not be active on consumer WhatsApp or the WhatsApp Business app.** "Numbers already in use with WhatsApp cannot be registered unless they are deleted first." Once registered to the Cloud API it can still be used for normal calls/SMS, but never again in the WhatsApp phone app while it's on the platform.

Which numbers work (Meta's own table, same doc, "Business phone number types"):

| Type | SMS code | Voice code | Notes |
|---|---|---|---|
| Mobile / SIM | Standard | Standard | **Recommended.** Cheapest reliable option: a prepaid SIM you keep in a drawer. |
| Fixed line (landline) | Not recommended | Standard | Works — choose **voice call** verification. Disable call forwarding / IVR menus first. |
| Toll-free / 1-800 | Not recommended | Standard | Voice call only; confirm with the carrier that it accepts calls from international/automated origins and has no IVR. |
| VoIP (Google Voice, Twilio, etc.) | Not recommended | Standard | *May* work via voice call if the provider passes the call through and doesn't front it with a menu. Meta's guidance: "Confirm that the VoIP provider supports international SMS/calls for OTPs". Twilio numbers are commonly used and generally receive the call; Google Voice is hit-or-miss. If you go VoIP, choose **voice** and answer immediately. |
| Shared-cost, personal, pager, M2M | Not recommended / unsupported | | Don't. |

Practical recommendation: a real mobile number (new SIM or eSIM) in your name. Do *not* use your personal WhatsApp number unless you're willing to lose consumer WhatsApp on it.

### 1.2 If the number is already on WhatsApp: delete that account first

On the phone that has WhatsApp for that number: **WhatsApp → Settings → Account → Delete my account** → enter the number → *Delete my account*. This wipes that account's history and groups. Wait a few minutes before registering it on the platform. (Cloud API requirement stated in the [phone numbers doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers); the account-deletion steps are in the WhatsApp Help Center under *Delete your account*.) A banned number must be appealed/unbanned before it can be registered.

### 1.3 Add the number in WhatsApp Manager

Per [How to connect your phone number](https://www.facebook.com/business/help/456220311516626):

1. Go to https://business.facebook.com/ → pick your business portfolio (top-left switcher).
2. **All tools → Engage customers → WhatsApp Manager** (or go straight to https://business.facebook.com/wa/manage/home/).
3. Select the WhatsApp Business account that your app uses (the one showing the `+1 555-661-4386` test number).
4. Left menu → **Account tools → Phone numbers** → **Add phone number**.
5. *Business profile*: enter the **WhatsApp display name** (see 1.5 — use `VocabText`) and pick a **category** (Education). *Next*.
6. Enter the phone number with country code and choose **Text message** (SIM) or **Phone call** (landline/VoIP/toll-free). *Next*.
7. Enter the 6-digit code you received. *Next*.
8. The number appears in the Phone numbers list. Status should become **Connected** (may show *Pending* for a few minutes).

Alternative route that does the same thing: App Dashboard → **WhatsApp → API Setup → "Add phone number"** (documented as a registration method in the [phone numbers doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers#registration-methods)). Either is fine; the App Dashboard route also registers the number for Cloud API (step 1.4) automatically in most cases.

Two-step verification: Meta requires a **6-digit two-step PIN** on every registered number. WhatsApp Manager asks for it during add-number; if it doesn't, set one at Phone numbers → your number → **Settings (gear) → Two-step verification**. Write the PIN down — you need it to change or delete the number later.

### 1.4 Register the number for the Cloud API (only if status isn't "Connected")

If you added the number through WhatsApp Manager and Phone numbers shows it as *Pending*/*Offline*, or the API returns "phone number not registered", call the register endpoint ([Registration doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration)):

```bash
curl -X POST "https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>/register" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"<YOUR_6_DIGIT_PIN>"}'
# expect: {"success":true}
```

(`<TOKEN>` can be the temporary token for now; you'll replace it in step 6. Use the current Graph version shown at the top of the docs — v26.0 at time of writing.)

### 1.5 Display name

- Guidelines: [Help Center display name guidelines](https://www.facebook.com/business/help/338047025165344) and the [display names doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names/). Must reflect your business/brand, no generic words alone, no "WhatsApp", proper capitalisation, min 3 chars. `VocabText` is fine.
- Meta's current rule (Help Center, note at the end of [connect your phone number](https://www.facebook.com/business/help/456220311516626)): *"Display name review will no longer be needed to get started… Display name review will be initiated after the business verification is completed."* So you can send right away; the name gets reviewed automatically once step 2 is done, and once **approved** it shows at the top of the chat instead of the raw phone number.
- Check status: Phone numbers list → *Name status* column, or via API:

```bash
curl "https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>?fields=verified_name,name_status,status,quality_rating" \
  -H "Authorization: Bearer <TOKEN>"
# name_status: APPROVED | PENDING_REVIEW | DECLINED | AVAILABLE_WITHOUT_REVIEW ...
```

### 1.6 Get the new Phone Number ID (this is `WHATSAPP_PHONE_NUMBER_ID`)

- App Dashboard → **WhatsApp → API Setup** → in the *From* dropdown pick the **new** number → copy **Phone number ID** (a 15–17 digit number; *not* the phone number and *not* the WABA ID shown next to it).
- Or WhatsApp Manager → Phone numbers → click the number → the ID is shown in the details panel.

**Also copy the WhatsApp Business Account ID** shown on the same API Setup page — you'll need it for the template API call in step 4 and the asset assignment in step 6.

Verify: `curl "https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>" -H "Authorization: Bearer <TOKEN>"` returns `{"verified_name":"VocabText","display_phone_number":"...","id":"<PHONE_NUMBER_ID>", ...}` with your real number.

Don't change the Vercel env var yet — do that in step 6 together with the new token, so you never have a mismatched token/number pair in production.

---

## 2. Verify the business portfolio (and understand messaging limits)

Docs: [How to verify your business](https://www.facebook.com/business/help/2058515294227817) · [Business verification for developers](https://developers.facebook.com/docs/development/release/business-verification) · [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)

### 2.1 Why

- **Messaging limit.** "Newly created business portfolios have a messaging limit of 250" unique recipients per rolling 24h *outside* customer-service windows ([messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)). Limits are per **portfolio** (shared across all your numbers), not per number. Verification is the quickest of the three "scaling paths" to **2,000**; after that Meta auto-scales to 10k → 100k → unlimited within 6 hours whenever (a) quality is high across your templates and (b) you've used ≥ 50 % of the current limit in the last 7 days.
  - For VocabText: 250 = the number of *distinct learners* you can send the morning quiz to per day while their 24h window is closed (which is most of them). Below 250 learners you technically don't need verification for volume — but see the next two bullets.
- **Display name approval** is only triggered after verification (step 1.5).
- **Unverified restrictions** you'll actually hit: messaging limit stuck at 250; display-name review not started (learners see a bare phone number); no Official Business Account / green tick eligibility; some Business Support tooling gated. Sending templates, adding a payment method, and Live mode do **not** require verification for a direct developer using your own WABA ([release doc](https://developers.facebook.com/docs/development/release/): "verification is not required to Go Live").

The other two scaling paths, if verification is rejected: (1) have a Solution Partner verify you (n/a), or (2) send 2,000 delivered template messages to unique users outside CSWs within a moving 30-day window with high quality — impossible to do quickly under a 250/day cap with a few learners, so verify.

### 2.2 What you need (prepare before you click)

From the [Help Center article](https://www.facebook.com/business/help/2058515294227817):

- **Full control** of the business portfolio (you, as its creator, have it).
- Legal business name, address, phone number, **website that loads over HTTPS** and visibly belongs to the business. The VocabText Vercel URL works if the site shows the business/brand name; a custom domain is better.
- Business details must **exactly match** your legal entity. If Meta can't auto-match, you upload documents. Commonly accepted (varies by country — Meta's list is in *About business verification*, linked from the article): business licence / certificate of incorporation or formation, articles of incorporation, tax registration (EIN letter for US LLCs), bank statement or utility bill showing name + address.
- If you're a sole proprietor without an entity, verification is materially harder; a tax document with your DBA/trade name and address is the usual route.
- A way to confirm the connection: email at the business domain, phone, SMS, WhatsApp message, or **domain verification** (meta tag / DNS TXT). Domain verification is the least flaky if you own the domain.

### 2.3 Steps

1. https://business.facebook.com/ → select the portfolio → **Settings** (gear, bottom-left) → **Security Center** (direct: https://business.facebook.com/settings/security).
2. Under *Business verification*, click **Start verification**. If the button says **Ineligible for verification**, instead go to App Dashboard → **App settings → Basic** → *Business verification* → **Start verification** (the developer entry point, per the [developer business-verification doc](https://developers.facebook.com/docs/development/release/business-verification)); Meta may also email you a dedicated link.
3. Choose the portfolio, enter legal name / address / phone / website exactly as on your documents.
4. Confirm the matching record, or **My business isn't listed** → upload documents.
5. Choose a confirmation method (email / phone / SMS / WhatsApp / domain). Complete it. **Done**.
6. Verify submission: Security Center shows *Business verification: In review*.

**Turnaround**: Help Center says "may take up to 14 business days"; in practice small businesses with clean documents often clear in 1–3 days. You get an email + Security Center status. Editing business details afterwards **restarts** verification.

If rejected: Security Center shows the reason and a **Resubmit** / appeal option; the usual fixes are document/name mismatch or a website that doesn't show the business name.

Check your limit any time: WhatsApp Manager → Overview → *Messaging limit*, or `GET /<WABA_ID>?fields=...` — the field is now `whatsapp_business_manager_messaging_limit` (the old `messaging_limit_tier` is deprecated).

---

## 3. Billing: add a payment method + how pricing works

Docs: [Add a credit card to your WhatsApp Business Platform account](https://www.facebook.com/business/help/488291839463771) · [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [Non-template (service) messages pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages) · [Template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization/)

### 3.1 Pricing model (as of September 2026)

Meta charges **per delivered message**, by message category and recipient country ([pricing doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)):

| Category | What it is | Charged? |
|---|---|---|
| **Utility** template | Follow-up to a user action/request, non-promotional — *our daily quiz* | Yes, per delivered message outside a CSW. Free when sent **inside** an open CSW until **Oct 1, 2026**; charged always after that. |
| **Marketing** template | Promotional / re-engagement | Yes, highest rate |
| **Authentication** template | OTP codes — *our signup code* (`WHATSAPP_VERIFY_TEMPLATE`) | Yes |
| **Service** (any non-template message: `type: text`, `image`, …) — *our grading replies and word images* | Can only be sent inside an open 24h **customer-service window (CSW)**, which opens/resets each time the *user* messages you | Free since Nov 2024; **charged per message from Oct 1, 2026** ([non-template pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)) |

Key rules:
- **Inbound messages are always free.** A learner's reply opens a 24h CSW.
- **Templates are the only thing you can send outside a CSW.** That's why the morning quiz needs a template (step 4). Everything we send *in response* to a reply (grading, reveal, image) is a service message inside the window.
- **Free entry point window**: 72h of free messages (including templates) when a user starts a chat via a Click-to-WhatsApp ad or Facebook Page CTA. Not our case.
- **The old "1,000 free service conversations per month" tier no longer exists** — pricing is per message now; the README's line about it is historical.
- **Volume tiers** lower utility/authentication rates as monthly volume grows.
- **Rate card**: the doc's *Rate cards and volume tiers* section links per-currency CSV/PDF rate cards, also interactive at https://business.whatsapp.com/products/platform-pricing. Rates are per country of the *recipient*. For a US learner, utility is on the order of a few US cents per delivered message; check the live card, Meta may change rates on the 1st of any quarter with ≥ 1 month notice.

Rough VocabText cost: 1 utility template per learner per day (+ a second one on streak-unlocked afternoons) + service replies after Oct 2026. At a few cents each, 100 daily-active learners ≈ low tens of dollars/month.

### 3.2 Deadline that matters

From [non-template pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages): *"For any … directly-integrated businesses that does not have a payment method on file by September 30, 2026, Meta will stop delivering service messages as of when they become charged on October 1, 2026."* Our grading replies are service messages. **Add a card now.**

### 3.3 Add the payment method

Per the [Help Center article](https://www.facebook.com/business/help/488291839463771) (Visa/Mastercard only; no Amex/PayPal; you may be asked for tax info):

1. WhatsApp Manager → **Overview** (https://business.facebook.com/wa/manage/home/).
2. Find your WhatsApp Business account → click the **⋯ (3-dot)** icon → **Manage account settings**.
3. **Settings** tab → **Payment settings** → opens *Billing & payments*.
4. **Add payment method** → follow prompts → **Add your business information** (legal name, address, tax ID if asked) → *Save* → card details → *Save*.
5. Set the **billing currency/timezone** when prompted; it cannot be changed later.

Verify: the *Settings* tab now lists the card, and WhatsApp Manager → Overview no longer shows a "Add payment method" warning. Optional: Billing & payments → **Payment threshold / spending limit** to cap monthly spend.

---

## 4. Create the UTILITY template for the daily quiz

Docs: [Help Center: create message templates](https://www.facebook.com/business/help/2055875911147364) · [Template components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/) · [Utility templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates/) · [Template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization/) · [Template review](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review/) · [Template media](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-media/) · [Template pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/)

### 4.1 Why the morning quiz needs a template

The cron sends the quiz at 8am local. The learner's last reply was usually to *yesterday's* quiz — 20-plus hours ago — and often longer. Anything sent > 24h after the learner's last message is rejected by the API (error `131047`, "Re-engagement message") unless it's an approved template. Templates are "the only message type that can be sent outside of a customer service window" ([pricing doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). Grading replies, the reveal, and word images are sent right after the learner replies, so they're inside the window and stay free-form.

### 4.2 Category rules — how to stay UTILITY

From [template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization/), a utility template must meet **both**:

1. Non-promotional, no persuasive intent.
2. Specific to / requested by the user (their account, service, subscription) **or** essential to them.

A daily quiz the learner explicitly subscribed to on the website is a "scheduled service the user requested" — utility. What flips it to **marketing** (Meta re-categorises automatically at review or later in production, and marketing costs several times more):

- Bodies that are *only* a placeholder or unclear: the doc literally cites `{{1}}` and "Congratulations!" as marketing-by-default. So **wrap the variable in fixed text** that explains what it is.
- Any upsell / "invite a friend" / "upgrade" / "don't miss" / discount language.
- Mixed content (utility + a promo line).
- Templates that start or end with a parameter ("dangling parameters") are **rejected** ([review doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review/)).
- Too many variables relative to text; non-sequential `{{n}}`; `#`, `$`, `%` inside braces; duplicate body+footer of an existing template.

Other hard limits ([components doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/)): body ≤ **1024 characters** (including the filled-in variable at send time), text header ≤ 60, footer ≤ 60, button text ≤ 25, name = lowercase letters/digits/underscores ≤ 512. **Parameter values cannot contain newlines, tabs, or 5+ consecutive spaces** — the API rejects the send with "Param text cannot have new-line/tab characters or more than 4 consecutive spaces". This is why `engine.ts` flattens the quiz to one line with ` | ` separators when sending through a template (`templateParamText` in `src/lib/whatsapp.ts`). Line breaks in the *fixed* template text are fine.

### 4.3 Can the template carry an image header? (Yes — details)

Per [template media](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-media/) and [utility templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates/):

- Utility templates support **1 optional header of any type**, including **IMAGE** (also video, document, location, text).
- **At creation** you must supply a *sample* image, uploaded via the Resumable Upload API (WhatsApp Manager does this for you when you click *Add sample* → *Choose file*). The sample is only for reviewers; it is **not** what gets sent.
- **At send time the image is dynamic per message**: the header component carries either `image.link` (a **publicly reachable HTTPS URL**, e.g. the generated picture in Vercel Blob/S3) or `image.id` (a media ID from `POST /<PHONE_NUMBER_ID>/media`). Meta recommends **uploading and using the ID** "to reduce the likelihood of errors and avoid unnecessary requests to your public server". `link` must be fetchable by Meta without auth; failures = message not sent.
- Formats/limits ([media doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media)): `image/jpeg` and `image/png`, **≤ 5 MB**, 8-bit RGB/RGBA. No WebP for images (WebP is stickers), no GIF as image. Aspect ratio isn't enforced but wide/landscape (~1.91:1) renders best as a header; square is cropped in the bubble preview.
- Media header + text body + quick-reply buttons can coexist in one utility template.

**For VocabText**: PR #15 sends the generated word picture *after grading*, at the reveal — inside the 24h window as a plain image message, so **no template image header is needed for the current product**. Draft A below is therefore text-only. Draft B keeps an image header so it's ready if you ever want a picture *with* the morning quiz (e.g. a fixed brand banner, or a picture that doesn't give away the answer). `sendTemplate()` already accepts a header component (`{ type: "header", parameters: [{ type: "image", image: { link } }] }`); wiring an image into the morning send is a deliberate product change, not a config flag.

### 4.4 Quick-reply buttons for a/b/c?

Allowed: utility templates support up to 10 buttons including **Quick reply** (max 25 chars each) ([utility templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates/)). A tap comes back as a webhook message with `type: "button"` and `button.payload` / `button.text` ([button webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/button)).

But: a quiz has up to 4 questions, each with its own a/b/c, and buttons are per *message*, not per question; one tap also only answers one thing. And **our webhook currently handles `text` and `audio` only** — a `button` message would be ignored. So: **don't add buttons** to the daily quiz template. Learners type `1. shalom 2. b 3. toda` or send a voice note, which is what the grader expects. (If you later want a single "Skip today" quick reply, that needs a small parser change in `src/app/api/whatsapp/webhook/route.ts`.)

### 4.5 Create the template in WhatsApp Manager (click-by-click)

Per the [Help Center article](https://www.facebook.com/business/help/2055875911147364):

1. WhatsApp Manager → your account → **⋯ → Manage message templates** (or left menu **Account tools → Message templates**; direct: https://business.facebook.com/wa/manage/message-templates/).
2. **Create template** (top right).
3. **Category: Utility.** Leave *"Allow category change"* **checked** — if Meta thinks it's marketing it will approve-as-marketing instead of rejecting; you then see the category in the list and can fix wording and resubmit as utility. (If you'd rather be rejected than silently pay marketing rates, uncheck it.)
4. **Name**: `vocabtext_daily_quiz` (lowercase, digits, underscores). **Language: English** → note the exact code Meta shows (`en` vs `en_US`) — it must match `WHATSAPP_QUIZ_TEMPLATE_LANG` exactly or every send fails with template-not-found. *Continue*.
5. **Header**: *None* for Draft A; *Media → Image* for Draft B.
6. **Body**: paste the body from the draft. Use the `+ Add variable` button (or type `{{1}}`) so Meta registers the variable.
7. Click **Add sample** (a link/button under the body; it may appear as "Add sample content" or as a *Samples for body content* panel). Paste the sample value from the draft. For Draft B also upload the sample PNG. The preview pane should render the message.
8. **Footer** (optional): `Reply STOP to pause messages.` — supported, ≤ 60 chars, harmless for utility classification and helps quality (it tells people how to opt out instead of blocking you).
9. **Buttons**: none.
10. **Submit** (button may read *Submit for review*).

Verify: template list shows `vocabtext_daily_quiz` with status **In review** → then **Active – Quality pending** (API: `APPROVED`). Approval "can take up to 24 hours" ([review doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review/)); simple utility text templates often approve in minutes. You also get an email and a `message_template_status_update` webhook (not subscribed by our app — that's fine). Rejections show a reason in the list and under Business Support Home → your WABA → *Rejected message templates*; fix and **Edit → Submit** again, or **Appeal**.

Alternatively, create it via API (same result; useful for re-creating in another WABA):

```bash
curl -X POST "https://graph.facebook.com/v26.0/<WABA_ID>/message_templates" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "name": "vocabtext_daily_quiz",
  "language": "en",
  "category": "UTILITY",
  "allow_category_change": true,
  "components": [
    {
      "type": "BODY",
      "text": "☀️ VocabText — your daily quiz is ready.\n\n{{1}}\n\nReply with your answers as a text or a voice note. Your results and today's new words come right back.",
      "example": { "body_text": [[ "🔥 3-day streak | 1. \"thank you\" in Hebrew? | 2. \"good morning\" in Hebrew? | 3. New — guess the meaning: | לחם | lechem | a) bread b) water c) house" ]] }
    },
    { "type": "FOOTER", "text": "Reply STOP to pause messages." }
  ]
}
JSON
# expect: {"id":"<TEMPLATE_ID>","status":"PENDING","category":"UTILITY"}
```

### 4.6 Template drafts (copy exactly)

The `{{1}}` value is what `engine.ts` produces: the quiz block (streak marker if ≥ 2 days, numbered free-recall questions for due words and, with PR #15, guess-first `a) b) c)` questions for new words — `🔥 3-day streak / 1. "thank you" in Hebrew? / 3. New — guess the meaning: / לחם / lechem / a) bread b) water c) house`) with line breaks replaced by ` | `. The fixed template text supplies the "what is this / what to do" wrapper so the body isn't a bare placeholder, and it never starts or ends with the variable. When PR #15's `formatQuiz` lands, pass its output *without* its closing "Reply with your answers…" line as the parameter — the template already says it.

**Draft A — text only (use this one)**

| Field | Value |
|---|---|
| Name | `vocabtext_daily_quiz` |
| Category | Utility |
| Language | English (`en`) |
| Header | none |
| Body | `☀️ VocabText — your daily quiz is ready.`<br><br>`{{1}}`<br><br>`Reply with your answers as a text or a voice note. Your results and today's new words come right back.` |
| Sample for `{{1}}` | `🔥 3-day streak \| 1. "thank you" in Hebrew? \| 2. "good morning" in Hebrew? \| 3. New — guess the meaning: \| לחם \| lechem \| a) bread b) water c) house` |
| Footer | `Reply STOP to pause messages.` |
| Buttons | none |

Rendered sample (what reviewers see):

> ☀️ VocabText — your daily quiz is ready.
>
> 🔥 3-day streak | 1. "thank you" in Hebrew? | 2. "good morning" in Hebrew? | 3. New — guess the meaning: | לחם | lechem | a) bread b) water c) house
>
> Reply with your answers as a text or a voice note. Your results and today's new words come right back.
>
> _Reply STOP to pause messages._

**Draft B — image header (only if you decide to send a picture with the morning quiz)**

| Field | Value |
|---|---|
| Name | `vocabtext_daily_quiz_img` |
| Category | Utility |
| Language | English (`en`) |
| Header | Media → **Image**; sample: upload any 1200×628 PNG/JPEG < 5 MB (e.g. a VocabText banner or one generated word picture) |
| Body | `Here's today's VocabText quiz. Answer from memory, then check the picture and your results in the reply.`<br><br>`{{1}}`<br><br>`Reply by text or voice note.` |
| Sample for `{{1}}` | `1. "water" in Spanish? \| 2. "thank you" in Spanish? \| 3. New — guess the meaning: \| perro \| a) cat b) dog c) bird` |
| Footer | `Reply STOP to pause messages.` |
| Buttons | none |

Send-time components for Draft B (what `sendTemplate` posts): `[{ type: "header", parameters: [{ type: "image", image: { link: "https://<public>/word.png" } }] }, { type: "body", parameters: [{ type: "text", text: "<flattened quiz>" }] }]`.

Wording to avoid in either draft (all pushed reviewers toward marketing in Meta's published examples): "Don't miss", "Keep your streak going!", "Upgrade", "Invite", "Only today", any emoji flood beyond one or two.

### 4.7 Wire it into the app

In Vercel (step 6.5) set `WHATSAPP_QUIZ_TEMPLATE=vocabtext_daily_quiz` and, if Meta assigned `en_US` rather than `en`, `WHATSAPP_QUIZ_TEMPLATE_LANG=en_US`. Until the env var is set, `sendLesson` keeps sending free-form text (which will fail with `131047` for anyone whose window is closed).

Test without touching learners: send the template to yourself from the terminal (this is a real utility send — a fraction of a cent):

```bash
curl -X POST "https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"<YOUR_NUMBER_E164_NO_PLUS>","type":"template",
       "template":{"name":"vocabtext_daily_quiz","language":{"code":"en"},
       "components":[{"type":"body","parameters":[{"type":"text","text":"🔥3 | 1. \"thank you\" in Hebrew? | 2. \"good morning\" in Hebrew?"}]}]}}'
```

Expect `{"messaging_product":"whatsapp","contacts":[...],"messages":[{"id":"wamid...","message_status":"accepted"}]}` and the message on your phone within seconds. `132001` = "template does not exist in the specified language or has not been approved" (check the language code and status); `132012` = parameter values formatted incorrectly (usually a newline in the text); `131047` (24h re-engagement) cannot happen for templates. Full list: [error codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes).

---

## 5. Switch the Meta app from Development to Live

Docs: [App modes](https://developers.facebook.com/docs/development/build-and-test/app-modes/) · [Publishing / Go live](https://developers.facebook.com/docs/development/release/) · [Basic settings](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings/) · [Data deletion](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback) · [WhatsApp permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/)

### 5.1 Do you need App Review? No.

The [permissions doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/) is explicit: *"If you are a direct developer and only access your own business data, you do not need to undergo App Review or obtain Advanced access for any permissions."* Advanced Access for `whatsapp_business_management` is only required when your app manages **WABAs your business doesn't own** (partners/Embedded Signup). VocabText messages from a number your own business owns, using a System User token from the same portfolio (step 6) — **Standard Access** on `whatsapp_business_messaging` and `whatsapp_business_management` is sufficient. Don't submit an App Review; it will just cost you a week.

### 5.2 Do you need Live mode? Yes (for webhooks), and it's a toggle.

From [app modes](https://developers.facebook.com/docs/development/build-and-test/app-modes/): Development mode limits the app to **role users** (admins/developers/testers). Meta's webhook troubleshooting says *"Make sure your app is in Live mode; some webhooks will not be sent if your app is in Dev mode"* ([set up webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)). Meta doesn't spell out which ones; developers commonly report inbound `messages` webhooks from non-role users being dropped in Dev mode, which for us means learners' replies would vanish. Switch to Live before real users sign up. (The 5-recipient allow list is a property of the *test* number, not of Dev mode — it goes away as soon as you send from the production number.)

Note: if your dashboard has **no** Development/Live toggle in the top bar, the app is a "Business"-type app that "does not have app modes and relies exclusively on access levels" ([release doc](https://developers.facebook.com/docs/development/release/)) — then there's nothing to switch and you can skip to step 6.

### 5.3 Prerequisites (Meta blocks the toggle until these are filled)

App Dashboard → **App settings → Basic** (https://developers.facebook.com/apps/1434430461913022/settings/basic/). Required to go Live per [basic settings](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings/):

| Field | What to enter |
|---|---|
| Display name | `VocabText` |
| App icon | 1024×1024 PNG, no Meta/Facebook branding. Use the site favicon/logo. |
| Contact email | your address (Meta sends developer alerts — e.g. template paused, token issues — here) |
| Privacy policy URL | public HTTPS page. Add `/privacy` to the Next.js site (what data: phone number, language, answers, voice-note transcripts; OpenAI processing; retention; contact). Must load without auth. |
| Terms of service URL | public HTTPS page (`/terms`). Short is fine. |
| User data deletion | choose **Data deletion instructions URL** → a page/section (can be an anchor in the privacy policy) saying: *"Reply STOP to stop messages; to delete your account and all data, email … from the phone's owner and we delete it within 30 days."* (the app has no DELETE keyword — don't promise one). A callback URL is the alternative and is not needed. |
| Category | **Education** |
| App purpose | *Yourself or your own business* |
| Business verification | shows the portfolio's status; not required for Live (step 2 can still be pending). |

**Save changes** (bottom right).

### 5.4 Flip the toggle

Top bar of the App Dashboard → the **App Mode: Development** switch → toggle to **Live** → confirm. If the toggle is disabled, hover it: the tooltip names the missing Basic-settings field.

Verify: top bar shows **Live**. Behavior differences you'll notice:

- The **test number's** recipient allow-list stops mattering (it applies to the *test* number only; your production number never had one — its limit is the 250/24h from step 2).
- Webhooks are delivered for all senders, not just role users.
- **Signature validation**: nothing changes — our webhook already validates `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` in production. The app secret does not rotate when you switch modes. (Do **not** click *Reset* on the App secret unless you're ready to update Vercel at the same time.)

---

## 6. Permanent System User access token + Vercel env update

Docs: [Access tokens](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/) (section "Generate system user access tokens")

The token from *API Setup* expires after 24h — the cron would die daily. A **System User** token is long-lived (never expires if you choose so) and represents the business rather than you.

### 6.1 Create the system user

1. https://business.facebook.com/settings/ → make sure the right portfolio is selected (top-left).
2. Left menu: **Users → System users** (direct: https://business.facebook.com/settings/system-users).
3. **Add** → *Create system user*: name `vocabtext-server`, role **Admin** (Admin system users have "full access to all WABAs … owned by … your business portfolio", so you won't have to re-grant when you add a number later — [access tokens doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/)). *Create system user*.

### 6.2 Assign assets

1. Click the new system user → **Assign assets** (button top right of its panel).
2. Left column **Apps** → tick your Meta app (`1434430461913022`, name shown as in App Dashboard) → on the right enable **Manage app** (shows as *Full control*) → **Save changes**.
3. **Assign assets** again → left column **WhatsApp accounts** → tick your WABA → enable **Manage WhatsApp business account** (*Full control*) → **Save changes**.
4. Reload the page: the system user's *Assigned assets* should list the app and the WABA with *Full control*. The doc notes "granting the permissions may take a few minutes, so reload the page if your app doesn't appear".

### 6.3 Generate the token

1. Still on the system user → **Generate new token** (or **Generate token**).
2. *Select app*: your app. **Token expiration: Never** (Meta offers 60 days / 90 days / Never here; pick *Never* — this is the "permanent" token. If *Never* is missing, the app must be assigned to the system user first — go back to 6.2).
3. *Available permissions*: tick **`whatsapp_business_messaging`**, **`whatsapp_business_management`**, and **`business_management`** (the doc lists all three; the third lets the token read WABA/template metadata). Nothing else.
4. **Generate token** → **copy it now** into your password manager. Meta shows it exactly once. Close.

If it's ever leaked: System users → the user → *Generate new token* creates a new one and **Revoke** invalidates the old one.

### 6.4 Test the token (before touching production)

```bash
export WHATSAPP_ACCESS_TOKEN='<paste>'
export PHONE_NUMBER_ID='<from step 1.6>'

# 1) token → number: should return your real number, not 555-661-4386
curl -s "https://graph.facebook.com/v26.0/$PHONE_NUMBER_ID?fields=display_phone_number,verified_name,name_status,quality_rating,status" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
# {"display_phone_number":"+1 xxx-xxx-xxxx","verified_name":"VocabText","status":"CONNECTED", ...}

# 2) token → templates (checks whatsapp_business_management)
curl -s "https://graph.facebook.com/v26.0/<WABA_ID>/message_templates?fields=name,status,category,language&limit=20" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
# should list vocabtext_daily_quiz APPROVED UTILITY (+ your verify template)

# 3) token metadata: expires_at 0 == never
curl -s "https://graph.facebook.com/debug_token?input_token=$WHATSAPP_ACCESS_TOKEN" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
```

`(#200) Permissions error` or `error_subcode 33` = the system user isn't assigned to the WABA/app (6.2) or the token lacks a permission (6.3). `190` = token invalid/expired.

### 6.5 Update Vercel and redeploy

Env vars that change: `WHATSAPP_ACCESS_TOKEN` (new permanent token), `WHATSAPP_PHONE_NUMBER_ID` (new number's ID), and the new `WHATSAPP_QUIZ_TEMPLATE` (+ `WHATSAPP_QUIZ_TEMPLATE_LANG` if not `en`). **Unchanged**: `WHATSAPP_APP_SECRET` (same app), `WHATSAPP_VERIFY_TOKEN` (your own string), `WHATSAPP_VERIFY_TEMPLATE`, `OPENAI_API_KEY`, `CRON_SECRET`, `DATABASE_URL*`.

1. https://vercel.com → team → project **vocabtext** → **Settings → Environment Variables**.
2. For `WHATSAPP_ACCESS_TOKEN`: ⋯ → **Edit** → replace the value → tick **Production** (and Preview if you use it) → **Save**. Mark it *Sensitive* if offered.
3. Same for `WHATSAPP_PHONE_NUMBER_ID`.
4. **Add** `WHATSAPP_QUIZ_TEMPLATE` = `vocabtext_daily_quiz` (Production). Add `WHATSAPP_QUIZ_TEMPLATE_LANG` only if the template's language code isn't `en`.
5. Env changes don't apply to the running deployment: **Deployments** → latest Production deployment → ⋯ → **Redeploy** (uncheck "Use existing Build Cache" isn't necessary). Or from the repo: `vercel env pull` to sanity check, then `vercel --prod`, or just push a commit.
6. Verify: Deployments → the new one is *Ready*; **Logs** → filter `/api/cron/tick` at the next hour boundary → no `WhatsApp send failed: 401`.

Keep the test number's ID/token around in a note for a week in case you need to roll back, then forget them (the temp token is dead anyway).

---

## 7. Point the webhook at production and run the end-to-end check

Docs: [Create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/) · [Set up webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)

Our endpoint: `src/app/api/whatsapp/webhook/route.ts` — `GET` answers Meta's verification handshake (`hub.verify_token` must equal `WHATSAPP_VERIFY_TOKEN`, echoes `hub.challenge`), `POST` validates `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` and handles `text`/`audio` messages plus STOP/START.

Prerequisites: Vercel **Deployment Protection must be off** for Production (Vercel project → Settings → Deployment Protection), otherwise Meta gets Vercel's authentication page instead of our handler.

### 7.1 Configure

1. App Dashboard → **WhatsApp → Configuration** (left menu). If you created the app via a *use case*, it's **Use cases → Connect with customers through WhatsApp → Customize → Configuration** ([set up webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)).
2. *Webhook* card → **Edit**.
3. **Callback URL**: `https://vocabtext-jaredzoneraich-7255s-projects.vercel.app/api/whatsapp/webhook`
4. **Verify token**: the exact value of `WHATSAPP_VERIFY_TOKEN` in Vercel.
5. **Verify and save**. Meta immediately GETs the URL; success closes the dialog. Failure ("The callback URL or verify token couldn't be validated") = token mismatch, deployment protection on, or the deploy isn't live yet — check Vercel **Logs** for the GET.
6. *Webhook fields* → **Manage** → tick **`messages`** → *Subscribe* → **Done**. (Optionally also `message_template_status_update` and `account_update` if you want to log them; our handler ignores unknown fields.) The Configuration page should now list `messages` as subscribed.

Also check the app is subscribed to the WABA (normally automatic when you used API Setup):

```bash
curl -s "https://graph.facebook.com/v26.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
# should list your app; if empty:
curl -s -X POST "https://graph.facebook.com/v26.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
```

### 7.2 End-to-end checklist

Do these in order; each one proves one link in the chain.

- [ ] **Outbound template → you.** From the Configuration page's *Test* / *Send test message* (or API Setup → *Send message*) send **`hello_world`** to your personal WhatsApp number using the **new** number as *From*. It arrives from your new number with display name (or the raw number if the name isn't approved yet).
- [ ] **Inbound webhook.** Reply anything to that message. Vercel → project → **Logs** → you should see `POST /api/whatsapp/webhook 200` within ~2 s. Configuration page → *Webhook fields* → **Test** next to `messages` (label may vary) sends a synthetic payload too; if it comes back `403 Invalid signature` in Vercel logs, the signature check is on and `WHATSAPP_APP_SECRET` doesn't match this app — fix before going further.
- [ ] **App logic.** If your number isn't a signed-up user the handler ignores the reply silently — sign up via the website with your number to test the full loop; then the DB (`npx prisma studio` against the Neon URL, or the Neon console) shows a `Message` row with `direction: "in"` for each reply.
- [ ] **Signup verification code.** Sign up on the site with your number → the code arrives via the `WHATSAPP_VERIFY_TEMPLATE` authentication template (or plain text if that var is unset — set it for production, plain-text codes fail outside a CSW).
- [ ] **Daily quiz via template.** Either wait for the cron hour or temporarily set your user's `sendHour` to the current UTC-aligned local hour and hit `GET /api/cron/tick` with `Authorization: Bearer $CRON_SECRET`. The quiz arrives as the `vocabtext_daily_quiz` template; a `Message` row with `kind: "quiz"` is written.
- [ ] **Reply → grading.** Answer the quiz; you get the graded reply (and, on PR #15, the word picture) as free-form messages; check `Message` rows.
- [ ] **STOP / START.** Send `STOP` → confirmation, user `optedOut`; send `START` → resumed.
- [ ] **Quality.** WhatsApp Manager → Phone numbers → your number shows *Quality rating: High (green)* and *Messaging limit: 250* (or 2K after verification).

If sends succeed but no webhook arrives: app not Live (5.4), `messages` not subscribed (7.1.6), WABA not subscribed to the app (curl above), or Deployment Protection is on.

---

## 8. Gotchas

- **24-hour customer-service window.** Non-template sends to someone who hasn't messaged you in 24h fail with `131047`. Only the morning quiz needs to cross the window (template). If you add more business-initiated messages later (reminders, weekly summary), each needs its own approved template. ([pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing))
- **Quality rating & template pausing.** Blocks/reports over the last 7 days set the number's quality (Green/Yellow/Red) and each template's quality. A template that hits **Low** is auto-**paused**: 3h the first time, 6h the second, **disabled** the third; sends during a pause are rejected by the API ([template pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/), [quality Help Center](https://www.facebook.com/business/help/896873687365001)). Mitigations: only message people who signed up, honour STOP instantly (we do), keep the footer telling them how to stop, and watch WhatsApp Manager → Message templates → *Quality* column. A disabled template can't be revived — you'd create `vocabtext_daily_quiz_v2` and change the env var. Meta emails the *contact email* from step 5.3 when this happens.
- **Meta can re-categorise a template to Marketing** after approval based on content/usage; you're charged at the new category from then on. Check the *Category* column occasionally ([categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization/)).
- **Opt-in is mandatory** ([getting opt-in](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in/)). Requirements: the person actively agrees, the opt-in text clearly says they're opting in to receive messages **from VocabText** (business name), and it complies with local law (TCPA in the US for automated messages; say what and how often). **Website signup is an explicitly allowed method**, so our flow counts *if the signup form says so*. Make the sentence next to the phone field read something like: *"By continuing you agree to receive daily language-quiz messages from VocabText on WhatsApp at this number. Reply STOP any time to pause."* — and require the verification code (already done) so the number is proven to be theirs.
- **Record the opt-in.** Meta may ask for proof if the number is reported. Store per user: phone, timestamp of consent, the exact consent wording/version shown, IP/user-agent if you have them, and the fact that the code was verified. Today the `User` row has `createdAt` + `verified`; add a `consentText`/`consentAt` (or reuse `createdAt` and keep the form wording in git history) before opening signups widely. Also log STOP/START events (already written as `Message` rows).
- **STOP handling.** Our webhook treats `STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT` (case-insensitive, whole message) as opt-out (sets `optedOut`, sends a confirmation, cron skips the user) and `START` as resume. Keep the footer `Reply STOP to pause messages.` on every template so learners choose STOP over *Block/Report* — blocks hurt quality, STOP doesn't. WhatsApp also shows its own *"Stop receiving marketing messages"* option for marketing templates only; utility templates don't get it, another reason to stay utility.
- **Template parameter formatting.** No `\n`, tabs, or 5+ spaces in `{{1}}` values (API error `132012` "Variable parameter values formatted incorrectly", or `132018` template validation error); ≤ 1024 chars total body after substitution. `132000` = wrong number of parameters; `132015`/`132016` = template paused/disabled ([error codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes)). `templateParamText` handles the newlines; with 4 review items + 2 MCQs the flattened quiz is ~350 chars, well under.
- **Language code must match exactly** (`en` ≠ `en_US`). Error `132001` = mismatch or template not (yet) approved.
- **Graph API version.** Code pins `v21.0`; Meta keeps each version ~2 years. Bump `GRAPH_BASE` in `src/lib/whatsapp.ts` when Meta's deprecation email arrives.
- **Token hygiene.** The System User token has full messaging power over your WABA; keep it only in Vercel env + your password manager. If Meta emails "your app secret was leaked", reset it in App settings → Basic and update `WHATSAPP_APP_SECRET` in Vercel *in the same minute* — the webhook rejects everything with a stale secret.
- **Number can't be moved back to the WhatsApp app easily.** Deleting a number from the platform is allowed (with the 2FA PIN) but re-registering it on consumer WhatsApp is not guaranteed to work quickly. Treat the production number as dedicated.
- **Test number stays available** in the same WABA for development — keep using it with `WA_STUB=1`/dev env; nothing about it changes when the production number goes live.
