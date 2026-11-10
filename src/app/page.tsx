import type { Metadata } from "next";

import HomeApp from "@/components/home/HomeApp";

/**
 * ─── ROOT PAGE — static shell (perf: split from share-link rendering) ────────
 *
 * This page is deliberately STATIC. The SPA lives in @/components/home/HomeApp
 * ("use client") — everything user-specific (auth, points, feed, language)
 * is fetched client-side, so the server HTML is identical for every visitor
 * and can be prerendered at build time and served from the Vercel edge cache.
 * That is the single biggest "site opens slowly" fix: TTFB drops from a
 * per-request server render (0.3–1.9s, x-vercel-cache: MISS) to an edge HIT
 * (tens of ms), the same as /privacy & /terms today.
 *
 * Share links (/?comic=genesis/1, /?view=bible&book=…, /?post=…, /?group=…,
 * /?event=…) still get REAL Open Graph metadata: src/proxy.ts rewrites those
 * URLs to /share (src/app/share/page.tsx), which kept the per-link OG
 * lookups. The visitor URL never changes; the app behaves
 * identically because HomeApp reads deep-link params client-side.
 */

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Page() {
  return <HomeApp />;
}
