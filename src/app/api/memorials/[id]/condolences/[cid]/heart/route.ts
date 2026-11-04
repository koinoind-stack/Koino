import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { canView, memorialRole } from "@/lib/memorials";

/**
 * POST /api/memorials/[id]/condolences/[cid]/heart — toggle a ❤ on a tribute.
 * One heart per member per tribute (DB-enforced unique index) — the count is
 * always genuine. Returns the new state: { hearts, liked }.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Sign in to leave a heart", 401);
  const me = session.user;

  if (!rateLimit(`m-heart:${me.id}`, 80, 60 * 60 * 1000)) {
    return jsonError("Too many actions — slow down a little", 429);
  }

  try {
    const m = await db.memorial.findUnique({
      where: { id },
      select: { status: true, visibility: true },
    });
    if (!m) return jsonError("Memorial not found", 404);
    const role = await memorialRole(id, me.id);
    const isAdmin = me.role === "admin";
    if (!canView(m, role, isAdmin)) return jsonError("Memorial not found", 404);

    const msg = await db.memorialCondolence.findUnique({
      where: { id: cid },
      select: { id: true, memorialId: true },
    });
    if (!msg || msg.memorialId !== id) return jsonError("Message not found", 404);

    const existing = await db.memorialCondolenceHeart.findUnique({
      where: { condolenceId_userId: { condolenceId: cid, userId: me.id } },
      select: { id: true },
    });

    if (existing) {
      await db.memorialCondolenceHeart.delete({ where: { id: existing.id } });
    } else {
      await db.memorialCondolenceHeart.create({ data: { condolenceId: cid, userId: me.id } });
    }

    const hearts = await db.memorialCondolenceHeart.count({ where: { condolenceId: cid } });
    return Response.json({ success: true, hearts, liked: !existing });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/heart] toggle failed:", err);
    return jsonError("Could not save your heart", 500);
  }
}
