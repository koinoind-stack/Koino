/**
 * ─── BRAND CONFIGURATION — SINGLE SOURCE OF TRUTH (Task 51) ───
 *
 * Every brand-facing string, asset path, color, and metadata value in the
 * app derives from this file. A future rebrand (e.g. Koino → LordsBook)
 * should require changing ONLY this file + /public/brand/logo.png + the
 * NEXT_PUBLIC_SITE_URL env var — see docs/REBRAND-AND-LORDSBOOK-READINESS.md.
 *
 * ⚠️ Do NOT hardcode "Koino" in components — import { BRAND } from here.
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

  /** Assets — a brand-neutral path so a rebrand swaps the FILE, not code. */
  assets: {
    logo: "/brand/logo.png", // canonical logo (public/brand/logo.png)
    /** Legacy logo path kept for already-installed PWAs; do not delete. */
    legacyLogo: "/koino-logo.png",
  },

  /** Design tokens mirrored from globals.css — keep both in sync. */
  colors: {
    background: "#12101A",
    surface: "#0B1120",
    card: "#111827",
    primary: "#7C3AED",
    primarySoft: "#A78BFA",
    accent: "#38BDF8",
    pink: "#EC4899",
    amber: "#F59E0B",
    muted: "#94A3B8",
  },

  /** PWA metadata. */
  pwa: {
    name: "Koino — Faith. Fellowship. Belong.",
    shortName: "Koino",
    themeColor: "#12101A",
    backgroundColor: "#12101A",
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
