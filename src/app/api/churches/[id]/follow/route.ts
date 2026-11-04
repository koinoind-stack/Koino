import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * POST /api/churches/[id]/follow — follow a PUBLISHED church (auth).
 * Dedupe is DB-enforced: @@unique([churchId, userId]) makes double-follows
 * impossible. The live count is derived from ChurchFollow._count by the
 * GET endpoints, so no counter maintenance is needed here.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to follow churches." }, { status: 401 });
    }
    const { id } = await params;

    const church = await db.church.findUnique({
      where: { id },
      select: { id: true, status: true, name: true },
    });
    if (!church || church.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Church not found" }, { status: 404 });
    }

    try {
      await db.churchFollow.create({ data: { churchId: id, userId: user.id } });
    } catch {
      // Unique violation → already following. Idempotent success.
    }

    const count = await db.churchFollow.count({ where: { churchId: id } });
    return NextResponse.json({ following: true, followers: count });
  } catch (err) {
    console.error("[api/churches/id/follow] POST failed:", err);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

/**
 * DELETE /api/churches/[id]/follow — unfollow (auth). Removing a follow
 * that doesn't exist is a no-op success (idempotent).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to manage follows." }, { status: 401 });
    }
    const { id } = await params;

    await db.churchFollow.deleteMany({ where: { churchId: id, userId: user.id } });
    const count = await db.churchFollow.count({ where: { churchId: id } });
    return NextResponse.json({ following: false, followers: count });
  } catch (err) {
    console.error("[api/churches/id/follow] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}
