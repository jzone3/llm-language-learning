import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_ENTITY, POLICY_UPDATED, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The short, plain-language terms for using ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-sm text-neutral-600">Last updated {POLICY_UPDATED}</p>

      <p>
        These terms cover your use of {SITE_NAME}, a WhatsApp-based vocabulary quiz operated by{" "}
        {LEGAL_ENTITY}. By signing up on our website or replying to our messages you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        {SITE_NAME} sends you a short vocabulary quiz on WhatsApp once a day (and, once you have a
        streak, an optional second round), grades your text or voice-note replies, and schedules each
        word with spaced repetition. It is a study aid, not a course or a certification, and we do not
        promise any particular learning outcome.
      </p>

      <h2>Messaging consent</h2>
      <p>
        You must own or have permission to use the phone number you sign up with, and you must be at
        least 13 years old (or the minimum age to use WhatsApp where you live). By confirming the
        verification code you consent to receive recurring automated WhatsApp messages from us.
        Consent is not a condition of any purchase. Reply <strong>STOP</strong> at any time to stop
        messages; standard carrier data rates may apply.
      </p>

      <h2>Your replies</h2>
      <p>
        Send us quiz answers only. Do not send anything unlawful, abusive, or that you do not have the
        right to share, and do not try to disrupt or reverse-engineer the service. We may stop
        messaging a number that misuses the service.
      </p>

      <h2>Automated grading</h2>
      <p>
        Answers are graded automatically, including by AI models, and grading can be wrong. Example
        sentences and illustrations are also machine-generated and may occasionally contain errors.
        Treat feedback as a study aid and check anything important against a trusted source.
      </p>

      <h2>Cost</h2>
      <p>{SITE_NAME} is currently free. If that ever changes we will tell you first and ask before charging anything.</p>

      <h2>Availability and changes</h2>
      <p>
        We may change, pause, or shut down the service, and we may update these terms. For significant
        changes we will tell you on WhatsApp before they take effect. Continuing to use the service
        after a change means you accept it.
      </p>

      <h2>Disclaimer and liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the extent
        permitted by law, {LEGAL_ENTITY} is not liable for any indirect or consequential loss arising
        from your use of {SITE_NAME}, and our total liability to you is limited to the amount you paid
        us (currently nothing).
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle your data is described in our <Link href="/privacy">Privacy Policy</Link>, which is
        part of these terms.
      </p>

      <h2>Third parties</h2>
      <p>
        {SITE_NAME} is delivered through WhatsApp but is not affiliated with, endorsed by, or operated
        by WhatsApp or Meta. Your use of WhatsApp is subject to their own terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
