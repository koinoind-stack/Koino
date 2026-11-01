// ─── YouVersion Platform — server-side configuration (DORMANT) ──────────────
//
// Preparation for the YouVersion Bible provider integration. NOTHING in the
// app imports this module yet — the integration stays fully dormant until the
// owner explicitly authorizes activation. This module only establishes the
// secure, server-side environment-variable contract so that adding the real
// provider later cannot touch frontend code or leak credentials.
//
// SECURITY RULES (this file is the single gate — enforced by review):
//   • YOUVERSION_APP_KEY is a SERVER-ONLY secret. It must never be prefixed
//     with NEXT_PUBLIC_, never returned in an API response, never written to
//     logs, and never imported from a client component ("use client").
//   • The module is dependency-free and Node-only (no React, no browser APIs)
//     so it can be unit-tested in isolation and statically audited.
//
// API facts this integration will rely on (https://developers.youversion.com):
//   • Base URL:   https://api.youversion.com/v1
//   • Auth:       every request carries the App Key in the `X-YVP-App-Key`
//                 header (server-to-server; no OAuth needed for content APIs)
//   • Licensing:  GET /v1/licenses (+ ?bible_id=, ?all_available=) — a Bible
//                 may require a separate license agreement before text can be
//                 served; unlicensed Bibles return HTTP 403
//   • Errors:     401 invalid key · 403 unlicensed Bible/endpoint · 429 rate
//                 limited (honor Retry-After) · 204 no content for parameters
//                 (e.g. language without accessible translations) · 5xx retry
//                 with backoff

export const YVP_DEFAULT_BASE_URL = "https://api.youversion.com";

export type YouVersionConfig = {
  /** Feature flag — true only when YOUVERSION_ENABLED=true AND a key is set. */
  enabled: boolean;
  /** Server-only secret. Never log, serialize, or send to the browser. Null when unset. */
  appKey: string | null;
  /** REST base URL without trailing slash. Overridable for tests/staging. */
  baseUrl: string;
};

/**
 * Read + validate YouVersion configuration from the server environment.
 *
 * Fails CLOSED in both directions:
 *   • Flag on + key missing  → throw (misconfiguration surfaces immediately
 *     instead of silently serving an empty provider).
 *   • Key set + flag off     → provider stays disabled (a stray key in the
 *     environment can never generate traffic before activation is authorized).
 */
export function getYouVersionConfig(): YouVersionConfig {
  const flagOn =
    (process.env.YOUVERSION_ENABLED ?? "").trim().toLowerCase() === "true";
  const appKey = (process.env.YOUVERSION_APP_KEY ?? "").trim() || null;
  const baseUrl =
    (process.env.YOUVERSION_API_BASE_URL ?? "").trim().replace(/\/+$/, "") ||
    YVP_DEFAULT_BASE_URL;

  if (flagOn && !appKey) {
    throw new Error(
      "YouVersion integration misconfigured: YOUVERSION_ENABLED=true but " +
        "YOUVERSION_APP_KEY is empty. Set the App Key from the YouVersion " +
        "Platform portal (developers.youversion.com) in the SERVER environment " +
        "— never as a NEXT_PUBLIC_* variable."
    );
  }

  return { enabled: flagOn && appKey !== null, appKey, baseUrl };
}

/**
 * Build authenticated request headers for YouVersion REST calls.
 * Throws when the provider is not enabled — callers can treat that as
 * "skip YouVersion, use the existing Koino provider".
 * The returned object contains the raw key: never log or serialize it.
 */
export function youVersionRequestHeaders(
  cfg: YouVersionConfig
): Record<string, string> {
  if (!cfg.enabled || !cfg.appKey) {
    throw new Error(
      "YouVersion provider is not enabled/configured — refusing to build request headers."
    );
  }
  return {
    "X-YVP-App-Key": cfg.appKey,
    Accept: "application/json",
  };
}

/**
 * Safe, human-readable description for diagnostics/support tickets.
 * Shows only the key LENGTH and a 4-char masked tail — never the full key —
 * so this string is safe to paste into logs, screenshots or emails.
 */
export function describeYouVersionConfig(cfg: YouVersionConfig): string {
  if (!cfg.enabled || !cfg.appKey) return "YouVersion provider: disabled";
  const tail = cfg.appKey.slice(-4);
  return `YouVersion provider: enabled (key ***${tail}, ${cfg.appKey.length} chars, base ${cfg.baseUrl})`;
}
