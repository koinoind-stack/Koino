import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";

/**
 * GET  /api/social/notifications?unread=1        — list (newest first)
 * POST /api/social/notifications { id? , all? }  — mark one / all read
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "1";
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "25", 10), 1), 50);

  const rows = await db.notification.findMany({
    where: {
      userId: session.user.id,
      ...(unreadOnly ? { read: false } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      type: true,
      read: true,
      createdAt: true,
      postId: true,
      commentId: true,
      storyId: true,
      actor: { select: { id: true, name: true, username: true, image: true } },
      post: { select: { id: true, content: true, mediaType: true, mediaUrls: true, thumbnailUrl: true } },
    },
  });

  const unreadCount = await db.notification.count({
    where: { userId: session.user.id, read: false },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  return Response.json({
    notifications: page.map((n) => ({
      id: n.id,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      postId: n.postId,
      commentId: n.commentId,
      storyId: n.storyId,
      actor: n.actor,
      post: n.post
        ? {
            id: n.post.id,
            content: n.post.content,
            mediaType: n.post.mediaType,
            mediaUrls: (() => {
              try {
                const p = JSON.parse(n.post.mediaUrls);
                return Array.isArray(p) ? p : [];
              } catch {
                return [];
              }
            })(),
            thumbnailUrl: n.post.thumbnailUrl,
          }
        : null,
    })),
    unreadCount,
    nextCursor: hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body → mark all
  }

  if (body.all === true || !body.id) {
    const result = await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
    return Response.json({ success: true, marked: result.count });
  }

  if (typeof body.id !== "string") return jsonError("Invalid notification id");
  await db.notification.updateMany({
    where: { id: body.id, userId: session.user.id },
    data: { read: true },
  });
  return Response.json({ success: true });
}
