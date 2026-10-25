/**
 * ─── UNIVERSAL SHARE-CARD RENDERER (Task 121) ────────────────────────────────
 *
 * The ONE server-side generator every Koino share image goes through.
 * Pipeline (proven in-repo by /api/comic/share): build an SVG layout →
 * rasterize with sharp → PNG buffer.
 *
 * Design rules (share spec):
 *  • Subtle, consistent Koino branding: small logo mark top-centre, discreet
 *    "koino.in" pill bottom-centre.
 *  • Readable typography, wrapped text, no overflow — long bodies clamp with
 *    an ellipsis instead of spilling.
 *  • Real content only: callers pass already-validated data (the API route
 *    enforces visibility/privacy gates before rendering).
 *  • Background images are composited ONLY when the caller marked them as
 *    Koino-hosted (own artwork / user uploads). Third-party images (e.g.
 *    YouTube thumbnails) are never used — a branded gradient is rendered
 *    instead, so no Koino branding sits over copyrighted media.
 *
 * Server-only: imports sharp. Not client-safe.
 */

import sharp from "sharp";
import fs from "fs";
import os from "os";
import path from "path";

/* ─── Bundled fonts (Vercel serverless ships NO system fonts) ─────────────
 * librsvg renders SVG <text> through pango/fontconfig. On Vercel's minimal
 * Node runtime there are no fonts at all — every glyph becomes a tofu box.
 * Fix: ship DejaVu (Latin) + Noto Sans Devanagari/Telugu (Hindi/Telugu comic
 * titles) inside public/fonts and provision an isolated fontconfig tree in
 * /tmp at module load, BEFORE the first fontconfig initialisation.
 * Setting FONTCONFIG_PATH replaces the (empty) system config with exactly
 * our fonts — which is also why local smoke tests prove the same behaviour. */
const BUNDLED_FONTS = [
  "DejaVuSans.ttf",
  "DejaVuSans-Bold.ttf",
  "DejaVuSerif.ttf",
  "DejaVuSerif-Bold.ttf",
  "NotoSansDevanagari.ttf",
  "NotoSansTelugu.ttf",
];

