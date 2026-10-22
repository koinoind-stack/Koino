import type { MetadataRoute } from "next";
import { PrismaClient } from "@prisma/client";

// Single PrismaClient instance at module scope — same pattern as the
// blog page + admin routes. A separate client from the auth-server.ts one
// (we don't want to share the user-mirror instance here).
const db = new PrismaClient();

const SITE_ORIGIN = "https://www.koino.in";

/**
 * Next.js MetadataRoute.Sitemap convention — auto-served at /sitemap.xml.
 *
 * Generates a dynamic sitemap combining the static marketing pages with
 * every published blog post (only published — drafts and future-scheduled
 * posts are NOT included since they aren't publicly reachable).
 *
 * The static `public/sitemap.xml` was deleted in favour of this file so
 * Next.js is the single source of truth for /sitemap.xml.
 *
 * ROBUSTNESS: if the database is unreachable (e.g., during local builds
 * without a Postgres URL, or during a transient outage), fall back to
 * returning just the static URLs so the sitemap is still served.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls = [
    "/",
    "/about",
    "/blog",
    "/community",
    "/contact",
    "/partner",
    "/support",
    "/terms",
    "/privacy",
    "/cookies",
    "/help",
  ];

  const now = new Date();

  // Only published posts that are currently visible (publishedAt is null or in the past).
  // Wrap in try/catch so the sitemap still serves the static URLs if the DB
  // is unavailable (local builds, transient outages).
  let posts: { slug: string; publishedAt: Date | null; updatedAt: Date }[] = [];
  try {
    posts = await db.blogPost.findMany({
      where: {
        published: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      select: { slug: true, publishedAt: true, updatedAt: true },
    });
  } catch (error) {
    console.warn("[sitemap] Failed to fetch blog posts for sitemap, serving static URLs only:", error);
  }

  // Published Apologetics articles — only status=published + contentType=APOLOGETICS.
  // Drafts are NEVER included in the sitemap.
  let apologeticsArticles: { slug: string; updatedAt: Date }[] = [];
  try {
    apologeticsArticles = await db.koinoArticle.findMany({
      where: {
        status: "published",
        contentType: "APOLOGETICS",
      },
      select: { slug: true, updatedAt: true },
    });
  } catch (error) {
    console.warn("[sitemap] Failed to fetch apologetics articles for sitemap, serving static URLs only:", error);
  }

  return [
    ...staticUrls.map((url) => ({
      url: `${SITE_ORIGIN}${url}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: url === "/" ? 1.0 : 0.7,
    })),
    ...posts.map((p) => ({
      url: `${SITE_ORIGIN}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...apologeticsArticles.map((a) => ({
      url: `${SITE_ORIGIN}/apologetics/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
