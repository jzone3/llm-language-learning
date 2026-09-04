import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link
        href="/"
        className="text-sm font-medium tracking-widest uppercase text-neutral-600 hover:text-neutral-900 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        ← {SITE_NAME}
      </Link>
      <article className="mt-6 text-neutral-800 leading-relaxed [&_h1]:text-3xl [&_h1]:sm:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-neutral-900 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-neutral-900 [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-neutral-300 [&_th]:py-2 [&_td]:border-b [&_td]:border-neutral-200 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top">
        {children}
      </article>
    </main>
  );
}