let fontConfigReady = false;
function ensureFontConfig(): void {
  if (fontConfigReady) return;
  fontConfigReady = true;
  try {
    if (process.env.FONTCONFIG_PATH) return; // already provisioned by the host
    const dir = path.join(os.tmpdir(), "koino-share-fonts");
    fs.mkdirSync(dir, { recursive: true });
    for (const f of BUNDLED_FONTS) {
      const dst = path.join(dir, f);
      if (!fs.existsSync(dst)) {
        try {
          fs.copyFileSync(path.join(process.cwd(), "public", "fonts", f), dst);
        } catch {
          /* missing file: the remaining fonts still cover most scripts */
        }
      }
    }
    fs.writeFileSync(
      path.join(dir, "fonts.conf"),
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${dir}</dir>\n  <cachedir>${dir}/cache</cachedir>\n</fontconfig>\n`
    );
    process.env.FONTCONFIG_PATH = dir;
  } catch {
    /* /tmp unavailable — fall back to whatever system fonts exist */
  }
}
ensureFontConfig();

export type CardFormat = "square" | "portrait" | "story" | "landscape";

export const CARD_DIMS: Record<CardFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 630 },
};

export function isCardFormat(v: string | null | undefined): v is CardFormat {
  return v === "square" || v === "portrait" || v === "story" || v === "landscape";
}

/** What the renderer needs. All text is plain (unescaped) — we escape here. */
export type CardSpec = {
  format: CardFormat;
  /** Small uppercase line above the title, e.g. "BIBLE COMICS • GENESIS 1". */
  kicker?: string;
  /** Main headline. */
  title: string;
  /** Excerpt / body copy. Clamped per format. */
  body?: string;
  /** Chip near the footer, e.g. "Genesis 1:1 (KJV)" or "₹499 • Marketplace". */
  reference?: string;
  /** Background image URL — composite only if isKoinoHosted. */
  bgImageUrl?: string | null;
  /**
   * True when bgImageUrl points at Koino's own storage (our artwork or a
   * user upload being shared by its owner). When false/absent the card
   * renders the branded gradient — never a third-party image.
   */
  bgIsKoinoHosted?: boolean;
  /** Rotates gradient palettes so different content types feel distinct. */
  gradientSeed?: number;
};

/* ─── XML safety ─────────────────────────────────────────────────────────── */

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // strip control chars that break SVG text rendering
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/* ─── Text wrapping with ellipsis clamp ──────────────────────────────────── */

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + " " + word).length > maxChars) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  const consumed = lines.join(" ").length;
  if (consumed < text.trim().length - 1 && lines.length === maxLines) {
    // clamp: make the last line end with an ellipsis
    let last = lines[maxLines - 1];
    while (last.length > 3 && last.length + 1 > maxChars) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, "") + "…";
  }
  return lines;
}

/* ─── Palettes (mirrors BRAND.colors family) ─────────────────────────────── */

type Palette = { deep: string; mid: string; glow: string; accent: string };

const PALETTES: Palette[] = [
  { deep: "#14101F", mid: "#221A38", glow: "#F39B9B", accent: "#F39B9B" }, // comics rose
  { deep: "#120F1E", mid: "#1E1740", glow: "#7C3AED", accent: "#A78BFA" }, // brand violet
  { deep: "#0E1420", mid: "#13233C", glow: "#38BDF8", accent: "#7DD3FC" }, // watch sky
  { deep: "#171122", mid: "#2A1B33", glow: "#EC4899", accent: "#F9A8D4" }, // memorial pink
  { deep: "#131A16", mid: "#1B2B22", glow: "#22C55E", accent: "#86EFAC" }, // trivia green
];

/* ─── Cached assets ──────────────────────────────────────────────────────── */

let logoB64: string | null = null;
function getLogoBase64(): string {
  if (logoB64 !== null) return logoB64;
  try {
    const p = path.join(process.cwd(), "public", "brand", "logo.png");
    const buf = fs.readFileSync(p);
    logoB64 = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    logoB64 = "";
  }
  return logoB64;
}

const bgCache = new Map<string, Buffer>();
const BG_CACHE_MAX = 64;

async function fetchBackground(url: string): Promise<Buffer | null> {
  const hit = bgCache.get(url);
  if (hit) return hit;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "KoinoShareCard/1.0" },
    });
    if (!res.ok) return null;
    const arr = Buffer.from(await res.arrayBuffer());
    if (arr.length > 8 * 1024 * 1024) return null;
    const out = await sharp(arr).jpeg({ quality: 82 }).toBuffer();
    if (bgCache.size >= BG_CACHE_MAX) {
      const first = bgCache.keys().next().value;
      if (first) bgCache.delete(first);
    }
    bgCache.set(url, out);
    return out;
  } catch {
    return null;
  }
}

/* ─── Main renderer ──────────────────────────────────────────────────────── */

export async function renderShareCard(spec: CardSpec): Promise<Buffer> {
  const { width, height } = CARD_DIMS[spec.format];
  const palette = PALETTES[Math.abs(spec.gradientSeed ?? 0) % PALETTES.length];

  const isLandscape = spec.format === "landscape";

  // Layout metrics per format.
  const kickerSize = isLandscape ? 26 : 30;
  const titleSize = isLandscape ? 54 : spec.format === "square" ? 58 : 62;
  const bodySize = isLandscape ? 30 : 33;
  const titleMaxChars = isLandscape ? 30 : 24;
  const bodyMaxChars = isLandscape ? 46 : 40;
  const titleLinesMax = 3;
  const bodyLinesMax = isLandscape
    ? 3
    : spec.format === "story"
      ? 14
      : spec.format === "portrait"
        ? 9
        : 7;

  const kicker = (spec.kicker || "").trim().slice(0, 90);
  const title = spec.title.trim().slice(0, 220) || "Koino";
  const body = (spec.body || "").trim().replace(/\s+\n/g, "\n").slice(0, 1200);
  const reference = (spec.reference || "").trim().slice(0, 80);

  const kickerLines = kicker ? wrapText(kicker, titleMaxChars + 8, 1) : [];
  const titleLines = wrapText(title, titleMaxChars, titleLinesMax);
  const bodyLines = body ? wrapText(body, bodyMaxChars, bodyLinesMax) : [];

  // Background: real artwork (Koino-hosted only) or branded gradient.
  let bgImageBuf: Buffer | null = null;
  if (spec.bgImageUrl && spec.bgIsKoinoHosted) {
    bgImageBuf = await fetchBackground(spec.bgImageUrl);
  }

  const logoTag = `<image href="${getLogoBase64()}" x="${width / 2 - 26}" y="${isLandscape ? 36 : 56}" width="52" height="52" opacity="0.92" preserveAspectRatio="xMidYMid meet"/>`;
  const scrimOpacity = bgImageBuf ? 1 : 0;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.mid}"/>
      <stop offset="100%" stop-color="${palette.deep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${palette.deep}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scrim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#05030A" stop-opacity="0.94"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect width="${width}" height="${height}" fill="url(#scrim)" opacity="${scrimOpacity}"/>
  ${logoTag}

  ${kickerLines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${(isLandscape ? 128 : 176) + i * (kickerSize + 10)}" text-anchor="middle" fill="${palette.accent}" font-family="Arial, 'DejaVu Sans', 'Liberation Sans', sans-serif" font-size="${kickerSize}" font-weight="bold" letter-spacing="6">${escapeXml(line.toUpperCase())}</text>`
    )
    .join("")}

  ${titleLines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${(isLandscape ? 190 : 240) + i * (titleSize + 14)}" text-anchor="middle" fill="#FFFFFF" font-family="Georgia, 'DejaVu Serif', 'Liberation Serif', serif" font-size="${titleSize}" font-weight="bold">${escapeXml(line)}</text>`
    )
    .join("")}

  ${bodyLines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${bodyTop(spec.format, height, bodyLines.length, bodySize) + i * (bodySize + 12)}" text-anchor="middle" fill="#D7D3E4" font-family="Arial, 'DejaVu Sans', 'Liberation Sans', sans-serif" font-size="${bodySize}">${escapeXml(line)}</text>`
    )
    .join("")}

  ${
    reference
      ? (() => {
          const chipW = Math.min(width - 192, reference.length * 13 + 72);
          const chipX = width / 2 - chipW / 2;
          const chipY = height - (spec.format === "story" ? 210 : 186);
          return `<rect x="${chipX}" y="${chipY}" width="${chipW}" height="52" rx="26" fill="#FFFFFF" fill-opacity="0.07" stroke="${palette.accent}" stroke-opacity="0.45"/>
  <text x="${width / 2}" y="${chipY + 34}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, 'DejaVu Sans', 'Liberation Sans', sans-serif" font-size="26" font-weight="bold">${escapeXml(reference)}</text>`;
        })()
      : ""
  }

  <rect x="${width / 2 - 92}" y="${height - 104}" width="184" height="48" rx="24" fill="#FFFFFF" fill-opacity="0.92"/>
  <text x="${width / 2}" y="${height - 72}" text-anchor="middle" fill="${palette.deep}" font-family="Arial, 'DejaVu Sans', 'Liberation Sans', sans-serif" font-size="24" font-weight="bold">koino.in</text>
