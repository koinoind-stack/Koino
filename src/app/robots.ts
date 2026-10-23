import type { MetadataRoute } from "next";
import { BRAND, siteUrl } from "@/lib/brand";

/**
 * Config-driven robots.txt (Task 51 — replaces the static public/robots.txt).
 * Auto-served at /robots.txt. Sitemap URL derives from the central brand
 * config so a future rebrand/domain change needs no edits here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin"],
      },
    ],
    sitemap: siteUrl("sitemap.xml"),
    host: BRAND.url,
  };
}
