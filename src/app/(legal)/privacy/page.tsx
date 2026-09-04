import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_ENTITY, POLICY_UPDATED, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What ${SITE_NAME} stores (your phone number, language, quiz answers, voice-note transcripts), who processes it, and how to opt out or delete it.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-neutral-600">Last updated {POLICY_UPDATED}</p>

      <p>
        {SITE_NAME} (&ldquo;we&rdquo;, operated by {LEGAL_ENTITY}) sends you a short vocabulary quiz on
        WhatsApp every day and grades your replies. This policy explains, in plain language, what we
        store and why. We collect the minimum needed to run the service and we do not sell your data.
      </p>

      <h2>What we collect</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Your phone number</td>
            <td>To send WhatsApp messages and recognise your replies. It is also your account identifier — we have no usernames or passwords.</td>
          </tr>
          <tr>
            <td>Language, level, and time zone</td>
            <td>To pick which words you get and to send the quiz at the right local time. The time zone comes from your browser at signup.</td>
          </tr>
          <tr>
            <td>Your quiz answers and our messages</td>
            <td>We keep the text of messages sent and received so we can grade answers, show feedback, and schedule each word with spaced repetition.</td>
          </tr>
          <tr>
            <td>Voice-note transcripts</td>
            <td>If you reply with a voice note, the audio is transcribed and the transcript is graded like a text answer. We store the transcript, not the audio file.</td>
          </tr>
          <tr>
            <td>Learning progress</td>
            <td>Per-word scheduling data (when it is due, how well you know it), your streak, and reply timing so we can adjust when messages are sent.</td>
          </tr>
          <tr>
            <td>Verification code and placement quiz results</td>
            <td>To confirm the number is yours and to skip words you already know.</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not collect your name, email, contacts, location, or payment details. We do not use
        advertising or analytics trackers on this website.
      </p>

      <h2>Who processes it</h2>
      <p>We rely on a few service providers to run {SITE_NAME}. Each one only receives what it needs:</p>
      <ul>
        <li>
          <strong>Meta (WhatsApp Business Platform)</strong> — delivers messages to and from your number.
          Your use of WhatsApp is also governed by{" "}
          <a href="https://www.whatsapp.com/legal/privacy-policy" rel="noopener noreferrer">
            WhatsApp&rsquo;s privacy policy
          </a>
          .
        </li>
        <li>
          <strong>OpenAI</strong> — grades your answers, transcribes voice notes, and generates example
          sentences and word illustrations. Your answers (and voice-note audio) are sent to OpenAI for
          that purpose only, through their API, which by default does not use submitted data for training.
        </li>
        <li>
          <strong>Vercel and Neon</strong> — host the website, the database, and generated images.
        </li>
      </ul>
      <p>We do not sell or rent your information and we do not share it with anyone for marketing.</p>

      <h2>Messaging and opt-in</h2>
      <p>
        You only receive messages after entering your number on our website and confirming it with the
        code we send to WhatsApp. By continuing past that step you agree to receive one daily quiz (and,
        after a streak, an optional afternoon round) plus replies to your answers. Message and data
        rates from your carrier may apply.
      </p>
      <p>
        Reply <strong>STOP</strong> to any message to stop receiving them immediately. Reply{" "}
        <strong>START</strong> to resume.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is active so your progress is preserved. If you opt out we
        stop messaging you but keep your data in case you come back. You can ask us to delete
        everything at any time — see{" "}
        <Link href="/data-deletion">how to delete your data</Link>.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us to show you, correct, or delete the data we hold about you at any time by
        emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from any address and
        including the phone number you signed up with. We respond within 30 days. If you are in the EU,
        UK, or another region with data-protection law, these are your access, rectification, erasure,
        and objection rights; our legal basis is the consent you gave at signup and our legitimate
        interest in running the service you asked for.
      </p>

      <h2>Security</h2>
      <p>
        Data is stored in a managed database with encryption in transit and at rest and is only
        accessible to the people running the service. Inbound WhatsApp webhooks are signature-verified.
        No system is perfectly secure, so please do not send us sensitive personal information in your
        replies.
      </p>

      <h2>Children</h2>
      <p>
        {SITE_NAME} is not directed at children under 13 (or 16 where that is the local minimum) and we
        do not knowingly collect their data. WhatsApp itself requires users to be at least 13.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we will update the date above and, for
        significant changes, tell you on WhatsApp before they take effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
