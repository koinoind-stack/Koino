import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, areBlocked, notify, jsonError } from "@/lib/social/server";

/**
 * GET    /api/social/stories/[id]?viewers=1 — story details; `viewers` is
 *        OWNER-ONLY (who watched). POST marks a view; body { reply } sends
 *        the reply as a notification (real DMs are future work).
 * DELETE /api/social/stories/[id] — owner deletes a story.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  const story = await db.story.findUnique({
    where: { id },
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
    },
  });
  if (!story) return jsonError("Story not found", 404);
  if (story.userId !== me.id && (await areBlocked(me.id, story.userId))) {
    return jsonError("Story not found", 404);
  }

  const { searchParams } = new URL(req.url);
  let viewers: unknown = undefined;
  if (searchParams.get("viewers") === "1") {
    if (story.userId !== me.id) return jsonError("Only the story owner can see viewers", 403);
    const rows = await db.storyView.findMany({
      where: { storyId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        createdAt: true,
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });
    viewers = rows.map((v) => ({ user: v.user, viewedAt: v.createdAt.toISOString() }));
  }

  return Response.json({
    story: {
      ...story,
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
      isMine: story.userId === me.id,
    },
    viewers,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  const story = await db.story.findUnique({
    where: { id },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!story) return jsonError("Story not found", 404);
  if (story.expiresAt.getTime() < Date.now()) return jsonError("Story has expired", 410);
  if (story.userId !== me.id && (await areBlocked(me.id, story.userId))) {
    return jsonError("Story not found", 404);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body = view mark
  }

  // Mark as viewed (idempotent via unique constraint).
  if (story.userId !== me.id) {
    await db.storyView.upsert({
      where: { storyId_userId: { storyId: id, userId: me.id } },
      create: { storyId: id, userId: me.id },
      update: {},
    });
  }

  // Reply → delivered as a notification (real DMs are future work).
  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 300) : null;
  if (reply && story.userId !== me.id) {
    await notify({
      userId: story.userId,
      actorId: me.id,
      type: "story_reply",
      storyId: id,
    });
    return Response.json({ success: true, viewed: true, replySent: true });
  }

  return Response.json({ success: true, viewed: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);

  const story = await db.story.findUnique({ where: { id }, select: { userId: true, mediaUrl: true } });
  if (!story) return jsonError("Story not found", 404);
  if (story.userId !== session.user.id) return jsonError("You can only delete your own stories", 403);

  try {
    await db.story.delete({ where: { id } });
    // Best-effort storage cleanup.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const m = story.mediaUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
      if (m) {
        const { createServiceClient } = await import("@/lib/supabase/service");
        const supabase = createServiceClient();
        await supabase.storage.from(m[1]).remove([m[2]]).catch(() => {});
      }
    }
    return Response.json({ success: true });
  } catch (err) {
    console.error("[social/stories] delete failed:", err);
    return jsonError("Failed to delete story", 500);
  }
}
