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
 * GET /api/admin/rewards — list all rewards
 * POST /api/admin/rewards — create a reward
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const rewards = await db.koinoReward.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { userRewards: true, milestones: true } } },
    });
    return NextResponse.json({ rewards });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    if (!body.name || !body.rewardType) {
      return NextResponse.json({ error: "Missing required fields: name, rewardType" }, { status: 400 });
    }

    const reward = await db.koinoReward.create({
      data: {
        name: body.name,
        description: body.description || null,
        rewardType: body.rewardType,
        discountType: body.discountType || null,
        discountValue: parseFloat(body.discountValue) || 0,
        maximumDiscount: body.maximumDiscount ? parseFloat(body.maximumDiscount) : null,
        minimumOrderValue: body.minimumOrderValue ? parseFloat(body.minimumOrderValue) : null,
        productId: body.productId || null,
        inventoryLimit: body.inventoryLimit ? parseInt(body.inventoryLimit) : null,
        expiresAfterDays: body.expiresAfterDays ? parseInt(body.expiresAfterDays) : null,
        active: body.active !== false,
      },
    });

    return NextResponse.json({ success: true, reward });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
