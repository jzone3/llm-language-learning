import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Delete your data",
  description: `How to stop ${SITE_NAME} messages and have everything we store about you deleted.`,
  alternates: { canonical: "/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <>
      <h1>Delete your data</h1>
      <p>
        You can stop messages instantly and have everything we hold about you erased. There is no
        account to log into — your phone number is the only identifier — so deletion works by
        request.
      </p>

      <h2>1. Stop the messages (instant)</h2>
      <p>
        Reply <strong>STOP</strong> to any {SITE_NAME} message on WhatsApp. You will get one
        confirmation and nothing further. This pauses your account but keeps your progress in case you
        reply <strong>START</strong> later.
      </p>

      <h2>2. Delete everything (on request)</h2>
      <ol>
        <li>
          Email <a href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20VocabText%20data`}>{CONTACT_EMAIL}</a>{" "}
          with the subject &ldquo;Delete my {SITE_NAME} data&rdquo;.
        </li>
        <li>Include the phone number you signed up with (in international format, e.g. +1 415 555 1234).</li>
        <li>
          To confirm the number is yours, we may reply on WhatsApp with a one-time code and ask you to
          include it in your email.
        </li>
      </ol>
      <p>
        We delete your record within 30 days of confirming the request and email you when it is done.
        Deletion is permanent and removes:
      </p>
      <ul>
        <li>your phone number, language, level, and time zone</li>
        <li>every message we sent you and every reply you sent us, including voice-note transcripts</li>
        <li>your placement-quiz results, per-word progress, streak, and schedule</li>
      </ul>
      <p>
        Copies of messages already delivered to your WhatsApp account stay on your device and in your
        WhatsApp backups; you control those. Our service providers (listed in the{" "}
        <Link href="/privacy">Privacy Policy</Link>) purge their copies on their own retention
        schedules, typically within 30 days.
      </p>

      <h2>Not sure you signed up?</h2>
      <p>
        If you are getting {SITE_NAME} messages you did not ask for, reply <strong>STOP</strong> and
        email us the number — we will delete it and look into how it was added.
      </p>
    </>
  );
}
