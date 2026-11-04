import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * GET /api/churches/follows — the caller's followed church ids (auth).
 * Used by the Churches view to hydrate follow state on mount and to build
 * the My Churches tab. Only ids of churches that are STILL PUBLISHED are
 * returned — cancelled/rejected churches drop out automatically.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rows = await db.churchFollow.findMany({
      where: { userId: user.id, church: { status: "PUBLISHED" } },
      select: { churchId: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ followedChurchIds: rows.map((r) => r.churchId) });
  } catch (err) {
    console.error("[api/churches/follows] GET failed:", err);
    return NextResponse.json({ followedChurchIds: [] }, { status: 200 });
  }
}
