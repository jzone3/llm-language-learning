"use client";

import { useState } from "react";

export function SignupForm() {
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "done">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          channel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
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
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
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
        🎉 You&apos;re in — check your texts for your first lesson.
      </p>
    );
  }

  return (
    <form onSubmit={stage === "phone" ? submitPhone : submitCode} className="flex flex-col gap-3">
      {stage === "phone" && (
        <div className="flex gap-2">
          {(["sms", "whatsapp"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                channel === c
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
              }`}
            >
              {c === "sms" ? "Text (SMS)" : "WhatsApp"}
            </button>
          ))}
        </div>
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
        {loading ? "..." : stage === "phone" ? (channel === "whatsapp" ? "Message me" : "Text me") : "Verify"}
      </button>
      </div>
      {stage === "phone" && channel === "whatsapp" && (
        <p className="text-sm text-neutral-500">
          You can reply by text or voice note on WhatsApp — we&apos;ll grade either.
        </p>
      )}
      {error && <p className="text-sm text-red-600 sm:w-full">{error}</p>}
    </form>
  );
}
