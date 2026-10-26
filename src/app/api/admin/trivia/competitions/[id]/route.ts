import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/trivia/competitions/[id]
 *
 * Status transitions for competition moderation. The important one is
 * approving community-hosted trivia:
 *
 *   approve  : pending → scheduled      (goes live on the public board)
 *   reject   : pending → cancelled      (host sees "declined" in their list)
 *   cancel   : scheduled|live → cancelled
 *   reopen   : cancelled|ended → scheduled (admin discretion)
 *   end      : scheduled|live → ended
 *
 * create/update stay on POST /api/admin/trivia/competitions.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAuthUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const action = body?.action;

    const ALLOWED: Record<string, { from: string[]; to: string }> = {
      approve: { from: ["pending"], to: "scheduled" },
      reject: { from: ["pending"], to: "cancelled" },
      cancel: { from: ["scheduled", "live"], to: "cancelled" },
      reopen: { from: ["cancelled", "ended"], to: "scheduled" },
      end: { from: ["scheduled", "live"], to: "ended" },
    };

    if (!action || !ALLOWED[action]) {
      return NextResponse.json(
        { error: `action must be one of: ${Object.keys(ALLOWED).join(", ")}` },
        { status: 400 },
      );
    }

    const competition = await db.triviaCompetition.findUnique({ where: { id } });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const rule = ALLOWED[action];
    if (!rule.from.includes(competition.status)) {
      return NextResponse.json(
        { error: `Cannot ${action} a competition in status "${competition.status}"` },
        { status: 409 },
      );
    }

    const updated = await db.triviaCompetition.update({
      where: { id },
      data: { status: rule.to },
    });

    return NextResponse.json({ success: true, competition: updated });
  } catch (error: any) {
    console.error("[admin/trivia/competitions/id] PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update competition" }, { status: 500 });
  }
}
