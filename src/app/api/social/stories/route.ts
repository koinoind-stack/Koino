import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, getExcludedUserIds, notify, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * GET /api/social/stories — active (non-expired) stories grouped by author,
 * ordered: viewer's own stories first, then followed users, then others.
 * Also performs lazy cleanup of expired stories + their storage objects.
 *
 * POST /api/social/stories — create a story (24h expiry, server-set).
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  const excluded = await getExcludedUserIds(me.id);
  const now = new Date();

  const rows = await db.story.findMany({
    where: {
      expiresAt: { gt: now },
      userId: { notIn: excluded.length ? excluded : ["__none__"] },
    },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true,
      mediaUrl: true,
      mediaType: true,
      thumbnailUrl: true,
      aspectRatio: true,
      caption: true,
      backgroundColor: true,
      createdAt: true,
      expiresAt: true,
      userId: true,
      user: { select: { id: true, name: true, username: true, image: true } },
      views: { where: { userId: me.id }, select: { id: true } },
    },
  });

  // Group by author, preserve recency.
  const groups = new Map<
    string,
    {
      user: { id: string; name: string | null; username: string | null; image: string | null };
      items: Array<{
        id: string;
        mediaUrl: string;
        mediaType: string;
        thumbnailUrl: string | null;
        aspectRatio: string | null;
        caption: string | null;
        backgroundColor: string | null;
        createdAt: string;
        expiresAt: string;
        seen: boolean;
        isMine: boolean;
      }>;
      allSeen: boolean;
      isMine: boolean;
    }
  >();
  for (const s of rows) {
    const g = groups.get(s.userId) ?? {
      user: s.user,
      items: [],
      allSeen: true,
      isMine: s.userId === me.id,
    };
    const seen = s.views.length > 0;
    g.items.push({
      id: s.id,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      thumbnailUrl: s.thumbnailUrl,
      aspectRatio: s.aspectRatio,
      caption: s.caption,
      backgroundColor: s.backgroundColor,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      seen,
      isMine: s.userId === me.id,
    });
    if (!seen) g.allSeen = false;
    groups.set(s.userId, g);
  }

  // Own stories first, then unseen, then seen — a stable, useful order.
  const list = [...groups.values()].sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
    return 0;
  });

  // Lazy cleanup of expired stories (best-effort, fire-and-forget).
  db.story
    .findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, mediaUrl: true },
      take: 50,
    })
    .then(async (expired) => {
      if (expired.length === 0) return;
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const { createServiceClient } = await import("@/lib/supabase/service");
          const supabase = createServiceClient();
          const paths = expired
            .map((s) => {
              const m = s.mediaUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
              return m ? { bucket: m[1], path: m[2] } : null;
            })
            .filter((x): x is { bucket: string; path: string } => !!x);
          for (const p of paths) await supabase.storage.from(p.bucket).remove([p.path]).catch(() => {});
        }
        await db.story.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });
      } catch (e) {
        console.warn("[social/stories] cleanup failed (non-fatal):", e);
      }
    })
    .catch(() => {});

  return Response.json({ groups: list });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;

  if (!rateLimit(`stories:create:${me.id}`, 20, 24 * 60 * 60 * 1000)) {
    return jsonError("You've added a lot of stories today — try again tomorrow", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl : "";
  const mediaType = body.mediaType === "video" ? "video" : "image";
  if (!mediaUrl) return jsonError("mediaUrl is required");
  if (mediaType === "video" && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrl)) {
    return jsonError("Unsupported video format");
  }
  const caption = typeof body.caption === "string" ? body.caption.slice(0, 200) : null;
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.slice(0, 2048) : null;
  const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.slice(0, 10) : null;
  const backgroundColor = typeof body.backgroundColor === "string" ? body.backgroundColor.slice(0, 30) : null;

  try {
    const story = await db.story.create({
      data: {
        userId: me.id,
        mediaUrl,
        mediaType,
        thumbnailUrl,
        aspectRatio,
        caption,
        backgroundColor,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // server-set 24h
      },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return Response.json(
      {
        story: {
          ...story,
          createdAt: story.createdAt.toISOString(),
          expiresAt: story.expiresAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[social/stories] create failed:", err);
    return jsonError("Failed to create story", 500);
  }
}
