import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ phone: z.string(), token: z.string().min(1) });

const PLACEMENT_ITEMS = 10;
const OPTIONS_PER_ITEM = 4;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Sample items evenly across the frequency range; each becomes a multiple-choice
 * question with the correct English meaning plus distractors from other words. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (!user?.verified || !user.placementToken || user.placementToken !== parsed.data.token) {
    return Response.json({ error: "This signup session has expired — refresh the page and start again." }, { status: 403 });
  }

  const words = await prisma.word.findMany({
    where: { language: user.language },
    orderBy: { rank: "asc" },
  });
  if (words.length === 0) return Response.json({ items: [] });

  const step = Math.max(1, Math.floor(words.length / PLACEMENT_ITEMS));
  const sampled = [];
  for (let i = 0; i < words.length && sampled.length < PLACEMENT_ITEMS; i += step) {
    sampled.push(words[i]);
  }

  const items = sampled.map((w) => {
    const seen = new Set([w.translation]);
    const distractors: string[] = [];
    for (const x of shuffle(words)) {
      if (distractors.length >= OPTIONS_PER_ITEM - 1) break;
      if (x.id === w.id || seen.has(x.translation)) continue;
      seen.add(x.translation);
      distractors.push(x.translation);
    }
    return {
      wordId: w.id,
      term: w.term,
      options: shuffle([w.translation, ...distractors]),
    };
  });

  return Response.json({ items });
}
