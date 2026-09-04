"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/words";
import { normalizePhone } from "@/lib/phone";

type PlacementItem = { wordId: string; term: string; options: string[] };

export function SignupForm({ hero, demo }: { hero?: React.ReactNode; demo?: React.ReactNode }) {
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("he");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "placement" | "done">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PlacementItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [level, setLevel] = useState<string | null>(null);
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
        setStage("done");
      } else {
        const start = await post("/api/placement/start", { phone, token: data.placementToken });
        setItems(start.items);
        setStage(start.items.length > 0 ? "placement" : "done");
        if (start.items.length === 0)
          await post("/api/placement/submit", { phone, token: data.placementToken, answers: [] });
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
    try {
      const answers = finalResponses ?? responses;
      const data = await post("/api/placement/submit", {
        phone,
        token,
        answers: skip
          ? []
          : items.map((it) => ({ wordId: it.wordId, response: answers[it.wordId] ?? "" })),
      });
      setLevel(data.level);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (stage === "done") {
    return (
      <div className="mt-10">
        <h2 className="text-lg font-semibold">You&apos;re all set</h2>
        <p className="mt-2 text-lg font-medium text-green-700">
          🎉 You&apos;re in{level ? ` — starting at ${level} level` : ""}. Check WhatsApp for your
          first lesson.
        </p>
      </div>
    );
  }

  if (stage === "placement") {
    const item = items[current];

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
        <div className="grid grid-cols-2 gap-2">
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
        <button
          type="button"
          disabled={loading}
          onClick={() => submitPlacement(true)}
          className="w-fit text-sm text-neutral-500 underline hover:text-neutral-700 disabled:opacity-50"
        >
          {loading ? "..." : "I'm brand new — skip the quiz"}
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
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-fit rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
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
        {loading ? "..." : stage === "phone" ? "Message me" : "Verify"}
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
