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

import { NextResponse } from "next/server";
import { resolveChapter } from "@/lib/bible-server";

export const dynamic = "force-dynamic";

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
