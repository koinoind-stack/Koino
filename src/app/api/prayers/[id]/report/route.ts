import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/prayers/[id]/report — report a request or one of its comments.
 * Reuses the existing Report model (admins review via /api/admin/reports,
 * whose enrichment learns the "prayer" / "prayer_comment" targetTypes).
 * Body: { targetType: "prayer" | "prayer_comment", targetId?, reason?, details? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;

    if (!rateLimit(`prayers:report:${user.id}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const targetType = body.targetType === "prayer_comment" ? "prayer_comment" : "prayer";
    const targetId = targetType === "prayer" ? id : typeof body.targetId === "string" ? body.targetId : "";
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 100) : null;
    const details = typeof body.details === "string" ? body.details.trim().slice(0, 1000) : null;

    if (targetType === "prayer") {
      const prayer = await db.prayerRequest.findUnique({ where: { id }, select: { id: true } });
      if (!prayer) return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
    } else {
      if (!targetId) return NextResponse.json({ error: "targetId is required" }, { status: 400 });
      const comment = await db.prayerComment.findUnique({ where: { id: targetId }, select: { id: true, prayerId: true } });
      if (!comment || comment.prayerId !== id) {
        return NextResponse.json({ error: "Comment not found on this prayer" }, { status: 404 });
      }
    }

    // Duplicate guard: same reporter + same target still pending.
    const dupe = await db.report.findFirst({
      where: { reporterId: user.id, targetType, targetId, status: "pending" },
      select: { id: true },
    });
    if (dupe) {
      return NextResponse.json({ ok: true, alreadyReported: true });
    }

    await db.report.create({
      data: { reporterId: user.id, targetType, targetId, reason, details },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[api/prayers/id/report] POST failed:", err);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
