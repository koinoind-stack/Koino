/**
 * ─── BRAND CONFIGURATION — SINGLE SOURCE OF TRUTH (Task 51) ───
 *
 * Every brand-facing string, asset path, color, and metadata value in the
 * app derives from this file. A future rebrand should require changing
 * ONLY this file + the files under /public/brand/ + the NEXT_PUBLIC_SITE_URL
 * env var.
 *
 * ⚠️ Do NOT hardcode "Koino" in components — import { BRAND } from here.
 *
 * KOINO (www.koino.in) — approved brand: logo public/koino-logo.png
 * (gradient k+cross mark, wordmark, tagline), tagline
 * "Faith. Fellowship. Belong.", palette per the approved design tokens
 * (navy #090D18, secondary navy #0D1322, card #111827, elevated card
 * #172033, primary purple #873EFF, lavender #B68AFF). The PWA icon set
 * under /public/brand/ is derived from the approved Koino mark on the
 * approved navy.
 *
 * Client-safe: only NEXT_PUBLIC_* env vars are read, never private secrets.
 */

const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export const BRAND = {
  /** Public brand name (display chrome, SEO, share texts, i18n interpolation). */
  name: "Koino",

  /** Tagline used in titles, landing, PWA. */
  tagline: "Faith. Fellowship. Belong.",

  /** Full SEO description. */
  description:
    "Koino is a Christian community platform for Scripture, churches, prayer, events, Bible trivia, Christian businesses, marketplace and fellowship.",

  /** Canonical site origin (no trailing slash). Configure via NEXT_PUBLIC_SITE_URL. */
  url: envSiteUrl || "https://www.koino.in",

  /** Contact / support email shown in footer, help, legal pages. */
  contactEmail: "koinoind@gmail.com",

  /** Rewards program display name (Trivia shop / claim flows). */
  storeName: "Koino Rewards",
  rewardsName: "Faith Points",

  /** Assets — approved Koino artwork (public/koino-logo.png, public/logo.svg). */
  assets: {
    /** Approved Koino lockup (mark + wordmark) — headers and hero. */
    logo: "/koino-logo.png",
    /** Approved Koino mark (square, transparent) — tight squares, avatars. */
    shield: "/koino-logo.png",
    /** Full square emblem — auth, hero, splash surfaces (same approved art). */
    emblem: "/koino-logo.png",
    /** PWA icon entries (Koino mark on approved navy, maskable-safe). */
    icon192: "/brand/icon-192.png",
    icon512: "/brand/icon-512.png",
    appleTouchIcon: "/brand/apple-touch-icon.png",
    favicon: "/brand/favicon.ico",
    /** Legacy Koino logo path kept for already-installed PWAs; do not delete. */
    legacyLogo: "/koino-logo.png",
  },

  /** Design tokens mirrored from globals.css — keep both in sync.
   *  Approved Koino palette anchors below; orange/gold/silver/muted stay as
   *  functional accents from the approved design. */
  colors: {
    /** Deep navy app background (approved). */
    background: "#090D18",
    /** Secondary navy — sidebar / main surface (approved). */
    surface: "#0D1322",
    /** Card navy (approved). */
    card: "#111827",
    /** Elevated card navy (approved). */
    cardElevated: "#172033",
    /** Primary purple — primary actions, active nav (approved). */
    primary: "#873EFF",
    /** Lavender — soft accents, gradients, hovers (approved). */
    primarySoft: "#B68AFF",
    /** Lavender accent slot (approved). */
    accent: "#B68AFF",
    /** Orange — CTA highlights and attention. */
    orange: "#F97316",
    /** Gold accent (cross flame / premium touches). */
    gold: "#F5B84A",
    /** Silver accent (metallic text edges). */
    silver: "#C3CAD6",
    /** Muted slate text. */
    muted: "#94A3B8",
  },

  /** PWA metadata. */
  pwa: {
    name: "Koino — Faith. Fellowship. Belong.",
    shortName: "Koino",
    themeColor: "#090D18",
    backgroundColor: "#090D18",
  },

  /** Email identity (for transactional templates / sender display name). */
  email: {
    fromName: "Koino",
    signature: "— The Koino Team",
  },

  /** Social/share label. */
  social: {
    shareTitle: "Koino — Faith. Fellowship. Belong.",
    whatsappChannelLabel: "Koino WhatsApp Channel",
  },
} as const;

/** <title> for the root layout. */
export const SITE_TITLE = `${BRAND.name} — ${BRAND.tagline}`;

/** Canonical URL helper: joins BRAND.url with a path safely. */
export function siteUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BRAND.url}${clean === "/" ? "" : clean}`;
}

/**
 * Display host (www stripped) for UI copy like "Visit koino.in".
 */
export const DISPLAY_HOST = BRAND.url.replace(/^https?:\/\//, "").replace(/^www\./, "");
