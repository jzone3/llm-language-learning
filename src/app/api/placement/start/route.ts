import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ phone: z.string(), token: z.string().min(1) });

const PLACEMENT_ITEMS = 12;

/** Sample items evenly across the frequency range for the placement test. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (!user?.verified || !user.placementToken || user.placementToken !== parsed.data.token) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
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

  return Response.json({
    items: sampled.map((w) => ({
      wordId: w.id,
      term: w.term,
      transliteration: w.transliteration,
    })),
  });
}
