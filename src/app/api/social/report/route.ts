import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/social/report — report a post / comment / user / story / memorial.
 * Reports land in the Report table for admin review (review UI is future
 * work; they are visible via the database / a future admin tab).
 * Part 4 adds targetType "memorial" (In Loving Memory) — same flow, same
 * table, no schema change.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`reports:${me.id}`, 20, 60 * 60 * 1000)) {
    return jsonError("Too many reports submitted — try again later", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const targetType = String(body.targetType || "");
  const targetId = String(body.targetId || "");
  const validTargets = ["post", "comment", "user", "story", "memorial"];
  if (!validTargets.includes(targetType)) return jsonError("Invalid target type");
  if (!targetId) return jsonError("targetId is required");

  const reason = typeof body.reason === "string" ? body.reason.slice(0, 100) : null;
  const details = typeof body.details === "string" ? body.details.slice(0, 1000) : null;

  // Verify the target exists (best-effort by type).
  try {
    if (targetType === "post") {
      const found = await db.post.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!found) return jsonError("Post not found", 404);
    } else if (targetType === "comment") {
      const found = await db.postComment.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!found) return jsonError("Comment not found", 404);
    } else if (targetType === "story") {
      const found = await db.story.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!found) return jsonError("Story not found", 404);
    } else if (targetType === "user") {
      const found = await db.user.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!found) return jsonError("User not found", 404);
    } else if (targetType === "memorial") {
      const found = await db.memorial.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!found) return jsonError("Memorial not found", 404);
    }
  } catch {
    // existence check is best-effort; a dangling id will simply never match
  }

  try {
    const report = await db.report.create({
      data: { reporterId: me.id, targetType, targetId, reason, details },
      select: { id: true, createdAt: true },
    });
    return Response.json({ success: true, reportId: report.id }, { status: 201 });
  } catch (err) {
    console.error("[social/report] create failed:", err);
    return jsonError("Failed to submit report", 500);
  }
}
