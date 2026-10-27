import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import {
  validateImages, str, int, validPrice, validPhone, validCategory,
  validLocation, serializeMemberListing, serializeStoreProduct, type PublicProductCard,
} from "@/lib/marketplace";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/marketplace — public, database-backed product feed.
 *   ?source=all|koino|member   koino = official Koino Store inventory,
 *                              member = community listings (default all)
 *   ?q=&category=&state=&city=&sort=newest|price_asc|price_desc&featured=1
 *   ?cursor=<iso date>&limit=  keyset pagination over member listings
 * Only APPROVED member listings and active store products are exposed.
 * Seller contact details are NEVER included here (detail endpoint only).
 *
 * POST /api/marketplace — member creates a listing (auth required).
 *   Always saved with status PENDING — an admin must approve before it
 *   appears publicly. Members cannot set status/featured/sellerType.
 */

const SORTS = ["newest", "price_asc", "price_desc"] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = ["all", "koino", "member"].includes(searchParams.get("source") || "")
    ? (searchParams.get("source") as "all" | "koino" | "member")
    : "all";
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const state = searchParams.get("state")?.trim();
  const city = searchParams.get("city")?.trim();
  const sort = SORTS.includes((searchParams.get("sort") || "") as never)
    ? (searchParams.get("sort") as (typeof SORTS)[number])
    : "newest";
  const featured = searchParams.get("featured") === "1";
  const cursor = searchParams.get("cursor")?.trim();
  const limit = Math.min(Math.max(int(searchParams.get("limit")) || 24, 1), 48);

  const memberWhere: Prisma.MarketplaceListingWhereInput = { status: "APPROVED" };
  const storeWhere: Prisma.StoreProductWhereInput = { active: true };
  for (const w of [memberWhere, storeWhere] as Prisma.MarketplaceListingWhereInput[]) {
    if (q) w.OR = [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }];
    if (category) w.category = category;
    if (state) w.state = state;
    if (city) w.city = city;
    if (featured) w.featured = true;
  }

  try {
    const wantKoino = source === "all" || source === "koino";
    const wantMember = source === "all" || source === "member";

    // Koino Store inventory is admin-managed and small — filtered server-side,
    // returned whole so the store filter always shows every store item.
    const storeRows = wantKoino
      ? await db.storeProduct.findMany({
          where: storeWhere,
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        })
      : [];

    // Member listings use keyset pagination (createdAt cursor, memorials-style).
    const memberWherePaged: Prisma.MarketplaceListingWhereInput = { ...memberWhere };
    if (cursor) {
      const d = new Date(cursor);
      if (!Number.isNaN(d.getTime())) memberWherePaged.createdAt = { lt: d };
    }
    const memberRows = wantMember
      ? await db.marketplaceListing.findMany({
          where: memberWherePaged,
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [];

    const products: PublicProductCard[] = [
      ...storeRows.map((r) => serializeStoreProduct(r)),
      ...memberRows.map((r) => serializeMemberListing(r)),
    ];
    if (sort === "price_asc") products.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") products.sort((a, b) => b.price - a.price);

    const hasMore = wantMember && memberRows.length === limit;
    return Response.json({
      products,
      nextCursor: hasMore ? memberRows[memberRows.length - 1].createdAt.toISOString() : null,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return Response.json({ products: [], nextCursor: null });
    }
    console.error("[marketplace] list failed:", err);
    return jsonError("Could not load the marketplace", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;

  if (!rateLimit(`marketplace:create:${me.id}`, 10, 60 * 60 * 1000)) {
    return jsonError("Too many listings created — try again in a while", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const title = str(body.title, 120);
  if (!title || title.length < 2) return jsonError("Please enter the product name (2–120 characters)");
  const description = str(body.description, 5000);
  if (!description || description.length < 10) return jsonError("Please write a short description (at least 10 characters)");

  const price = int(body.price);
  const mrpRaw = int(body.mrp);
  const mrp = body.mrp == null || body.mrp === "" ? null : mrpRaw;
  if (price == null) return jsonError("Please enter the selling price in ₹");
  const priceErr = validPrice(price, mrp);
  if (priceErr) return jsonError(priceErr);

  const category = str(body.category, 60);
  if (!category || !validCategory(category, "marketplace")) return jsonError("Please choose a valid category");

  const imgs = validateImages(body.images);
  if (!imgs.ok) return jsonError(imgs.error);

  const state = str(body.state, 60);
  const city = str(body.city, 80);
  const locErr = validLocation(state, city);
  if (locErr) return jsonError(locErr);

  const whatsappNumber = str(body.whatsappNumber, 16)?.replace(/[\s\-()]/g, "") || null;
  const phone = str(body.phone, 16)?.replace(/[\s\-()]/g, "") || null;
  if (!whatsappNumber && !phone) return jsonError("Please add a WhatsApp or phone number so buyers can reach you");
  if (!validPhone(whatsappNumber) || !validPhone(phone)) {
    return jsonError("Please enter a valid phone/WhatsApp number (10–15 digits)");
  }

  const inStock = body.inStock !== false;

  try {
    const row = await db.marketplaceListing.create({
      data: {
        title,
        description,
        price,
        mrp,
        category,
        images: JSON.stringify(imgs.images),
        state,
        city,
        sellerName: str(body.sellerName, 80) || "A Koino member",
        whatsappNumber,
        phone,
        inStock,
        status: "PENDING",
        sellerType: "member",
        sellerId: me.id,
      },
      select: { id: true, status: true },
    });
    return Response.json({ success: true, listing: row }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return jsonError("The marketplace is not ready yet — the database tables need to be created first", 503);
    }
    console.error("[marketplace] create failed:", err);
    return jsonError("Could not create the listing", 500);
  }
}
