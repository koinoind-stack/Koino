import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/social/server";
import { serializeStoreProduct } from "@/lib/marketplace";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/store — public Koino Store catalogue (admin-managed inventory).
 *   ?q=&category=&sort=newest|price_asc|price_desc&featured=1
 * Only active products are exposed. Store contact details are NOT included
 * in the list (see /api/store/[id] detail).
 */
const SORTS = ["newest", "price_asc", "price_desc"] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const sort = SORTS.includes((searchParams.get("sort") || "") as never)
    ? (searchParams.get("sort") as (typeof SORTS)[number])
    : "newest";
  const featured = searchParams.get("featured") === "1";

  const where: Prisma.StoreProductWhereInput = { active: true };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }];
  if (category) where.category = category;
  if (featured) where.featured = true;

  try {
    const rows = await db.storeProduct.findMany({
      where,
      orderBy: sort === "price_asc" ? { price: "asc" } : sort === "price_desc" ? { price: "desc" } : [{ featured: "desc" }, { createdAt: "desc" }],
    });
    return Response.json({ products: rows.map((r) => serializeStoreProduct(r)) });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return Response.json({ products: [] });
    console.error("[store] list failed:", err);
    return jsonError("Could not load the Koino Store", 500);
  }
}
