/**
 * Regression tests — Phase 1 Fix 4: production security headers.
 *
 * next.config.ts used to send only the X-Koino-Round deploy marker. These
 * tests pin the full header set (HSTS, X-Content-Type-Options,
 * X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP) AND the CSP
 * guarantees that keep the existing integrations working:
 *   - Google OAuth / Supabase / Vercel: connect-src must allow 'self',
 *     https: and wss: (Supabase REST + realtime WebSocket);
 *   - image/video uploads and remote media: img-src/media-src must allow
 *     https: (+ data:/blob:);
 *   - Next.js hydration: script-src keeps 'unsafe-inline' (+ 'unsafe-eval');
 *   - clickjacking protection: frame-ancestors 'self' + XFO SAMEORIGIN.
 *
 * Technique: plain unit test over the exported async headers() config —
 * no mocks needed (next.config.ts imports NextConfig as a type only).
 * No network, no database.
 *
 * Run: npm test
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };
type NextConfigModule = {
  default: { headers?: () => Promise<HeaderRule[]> };
};

let rules: HeaderRule[] = [];
let globalHeaders: Array<{ key: string; value: string }> = [];
const headerMap = new Map<string, string>();

before(async () => {
  const cfg = (await import("../next.config")) as NextConfigModule;
  assert.equal(typeof cfg.default.headers, "function", "next.config.ts must keep its headers() hook");
  rules = (await cfg.default.headers!()) ?? [];
  const global = rules.find((r) => r.source === "/:path*");
  assert.ok(global, "headers() must define a '/:path*' rule set");
  globalHeaders = global.headers;
  for (const h of globalHeaders) headerMap.set(h.key, h.value);
});

function headerValue(key: string): string {
  const v = headerMap.get(key);
  assert.ok(v !== undefined, `header ${key} must be present on every response`);
  return v;
}

/** Parse a CSP string into directive → source-set map. */
function parseCsp(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(";").map((s) => s.trim()).filter(Boolean)) {
    const tokens = part.split(/\s+/);
    map.set(tokens[0], tokens.slice(1));
  }
  return map;
}

// ════════════════════════════════════════════════════════════════════════════
// Header presence + values
// ════════════════════════════════════════════════════════════════════════════

test("SH-1: Strict-Transport-Security present — ≥180 days, includeSubDomains, NO preload", () => {
  const v = headerValue("Strict-Transport-Security");
  const maxAge = Number(/max-age=(\d+)/.exec(v)?.[1]);
  assert.ok(Number.isFinite(maxAge) && maxAge >= 15552000, `HSTS max-age too small: ${v}`);
  assert.match(v, /includeSubDomains/);
  assert.doesNotMatch(v, /preload/, "preload must NOT be enabled (irreversible; subdomains not verified)");
});

test("SH-2: X-Content-Type-Options is nosniff", () => {
  assert.equal(headerValue("X-Content-Type-Options"), "nosniff");
});

test("SH-3: X-Frame-Options is SAMEORIGIN (clickjacking backstop)", () => {
  assert.equal(headerValue("X-Frame-Options"), "SAMEORIGIN");
});

test("SH-4: Referrer-Policy is strict-origin-when-cross-origin (OAuth-safe)", () => {
  assert.equal(headerValue("Referrer-Policy"), "strict-origin-when-cross-origin");
});

test("SH-5: Permissions-Policy disables camera, microphone, geolocation", () => {
  const v = headerValue("Permissions-Policy");
  assert.match(v, /camera=\(\)/);
  assert.match(v, /microphone=\(\)/);
  assert.match(v, /geolocation=\(\)/);
});

test("SH-6: deploy marker X-Koino-Round preserved (deploy verification intact)", () => {
  assert.equal(headerValue("X-Koino-Round"), "comics-back-nav");
});

// ════════════════════════════════════════════════════════════════════════════
// CSP — hardening guarantees
// ════════════════════════════════════════════════════════════════════════════

test("SH-7: CSP present and parseable, default-src 'self'", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  assert.deepEqual(csp.get("default-src"), ["'self'"]);
});

test("SH-8: CSP frame-ancestors 'self' + object-src 'none' + base-uri 'self' (strict hardening)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  assert.deepEqual(csp.get("frame-ancestors"), ["'self'"]);
  assert.deepEqual(csp.get("object-src"), ["'none'"]);
  assert.deepEqual(csp.get("base-uri"), ["'self'"]);
  assert.deepEqual(csp.get("form-action"), ["'self'"]);
  assert.ok(csp.get("upgrade-insecure-requests"), "upgrade-insecure-requests must be set");
});

// ════════════════════════════════════════════════════════════════════════════
// CSP — integration-safety guarantees (must NOT break existing features)
// ════════════════════════════════════════════════════════════════════════════

test("SH-9: connect-src allows self + https: + wss: (Google/Supabase REST + realtime/Vercel)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  const connect = csp.get("connect-src") ?? [];
  assert.ok(connect.includes("'self'"), "same-origin API calls must stay allowed");
  assert.ok(connect.includes("https:"), "any external https API (Supabase/Google) must stay reachable");
  assert.ok(connect.includes("wss:"), "Supabase realtime WebSocket must stay reachable");
});

test("SH-10: img-src allows https: + data: + blob: (uploads, avatars, thumbnails never break)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  const img = csp.get("img-src") ?? [];
  for (const token of ["'self'", "data:", "blob:", "https:"]) {
    assert.ok(img.includes(token), `img-src must include ${token}`);
  }
});

test("SH-11: media-src allows https: + blob: (post/reel video playback never breaks)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  const media = csp.get("media-src") ?? [];
  assert.ok(media.includes("https:"));
  assert.ok(media.includes("blob:"));
});

test("SH-12: script-src keeps 'self' + 'unsafe-inline' (Next.js hydration keeps working)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  const script = csp.get("script-src") ?? [];
  assert.ok(script.includes("'self'"));
  assert.ok(script.includes("'unsafe-inline'"), "removing 'unsafe-inline' requires a nonce rollout first");
});

test("SH-13: style-src keeps 'unsafe-inline' (Tailwind/shadcn inline styles keep working)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  const style = csp.get("style-src") ?? [];
  assert.ok(style.includes("'unsafe-inline'"));
});

test("SH-14: frame-src allows https: (embedded external content, e.g. YouTube, keeps working)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  const frame = csp.get("frame-src") ?? [];
  assert.ok(frame.includes("https:"));
  assert.ok(frame.includes("'self'"));
});

test("SH-15: worker-src allows 'self' + blob: (service worker registration keeps working)", () => {
  const csp = parseCsp(headerValue("Content-Security-Policy"));
  const worker = csp.get("worker-src") ?? [];
  assert.ok(worker.includes("'self'"));
  assert.ok(worker.includes("blob:"));
});
