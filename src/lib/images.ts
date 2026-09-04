import OpenAI from "openai";
import { put } from "@vercel/blob";
import type { User, Word } from "@prisma/client";
import { prisma } from "./db";
import { sendWhatsAppImage } from "./whatsapp";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
const IMAGE_SIZE = "1024x1024";

export type ImageWord = Pick<Word, "term" | "translation" | "kind" | "language">;

/** Env kill-switch: `WORD_IMAGES=off` disables image generation and sending for everyone. */
export function wordImagesEnabled(): boolean {
  return (process.env.WORD_IMAGES ?? "on").toLowerCase() !== "off";
}

export function wordImagePrompt(word: ImageWord): string {
  const subject =
    word.kind === "word"
      ? `the concept "${word.translation}"`
      : `the everyday situation in which someone would say "${word.translation}" (a tiny scene with one or two simple stick-figure-style people)`;
  return [
    `A super simple tldraw-style whiteboard doodle of ${subject}.`,
    "Hand-drawn look: loose, slightly wobbly black marker outlines, a few flat fills in 2-3 bright colors, no shading or gradients.",
    "One central subject, lots of empty space, plain white background.",
    "Absolutely no text, letters, numbers, labels, speech bubbles, or captions anywhere in the image.",
  ].join(" ");
}

/** Generate an illustration for a word with OpenAI Images. Returns the encoded bytes. */
export async function generateWordImage(word: ImageWord): Promise<{ data: Buffer; contentType: string }> {
  const prompt = wordImagePrompt(word);
  const isGptImage = IMAGE_MODEL.startsWith("gpt-image");
  const res = await openai.images.generate(
    isGptImage
      ? {
          model: IMAGE_MODEL,
          prompt,
          n: 1,
          size: IMAGE_SIZE,
          quality: "low",
          output_format: "jpeg",
          output_compression: 80,
        }
      : {
          model: IMAGE_MODEL,
          prompt,
          n: 1,
          size: IMAGE_SIZE,
          quality: "standard",
          response_format: "b64_json",
        }
  );
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error(`OpenAI image response had no b64_json (model ${IMAGE_MODEL})`);
  return {
    data: Buffer.from(b64, "base64"),
    contentType: isGptImage ? "image/jpeg" : "image/png",
  };
}

/**
 * Return the cached public URL for a word's illustration, generating and
 * uploading it to Vercel Blob on first use. Generated once per word, shared by all users.
 */
export async function getOrCreateWordImageUrl(word: Word): Promise<string> {
  if (word.imageUrl) return word.imageUrl;

  const fresh = await prisma.word.findUnique({ where: { id: word.id }, select: { imageUrl: true } });
  if (fresh?.imageUrl) return fresh.imageUrl;

  const { data, contentType } = await generateWordImage(word);
  const ext = contentType === "image/png" ? "png" : "jpg";
  const blob = await put(`word-images/${word.language}/${word.id}.${ext}`, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  await prisma.word.update({ where: { id: word.id }, data: { imageUrl: blob.url } });
  return blob.url;
}

/** One field per line: mixing RTL script with Latin on one line scrambles WhatsApp rendering. */
export function wordImageCaption(word: Pick<Word, "term" | "transliteration" | "translation">): string {
  return [word.term, word.transliteration, word.translation].filter((s): s is string => Boolean(s)).join("\n");
}

/**
 * Send a generated picture for each new word in today's lesson. Images are
 * generated in parallel; every failure is logged and swallowed so the text
 * lesson (already sent) is never affected.
 */
export async function sendNewWordImages(user: User, words: Word[]): Promise<void> {
  if (!wordImagesEnabled() || !user.wantsImages || words.length === 0) return;

  const urls = await Promise.all(
    words.map(async (w) => {
      try {
        return await getOrCreateWordImageUrl(w);
      } catch (err) {
        console.error(`word image generation failed for word ${w.id} (${w.term})`, err);
        return null;
      }
    })
  );

  for (let i = 0; i < words.length; i++) {
    const imageUrl = urls[i];
    if (!imageUrl) continue;
    try {
      await sendWhatsAppImage({
        userId: user.id,
        to: user.phone,
        imageUrl,
        caption: wordImageCaption(words[i]),
        kind: "word_image",
      });
    } catch (err) {
      console.error(`word image send failed for user ${user.id}, word ${words[i].id}`, err);
    }
  }
}
