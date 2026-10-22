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
 * GET /api/admin/milestones — list all milestones
 * POST /api/admin/milestones — create a milestone (links streak threshold to reward)
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const milestones = await db.streakMilestone.findMany({
      orderBy: { streakDays: "asc" },
      include: { reward: true, _count: { select: { userRewards: true } } },
    });
    return NextResponse.json({ milestones });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    if (!body.streakDays || !body.rewardId) {
      return NextResponse.json({ error: "Missing required fields: streakDays, rewardId" }, { status: 400 });
    }

    const milestone = await db.streakMilestone.create({
      data: {
        streakDays: parseInt(body.streakDays),
        rewardId: body.rewardId,
        repeatable: body.repeatable === true,
        active: body.active !== false,
        displayText: body.displayText || null,
      },
      include: { reward: true },
    });

    return NextResponse.json({ success: true, milestone });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
