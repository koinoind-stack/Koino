import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { PrismaClient } from "@prisma/client";
import { PRODUCTS } from "@/lib/crosscrafted-data";

const db = new PrismaClient();

function safeParseArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/trivia/gifts
 *
 * Returns all active gifts + whether the authenticated user has claimed each.
 * When a gift has a productId, the product info (name, image, price, variants)
 * is merged from the Koino Shop product catalog — no duplicate data.
 */
export async function GET() {
  try {
    const user = await getAuthUser();

    const gifts = await db.gift.findMany({
      where: { isActive: true },
      orderBy: { pointsRequired: "asc" },
    });

    // Get user's redemptions if logged in
    let claimedGiftIds: Set<string> = new Set();
    if (user) {
      const redemptions = await db.giftRedemption.findMany({
        where: { userId: user.id },
        select: { giftId: true },
      });
      claimedGiftIds = new Set(redemptions.map((r) => r.giftId));
    }

    // Build a product lookup map from the Koino Shop catalog
    const productMap = new Map(PRODUCTS.map((p) => [p.id, p]));

    const result = gifts.map((g) => {
      // If this gift references a Koino Shop product, merge product data
      let productInfo: any = null;
      if (g.productId) {
        const product = productMap.get(g.productId);
        if (product) {
          productInfo = {
            productId: product.id,
            productImage: product.cover_image || product.images?.[0] || null,
            productName: product.name,
            productPrice: product.price,
            productVariants: product.variations || [],
            productInStock: product.in_stock,
            sellerType: product.sellerType,
          };
        }
      }

      // Use product image if available, otherwise fall back to the gift's imageUrl
      const displayImage = productInfo?.productImage || g.imageUrl;

      return {
        id: g.giftId,
        title: g.title,
        description: g.description,
        imageUrl: displayImage,
        pointsRequired: g.pointsRequired,
        tier: g.tier,
        stock: g.stock,
        variations: safeParseArray(g.variations),
        attributes: safeParseArray(g.attributes),
        claimed: claimedGiftIds.has(g.giftId),
        productId: g.productId || null,
        product: productInfo,
        rewardType: g.rewardType,
      };
    });

    return NextResponse.json({
      gifts: result,
      userPoints: user?.totalPoints || 0,
      isAuthenticated: !!user,
    });
  } catch (error: any) {
    console.error("[trivia/gifts] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
