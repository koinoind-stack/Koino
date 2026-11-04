import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { canView, memorialRole } from "@/lib/memorials";

/**
 * POST   /api/memorials/[id]/candle — light a candle (authentication required).
 *        One candle per member per memorial — DB-enforced via a unique index,
 *        so the count is always genuine. Lighting again is a no-op, never a
 *        second candle.
 * DELETE /api/memorials/[id]/candle — un-light (fixing an accidental tap).
 *
 * Visitors can light a candle on any memorial they can view (respecting the
 * memorial's visibility), unless the family turned candles off.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Sign in to light a candle", 401);
  const me = session.user;

  if (!rateLimit(`candle:${me.id}`, 40, 60 * 60 * 1000)) {
    return jsonError("Too many candle actions — please try again in a few minutes", 429);
  }

  try {
    const m = await db.memorial.findUnique({
      where: { id },
      select: { status: true, visibility: true, display: true },
    });
    if (!m) return jsonError("Memorial not found", 404);
    const role = await memorialRole(id, me.id);
    const isAdmin = me.role === "admin";
    if (!canView(m, role, isAdmin)) return jsonError("Memorial not found", 404);

    if (!parseCandles(m.display)) {
      return jsonError("The family has turned candles off for this memorial", 403);
    }

    const existing = await db.memorialCandle.findUnique({
      where: { memorialId_userId: { memorialId: id, userId: me.id } },
      select: { id: true },
    });
    if (existing) {
      const count = await db.memorialCandle.count({ where: { memorialId: id } });
      return Response.json({ success: true, alreadyLit: true, candleCount: count });
    }

    await db.memorialCandle.create({ data: { memorialId: id, userId: me.id } });
    const count = await db.memorialCandle.count({ where: { memorialId: id } });
    return Response.json({ success: true, alreadyLit: false, candleCount: count }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/candle] post failed:", err);
    return jsonError("Could not light the candle", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  try {
    const m = await db.memorial.findUnique({ where: { id }, select: { id: true } });
    if (!m) return jsonError("Memorial not found", 404);

    await db.memorialCandle.deleteMany({ where: { memorialId: id, userId: me.id } });
    const count = await db.memorialCandle.count({ where: { memorialId: id } });
    return Response.json({ success: true, candleCount: count });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/candle] delete failed:", err);
    return jsonError("Could not remove the candle", 500);
  }
}

/** Local display parse (avoids importing the server lib twice). */
function parseCandles(json: string | null): boolean {
  try {
    const parsed = JSON.parse(json || "{}");
    return typeof parsed.candles === "boolean" ? parsed.candles : true;
  } catch {
    return true;
  }
}
