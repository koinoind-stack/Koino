import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { validateImages, str, int, validPrice, validPhone, validCategory, validLocation } from "@/lib/marketplace";

/**
 * GET /api/marketplace/[id] — public detail for an APPROVED listing.
 * This is the ONLY endpoint that exposes seller contact details, and only
 * for approved listings. Owners/admins may also view their PENDING/REJECTED
 * listings here (contact included for owner only).
 *
 * PATCH /api/marketplace/[id] — owner edits content; owner may move their
 * listing to PENDING (resubmit after rejection), SOLD or ARCHIVED. A member
 * can never touch another member's listing (admins use /api/admin/marketplace).
 *
 * DELETE /api/marketplace/[id] — owner or admin deletes permanently.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await db.marketplaceListing.findUnique({ where: { id } });
    if (!row) return jsonError("Listing not found", 404);

    const session = await getSessionUser();
    const isOwner = !!session.user && (session.user.id === row.sellerId || session.user.role === "admin");
    if (row.status !== "APPROVED" && !isOwner) return jsonError("Listing not found", 404);

    return Response.json({
      listing: {
        id: row.id,
        kind: "member" as const,
        name: row.title,
        description: row.description,
        price: row.price,
        mrp: row.mrp,
        category: row.category,
        images: JSON.parse(row.images || "[]") as string[],
        state: row.state || "",
        city: row.city || "",
        vendor: row.sellerName,
        sellerType: "marketplace" as const,
        in_stock: row.inStock,
        featured: row.featured,
        buyUrl: null,
        rating: null,
        reviews: null,
        cover_gradient: row.coverGradient,
        createdAt: row.createdAt.toISOString(),
        status: row.status,
        // Privacy: contact only for approved listings (or the owner's view).
        ...(row.status === "APPROVED" || isOwner
          ? { whatsappNumber: row.whatsappNumber, phone: row.phone }
          : {}),
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Listing not found", 404);
    console.error("[marketplace/detail] failed:", err);
    return jsonError("Could not load the listing", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }

  try {
    const row = await db.marketplaceListing.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true },
    });
    if (!row) return jsonError("Listing not found", 404);
    const isOwner = row.sellerId === session.user.id;
    const isAdmin = session.user.role === "admin";
    if (!isOwner && !isAdmin) return jsonError("You can only manage your own listings", 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON body");
    }

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const t = str(body.title, 120);
      if (!t || t.length < 2) return jsonError("Please enter the product name (2–120 characters)");
      data.title = t;
    }
    if ("description" in body) {
      const d = str(body.description, 5000);
      if (!d || d.length < 10) return jsonError("Please write a short description (at least 10 characters)");
      data.description = d;
    }
    if ("price" in body || "mrp" in body) {
      const current = await db.marketplaceListing.findUnique({ where: { id }, select: { price: true, mrp: true } });
      const price = "price" in body ? int(body.price) : current!.price;
      const mrpIn = "mrp" in body ? (body.mrp == null || body.mrp === "" ? null : int(body.mrp)) : current!.mrp;
      if (price == null) return jsonError("Please enter a valid price");
      const priceErr = validPrice(price, mrpIn);
      if (priceErr) return jsonError(priceErr);
      data.price = price;
      data.mrp = mrpIn;
    }
    if ("category" in body) {
      const c = str(body.category, 60);
      if (!c || !validCategory(c, "marketplace")) return jsonError("Please choose a valid category");
      data.category = c;
    }
    if ("images" in body) {
      const imgs = validateImages(body.images);
      if (!imgs.ok) return jsonError(imgs.error);
      data.images = JSON.stringify(imgs.images);
    }
    if ("state" in body || "city" in body) {
      const current = await db.marketplaceListing.findUnique({ where: { id }, select: { state: true, city: true } });
      const state = "state" in body ? str(body.state, 60) : current!.state;
      const city = "city" in body ? str(body.city, 80) : current!.city;
      const locErr = validLocation(state, city);
      if (locErr) return jsonError(locErr);
      data.state = state;
      data.city = city;
    }
    if ("whatsappNumber" in body || "phone" in body) {
      const current = await db.marketplaceListing.findUnique({ where: { id }, select: { whatsappNumber: true, phone: true } });
      const whatsappNumber = "whatsappNumber" in body ? (str(body.whatsappNumber, 16)?.replace(/[\s\-()]/g, "") || null) : current!.whatsappNumber;
      const phone = "phone" in body ? (str(body.phone, 16)?.replace(/[\s\-()]/g, "") || null) : current!.phone;
      if (!whatsappNumber && !phone) return jsonError("Please keep at least one contact number so buyers can reach you");
      if (!validPhone(whatsappNumber) || !validPhone(phone)) return jsonError("Please enter a valid phone/WhatsApp number (10–15 digits)");
      data.whatsappNumber = whatsappNumber;
      data.phone = phone;
    }
    if ("inStock" in body) data.inStock = body.inStock === true;

    // Member-allowed status moves: resubmit after rejection, mark sold, archive.
    if ("status" in body) {
      const s = String(body.status);
      if (!["PENDING", "SOLD", "ARCHIVED"].includes(s)) {
        return jsonError("Listings are approved by Koino admins — you can mark a listing Sold or Archived");
      }
      data.status = s;
      if (s === "PENDING") data.rejectionReason = null;
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update");

    const updated = await db.marketplaceListing.update({
      where: { id },
      data,
      select: { id: true, status: true },
    });
    return Response.json({ success: true, listing: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Listing not found", 404);
    console.error("[marketplace/patch] failed:", err);
    return jsonError("Could not update the listing", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  try {
    const row = await db.marketplaceListing.findUnique({
      where: { id },
      select: { sellerId: true },
    });
    if (!row) return jsonError("Listing not found", 404);
    if (row.sellerId !== session.user.id && session.user.role !== "admin") {
      return jsonError("You can only delete your own listings", 403);
    }
    await db.marketplaceListing.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Listing not found", 404);
    console.error("[marketplace/delete] failed:", err);
    return jsonError("Could not delete the listing", 500);
  }
}
