export const SITE_NAME = "VocabText";

export const SITE_TAGLINE = "Learn a language one WhatsApp quiz a day";

export const SITE_DESCRIPTION =
  "A short vocabulary quiz on WhatsApp every morning. Reply by text or voice note, get instant feedback, and spaced repetition (FSRS) brings each word back right before you forget it. 10 languages, including Hebrew.";

/**
 * Canonical origin for absolute URLs (metadata, sitemap, robots).
 * Set NEXT_PUBLIC_SITE_URL in production; falls back to the Vercel production
 * domain, then localhost.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

/** Contact address shown on the privacy / terms / data-deletion pages. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@vocabtext.app";

/** Legal entity named in the policies (defaults to the product name). */
export const LEGAL_ENTITY = process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? SITE_NAME;

export const POLICY_UPDATED = "September 4, 2026";
