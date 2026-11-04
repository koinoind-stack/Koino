import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import { requireAuth } from "@/lib/apologetics-server";

const REPORTABLE = ["apologetics_article", "apologetics_question", "apologetics_comment"] as const;

/**
 * POST /api/apologetics/report — report an article, question or comment
 * (auth required). Stored in the existing Report model with a PART 2
 * targetType; admins review via the admin Engagement tab.
 * Body: { targetType, targetId, reason?, details? }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const user = auth.user;

    if (!rateLimit(`apologetics:report:${user.id}`, 5, 10 * 60_000)) {
      return NextResponse.json(
        { error: "Too many reports. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { targetType, targetId } = body;
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 100) : null;
    const details = typeof body.details === "string" ? body.details.trim().slice(0, 1000) : null;

    if (!REPORTABLE.includes(targetType)) {
      return NextResponse.json(
        { error: `Invalid targetType. Must be one of: ${REPORTABLE.join(", ")}` },
        { status: 400 }
      );
    }
    if (typeof targetId !== "string" || !targetId.trim()) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }

    // Target must exist (any status — reporting hidden content is valid)
    let exists = false;
    if (targetType === "apologetics_article") {
      exists = !!(await db.koinoArticle.findUnique({ where: { id: targetId }, select: { id: true } }));
    } else if (targetType === "apologetics_question") {
      exists = !!(await db.userQuestion.findUnique({ where: { id: targetId }, select: { id: true } }));
    } else {
      exists = !!(await db.apologeticsComment.findUnique({ where: { id: targetId }, select: { id: true } }));
    }
    if (!exists) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    // Duplicate guard: same reporter + same target, still pending
    const dupe = await db.report.findFirst({
      where: {
        reporterId: user.id,
        targetType,
        targetId,
        status: "pending",
      },
      select: { id: true },
    });
    if (dupe) {
      return NextResponse.json({
        success: true,
        alreadyReported: true,
        message: "You've already reported this. Our team is reviewing it.",
      });
    }

    await db.report.create({
      data: {
        reporterId: user.id,
        targetType,
        targetId,
        reason,
        details,
      },
    });

    return NextResponse.json({ success: true, message: "Report received. Thank you." });
  } catch (error: any) {
    console.error("[api/apologetics/report POST] Error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
