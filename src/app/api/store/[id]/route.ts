import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/social/server";
import { serializeStoreProduct } from "@/lib/marketplace";

/**
 * GET /api/store/[id] — public detail for an active Koino Store product.
 * Includes the store contact number for the existing WhatsApp order workflow.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await db.storeProduct.findUnique({ where: { id } });
    if (!row || !row.active) return jsonError("Product not found", 404);
    return Response.json({
      product: {
        ...serializeStoreProduct(row),
        stockQuantity: row.stockQuantity,
        variations: JSON.parse(row.variations || "[]"),
        attributes: JSON.parse(row.attributes || "[]"),
        contactWhatsapp: row.contactWhatsapp,
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Product not found", 404);
    console.error("[store/detail] failed:", err);
    return jsonError("Could not load the product", 500);
  }
}
