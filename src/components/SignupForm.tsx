"use client";

import { useState } from "react";
import { LanguageSelect } from "@/components/LanguageSelect";
import { normalizePhone } from "@/lib/phone";
import { SignupDone, type PlacementSummary } from "./SignupDone";

type PlacementItem = { wordId: string; term: string; options: string[] };

function Spinner() {
  return (
    <svg
      className="size-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ButtonLabel({ loading, busyLabel, children }: { loading: boolean; busyLabel: string; children: React.ReactNode }) {
  return (
    <span className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
      <span className={`inline-flex items-center gap-2 ${loading ? "invisible" : ""}`}>{children}</span>
      <span className={`inline-flex items-center gap-2 ${loading ? "" : "invisible"}`}>
        <Spinner />
        {busyLabel}
      </span>
    </span>
  );
}

export function SignupForm({ hero, demo }: { hero?: React.ReactNode; demo?: React.ReactNode }) {
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("he");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "placement" | "done">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [items, setItems] = useState<PlacementItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [summary, setSummary] = useState<PlacementSummary>({});
  const [returning, setReturning] = useState(false);
  const [token, setToken] = useState("");

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Enter a valid phone number, e.g. (415) 555-1234 or +44 20 7946 0958");
      return;
    }
    setPhone(normalized);
    setLoading(true);
    try {
      await post("/api/signup", {
        phone: normalized,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language,
      });
      setStage("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await post("/api/verify", { phone, code });
      setToken(data.placementToken ?? "");
      if (data.placementDone) {
        setReturning(true);
        setStage("done");
      } else {
        const start = await post("/api/placement/start", { phone, token: data.placementToken });
        setItems(start.items);
        if (start.items.length > 0) {
          setStage("placement");
        } else {
          const done = await post("/api/placement/submit", { phone, token: data.placementToken, answers: [] });
          setSummary(done);
          setStage("done");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitPlacement(skip: boolean, finalResponses?: Record<string, string>) {
    setError(null);
    setLoading(true);
    setSkipping(skip);
    try {
      const answers = finalResponses ?? responses;
      const data = await post("/api/placement/submit", {
        phone,
        token,
        answers: skip
          ? []
          : items.map((it) => ({ wordId: it.wordId, response: answers[it.wordId] ?? "" })),
      });
      setSummary(data);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setSkipping(false);
    }
  }

  if (stage === "done") {
    return <SignupDone summary={summary} returning={returning} />;
  }

  if (stage === "placement") {
    const item = items[current];
    const grading = loading && !skipping;

    function answer(option: string) {
      const next = { ...responses, [item.wordId]: option };
      setResponses(next);
      if (current + 1 < items.length) {
        setCurrent(current + 1);
      } else {
        void submitPlacement(false, next);
      }
    }

    return (
      <div className="mt-10 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Step 2 of 2: Quick level check</h2>
          <p className="text-sm text-neutral-500">
            Question {current + 1} of {items.length}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-neutral-900 transition-all"
            style={{ width: `${(current / items.length) * 100}%` }}
          />
        </div>
        <p className="text-3xl font-semibold">{item.term}</p>
        <div className="relative">
          <div
            className={`grid grid-cols-2 gap-2 transition-opacity ${grading ? "pointer-events-none opacity-50" : ""}`}
            aria-busy={grading}
          >
            {item.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={loading}
                onClick={() => answer(option)}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-base hover:border-neutral-900 disabled:opacity-50"
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              onClick={() => answer("")}
              className="col-span-2 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-center text-base text-neutral-500 hover:border-neutral-500 disabled:opacity-50"
            >
              I don&apos;t know
            </button>
          </div>
          {grading && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm">
                <Spinner />
                Grading…
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => submitPlacement(true)}
          className="w-fit text-sm text-neutral-500 underline hover:text-neutral-700 disabled:opacity-50 disabled:no-underline"
        >
          <ButtonLabel loading={skipping} busyLabel="Skipping…">
            I&apos;m brand new — skip the quiz
          </ButtonLabel>
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <>
      {stage === "phone" && hero}
      {stage === "code" && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Step 1 of 2: Verify your number</h2>
          <p className="text-sm text-neutral-500">Enter the code we sent you on WhatsApp.</p>
        </div>
      )}
    <form onSubmit={stage === "phone" ? submitPhone : submitCode} className="mt-4 flex flex-col gap-3">
      {stage === "phone" && (
        <LanguageSelect value={language} onChange={setLanguage} disabled={loading} />
      )}
      <div className="flex flex-col sm:flex-row gap-3">
      {stage === "phone" ? (
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(415) 555-1234"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900"
        />
      ) : (
        <input
          type="text"
          required
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900"
        />
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        <ButtonLabel loading={loading} busyLabel={stage === "phone" ? "Sending…" : "Verifying…"}>
          {stage === "phone" ? "Message me" : "Verify"}
        </ButtonLabel>
      </button>
      </div>
      {stage === "phone" && (
        <p className="text-sm text-neutral-500">
          Lessons arrive on WhatsApp. Reply by text or voice note — we&apos;ll grade either.
        </p>
      )}
      {error && <p className="text-sm text-red-600 sm:w-full">{error}</p>}
    </form>
      {stage === "phone" && demo}
    </>
  );
}
