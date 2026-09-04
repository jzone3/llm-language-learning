import { LANGUAGE_NAMES } from "@/lib/words";

export type PlacementSummary = {
  level?: string | null;
  knownCount?: number;
  totalAsked?: number;
  queueCount?: number;
  sendHour?: number;
  language?: string;
  firstLessonSent?: boolean;
};

const LEVEL_BLURB: Record<string, string> = {
  beginner: "We start from the most common words, phrases, and slang.",
  intermediate: "You know the basics — those are skipped, and new picks build from there.",
  advanced: "Strong vocabulary — known words are skipped and weekly picks target an advanced learner.",
};

function formatSendTime(sendHour: number) {
  const d = new Date();
  d.setHours(sendHour, 0, 0, 0);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZoneName: "short" }).format(d);
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-tight">{value}</p>
      <p className="mt-1 text-sm text-neutral-600">{detail}</p>
    </div>
  );
}

export function SignupDone({ summary, returning }: { summary: PlacementSummary; returning?: boolean }) {
  const { level, knownCount, totalAsked, queueCount, sendHour, language, firstLessonSent } = summary;
  const deliveryFailed = firstLessonSent === false;
  const sendTime = formatSendTime(sendHour ?? 8);
  const morning = sendHour !== undefined ? `Around ${sendTime}` : "Every morning";
  const languageName = language ? LANGUAGE_NAMES[language] ?? language : null;

  const stats: { label: string; value: string; detail: string }[] = [];
  if (level) {
    stats.push({
      label: "Your level",
      value: level.charAt(0).toUpperCase() + level.slice(1),
      detail: LEVEL_BLURB[level] ?? "Sets the starting point for your quizzes.",
    });
  }
  if (totalAsked !== undefined && totalAsked > 0 && knownCount !== undefined) {
    stats.push({
      label: "Already known",
      value: `${knownCount} of ${totalAsked}`,
      detail:
        knownCount > 0
          ? "Saved as known — they won't show up as new words."
          : "No problem — every word will be introduced in a quiz first.",
    });
  }
  if (queueCount !== undefined) {
    stats.push({
      label: "In your queue",
      value: queueCount.toLocaleString(),
      detail: `${languageName ? `${languageName} ` : ""}words, phrases & slang, a couple new each morning.`,
    });
  }
  const statCols = stats.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  const steps = [
    {
      icon: "☀️",
      title: "One quiz every morning",
      body: `${morning}: a short numbered quiz — up to 4 words due for review, plus a couple of new words to guess from a/b/c choices.`,
    },
    {
      icon: "💬",
      title: "Reply by text or voice note",
      body: "Graded instantly and leniently — typos, missing accents, transliterations, and close synonyms all count. The feedback is the study material: each word with its transliteration and an example sentence.",
    },
    {
      icon: "🔁",
      title: "Spaced repetition does the scheduling",
      body: "Each word comes back at growing intervals (FSRS) until it sticks. Miss one and it returns sooner.",
    },
    {
      icon: "🔥",
      title: "Build a streak, unlock more",
      body: "Reply daily to keep your streak; after a 4-day streak an optional afternoon round can unlock. We never send a second quiz while one is unanswered. Reply STOP anytime.",
    },
  ];

  return (
    <div className="mt-10 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight">
          {returning
            ? "👋 Welcome back — you're already set up."
            : deliveryFailed
              ? "🎉 You're all set — your first quiz is on its way."
              : "🎉 Check WhatsApp — your first quiz just landed."}
        </h1>
        <p className="mt-3 text-neutral-600">
          {returning
            ? "Your quizzes keep arriving on WhatsApp every morning. Reply to the next one to keep your streak going."
            : deliveryFailed
              ? `We couldn't reach your WhatsApp just now, so your first quiz will arrive at your next morning slot (~${sendTime}). Make sure this number can receive WhatsApp messages.`
              : "Reply to it by text or voice note — the feedback teaches you each word. Tomorrow morning's quiz starts your streak."}
        </p>
      </div>

      {!returning && (
        <div className={`grid grid-cols-1 gap-3 ${statCols}`}>
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:col-span-full">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Your schedule</p>
            <p className="mt-1 text-2xl font-semibold leading-tight">Daily · ~{sendTime}</p>
            <p className="mt-1 text-sm text-neutral-600">
              First quiz:{" "}
              <span className="text-neutral-900">{deliveryFailed ? `next ~${sendTime}` : "sent now"}</span> · Next
              quiz: tomorrow ~{sendTime}
            </p>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-neutral-600">How it works</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-lg" aria-hidden>
                {step.icon}
              </div>
              <div>
                <p className="font-medium">
                  <span className="mr-2 text-neutral-500">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-1 text-sm text-neutral-600 leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
