import type { MetadataRoute } from "next";

// PWA manifest — Koino
// Next.js App Router convention: this file is auto-served at /manifest.webmanifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koino — Faith. Fellowship. Belong.",
    short_name: "Koino",
    description:
      "Koino is a Christian community platform for Scripture, churches, prayer, events, Bible trivia, Christian businesses, marketplace and fellowship.",
    start_url: "/",
    display: "standalone",
    background_color: "#12101A",
    theme_color: "#12101A",
    orientation: "portrait",
    scope: "/",
    lang: "en",
    categories: ["lifestyle", "social", "books", "education"],
    icons: [
      {
        src: "/koino-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/koino-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/koino-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/koino-logo.png",
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
