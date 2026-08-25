import { SignupForm } from "@/components/SignupForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafaf7] text-neutral-900 flex flex-col">
      <div className="mx-auto w-full max-w-2xl px-6 py-20 flex-1">
        <p className="text-sm font-medium tracking-widest uppercase text-neutral-400">VocabText</p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">
          Learn a language
          <br />
          by answering one text a day.
        </h1>
        <p className="mt-6 text-lg text-neutral-600 leading-relaxed">
          Every morning we text you a bite-size quiz of the words you&apos;re about to forget,
          plus a couple of new ones — scheduled by a real spaced-repetition algorithm (FSRS).
          Reply with your answers. That&apos;s the whole app.
        </p>

        <ul className="mt-8 space-y-3 text-neutral-700">
          <li>📱 No app, no account, no streak-shaming push notifications — just SMS</li>
          <li>🧠 Active recall: you type the word before you see the answer</li>
          <li>📈 Build a streak and it learns your rhythm — more reps only when you want them</li>
          <li>🇪🇸 Spanish first; more languages soon</li>
        </ul>

        <div className="mt-10">
          <SignupForm />
        </div>

        <div className="mt-16 rounded-2xl border border-neutral-200 bg-white p-6 font-mono text-sm text-neutral-700 shadow-sm">
          <p className="text-neutral-400 mb-3">Tomorrow, 8:00 AM</p>
          <p>☀️ VocabText 🔥6</p>
          <p>Quiz — reply with your answers:</p>
          <p>1. &quot;water&quot; in Spanish?</p>
          <p>2. &quot;to find&quot; in Spanish?</p>
          <p className="mt-2">New word:</p>
          <p>• corazón = heart</p>
          <p>&nbsp;&nbsp;&quot;Mi corazón está feliz.&quot; (My heart is happy.)</p>
          <p className="mt-4 text-right text-blue-600">agua, encontrar → </p>
          <p className="text-neutral-400">2/2 🎉</p>
        </div>
      </div>
      <footer className="py-8 text-center text-xs text-neutral-400">
        Msg &amp; data rates may apply. Reply STOP to unsubscribe.
      </footer>
    </main>
  );
}
