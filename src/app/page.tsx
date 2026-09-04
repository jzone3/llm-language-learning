import { SignupForm } from "@/components/SignupForm";
import { SITE_NAME } from "@/lib/site";

const FEATURES = [
  { icon: "💬", text: "Just WhatsApp. No app to install, no account, no password." },
  { icon: "🎙️", text: "Answer by text or voice note. Grading is lenient about typos, accents, and transliteration." },
  {
    icon: "🧠",
    text: "The feedback does the teaching: after every answer you get the word, how to say it, and an example sentence.",
  },
  { icon: "🔁", text: "Spaced repetition (FSRS) brings each word back right before you'd forget it." },
  {
    icon: "🌍",
    text: "10 languages: Hebrew, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Mandarin, Russian.",
  },
  { icon: "🎯", text: "A two-minute level check at signup so you skip what you already know." },
];

const STEPS = [
  { title: "Pick a language, verify your number", body: "We send a 6-digit code to your WhatsApp." },
  { title: "Take a quick level check", body: "Up to 10 multiple-choice questions, or skip if you're brand new." },
  {
    title: "Your first quiz arrives right away",
    body: "Then one every morning. Reply when you have a minute — we never send a second quiz while one is unanswered.",
  },
];

function Bubble({
  from,
  time,
  children,
}: {
  from: "them" | "you";
  time: string;
  children: React.ReactNode;
}) {
  const you = from === "you";
  return (
    <li className={`flex ${you ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          you ? "rounded-br-md bg-[#d9fdd3]" : "rounded-bl-md bg-white"
        }`}
      >
        <span className="sr-only">{you ? "You" : SITE_NAME}: </span>
        <div className="whitespace-pre-line text-[15px] leading-relaxed text-neutral-800">{children}</div>
        <p className="mt-1 text-right text-[11px] text-neutral-600">{time}</p>
      </div>
    </li>
  );
}

function Hebrew({ children }: { children: React.ReactNode }) {
  return (
    <span lang="he" dir="rtl" className="block text-left">
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:px-6 sm:py-20">
      <p className="text-sm font-medium tracking-widest uppercase text-neutral-600">{SITE_NAME}</p>
      <SignupForm
        hero={
          <>
            <h1 className="mt-4 text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">
              Learn a language
              <br />
              one WhatsApp quiz a day.
            </h1>
            <p className="mt-6 text-lg text-neutral-600 leading-relaxed">
              Every morning we message you a short vocabulary quiz: the words you&rsquo;re about to
              forget, plus a couple of new ones to guess. Reply by text or voice note, get instant
              feedback, and spaced repetition does the scheduling. That&rsquo;s the whole app.
            </p>

            <ul className="mt-8 space-y-3 text-neutral-700">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex gap-3">
                  <span aria-hidden="true" className="shrink-0">
                    {f.icon}
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </>
        }
        demo={
          <>
            <section aria-labelledby="demo-heading" className="mt-16">
              <h2 id="demo-heading" className="text-sm font-medium tracking-widest uppercase text-neutral-600">
                What a day looks like
              </h2>
              <p className="mt-2 text-neutral-600">
                A real exchange for a Hebrew learner on day 6. The quiz is only questions; the reply
                is where you learn.
              </p>
              <ol className="mt-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-[#efeae2] p-4 font-mono text-sm">
                <Bubble from="them" time="8:00 AM">
                  🔥 5-day streak{"\n\n"}
                  1. &quot;thank you&quot; in Hebrew?{"\n"}
                  2. New — guess the meaning:{"\n"}
                  <Hebrew>שלום</Hebrew>
                  shalom{"\n"}
                  a) hello / peace&nbsp;&nbsp;b) bread&nbsp;&nbsp;c) water{"\n\n"}
                  Reply with your answers (text or voice note).
                </Bubble>
                <Bubble from="you" time="8:04 AM">
                  toda, a
                </Bubble>
                <Bubble from="them" time="8:04 AM">
                  2/2 🎉{"\n\n"}
                  1. ✓{"\n"}
                  <Hebrew>תודה</Hebrew>
                  toda{"\n\n"}
                  2. ✓{"\n"}
                  <Hebrew>שלום</Hebrew>
                  shalom{"\n"}= hello / peace{"\n"}
                  <Hebrew>שלום, איך אתה היום?</Hebrew>
                  Hello, how are you today?
                </Bubble>
              </ol>
            </section>

            <section aria-labelledby="how-heading" className="mt-16">
              <h2 id="how-heading" className="text-sm font-medium tracking-widest uppercase text-neutral-600">
                How it works
              </h2>
              <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="rounded-xl border border-neutral-200 bg-white p-4">
                    <p className="text-sm font-medium text-neutral-600">Step {i + 1}</p>
                    <p className="mt-1 font-medium">{s.title}</p>
                    <p className="mt-1 text-sm text-neutral-600 leading-relaxed">{s.body}</p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        }
      />
    </main>
  );
}
