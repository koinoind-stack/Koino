import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/videos/me/saves — toggle Watch Later / Favorite (signed-in only).
 * Body: { videoId, list: "watch_later" | "favorite", on?: boolean }
 *   - `on` omitted → toggle and return the new state.
 *   - `on` given  → set explicitly (idempotent).
 * Returns { saved: boolean }.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`video-save:${me.id}`, 120, 60 * 60 * 1000)) {
    return jsonError("Too many requests — try again later", 429);
  }

  let body: { videoId?: unknown; list?: unknown; on?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const list = body.list === "favorite" ? "favorite" : "watch_later";
  if (!videoId) return jsonError("videoId is required");

  try {
    const video = await db.video.findUnique({ where: { id: videoId }, select: { id: true, status: true } });
    if (!video || video.status !== "published") return jsonError("Video not found", 404);

    const key = { userId_videoId_list: { userId: me.id, videoId, list } };
    const existing = await db.videoSave.findUnique({ where: key, select: { id: true } });
    const wantOn = typeof body.on === "boolean" ? body.on : !existing;

    if (wantOn && !existing) {
      await db.videoSave.create({ data: { userId: me.id, videoId, list } });
    } else if (!wantOn && existing) {
      await db.videoSave.delete({ where: key });
    }
    return Response.json({ success: true, saved: wantOn });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return jsonError("The video library is not ready yet", 503);
    }
    console.error("[videos/saves] failed:", err);
    return jsonError("Could not update your list", 500);
  }
}
