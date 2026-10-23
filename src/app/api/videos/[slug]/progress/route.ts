import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/videos/[slug]/progress — record playback position (signed-in only).
 *
 * Body: { positionSec: number, completed?: boolean }
 * The player heartbeat fires every ~30s while the watch page is open, plus a
 * final call on unload/complete. Visitors (signed-out) never send heartbeats
 * and this route rejects them — no unnecessary viewing data is collected.
 * The embed resumes from the stored position via the YouTube `start` param.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  // Heartbeat every 30s + unload calls → generous window, still abuse-bounded.
  if (!rateLimit(`video-progress:${me.id}`, 300, 30 * 60 * 1000)) {
    return jsonError("Too many progress updates", 429);
  }

  let body: { positionSec?: unknown; completed?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const positionSec = Math.floor(Number(body.positionSec));
  if (!Number.isFinite(positionSec) || positionSec < 0 || positionSec > 24 * 3600) {
    return jsonError("Invalid positionSec");
  }
  const completed = body.completed === true;

  try {
    const video = await db.video.findUnique({
      where: { slug },
      select: { id: true, status: true, durationSec: true },
    });
    if (!video || video.status !== "published") return jsonError("Video not found", 404);

    // Cap the stored position near the video length when duration is known.
    const capped =
      video.durationSec && video.durationSec > 0
        ? Math.min(positionSec, video.durationSec + 30)
        : positionSec;
    const isComplete = completed || (video.durationSec ? capped >= video.durationSec * 0.92 : false);

    const existing = await db.videoProgress.findUnique({
      where: { userId_videoId: { userId: me.id, videoId: video.id } },
      select: { positionSec: true, completed: true },
    });
    // Never regress: a reload restarting the embed at 0 must not erase position.
    const nextPos = existing && !isComplete && !existing.completed
      ? Math.max(existing.positionSec, capped)
      : capped;
    if (existing) {
      await db.videoProgress.update({
        where: { userId_videoId: { userId: me.id, videoId: video.id } },
        data: { positionSec: nextPos, completed: isComplete || existing.completed },
      });
    } else {
      await db.videoProgress.create({
        data: { userId: me.id, videoId: video.id, positionSec: nextPos, completed: isComplete },
      });
    }
    return Response.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return jsonError("The video library is not ready yet", 503);
    }
    console.error("[videos/progress] failed:", err);
    return jsonError("Could not save progress", 500);
  }
}
