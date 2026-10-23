import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, postSelect, serializePosts, jsonError } from "@/lib/social/server";

/**
 * GET /api/social/bookmarks?cursor=<bookmarkCreatedAt>
 * The viewer's saved posts, newest-save first (keyset on the bookmark row).
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 30);

  const rows = await db.postBookmark.findMany({
    where: {
      userId: session.user.id,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: { post: { select: postSelect }, createdAt: true },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const posts = await serializePosts(page.map((b) => b.post), session.user.id);

  return Response.json({
    posts,
    nextCursor:
      hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null,
  });
}
