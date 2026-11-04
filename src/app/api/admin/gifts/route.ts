import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

// JSON-encoded fields stored as TEXT in SQLite. Always fall back to []
// if the column is empty / malformed so the client never crashes.
function safeParseArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Strip empty / malformed variation entries coming from the client.
// Expected shape: [{ name: "Size", options: ["S","M","L"] }, ...]
function normalizeVariations(input: any): any[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v: any) => ({
      name: typeof v?.name === "string" ? v.name.trim() : "",
      options: Array.isArray(v?.options)
        ? v.options.map((o: any) => String(o).trim()).filter(Boolean)
        : [],
    }))
    .filter((v: any) => v.name && v.options.length > 0);
}

// Strip empty / malformed attribute entries.
// Expected shape: [{ label: "Material", value: "100% Cotton" }, ...]
function normalizeAttributes(input: any): any[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((a: any) => ({
      label: typeof a?.label === "string" ? a.label.trim() : "",
      value: typeof a?.value === "string" ? a.value.trim() : "",
    }))
    .filter((a: any) => a.label && a.value);
}

async function requireAdmin() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  if (authUser.role !== "admin") return null;
  return authUser.id;
}

export async function GET() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const gifts = await db.gift.findMany({
      where: { isActive: true },
      orderBy: { pointsRequired: "asc" },
    });
    return NextResponse.json({
      gifts: gifts.map((g) => ({
        id: g.giftId,
        title: g.title,
        description: g.description,
        imageUrl: g.imageUrl,
        pointsRequired: g.pointsRequired,
        tier: g.tier,
        stock: g.stock,
        variations: safeParseArray(g.variations),
        attributes: safeParseArray(g.attributes),
        isActive: g.isActive,
        rewardType: g.rewardType,
        deliveryType: g.deliveryType,
        eligibilityType: g.eligibilityType,
        eligibilityValue: g.eligibilityValue,
        isAdmin: !["g1", "g2", "g3", "g4", "g5", "g6"].includes(g.giftId),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const { title, description, imageUrl, pointsRequired, tier, stock, variations, attributes } = body;

    if (!title || !pointsRequired || !imageUrl) {
      return NextResponse.json({ error: "Title, pointsRequired, and imageUrl are required" }, { status: 400 });
    }

    const giftId = `g_admin_${Date.now()}`;
    const gift = await db.gift.create({
      data: {
        giftId, title, description: description || "", imageUrl,
        pointsRequired: Number(pointsRequired), tier: tier || "bronze",
        stock: Number(stock) || 0, isActive: true,
        variations: JSON.stringify(normalizeVariations(variations)),
        attributes: JSON.stringify(normalizeAttributes(attributes)),
      },
    });

    return NextResponse.json({ success: true, gift: { id: gift.giftId, title: gift.title } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const { giftId, ...updates } = body;
    if (!giftId) return NextResponse.json({ error: "giftId required" }, { status: 400 });

    const gift = await db.gift.findFirst({ where: { giftId } });
    if (!gift) return NextResponse.json({ error: "Gift not found" }, { status: 404 });

    const data: any = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl;
    if (updates.pointsRequired !== undefined) data.pointsRequired = Number(updates.pointsRequired);
    if (updates.tier !== undefined) data.tier = updates.tier;
    if (updates.stock !== undefined) {
      const stock = Number(updates.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
        return NextResponse.json({ error: "Stock must be 0 or more" }, { status: 400 });
      }
      data.stock = stock;
    }
    if (updates.isActive !== undefined) data.isActive = updates.isActive === true;
    if (updates.rewardType !== undefined) {
      if (!["fp_reward", "competition_prize", "streak_milestone"].includes(String(updates.rewardType))) {
        return NextResponse.json({ error: "Invalid rewardType" }, { status: 400 });
      }
      data.rewardType = String(updates.rewardType);
    }
    if (updates.deliveryType !== undefined) {
      if (!["physical", "merchandise", "voucher"].includes(String(updates.deliveryType))) {
        return NextResponse.json({ error: "Invalid deliveryType" }, { status: 400 });
      }
      data.deliveryType = String(updates.deliveryType);
    }
    if (updates.eligibilityType !== undefined) {
      if (!["points", "competition_winner", "leaderboard_top"].includes(String(updates.eligibilityType))) {
        return NextResponse.json({ error: "Invalid eligibilityType" }, { status: 400 });
      }
      data.eligibilityType = String(updates.eligibilityType);
    }
    if (updates.eligibilityValue !== undefined) {
      if (updates.eligibilityValue == null) {
        data.eligibilityValue = null;
      } else {
        const ev = Number(updates.eligibilityValue);
        if (!Number.isInteger(ev) || ev < 1 || ev > 1_000_000) {
          return NextResponse.json({ error: "Invalid eligibilityValue" }, { status: 400 });
        }
        data.eligibilityValue = ev;
      }
    }
    if (updates.variations !== undefined) {
      data.variations = JSON.stringify(normalizeVariations(updates.variations));
    }
    if (updates.attributes !== undefined) {
      data.attributes = JSON.stringify(normalizeAttributes(updates.attributes));
    }

    await db.gift.update({ where: { id: gift.id }, data });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const { giftId } = body;
    if (!giftId) return NextResponse.json({ error: "giftId required" }, { status: 400 });

    const gift = await db.gift.findFirst({ where: { giftId } });
    if (!gift) return NextResponse.json({ error: "Gift not found" }, { status: 404 });

    await db.gift.update({ where: { id: gift.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
