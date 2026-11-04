import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * GET /api/admin/trivia/winners
 *
 * Returns all trivia competition winners for admin management.
 * Shows winner status, prize, phone verification, shipping info.
 * Admin-only — 403 for non-admins.
 *
 * Query: ?status=pending_verification | ?competitionId=X
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const competitionId = searchParams.get("competitionId");

    const where: any = {};
    if (status) where.status = status;
    if (competitionId) where.competitionId = competitionId;

    const winners = await db.triviaWinner.findMany({
      where,
      orderBy: [{ rank: "asc" }, { createdAt: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            image: true,
            state: true,
            city: true,
            mobileNumber: true, // only visible to admin
            mobileVerified: true,
          },
        },
        competition: { select: { id: true, title: true, type: true } },
        prize: { select: { id: true, name: true, imageUrl: true } },
      },
    });

    return NextResponse.json({ winners });
  } catch (error: any) {
    console.error("[admin/trivia/winners] GET error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/trivia/winners
 *
 * Update a winner's fulfilment status / admin notes (Trivia Rewards mgmt).
 * Body: { id, status?, adminNotes? }
 * Allowed status values match the TriviaWinner lifecycle:
 * pending_verification | phone_verified | contacted | address_pending |
 * address_verified | processing | shipped | delivered | claimed |
 * cancelled | disqualified | expired
 */
const WINNER_STATUSES = [
  "pending_verification", "phone_verified", "contacted", "address_pending",
  "address_verified", "processing", "shipped", "delivered", "claimed",
  "cancelled", "disqualified", "expired",
];

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (body?.status !== undefined) {
      const status = String(body.status);
      if (!WINNER_STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = status;
    }
    if (body?.adminNotes !== undefined) {
      data.adminNotes = typeof body.adminNotes === "string" && body.adminNotes.trim()
        ? body.adminNotes.trim().slice(0, 1000) : null;
    }
    if (body?.disqualifiedReason !== undefined) {
      data.disqualifiedReason = typeof body.disqualifiedReason === "string" && body.disqualifiedReason.trim()
        ? body.disqualifiedReason.trim().slice(0, 500) : null;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.triviaWinner.update({
      where: { id },
      data,
      select: { id: true, status: true, adminNotes: true },
    });
    return NextResponse.json({ success: true, winner: updated });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Winner not found" }, { status: 404 });
    console.error("[admin/trivia/winners] patch failed:", e);
    return NextResponse.json({ error: "Could not update the winner" }, { status: 500 });
  }
}
