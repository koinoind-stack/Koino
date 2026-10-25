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
        headers: [{ key: "X-Koino-Round", value: "universal-share-cards.1" }],
      },
    ];
  },
  /* config options here */
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
