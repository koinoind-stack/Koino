import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Deploy-verification marker: lets us confirm a server-side-only change is
  // live with `curl -I https://www.koino.in` (server code is not visible in
  // public JS chunks). Bump the value on each server-side round.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Koino-Round", value: "comics-back-nav" }],
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
