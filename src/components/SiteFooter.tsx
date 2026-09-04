import Link from "next/link";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/data-deletion", label: "Delete your data" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-2xl px-6 py-8 text-sm text-neutral-600">
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-sm underline-offset-4 hover:text-neutral-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-center">
        Messages arrive on WhatsApp. Reply STOP anytime to unsubscribe. Not affiliated with WhatsApp or Meta.
      </p>
    </footer>
  );
}
