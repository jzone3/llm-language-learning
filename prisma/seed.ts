import { PrismaClient } from "@prisma/client";
import { WORD_LISTS } from "../src/lib/words";

const prisma = new PrismaClient();

async function main() {
  for (const [language, words] of Object.entries(WORD_LISTS)) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      await prisma.word.upsert({
        where: { language_rank: { language, rank: i + 1 } },
        create: {
          language,
          rank: i + 1,
          term: w.term,
          translation: w.translation,
          transliteration: w.transliteration ?? null,
          kind: w.kind ?? "word",
        },
        update: {
          term: w.term,
          translation: w.translation,
          transliteration: w.transliteration ?? null,
          kind: w.kind ?? "word",
        },
      });
    }
    console.log(`Seeded ${words.length} ${language} items.`);
  }
}

main().finally(() => prisma.$disconnect());
