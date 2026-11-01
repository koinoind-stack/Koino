// ─── GET /api/bible/versions — unified Bible version catalogue ──────────────
//
// ONE selector, ONE catalogue endpoint. Response:
//   {
//     enabled: boolean,          // YouVersion provider active
//     versions: BibleVersion[]   // YouVersion (primary) + Koino fallbacks
//   }
//
// • YouVersion enabled → live licensed catalogue (server-side App Key) +
//   Koino's public-domain fallbacks with coveredByYouVersion dedup marking.
// • YouVersion disabled or failing → Koino fallbacks only (today's behavior).
//
// SECURITY: the App Key stays on the server; this endpoint exposes version
// metadata only (names, abbreviations, language tags, public copyright text).

import { NextResponse } from "next/server";
import { getYouVersionCatalog } from "@/lib/youversion/catalog";
import { getYouVersionConfig } from "@/lib/youversion/config";
import {
  KOINO_FALLBACK_VERSIONS,
  markCoveredFallbacks,
  type BibleVersion,
} from "@/lib/bible-versions";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getYouVersionConfig();
  const youVersionVersions = await getYouVersionCatalog();

  // Primary first, then the Koino fallbacks (dedup-marked when YouVersion
  // already provides an equivalent translation, e.g. its own KJV/WEB).
  const versions: BibleVersion[] = markCoveredFallbacks([
    ...youVersionVersions,
    ...KOINO_FALLBACK_VERSIONS,
  ]);

  return NextResponse.json(
    {
      enabled: cfg.enabled && youVersionVersions.length > 0,
      versions,
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }
  );
}
