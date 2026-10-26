import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import { requireAuth, isTargetType, resolveTarget } from "@/lib/apologetics-server";

/**
 * GET /api/apologetics/bookmarks — the current user's saved apologetics
 * targets. Returns ids so the hub can offer a "Saved" filter.
 * Response: { bookmarks: [{ targetType, targetId, createdAt }] }
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;

    const bookmarks = await db.apologeticsBookmark.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      select: { targetType: true, targetId: true, createdAt: true },
    });
    return NextResponse.json({ bookmarks });
  } catch (error: any) {
    console.error("[api/apologetics/bookmarks GET] Error:", error);
    return NextResponse.json({ error: "Failed to load bookmarks" }, { status: 500 });
  }
}

/**
 * POST /api/apologetics/bookmarks — toggle save/bookmark (auth required).
 * Body: { targetType: "article"|"question", targetId, saved?: boolean }
 * Saving twice is a no-op (DB unique constraint); toggling removes.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const user = auth.user;

    if (!rateLimit(`apologetics:bookmark:${user.id}`, 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { targetType, targetId } = body;
    const saved = body.saved === false ? false : true;

    if (!isTargetType(targetType)) {
      return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
    }
    if (typeof targetId !== "string" || !targetId.trim()) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }

    const target = await resolveTarget(targetType, targetId);
    if (!target.exists) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    if (!saved) {
      await db.apologeticsBookmark.deleteMany({
        where: { userId: user.id, targetType, targetId },
      });
      return NextResponse.json({ success: true, saved: false });
    }

    await db.apologeticsBookmark.upsert({
      where: {
        userId_targetType_targetId: { userId: user.id, targetType, targetId },
      },
      create: { userId: user.id, targetType, targetId },
      update: {},
    });
    return NextResponse.json({ success: true, saved: true });
  } catch (error: any) {
    console.error("[api/apologetics/bookmarks POST] Error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
