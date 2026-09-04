import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
  { path: "/data-deletion", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PAGES.map((p) => ({
    url: new URL(p.path, base).toString(),
    changeFrequency: "monthly",
    priority: p.priority,
  }));
}
