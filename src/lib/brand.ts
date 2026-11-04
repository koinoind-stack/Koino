/**
 * ─── BRAND CONFIGURATION — SINGLE SOURCE OF TRUTH (Task 51) ───
 *
 * Every brand-facing string, asset path, color, and metadata value in the
 * app derives from this file. A future rebrand should require changing
 * ONLY this file + the files under /public/brand/ + the NEXT_PUBLIC_SITE_URL
 * env var.
 *
 * ⚠️ Do NOT hardcode "Lordsbook" in components — import { BRAND } from here.
 *
 * LORDSBOOK DEMONSTRATION EDITION: this edition re-skins the platform with
 * Lordsbook branding. The change is reversible — the original Koino logo
 * files (public/brand/logo.png, public/koino-logo.png) are preserved and
 * still referenced by BRAND.assets.legacyLogo for installed PWAs.
 *
 * Client-safe: only NEXT_PUBLIC_* env vars are read, never private secrets.
 */

const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export const BRAND = {
  /** Public brand name (display chrome, SEO, share texts, i18n interpolation). */
  name: "Lordsbook",

  /** Tagline used in titles, landing, PWA. */
  tagline: "Faith. Fellowship. Community.",

  /** Full SEO description. */
  description:
    "Lordsbook is a Christian community platform for Scripture, churches, prayer, events, Bible trivia, Christian businesses, marketplace and fellowship.",

  /** Canonical site origin (no trailing slash). Configure via NEXT_PUBLIC_SITE_URL. */
  url: envSiteUrl || "https://www.koino.in",

  /** Contact / support email shown in footer, help, legal pages. */
  contactEmail: "koinoind@gmail.com",

  /** Rewards program display name (Trivia shop / claim flows). */
  storeName: "Lordsbook Rewards",
  rewardsName: "Faith Points",

  /** Assets — Lordsbook artwork supplied for this demonstration edition. */
  assets: {
    /** Horizontal shield + wordmark — desktop headers and wide placements. */
    logo: "/brand/lordsbook-horizontal.png",
    /** Compact shield-only mark — app icon, favicon, tight squares. */
    shield: "/brand/lordsbook-shield.png",
    /** Full square emblem (shield + banner) — auth, hero, splash surfaces. */
    emblem: "/brand/lordsbook-emblem.png",
    /** PWA icon entries (shield on deep navy, maskable-safe). */
    icon192: "/brand/icon-192.png",
    icon512: "/brand/icon-512.png",
    appleTouchIcon: "/brand/apple-touch-icon.png",
    favicon: "/brand/favicon.ico",
    /** Legacy Koino logo path kept for already-installed PWAs; do not delete. */
    legacyLogo: "/koino-logo.png",
  },

  /** Design tokens mirrored from globals.css — keep both in sync. */
  colors: {
    /** Deep navy app background. */
    background: "#071120",
    /** Sidebar / main surface navy. */
    surface: "#0A1729",
    /** Elevated card navy. */
    card: "#0F2038",
    /** Royal blue — primary actions, active nav. */
    primary: "#2563EB",
    /** Soft/electric blue for gradients and hovers. */
    primarySoft: "#3B82F6",
    /** Electric cyan — accents, live dots, highlights. */
    accent: "#22D3EE",
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
    name: "Lordsbook — Faith. Fellowship. Community.",
    shortName: "Lordsbook",
    themeColor: "#071120",
    backgroundColor: "#071120",
  },

  /** Email identity (for transactional templates / sender display name). */
  email: {
    fromName: "Lordsbook",
    signature: "— The Lordsbook Team",
  },

  /** Social/share label. */
  social: {
    shareTitle: "Lordsbook — Faith. Fellowship. Community.",
    whatsappChannelLabel: "Lordsbook WhatsApp Channel",
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
