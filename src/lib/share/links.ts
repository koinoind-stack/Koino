/**
 * ─── CANONICAL SHARE LINKS (Task 121) ────────────────────────────────────────
 *
 * One place that knows the canonical, shareable URL for every Koino content
 * type. All builders go through siteUrl() (BRAND.url / NEXT_PUBLIC_SITE_URL)
 * so shared links always resolve to production, never to a preview origin.
 *
 * Deep-link scheme (parsed by src/app/page.tsx):
 *   comic    → /?comic=<bookId>/<chapter>
 *   bible    → /?view=bible&book=<bookId>&chapter=<n>[&verse=<v>]
 *   post     → /?post=<id>
 *   group    → /?view=group-detail&group=<id>
 *   event    → /?view=events&event=<id>
 *   trivia   → /?view=trivia      (no per-result public URL exists)
 *   prayer   → /?view=prayer-wall (wall has no per-request URL)
 *   shop     → /?view=shop
 *   business → /?view=business-directory
 */

import { siteUrl } from "@/lib/brand";

export const shareLinks = {
  home: () => siteUrl("/"),
  comic: (bookId: string, chapter: number) =>
    siteUrl(`/?comic=${encodeURIComponent(bookId)}/${chapter}`),
  bible: (bookId: string, chapter: number, verse?: number | null) =>
    siteUrl(
      `/?view=bible&book=${encodeURIComponent(bookId)}&chapter=${chapter}${verse ? `&verse=${verse}` : ""}`
    ),
  post: (postId: string) => siteUrl(`/?post=${encodeURIComponent(postId)}`),
  group: (groupId: string) =>
    siteUrl(`/?view=group-detail&group=${encodeURIComponent(groupId)}`),
  event: (eventId: string) =>
    siteUrl(`/?view=events&event=${encodeURIComponent(eventId)}`),
  video: (slug: string) => siteUrl(`/videos/${encodeURIComponent(slug)}`),
  apologetics: (slug: string) =>
    siteUrl(`/apologetics/${encodeURIComponent(slug)}`),
  blog: (slug: string) => siteUrl(`/blog/${encodeURIComponent(slug)}`),
  memorial: (id: string) => siteUrl(`/memorials/${encodeURIComponent(id)}`),
  trivia: () => siteUrl("/?view=trivia"),
  prayerWall: () => siteUrl("/?view=prayer-wall"),
  shop: () => siteUrl("/?view=shop"),
  businessDirectory: () => siteUrl("/?view=business-directory"),
} as const;
