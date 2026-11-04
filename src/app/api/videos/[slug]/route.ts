import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { youtubeThumbnail } from "@/lib/videos";

/**
 * GET /api/videos/[slug] — one video's watch-page data.
 *
 * Published videos are public. Draft/unpublished entries are served ONLY to
 * admin sessions (preview); everyone else gets a 404 so nothing leaks.
 *
 * Response (session-aware):
 *   video      — full row incl. bibleRefs
 *   related    — up to 8 published videos sharing the category or a Bible book
 *   resumeAt   — seconds, signed-in continue-watching position (0 otherwise)
 *   savedIn    — { watchLater, favorite } for the signed-in user
 * Also counts a view (fire-and-forget) — refreshes count; the counter is a
 * simple popularity signal, not analytics.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionUser();
  const me = session.user;
  const isAdmin = me?.role === "admin";

  try {
    const video = await db.video.findUnique({
      where: { slug },
      include: {
        bibleRefs: {
          orderBy: [{ bookId: "asc" }, { chapterStart: "asc" }],
          select: { id: true, bookId: true, chapterStart: true, verseStart: true, chapterEnd: true, verseEnd: true },
        },
      },
    });

    if (!video) return jsonError("Video not found", 404);
    if (video.status !== "published" && !isAdmin) return jsonError("Video not found", 404);

    // Related: same category first, then videos sharing any Bible book.
    const bookIds = [...new Set(video.bibleRefs.map((r) => r.bookId))];
    const relatedRows = (
      await db.video.findMany({
        where: {
          status: "published",
          id: { not: video.id },
          OR: [
            { category: video.category },
            ...(bookIds.length ? [{ bibleRefs: { some: { bookId: { in: bookIds } } } }] : []),
          ],
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true, slug: true, title: true, summary: true, thumbnailUrl: true,
          youtubeId: true, durationSec: true, category: true, language: true,
          featured: true, sourceName: true, createdAt: true,
        },
      })
    ).map((r) => ({ ...r, bibleRefs: [] }));

    // Session-aware extras (best-effort — never fail the page over these).
    let resumeAt = 0;
    let savedIn = { watchLater: false, favorite: false };
    if (me) {
      const [progress, saves] = await Promise.all([
        db.videoProgress.findUnique({
          where: { userId_videoId: { userId: me.id, videoId: video.id } },
          select: { positionSec: true, completed: true },
        }),
        db.videoSave.findMany({
          where: { userId: me.id, videoId: video.id },
          select: { list: true },
        }),
      ]);
      if (progress && !progress.completed) resumeAt = progress.positionSec;
      savedIn = {
        watchLater: saves.some((s) => s.list === "watch_later"),
        favorite: saves.some((s) => s.list === "favorite"),
      };
    }

    // Popularity counter (fire-and-forget).
    if (video.status === "published") {
      db.video
        .update({ where: { id: video.id }, data: { viewCount: { increment: 1 } } })
        .catch(() => {});
    }

    return Response.json({
      video: {
        ...video,
        thumbnailUrl: video.thumbnailUrl || (video.youtubeId ? youtubeThumbnail(video.youtubeId) : null),
      },
      related: relatedRows,
      resumeAt,
      savedIn,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return jsonError("The video library is not ready yet", 503);
    }
    console.error("[videos/detail] failed:", err);
    return jsonError("Could not load the video", 500);
  }
}
