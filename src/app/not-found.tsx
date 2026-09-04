import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <p className="text-sm font-medium tracking-widest uppercase text-neutral-600">{SITE_NAME}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">This page doesn&rsquo;t exist.</h1>
      <p className="mt-4 text-lg text-neutral-600">
        The whole app lives on WhatsApp — there isn&rsquo;t much here besides the signup page.
      </p>
      <Link
        href="/"
        className="mt-8 w-fit rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        Back to signup
      </Link>
    </main>
  );
}
