import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { memorialRole } from "@/lib/memorials";

/**
 * POST /api/memorials/[id]/share-feed — share a memorial announcement to the
 * Koino feed. Consent is EXPLICIT: the manager presses "Share to feed" in the
 * UI; nothing is ever auto-published, and condolences stay private.
 *
 * Body: { message? } — optional custom announcement text (≤500 chars).
 * Creates a published Post linked via Post.memorialId so the feed card can
 * show a respectful "View Memorial" button. Only PUBLIC memorials can be
 * announced (announcing a private memorial would leak its existence).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`memorial-share:${me.id}`, 10, 60 * 60 * 1000)) {
    return jsonError("Too many shares — try again later", 429);
  }

  let message: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.message === "string" && body.message.trim()) {
      message = body.message.trim().slice(0, 500);
    }
  } catch {
    // no body — use the default announcement text
  }

  const role = await memorialRole(id, me.id);
  if (!role) return jsonError("Only the memorial managers can share this announcement", 403);

  try {
    const m = await db.memorial.findUnique({
      where: { id },
      select: { fullName: true, tribute: true, dob: true, dod: true, photoUrl: true, visibility: true, status: true },
    });
    if (!m) return jsonError("Memorial not found", 404);
    if (m.status !== "published") return jsonError("Publish the memorial before sharing it to the feed");
    if (m.visibility !== "public") {
      return jsonError("Only public memorials can be announced in the feed", 403);
    }

    const lifespan =
      m.dob && m.dod
        ? ` ${m.dob.getFullYear()}–${m.dod.getFullYear()}`
        : m.dod
          ? ` — remembered since ${m.dod.getFullYear()}`
          : "";
    const content =
      message ||
      `In loving memory of ${m.fullName}.${lifespan}${m.tribute ? ` ${m.tribute}` : ""} 🕊️`;

    const post = await db.post.create({
      data: {
        content,
        published: true,
        authorId: me.id,
        mediaType: m.photoUrl ? "image" : "text",
        mediaUrls: m.photoUrl ? JSON.stringify([m.photoUrl]) : "[]",
        memorialId: id,
      },
      select: { id: true },
    });
    return Response.json({ success: true, postId: post.id }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022" || code === "P2025") {
      return jsonError("Memorial not found", 404);
    }
    console.error("[memorials/share-feed] failed:", err);
    return jsonError("Could not share the announcement", 500);
  }
}
