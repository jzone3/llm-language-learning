import { NextRequest } from "next/server";
import { runHourlyTick } from "@/lib/engine";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await runHourlyTick();
  return Response.json({ ok: true, results });
}
