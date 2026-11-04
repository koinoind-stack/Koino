import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Deploy-verification marker: lets us confirm a server-side-only change is
  // live with `curl -I https://www.koino.in` (server code is not visible in
  // public JS chunks). Bump the value on each server-side round.
  //
  // Phase 1 Fix 4 — production security headers on EVERY response:
  //
  //   Strict-Transport-Security   180 days + includeSubDomains. No `preload`
  //                               directive on purpose: preload is close to
  //                               irreversible and requires EVERY subdomain
  //                               to be HTTPS-ready first.
  //   X-Content-Type-Options      nosniff — browsers honor the declared MIME.
  //   X-Frame-Options             SAMEORIGIN — clickjacking backstop for
  //                               older browsers (modern ones use CSP
  //                               frame-ancestors 'self', set below).
  //   Referrer-Policy             strict-origin-when-cross-origin — default
  //                               hardened value; preserves the query-less
  //                               origin handoff OAuth flows rely on.
  //   Permissions-Policy          camera/microphone/geolocation off — the
  //                               app uses none of them.
  //   Content-Security-Policy     enforced, but shaped so it CANNOT break the
  //                               existing integrations (Google OAuth redirect
  //                               flow, Supabase REST/realtime/storage,
  //                               image/video uploads, Vercel):
  //                                 * fetch-style directives carry `https:`
  //                                   fallbacks (img/media/connect/frame), so
  //                                   any current or future external host
  //                                   keeps working;
  //                                 * the directives that give real hardening
  //                                   without integration risk are enforced
  //                                   strictly: frame-ancestors 'self'
  //                                   (framing), object-src 'none' (plugins),
  //                                   base-uri 'self' (base hijack),
  //                                   form-action 'self',
  //                                   upgrade-insecure-requests;
  //                                 * script-src keeps 'unsafe-inline' +
  //                                   'unsafe-eval' for Next.js hydration and
  //                                   library compatibility — tightening to
  //                                   nonces is documented follow-up work and
  //                                   must be rollout behind report-only
  //                                   monitoring.
  async headers() {
    const CSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Koino-Round", value: "comics-back-nav" },
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
  /* Share-card font fix: guarantee the bundled TTFs (public/fonts) reach the
   * /api/share-card serverless bundle. The renderer copies them into an
   * isolated fontconfig tree at module load; without tracing they can be
   * absent in some runtimes and every glyph renders as tofu. */
  outputFileTracingIncludes: {
    "/api/share-card": ["./public/fonts/**/*", "./public/brand/logo.png"],
  },
  /* Prisma tracing fix (approved 2026-10-27): stop copying 21 never-executed
   * WASM runtime variants into every serverless function. Koino uses the
   * Node.js library engine (verified: engineType "library", no driver
   * adapters / Accelerate in src or lockfile), whose runtime is
   * runtime/library.js + libquery_engine-*.so.node - NOT these files:
   *  - @prisma/client/runtime/*wasm-base64* (20 files, ~53.3MB per function):
   *    only reachable via the edge/workerd/driver-adapter entry branches
   *  - .prisma/client/query_engine_bg.wasm (2.19MB): only reachable via the
   *    wasm engine loader used by edge/driver-adapter modes
   * Excluding them here only filters Next's own file trace (the same .nft.json
   * Vercel bundles from); it does not change any runtime behavior on Node.
   * Library-engine files (.so.node, library.js, generated client) untouched. */
  outputFileTracingExcludes: {
    "/api/**": [
      "node_modules/@prisma/client/runtime/*wasm-base64*",
      "node_modules/.prisma/client/query_engine_bg.wasm",
      // v2 additions (2026-10-28 audit): residual edge/wasm-only stubs still
      // traced (~0.8MB per function). Unused on the Node.js library engine
      // (verified: no @prisma/client/edge import, no queryCompiler/driver
      // adapters/Accelerate anywhere in src). Library-engine files untouched.
      "node_modules/.prisma/client/edge*",
      "node_modules/.prisma/client/wasm*",
      "node_modules/.prisma/client/index-browser*",
      "node_modules/.prisma/client/query_engine_bg.*",
      "node_modules/@prisma/client/runtime/query_compiler_bg.*",
      "node_modules/@prisma/client/runtime/index-browser*",
    ],
    "/**": [
      "node_modules/@prisma/client/runtime/*wasm-base64*",
      "node_modules/.prisma/client/query_engine_bg.wasm",
      "node_modules/.prisma/client/edge*",
      "node_modules/.prisma/client/wasm*",
      "node_modules/.prisma/client/index-browser*",
      "node_modules/.prisma/client/query_engine_bg.*",
      "node_modules/@prisma/client/runtime/query_compiler_bg.*",
      "node_modules/@prisma/client/runtime/index-browser*",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Keep native / ESM-only deps as server-external so Turbopack does NOT
  // attempt to bundle them (which breaks @napi-rs/canvas native addon and
  // pdf-parse's worker polyfill chain on Vercel).
  serverExternalPackages: [
    "pdf-parse",
    "@napi-rs/canvas",
  ],
};

export default nextConfig;
