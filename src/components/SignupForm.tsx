"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LANGUAGES } from "@/lib/words";
import { normalizePhone } from "@/lib/phone";
import { SignupDone, type PlacementSummary } from "./SignupDone";

type PlacementItem = { wordId: string; term: string; options: string[] };

const RESEND_COOLDOWN_S = 30;

function friendlyStatus(status: number) {
  if (status === 429) return "Too many attempts — wait a minute and try again.";
  if (status >= 500) return "Something went wrong on our end — please try again in a moment.";
  return "Something went wrong — please try again.";
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : friendlyStatus(0);
}

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
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const optionsRef = useRef<HTMLDivElement>(null);

  const rtl = LANGUAGES.find((l) => l.code === language)?.rtl ?? false;

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (stage === "placement") optionsRef.current?.querySelector("button")?.focus();
  }, [stage, current]);

  async function post(url: string, body: unknown) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("Couldn't reach the server — check your connection and try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : friendlyStatus(res.status));
    return data;
  }

  async function sendCode(normalized: string) {
    await post("/api/signup", {
      phone: normalized,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language,
    });
    setResendIn(RESEND_COOLDOWN_S);
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Enter a valid phone number, e.g. (415) 555-1234 or +44 20 7946 0958");
      return;
    }
    setPhone(normalized);
    setLoading(true);
    try {
      await sendCode(normalized);
      setNotice(null);
      setStage("code");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (loading || resendIn > 0) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await sendCode(phone);
      setCode("");
      setNotice("New code sent — check WhatsApp.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function changeNumber() {
    if (loading) return;
    setError(null);
    setNotice(null);
    setCode("");
    setStage("phone");
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from the WhatsApp message.");
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const data = await post("/api/verify", { phone, code: code.trim() });
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
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitPlacement(skip: boolean, finalResponses?: Record<string, string>) {
    if (loading) return;
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
      setError(errorMessage(err));
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
      if (loading) return;
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
          <h1 className="text-lg font-semibold">Step 2 of 2: Quick level check</h1>
          <p id="placement-progress" className="text-sm text-neutral-600" aria-live="polite">
            Question {current + 1} of {items.length} — what does this mean in English?
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Level check progress"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={current}
          aria-valuetext={`${current} of ${items.length} answered`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
        >
          <div
            className="h-full rounded-full bg-neutral-900 transition-all"
            style={{ width: `${(current / items.length) * 100}%` }}
          />
        </div>
        <p id="placement-term" lang={language} dir={rtl ? "rtl" : "ltr"} className="text-3xl font-semibold">
          {item.term}
        </p>
        <div className="relative">
          <div
            ref={optionsRef}
            role="group"
            aria-labelledby="placement-term"
            aria-describedby="placement-progress"
            className={`grid grid-cols-2 gap-2 transition-opacity ${grading ? "pointer-events-none opacity-50" : ""}`}
            aria-busy={grading}
          >
            {item.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={loading}
                onClick={() => answer(option)}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-base hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              onClick={() => answer("")}
              className="col-span-2 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-center text-base text-neutral-600 hover:border-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
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
          className="w-fit rounded-sm text-sm text-neutral-600 underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50 disabled:no-underline"
        >
          <ButtonLabel loading={skipping} busyLabel="Skipping…">
            I&apos;m brand new — skip the quiz
          </ButtonLabel>
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {stage === "phone" && hero}
      {stage === "code" && (
        <div className="mt-10">
          <h1 className="text-lg font-semibold">Step 1 of 2: Verify your number</h1>
          <p className="text-sm text-neutral-600">
            Enter the 6-digit code we just sent to <span className="font-medium text-neutral-900">{phone}</span>{" "}
            on WhatsApp. It expires in 10 minutes.
          </p>
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
          autoComplete="tel"
          aria-label="WhatsApp phone number"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "signup-error" : "signup-consent"}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(415) 555-1234"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900"
        />
      ) : (
        <input
          type="text"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          aria-label="6-digit verification code"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "signup-error" : undefined}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900"
        />
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
      >
        <ButtonLabel loading={loading} busyLabel={stage === "phone" ? "Sending…" : "Verifying…"}>
          {stage === "phone" ? "Message me" : "Verify"}
        </ButtonLabel>
      </button>
      </div>
      {stage === "phone" && (
        <p id="signup-consent" className="text-sm text-neutral-600">
          By continuing you agree to receive daily WhatsApp messages from VocabText and to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-neutral-900">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-neutral-900">
            Privacy Policy
          </Link>
          . Reply STOP anytime.
        </p>
      )}
      {stage === "code" && (
        <p className="text-sm text-neutral-600">
          Didn&apos;t get it?{" "}
          <button
            type="button"
            onClick={resendCode}
            disabled={loading || resendIn > 0}
            className="rounded-sm underline underline-offset-4 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:no-underline disabled:opacity-60"
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>{" "}
          ·{" "}
          <button
            type="button"
            onClick={changeNumber}
            disabled={loading}
            className="rounded-sm underline underline-offset-4 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60"
          >
            Use a different number
          </button>
        </p>
      )}
      {notice && !error && (
        <p role="status" className="text-sm text-green-700">
          {notice}
        </p>
      )}
      {error && (
        <p id="signup-error" role="alert" className="text-sm text-red-700 sm:w-full">
          {error}
        </p>
      )}
    </form>
      {stage === "phone" && demo}
    </>
  );
}
