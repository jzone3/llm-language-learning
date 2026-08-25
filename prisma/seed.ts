import { PrismaClient } from "@prisma/client";
import { SPANISH_WORDS } from "../src/lib/words";

const prisma = new PrismaClient();

async function main() {
  for (let i = 0; i < SPANISH_WORDS.length; i++) {
    const w = SPANISH_WORDS[i];
    await prisma.word.upsert({
      where: { language_rank: { language: "es", rank: i + 1 } },
      create: { language: "es", rank: i + 1, term: w.term, translation: w.translation },
      update: { term: w.term, translation: w.translation },
    });
  }
  console.log(`Seeded ${SPANISH_WORDS.length} Spanish words.`);
}

main().finally(() => prisma.$disconnect());
