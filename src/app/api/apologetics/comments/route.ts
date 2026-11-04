import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";
import {
  requireAuth,
  isTargetType,
  resolveTarget,
  createApologeticsNotification,
} from "@/lib/apologetics-server";

/**
 * GET /api/apologetics/comments?targetType=article&targetId=<id>
 * Public — visible comments for one target, threaded (replies nested under
 * their parent, one visible level in the UI; the model allows deeper chains).
 * Response: { comments: [{ id, authorName, body, createdAt, replies: [...] }] }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");

    if (!isTargetType(targetType)) {
      return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
    }
    if (!targetId) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }

    const target = await resolveTarget(targetType, targetId);
    if (!target.exists) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    let comments: any[] = [];
    try {
      comments = await db.apologeticsComment.findMany({
        where: { targetType, targetId, status: "visible" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          parentId: true,
          authorName: true,
          body: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (e: any) {
      const msg = e?.message || "";
      if (e?.code === "P2021" || e?.code === "P2022" || /does not exist/i.test(msg)) {
        return NextResponse.json({ comments: [] }); // migration window
      }
      throw e;
    }

    // Build threads: top-level comments with their replies nested.
    const byId = new Map<string, any>();
    const roots: any[] = [];
    for (const c of comments) {
      byId.set(c.id, { ...c, createdAt: c.createdAt.toISOString(), replies: [] });
    }
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId).replies.push(c);
      } else {
        roots.push(c);
      }
    }
    // Newest threads first; replies in chronological order.
    roots.reverse();

    // Server-driven moderation flag — the admin hide/delete buttons only
    // render when the current session is an admin (never client-asserted).
    const user = await getAuthUser();
    const canModerate = user?.role === "admin";

    return NextResponse.json({ comments: roots, canModerate });
  } catch (error: any) {
    console.error("[api/apologetics/comments GET] Error:", error);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

/**
 * POST /api/apologetics/comments — post a comment or reply (auth required).
 * Body: { targetType, targetId, body, parentId? }
 *
 * Spam prevention:
 *  - rate limit: 8 comments / 5 min per user
 *  - length cap (1500 chars) + non-empty
 *  - duplicate guard: same user posting the exact same body to the same
 *    target within 60s is rejected
 * Notifications: target owner gets "apologetics_comment"; when replying,
 * the parent comment's author gets "apologetics_reply". Both deduped.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const user = auth.user;

    if (!rateLimit(`apologetics:comment:${user.id}`, 8, 5 * 60_000)) {
      return NextResponse.json(
        { error: "You're commenting quickly. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { targetType, targetId, parentId } = body;
    const text = typeof body.body === "string" ? body.body.trim() : "";

    if (!isTargetType(targetType)) {
      return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
    }
    if (typeof targetId !== "string" || !targetId.trim()) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
    }
    if (text.length > 1500) {
      return NextResponse.json(
        { error: "Comment is too long (max 1500 characters)" },
        { status: 400 }
      );
    }

    const target = await resolveTarget(targetType, targetId);
    if (!target.exists) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    // Duplicate guard (rapid double-post / retry spam)
    const recent = await db.apologeticsComment.findFirst({
      where: {
        targetType,
        targetId,
        authorUserId: user.id,
        body: text,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    });
    if (recent) {
      return NextResponse.json(
        { error: "You just posted that comment." },
        { status: 429 }
      );
    }

    // Parent must belong to the same target (prevents cross-target threading)
    let parentAuthorUserId: string | null = null;
    if (parentId) {
      const parent = await db.apologeticsComment.findUnique({
        where: { id: parentId },
        select: { id: true, targetType: true, targetId: true, status: true, authorUserId: true },
      });
      if (!parent || parent.targetType !== targetType || parent.targetId !== targetId || parent.status !== "visible") {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
      }
      parentAuthorUserId = parent.authorUserId;
    }

    const displayName = user.name || user.email.split("@")[0];

    const comment = await db.apologeticsComment.create({
      data: {
        targetType,
        targetId,
        parentId: parentId || null,
        authorUserId: user.id,
        authorName: displayName.slice(0, 100),
        body: text,
      },
    });

    // Notifications (both deduped; self-notify skipped inside the helper)
    if (target.ownerUserId) {
      await createApologeticsNotification({
        userId: target.ownerUserId,
        actorId: user.id,
        type: "apologetics_comment",
        targetType: targetType === "article" ? "apologetics_article" : "apologetics_question",
        targetId,
        href: target.href,
      });
    }
    if (parentAuthorUserId) {
      await createApologeticsNotification({
        userId: parentAuthorUserId,
        actorId: user.id,
        type: "apologetics_reply",
        targetType: "apologetics_comment",
        targetId: comment.id,
        href: target.href,
      });
    }

    return NextResponse.json(
      {
        success: true,
        comment: {
          id: comment.id,
          parentId: comment.parentId,
          authorName: comment.authorName,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/apologetics/comments POST] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to post comment" },
      { status: 500 }
    );
  }
}
