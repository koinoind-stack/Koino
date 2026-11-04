import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { notifyPrayer } from "@/lib/prayers-server";

/**
 * POST /api/prayers/[id]/pray — toggle the caller's "I Prayed" (auth).
 * Dedupe is DB-enforced: @@unique([prayerId, userId]) makes double-counting
 * impossible even under concurrent clicks. Toggling off (undo) deletes the row.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;

    const prayer = await db.prayerRequest.findUnique({ where: { id } });
    if (!prayer || prayer.status !== "visible") {
      return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
    }

    const existing = await db.prayerPrayer.findUnique({
      where: { prayerId_userId: { prayerId: id, userId: user.id } },
    });

    let prayed: boolean;
    if (existing) {
      await db.prayerPrayer.delete({ where: { id: existing.id } });
      prayed = false;
    } else {
      // Unique constraint protects against races — a duplicate insert throws
      // and we treat it as already-prayed.
      try {
        await db.prayerPrayer.create({ data: { prayerId: id, userId: user.id } });
        prayed = true;
      } catch {
        prayed = true;
      }
    }

    const count = await db.prayerPrayer.count({ where: { prayerId: id } });

    // Notify the author once (self-prayers and repeats never notify).
    if (prayed && prayer.userId !== user.id) {
      await notifyPrayer({
        userId: prayer.userId,
        actorId: user.id,
        type: "prayer_prayed",
        prayerId: id,
      });
    }

    return NextResponse.json({ prayed, count });
  } catch (err) {
    console.error("[api/prayers/id/pray] POST failed:", err);
    return NextResponse.json({ error: "Failed to record prayer" }, { status: 500 });
  }
}
