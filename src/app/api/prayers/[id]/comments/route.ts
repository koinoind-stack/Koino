import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";
import { publicComment, notifyPrayer } from "@/lib/prayers-server";

/** GET — public, visible comments (with one-level replies) for a request. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prayer = await db.prayerRequest.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!prayer || prayer.status !== "visible") {
      return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
    }

    const viewer = await getAuthUser();
    const v = viewer ? { id: viewer.id, role: viewer.role } : null;

    const comments = await db.prayerComment.findMany({
      where: { prayerId: id, status: "visible" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, username: true } } },
    });

    return NextResponse.json({ comments: comments.map((c) => publicComment(c, v)) });
  } catch (err) {
    console.error("[api/prayers/id/comments] GET failed:", err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

/**
 * POST — add a comment or a reply (auth + rate limit).
 * Body: { body, parentId? } — parentId must be a visible comment on the
 * SAME prayer. Notifies the prayer author (comment) and/or the parent
 * comment author (reply); duplicate/repeat actions never re-notify.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;

    if (!rateLimit(`prayers:comment:${user.id}`, 8, 5 * 60_000)) {
      return NextResponse.json(
        { error: "You're commenting quickly. Please wait a moment." },
        { status: 429 }
      );
    }

    const prayer = await db.prayerRequest.findUnique({ where: { id } });
    if (!prayer || prayer.status !== "visible") {
      return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const text = typeof bodyJson.body === "string" ? bodyJson.body.trim().slice(0, 1000) : "";
    const parentId = typeof bodyJson.parentId === "string" ? bodyJson.parentId : null;
    if (!text) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });

    let parentAuthorId: string | null = null;
    if (parentId) {
      const parent = await db.prayerComment.findUnique({ where: { id: parentId } });
      if (!parent || parent.prayerId !== id || parent.status !== "visible") {
        return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
      }
      parentAuthorId = parent.userId;
    }

    const comment = await db.prayerComment.create({
      data: { prayerId: id, parentId, userId: user.id, body: text },
      include: { user: { select: { name: true, username: true } } },
    });

    // Notifications: author of the request (comment) / author of parent (reply).
    if (parentId && parentAuthorId && parentAuthorId !== user.id) {
      await notifyPrayer({ userId: parentAuthorId, actorId: user.id, type: "prayer_reply", prayerId: id });
    } else if (!parentId && prayer.userId !== user.id) {
      await notifyPrayer({ userId: prayer.userId, actorId: user.id, type: "prayer_comment", prayerId: id });
    }

    const viewer = { id: user.id, role: user.role };
    return NextResponse.json({ comment: publicComment(comment, viewer) }, { status: 201 });
  } catch (err) {
    console.error("[api/prayers/id/comments] POST failed:", err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

/**
 * DELETE ?commentId=<id> — owner deletes their own comment (hard delete),
 * admin removes any comment (status="removed" — preserves the record).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;
    const commentId = new URL(req.url).searchParams.get("commentId");
    if (!commentId) return NextResponse.json({ error: "commentId is required" }, { status: 400 });

    const comment = await db.prayerComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.prayerId !== id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const isOwner = comment.userId === user.id;
    const isAdmin = user.role === "admin";
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    if (isAdmin && !isOwner) {
      await db.prayerComment.update({ where: { id: commentId }, data: { status: "removed" } });
      return NextResponse.json({ ok: true, removed: true });
    }
    await db.prayerComment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/prayers/id/comments] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
