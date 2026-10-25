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
        headers: [{ key: "X-Koino-Round", value: "universal-share-cards.3" }],
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
