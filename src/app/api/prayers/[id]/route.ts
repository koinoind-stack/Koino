import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";

/**
 * PATCH /api/prayers/[id]
 *   Owner or admin: { answered: true, testimony? } / { answered: false }
 *   Admin only:     { status: "visible" | "hidden" | "removed" }
 * All permission checks happen here on the server — the client flags
 * (isMine/canModerate) are UI hints only, never trusted.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;

    const prayer = await db.prayerRequest.findUnique({ where: { id } });
    if (!prayer) return NextResponse.json({ error: "Prayer not found" }, { status: 404 });

    const isOwner = prayer.userId === user.id;
    const isAdmin = user.role === "admin";
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    // ── Admin moderation ──
    if (typeof body.status === "string") {
      if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      if (!["visible", "hidden", "removed"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const updated = await db.prayerRequest.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json({ prayer: { id: updated.id, status: updated.status } });
    }

    // ── Answered / praise report (owner or admin) ──
    if (typeof body.answered === "boolean") {
      const testimony =
        typeof body.testimony === "string" ? body.testimony.trim().slice(0, 1000) : null;
      const updated = await db.prayerRequest.update({
        where: { id },
        data: body.answered
          ? { answered: true, answeredAt: new Date(), testimony: testimony || null }
          : { answered: false, answeredAt: null, testimony: null },
      });
      return NextResponse.json({
        prayer: {
          id: updated.id,
          answered: updated.answered,
          testimony: updated.testimony,
          answeredAt: updated.answeredAt?.toISOString() ?? null,
        },
      });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (err) {
    console.error("[api/prayers/id] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/**
 * DELETE /api/prayers/[id] — owner deletes their own request, or admin
 * removes any. Cascade wipes its prayers/comments (new tables only).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;

    const prayer = await db.prayerRequest.findUnique({ where: { id } });
    if (!prayer) return NextResponse.json({ error: "Prayer not found" }, { status: 404 });

    const isOwner = prayer.userId === user.id;
    const isAdmin = user.role === "admin";
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    await db.prayerRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/prayers/id] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
