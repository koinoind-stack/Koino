import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";
import { db } from "@/lib/db";

/**
 * POST /api/churches/[id]/report — flag a published listing for incorrect
 * public information (wrong address, times, closed, etc). Reuses the
 * existing Report model — admins review it in /api/admin/reports.
 * Body: { reason?, details? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Sign in to report a listing." }, { status: 401 });
    const { id } = await params;

    if (!rateLimit(`churches:report:${user.id}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
    }

    const church = await db.church.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!church || church.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Church not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 100) : null;
    const details = typeof body.details === "string" ? body.details.trim().slice(0, 1000) : null;

    // Duplicate guard: same reporter + same church still pending.
    const dupe = await db.report.findFirst({
      where: { reporterId: user.id, targetType: "church", targetId: id, status: "pending" },
      select: { id: true },
    });
    if (dupe) {
      return NextResponse.json({ ok: true, alreadyReported: true });
    }

    await db.report.create({
      data: { reporterId: user.id, targetType: "church", targetId: id, reason, details },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[api/churches/id/report] POST failed:", err);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
