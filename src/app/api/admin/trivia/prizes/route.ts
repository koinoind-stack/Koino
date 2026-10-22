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
 * GET /api/admin/trivia/prizes
 * Returns all prizes for admin management.
 *
 * POST /api/admin/trivia/prizes
 * Creates a new prize. Admin-only.
 * Body: { name, description?, imageUrl?, sourceType, productId?, quantity,
 *         requiresShipping?, terms?, active? }
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const prizes = await db.triviaPrize.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { winners: true, competitions: true } },
      },
    });

    return NextResponse.json({ prizes });
  } catch (error: any) {
    console.error("[admin/trivia/prizes] GET error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    if (!body.name || !body.sourceType) {
      return NextResponse.json({ error: "Missing required fields: name, sourceType" }, { status: 400 });
    }

    const quantity = parseInt(body.quantity) || 1;

    const prize = await db.triviaPrize.create({
      data: {
        name: body.name,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        sourceType: body.sourceType, // "koino_merch" | "custom"
        productId: body.productId || null,
        quantity,
        assignedQuantity: 0,
        remainingQuantity: quantity,
        approximateValue: body.approximateValue ? parseFloat(body.approximateValue) : null,
        requiresShipping: body.requiresShipping !== false,
        active: body.active !== false,
        terms: body.terms || null,
      },
    });

    return NextResponse.json({ success: true, prize });
  } catch (error: any) {
    console.error("[admin/trivia/prizes] POST error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
