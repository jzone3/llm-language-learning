"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <p className="text-sm font-medium tracking-widest uppercase text-neutral-600">VocabText</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Something went wrong on our end.</h1>
      <p className="mt-4 text-lg text-neutral-600">
        Nothing you did — please try again. If you were in the middle of signing up, your WhatsApp
        code is still valid for 10 minutes.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-neutral-300 bg-white px-6 py-3 text-base font-medium hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Start over
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-neutral-600">Error reference: {error.digest}</p>
      )}
    </main>
  );
}
