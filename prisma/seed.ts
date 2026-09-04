import { PrismaClient } from "@prisma/client";
import { WORD_LISTS } from "../src/lib/words";

const prisma = new PrismaClient();

async function main() {
  for (const [language, words] of Object.entries(WORD_LISTS)) {
    const existing = new Map(
      (
        await prisma.word.findMany({
          where: { language },
          select: { rank: true, term: true, translation: true },
        })
      ).map((e) => [e.rank, e])
    );
    let imagesCleared = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const prev = existing.get(i + 1);
      // the illustration is derived from term/translation, so drop the cached one if either changed
      const clearImage = prev !== undefined && (prev.term !== w.term || prev.translation !== w.translation);
      if (clearImage) imagesCleared++;
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
          ...(clearImage ? { imageUrl: null } : {}),
        },
      });
    }
    console.log(`Seeded ${words.length} ${language} items (${imagesCleared} cached images cleared).`);
  }
}

main().finally(() => prisma.$disconnect());
