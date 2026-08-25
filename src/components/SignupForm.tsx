"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/words";

type PlacementItem = { wordId: string; term: string; transliteration: string | null };

export function SignupForm() {
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("he");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "placement" | "done">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PlacementItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
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
    setLoading(true);
    try {
      await post("/api/signup", {
        phone,
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

  async function submitPlacement(skip: boolean) {
    setError(null);
    setLoading(true);
    try {
      const data = await post("/api/placement/submit", {
        phone,
        token,
        answers: skip
          ? []
          : items.map((it) => ({ wordId: it.wordId, response: responses[it.wordId] ?? "" })),
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
      <p className="text-lg font-medium text-green-700">
        🎉 You&apos;re in{level ? ` — starting at ${level} level` : ""}. Check WhatsApp for your
        first lesson.
      </p>
    );
  }

  if (stage === "placement") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Quick level check</h2>
          <p className="text-sm text-neutral-500">
            Type the English meaning of any you know — leave the rest blank. This sets your
            starting point so we don&apos;t teach you words you already know.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.wordId} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-base">
                {it.term}
                {it.transliteration && (
                  <span className="block text-xs text-neutral-400">{it.transliteration}</span>
                )}
              </span>
              <input
                type="text"
                value={responses[it.wordId] ?? ""}
                onChange={(e) => setResponses({ ...responses, [it.wordId]: e.target.value })}
                placeholder="English meaning"
                className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => submitPlacement(false)}
            className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {loading ? "..." : "Finish"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => submitPlacement(true)}
            className="rounded-xl border border-neutral-300 px-6 py-3 text-base font-medium text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
          >
            I&apos;m brand new — skip
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={stage === "phone" ? submitPhone : submitCode} className="flex flex-col gap-3">
      {stage === "phone" && (
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-fit rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
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
          placeholder="+1 415 555 1234"
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
  );
}
