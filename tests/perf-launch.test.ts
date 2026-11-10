/**
 * Launch-perf regression tests (2026-11-04 "site is slow" audit).
 *
 * Measured production problems pinned here:
 *
 *   1. FONTS — next/font/local preloaded BOTH full Indic TTFs on every page
 *      for every visitor: NotoSansDevanagari.ttf (628KB) + NotoSansTelugu.ttf
 *      (868KB) = ~1.5MB before first paint, even for English-only readers.
 *      Fix: the faces ship as WOFF2 subsets (216KB + 244KB) declared in
 *      globals.css with `unicode-range`, so the browser downloads a face
 *      ONLY when the page actually renders that script — 0 bytes for
 *      English visits. Layout features (GSUB/GPOS) are preserved so Telugu
 *      conjuncts shape correctly. The original TTFs remain in public/fonts
 *      because the server-side share-card renderer reads them from disk.
 *   2. LOGOS — koino-logo.png / brand/logo.png / believ-logo.png were three
 *      identical 820KB PNGs (1332x1181). The brand logo is the favicon, the
 *      OG/Twitter card AND the service-worker precache — 820KB per fresh
 *      visit for a logo rendered at 32px. Fix: all three are now one 34KB
 *      512x512 palette PNG (also makes the manifest's declared 192/512 icon
 *      sizes true). SW cache bumped to v3 so existing installs re-cache the
 *      light shell.
 *
 * Technique: Node's built-in test runner (node:test) + tsx. Pure source
 * contracts and binary-size pins (fs) — no network, no database, no
 * production contact. PNG dimensions are parsed from the IHDR header.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

function pngDimensions(path: string): { width: number; height: number } {
  const buf = fs.readFileSync(path);
  // PNG signature (8B) + IHDR length/type (8B) → width @16, height @20 (u32be)
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `not a PNG: ${path}`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ─── 1. Fonts: conditional loading via unicode-range ────────────────────────

test("PF-1: layout no longer preloads the Indic TTFs through next/font/local", () => {
  const src = read("src/app/layout.tsx");
  // The heavy next/font/local faces are gone…
  assert.doesNotMatch(src, /NotoSansDevanagari\.ttf/);
  assert.doesNotMatch(src, /NotoSansTelugu\.ttf/);
  assert.doesNotMatch(src, /--font-devanagari/);
  assert.doesNotMatch(src, /--font-telugu/);
  // …and so are their variables on <body> (nothing references them anymore).
  assert.doesNotMatch(src, /notoDevanagari\.variable/);
  assert.doesNotMatch(src, /notoTelugu\.variable/);
  // Geist (the primary Latin UI face) stays on next/font.
  assert.match(src, /GeistSans/);
});

test("PF-2: globals.css declares both Indic faces with unicode-range + swap", () => {
  const css = read("src/app/globals.css");
  for (const family of ["Noto Sans Telugu", "Noto Sans Devanagari"]) {
    const blockStart = css.indexOf(`font-family: "${family}"`);
    assert.ok(blockStart !== -1, `@font-face missing for ${family}`);
    const block = css.slice(blockStart, blockStart + 400);
    assert.match(block, /format\("woff2"\)/);
    assert.match(block, /font-display: swap/);
    assert.match(block, /font-weight: 100 900/);
    assert.match(block, /unicode-range:/);
  }
  // The correct script blocks are targeted…
  const teBlock = css.slice(css.indexOf('font-family: "Noto Sans Telugu"'));
  assert.match(teBlock.slice(0, 400), /U\+0C00-0C7F/);
  const devaBlock = css.slice(css.indexOf('font-family: "Noto Sans Devanagari"'));
  assert.match(devaBlock.slice(0, 400), /U\+0900-097F/);
  // …and the sans stack tries Geist first, then the named Indic faces.
  assert.match(
    css,
    /--font-sans: var\(--font-geist-sans\), "Noto Sans Devanagari", "Noto Sans Telugu", ui-sans-serif/
  );
  // The old variable-based stack is gone.
  assert.doesNotMatch(css, /var\(--font-telugu\)/);
  assert.doesNotMatch(css, /var\(--font-devanagari\)/);
});

test("PF-3: WOFF2 subsets exist and are small; original TTFs remain for the share-card renderer", () => {
  const te = fs.statSync("public/fonts/NotoSansTelugu-web.woff2");
  const deva = fs.statSync("public/fonts/NotoSansDevanagari-web.woff2");
  assert.ok(te.size < 400 * 1024, `Telugu WOFF2 too big: ${(te.size / 1024).toFixed(0)}KB`);
  assert.ok(deva.size < 400 * 1024, `Devanagari WOFF2 too big: ${(deva.size / 1024).toFixed(0)}KB`);
  // The server-side share-card renderer still reads the full TTFs from disk.
  for (const ttf of [
    "public/fonts/NotoSansTelugu.ttf",
    "public/fonts/NotoSansDevanagari.ttf",
    "public/fonts/DejaVuSans.ttf",
  ]) {
    assert.ok(fs.existsSync(ttf), `missing server-side font: ${ttf}`);
  }
  const renderer = read("src/lib/share/card-renderer.ts");
  assert.match(renderer, /"NotoSansTelugu\.ttf"/);
  assert.match(renderer, /"NotoSansDevanagari\.ttf"/);
});

// ─── 2. Logos: 34KB 512x512 palette PNGs ────────────────────────────────────

test("PF-4: all three logo copies are ≤60KB and exactly 512x512", () => {
  for (const f of [
    "public/koino-logo.png",
    "public/brand/logo.png",
    "public/believ-logo.png",
  ]) {
    const stat = fs.statSync(f);
    assert.ok(stat.size <= 60 * 1024, `${f} too big: ${(stat.size / 1024).toFixed(0)}KB`);
    const { width, height } = pngDimensions(f);
    assert.equal(width, 512, `${f} width`);
    assert.equal(height, 512, `${f} height`);
  }
});

test("PF-5: favicon + OG + manifest still point at the approved Koino logo assets", () => {
  const layout = read("src/app/layout.tsx");
  // Phase 0 (Koino brand core): favicon wiring deliberately tightened —
  // icon/apple now use the square approved-mark PWA icon set instead of
  // BRAND.assets.logo (which the demonstration edition pointed at a wide
  // 2172x724 wordmark). Same approved artwork, correct icon geometry.
  assert.match(layout, /icon: BRAND\.assets\.icon192/);
  assert.match(layout, /apple: BRAND\.assets\.appleTouchIcon/);
  assert.match(layout, /images: \["\/koino-logo\.png"\]/);
  const manifest = read("src/app/manifest.ts");
  assert.match(manifest, /src: BRAND\.assets\.icon192/);
  assert.match(manifest, /src: BRAND\.assets\.icon512/);
  assert.match(manifest, /sizes: "192x192"/);
  assert.match(manifest, /sizes: "512x512"/);
});

// ─── 3. Service worker: cache bumped so existing installs re-cache the shell ─

test("PF-6: SW cache bumped to v3 (purges cached 820KB logo), shell list unchanged", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const CACHE_NAME = "koino-v3"/);
  assert.doesNotMatch(sw, /koino-v1|koino-v2/);
  assert.match(sw, /"\/koino-logo\.png"/);
  assert.match(sw, /caches\.keys\(\)\.then\(\(keys\) =>/);
});

// ─── 4. Suite registration ──────────────────────────────────────────────────

test("PF-7: this suite is registered in the npm test list", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.test, /tests\/perf-launch\.test\.ts/);
});
