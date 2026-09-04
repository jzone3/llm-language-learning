// Smoke test: quiz-only send + reply grading + image-at-reveal, with Graph API stubbed.
// Run: npx tsx --env-file=.env scripts/smoke-quiz-images.ts
const sent: { url: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://graph.facebook.com/")) {
    sent.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${sent.length}` }] }), { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;

process.env.WHATSAPP_ACCESS_TOKEN ??= "stub";
process.env.WHATSAPP_PHONE_NUMBER_ID ??= "123";

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { sendLesson, handleReply } = await import("../src/lib/engine");
  const { sendNewWordImages } = await import("../src/lib/images");

  const phone = "+15550009999";
  await prisma.message.deleteMany({ where: { user: { phone } } });
  await prisma.card.deleteMany({ where: { user: { phone } } });
  await prisma.user.deleteMany({ where: { phone } });
  const user = await prisma.user.create({
    data: { phone, language: "he", timezone: "UTC", verified: true, placementDone: true, newWordsPerDay: 2 },
  });

  const quiz = await sendLesson(user, { includeNewWords: true });
  console.log("--- quiz ---\n" + quiz?.body);
  const items = JSON.parse(quiz!.quizItems!) as { type: string; wordId?: string; correctIndex?: number }[];
  const newItems = items.filter((i) => i.type === "new");
  // Pre-set imageUrl so no OpenAI/Blob call is needed.
  for (const it of newItems) {
    await prisma.word.update({ where: { id: it.wordId! }, data: { imageUrl: `https://example.com/${it.wordId}.jpg` } });
  }

  const letters = ["a", "b", "c"];
  const answer = items.map((it, i) => `${i + 1}. ${it.type === "new" ? letters[it.correctIndex!] : "idk"}`).join("\n");
  const result = await handleReply(user, answer);
  console.log("--- feedback ---\n" + result.text);
  console.log("revealedWords:", result.revealedWords.map((w) => w.term));
  await sendNewWordImages(user, result.revealedWords);

  const imageSends = sent.filter((s) => (s.body as { type?: string })?.type === "image");
  console.log("image payloads:", JSON.stringify(imageSends.map((s) => s.body), null, 1));
  const rows = await prisma.message.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { kind: true, direction: true, mediaUrl: true } });
  console.log("messages:", rows);
  const cards = await prisma.card.count({ where: { userId: user.id } });
  console.log("cards created:", cards, "(expected", newItems.length + ")");

  if (imageSends.length !== newItems.length) throw new Error("image count mismatch");
  if (cards !== newItems.length) throw new Error("card count mismatch");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
