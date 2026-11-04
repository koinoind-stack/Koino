import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { validateImages, str, int, validPrice, validPhone, validCategory, validLocation } from "@/lib/marketplace";

/**
 * Admin: Member Marketplace moderation.
 *
 * GET   /api/admin/marketplace?q=&status=&filter=featured — search ALL listings
 *       (any status) with seller info. Offset pagination (?limit=&offset=).
 *       status ∈ PENDING|APPROVED|REJECTED|SOLD|ARCHIVED
 *
 * PATCH /api/admin/marketplace — action-based moderation:
 *       { id, action: "approve" }                    → APPROVED
 *       { id, action: "reject", rejectionReason }    → REJECTED
 *       { id, action: "feature" | "unfeature" }      → toggle featured
 *       { id, action: "archive" }                    → ARCHIVED
 *       { id, action: "edit", edit: {...} }          → fix content issues
 *
 * DELETE /api/admin/marketplace?id= — remove a listing permanently.
 */

const EDITABLE = ["title", "description", "price", "mrp", "category", "state", "city", "sellerName"] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const filter = searchParams.get("filter");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "") || 50, 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "") || 0, 0);

    const where: Record<string, unknown> = {};
    if (["PENDING", "APPROVED", "REJECTED", "SOLD", "ARCHIVED"].includes(statusParam || "")) where.status = statusParam;
    if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { sellerName: { contains: q, mode: "insensitive" } }];

    let rows = await db.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { seller: { select: { username: true, name: true, email: true } } },
    });
    if (filter === "featured") rows = rows.filter((r) => r.featured);

    return NextResponse.json({ listings: rows, total: await db.marketplaceListing.count({ where }) });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return NextResponse.json({ listings: [], total: 0 });
    console.error("[admin/marketplace] list failed:", err);
    return NextResponse.json({ error: "Could not load listings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const action = typeof body?.action === "string" ? body.action : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const now = new Date();

    if (action === "approve" || action === "reject" || action === "archive" || action === "feature" || action === "unfeature") {
      const data: Record<string, unknown> = { reviewedBy: user.email, reviewedAt: now };
      if (action === "approve") Object.assign(data, { status: "APPROVED", rejectionReason: null });
      if (action === "reject") {
        const reason = typeof body?.rejectionReason === "string" && body.rejectionReason.trim()
          ? body.rejectionReason.trim().slice(0, 500) : "";
        if (!reason) return NextResponse.json({ error: "Please give the seller a short reason so they can fix the listing" }, { status: 400 });
        Object.assign(data, { status: "REJECTED", rejectionReason: reason });
      }
      if (action === "archive") data.status = "ARCHIVED";
      if (action === "feature") data.featured = true;
      if (action === "unfeature") data.featured = false;

      const updated = await db.marketplaceListing.update({ where: { id }, data, select: { id: true, status: true, featured: true } });
      revalidatePath("/", "layout");
      return NextResponse.json({ success: true, listing: updated });
    }

    if (action === "edit") {
      const edit = body?.edit && typeof body.edit === "object" ? body.edit : null;
      if (!edit) return NextResponse.json({ error: "edit object is required" }, { status: 400 });
      const data: Record<string, unknown> = { reviewedAt: now };

      if (edit.title != null) {
        const t = str(edit.title, 120);
        if (!t || t.length < 2) return NextResponse.json({ error: "Title must be 2–120 characters" }, { status: 400 });
        data.title = t;
      }
      if (edit.description != null) {
        const d = str(edit.description, 5000);
        if (!d || d.length < 10) return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });
        data.description = d;
      }
      if (edit.price != null || edit.mrp !== undefined) {
        const current = await db.marketplaceListing.findUnique({ where: { id }, select: { price: true, mrp: true } });
        if (!current) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
        const price = edit.price != null ? int(edit.price) : current.price;
        const mrp = edit.mrp !== undefined ? (edit.mrp == null || edit.mrp === "" ? null : int(edit.mrp)) : current.mrp;
        const priceErr = validPrice(price ?? 0, mrp);
        if (priceErr) return NextResponse.json({ error: priceErr }, { status: 400 });
        data.price = price;
        data.mrp = mrp;
      }
      if (edit.category != null) {
        const c = str(edit.category, 60);
        if (!c || !validCategory(c, "marketplace")) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
        data.category = c;
      }
      if (edit.state != null || edit.city != null) {
        const current = await db.marketplaceListing.findUnique({ where: { id }, select: { state: true, city: true } });
        if (!current) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
        const state = edit.state != null ? str(edit.state, 60) : current.state;
        const city = edit.city != null ? str(edit.city, 80) : current.city;
        const locErr = validLocation(state, city);
        if (locErr) return NextResponse.json({ error: locErr }, { status: 400 });
        data.state = state;
        data.city = city;
      }
      if (edit.sellerName != null) {
        const sn = str(edit.sellerName, 80);
        if (!sn) return NextResponse.json({ error: "Seller name cannot be empty" }, { status: 400 });
        data.sellerName = sn;
      }
      if (edit.images !== undefined) {
        const imgs = validateImages(edit.images);
        if (!imgs.ok) return NextResponse.json({ error: imgs.error }, { status: 400 });
        data.images = JSON.stringify(imgs.images);
      }

      if (Object.keys(data).length === 1) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      const updated = await db.marketplaceListing.update({ where: { id }, data, select: { id: true, status: true } });
      revalidatePath("/", "layout");
      return NextResponse.json({ success: true, listing: updated });
    }

    if (action === "contact") {
      // Admin can fix seller contact details (e.g. invalid numbers).
      const whatsappNumber = str(body?.whatsappNumber, 16)?.replace(/[\s\-()]/g, "") || null;
      const phone = str(body?.phone, 16)?.replace(/[\s\-()]/g, "") || null;
      if (!whatsappNumber && !phone) return NextResponse.json({ error: "Provide at least one contact number" }, { status: 400 });
      if (!validPhone(whatsappNumber) || !validPhone(phone)) return NextResponse.json({ error: "Invalid phone/WhatsApp number" }, { status: 400 });
      const updated = await db.marketplaceListing.update({
        where: { id }, data: { whatsappNumber, phone },
        select: { id: true, status: true },
      });
      return NextResponse.json({ success: true, listing: updated });
    }

    return NextResponse.json({ error: "action must be approve | reject | feature | unfeature | archive | edit | contact" }, { status: 400 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    console.error("[admin/marketplace] patch failed:", err);
    return NextResponse.json({ error: "Could not update the listing" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db.marketplaceListing.delete({ where: { id } });
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    console.error("[admin/marketplace] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the listing" }, { status: 500 });
  }
}
