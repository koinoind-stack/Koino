import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { memorialRole } from "@/lib/memorials";
import { extractYouTubeId, isMemorialVideoCategory } from "@/lib/youtube";

/**
 * PATCH  /api/memorials/[id]/videos/[vid]
 *   - managers edit their video's metadata (title, description, category,
 *     and can fix the URL — re-validated, video id re-extracted)
 *   - ADMINS moderate: { status: "approved" | "rejected", rejectionReason? }
 * DELETE /api/memorials/[id]/videos/[vid] — managers or admins remove a video.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; vid: string }> }) {
  const { id, vid } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  try {
    const video = await db.memorialVideo.findUnique({ where: { id: vid } });
    if (!video || video.memorialId !== id) return jsonError("Video not found", 404);

    const role = await memorialRole(id, me.id);
    const isAdmin = me.role === "admin";
    const data: Record<string, unknown> = {};

    if ("status" in body) {
      if (!isAdmin) return jsonError("Only Koino admins can approve or reject videos", 403);
      const s = String(body.status);
      if (!["approved", "rejected", "pending"].includes(s)) return jsonError("Invalid status");
      data.status = s;
      data.moderatedAt = new Date();
      if (s === "rejected") {
        const reason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 500) : "";
        data.rejectionReason = reason || "Does not fit this memorial";
      } else {
        data.rejectionReason = null;
      }
    }

    if ("title" in body || "description" in body || "category" in body || "url" in body) {
      if (!role && !isAdmin) return jsonError("Only the memorial managers can edit videos", 403);
      if (typeof body.title === "string") {
        const t = body.title.trim().slice(0, 150);
        if (t.length < 2) return jsonError("Please enter a video title");
        data.title = t;
      }
      if (typeof body.description === "string") {
        data.description = body.description.trim().slice(0, 1000) || null;
      }
      if (typeof body.category === "string") {
        data.category = isMemorialVideoCategory(body.category) ? body.category : "other";
      }
      if (typeof body.url === "string" && body.url.trim()) {
        const videoId = extractYouTubeId(body.url.trim());
        if (!videoId) return jsonError("That is not a valid YouTube video link");
        data.videoId = videoId;
        data.url = body.url.trim().slice(0, 500);
      }
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update");

    const updated = await db.memorialVideo.update({
      where: { id: vid },
      data,
      select: { id: true, status: true, title: true },
    });
    return Response.json({ success: true, video: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Video not found", 404);
    console.error("[memorials/video] patch failed:", err);
    return jsonError("Could not update the video", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; vid: string }> }) {
  const { id, vid } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  try {
    const video = await db.memorialVideo.findUnique({ where: { id: vid } });
    if (!video || video.memorialId !== id) return jsonError("Video not found", 404);

    const role = await memorialRole(id, me.id);
    const isAuthor = video.addedById === me.id;
    if (!role && !isAuthor && me.role !== "admin") {
      return jsonError("Only the memorial managers or the video's contributor can remove it", 403);
    }

    await db.memorialVideo.delete({ where: { id: vid } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Video not found", 404);
    console.error("[memorials/video] delete failed:", err);
    return jsonError("Could not remove the video", 500);
  }
}