</svg>`;

  if (bgImageBuf) {
    const cover = await sharp(bgImageBuf)
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    const svgPng = await sharp(Buffer.from(svg)).png().toBuffer();
    return sharp({
      create: { width, height, channels: 4, background: palette.deep },
    })
      .composite([
        { input: cover, left: 0, top: 0 },
        { input: svgPng, left: 0, top: 0 },
      ])
      .png()
      .toBuffer();
  }
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Body block is anchored above the reference chip + footer. */
function bodyTop(
  format: CardFormat,
  height: number,
  lineCount: number,
  bodySize: number
): number {
  if (format === "landscape") return height - 250 - (lineCount - 1) * (bodySize + 12);
  if (format === "story") return height - 480 - (lineCount - 1) * (bodySize + 12);
  if (format === "portrait") return height - 400 - (lineCount - 1) * (bodySize + 12);
  return height - 360 - (lineCount - 1) * (bodySize + 12);
}

/* ─── Koino-hosted image test (branding/copyright rule) ─────────────────── */

let supabaseHost: string | null = null;
function getSupabaseHost(): string | null {
  if (supabaseHost !== null) return supabaseHost;
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    supabaseHost = u.host;
  } catch {
    supabaseHost = "";
  }
  return supabaseHost || null;
}

/**
 * True when the image lives on Koino's own storage (Supabase public bucket)
 * or the Koino site itself. Only these may be composited under the
 * Koino-branded share card. Third-party/CDN images (YouTube, unsplash, …)
 * never carry Koino overlays.
 */
export function isKoinoHostedImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).host;
    const sb = getSupabaseHost();
    if (sb && host === sb) return true;
    if (host === "www.koino.in" || host === "koino.in") return true;
    return false;
  } catch {
    return false;
  }
}
