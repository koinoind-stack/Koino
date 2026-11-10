import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// PWA manifest — driven entirely by the central brand config (Task 51).
// Next.js App Router convention: this file is auto-served at /manifest.webmanifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.pwa.name,
    short_name: BRAND.pwa.shortName,
    description: BRAND.description,
    start_url: "/",
    display: "standalone",
    background_color: BRAND.pwa.backgroundColor,
    theme_color: BRAND.pwa.themeColor,
    orientation: "portrait",
    scope: "/",
    lang: "en",
    categories: ["lifestyle", "social", "books", "education"],
    icons: [
      {
        src: BRAND.assets.logo,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND.assets.logo,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND.assets.logo,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: BRAND.assets.logo,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Bible",
        short_name: "Bible",
        url: "/?view=bible",
        description: "Read the Bible",
      },
      {
        name: "Bible Comics",
        short_name: "Comics",
        url: "/?view=comic",
        description: "Read Bible Comics",
      },
      {
        name: "Churches",
        short_name: "Churches",
        url: "/?view=churches",
        description: "Discover Christian churches",
      },
      {
        name: "Prayer Wall",
        short_name: "Prayer",
        url: "/?view=prayer-wall",
        description: "Share prayer requests",
      },
      {
        name: "Bible Trivia",
        short_name: "Trivia",
        url: "/?view=trivia",
        description: "Test your Bible knowledge",
      },
    ],
  };
}
