// ─── GET /api/bible/chapter — ONE chapter endpoint for the ONE reader ───────
//
// Query params:
//   version  VersionRef ("youversion:3034" / "koino:kjv")  [default koino:kjv]
//   book     Koino book slug ("john", "1corinthians", …)
//   chapter  1-based chapter number
//
// Responses:
//   200 { reference, verses[], translation_id, translation_name, provider,
//         versionRef, versionAbbr, versionLabel, languageTag, attribution }
//   4xx/5xx { error: { kind, message } } — kind drives the reader's graceful
//   unavailable state (unlicensed / rate_limited / network / bad_request…).
//
// SECURITY: server-only. The YouVersion App Key never leaves this process;
// errors never echo headers or auth material.
// ABUSE GUARD: per-client rate limit (rateLimitClient) upstream of the cache
// and both providers — normal reading is a few chapters per minute, so
// 60/min/client is far above legitimate use while capping scraping loops and
// runaway prefetchers before they reach YouVersion/bible-api.com quotas.

import { NextResponse } from "next/server";
import { rateLimitClient } from "@/lib/social/rate-limit";
import { resolveChapter } from "@/lib/bible-server";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

const KIND_STATUS: Record<string, number> = {
  bad_request: 400,
  unlicensed: 403,
  not_found: 404,
  empty: 404,
  rate_limited: 429,
  disabled: 503,
  unauthorized: 502,
  server: 502,
  network: 502,
};

export async function GET(request: Request) {
  if (!rateLimitClient(request, "bible:chapter", RATE_LIMIT, RATE_WINDOW_MS)) {
    // Same error taxonomy as resolveChapter failures so the reader renders
    // its friendly "slow down" state instead of a generic error.
    return NextResponse.json(
      { error: { kind: "rate_limited", message: "Too many requests — please slow down." } },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const url = new URL(request.url);
  const version = url.searchParams.get("version") || "koino:kjv";
  const book = url.searchParams.get("book");
  const chapter = url.searchParams.get("chapter");

  const result = await resolveChapter(version, book, chapter);

  if (!result.ok) {
    return NextResponse.json(
      { error: { kind: result.kind, message: result.message } },
      { status: KIND_STATUS[result.kind] ?? 502 }
    );
  }

  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
