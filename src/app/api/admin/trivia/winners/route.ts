import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

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
