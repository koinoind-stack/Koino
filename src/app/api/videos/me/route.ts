import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * GET /api/videos/me — the signed-in user's personal library.
 * Returns { continueWatching, watchLater, favorites, recentlyWatched }.
 * All four are [] when signed out (client calls only when authenticated).
 * Degrades to empty lists when the Part-5 tables do not exist yet.
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session.user) return Response.json({ continueWatching: [], watchLater: [], favorites: [], recentlyWatched: [] });
  const me = session.user;

  const cardSelect = {
    id: true, slug: true, title: true, summary: true, thumbnailUrl: true,
    youtubeId: true, durationSec: true, category: true, language: true,
    featured: true, sourceName: true, createdAt: true, status: true,
  } as const;

  try {
    const [progressRows, watchLaterRows, favoriteRows] = await Promise.all([
      db.videoProgress.findMany({
        where: { userId: me.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { positionSec: true, completed: true, updatedAt: true, video: { select: cardSelect } },
      }),
      db.videoSave.findMany({
        where: { userId: me.id, list: "watch_later" },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: { createdAt: true, video: { select: cardSelect } },
      }),
      db.videoSave.findMany({
        where: { userId: me.id, list: "favorite" },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: { createdAt: true, video: { select: cardSelect } },
      }),
    ]);

    const withProgress = progressRows
      .filter((p) => p.video && p.video.status === "published")
      .map((p) => ({ ...p.video, positionSec: p.positionSec, completed: p.completed, watchedAt: p.updatedAt }));

    return Response.json({
      // Still-open items only — finished ones live in recentlyWatched.
      continueWatching: withProgress.filter((v) => !v.completed),
      recentlyWatched: withProgress,
      watchLater: watchLaterRows.filter((s) => s.video && s.video.status === "published").map((s) => s.video),
      favorites: favoriteRows.filter((s) => s.video && s.video.status === "published").map((s) => s.video),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return Response.json({ continueWatching: [], watchLater: [], favorites: [], recentlyWatched: [] });
    }
    console.error("[videos/me] failed:", err);
    return jsonError("Could not load your library", 500);
  }
}
