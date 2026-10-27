import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  validateImages, str, validPhone, validCategory, validLocation,
  validWebsite, validEmail,
} from "@/lib/marketplace";

/**
 * Admin: Business Directory management.
 *
 * GET    /api/admin/businesses?q=&status= — all businesses incl. pending
 * POST   /api/admin/businesses — admin creates a business (any status)
 * PATCH  /api/admin/businesses — action-based:
 *        approve | reject(rejectionReason) | verify | unverify |
 *        feature | unfeature | archive | edit{...}
 * DELETE /api/admin/businesses?id=
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const where: Record<string, unknown> = {};
    if (["PENDING", "APPROVED", "REJECTED", "ARCHIVED"].includes(statusParam || "")) where.status = statusParam;
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { ownerName: { contains: q, mode: "insensitive" } }];

    const rows = await db.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { owner: { select: { username: true, name: true, email: true } } },
    });
    return NextResponse.json({ businesses: rows, total: await db.business.count({ where }) });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return NextResponse.json({ businesses: [], total: 0 });
    console.error("[admin/businesses] list failed:", err);
    return NextResponse.json({ error: "Could not load businesses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const name = str(body.name, 120);
    if (!name || name.length < 2) return NextResponse.json({ error: "Please enter the business name (2–120 characters)" }, { status: 400 });
    const description = str(body.description, 4000);
    if (!description || description.length < 10) return NextResponse.json({ error: "Please write a short description (at least 10 characters)" }, { status: 400 });
    const category = str(body.category, 80);
    if (!category || !validCategory(category, "business")) return NextResponse.json({ error: "Please choose a valid category" }, { status: 400 });
    const state = str(body.state, 60);
    const city = str(body.city, 80);
    const locErr = validLocation(state, city);
    if (locErr) return NextResponse.json({ error: locErr }, { status: 400 });
    const imgs = validateImages(body.images);
    if (!imgs.ok) return NextResponse.json({ error: imgs.error }, { status: 400 });
    const whatsappNumber = str(body.whatsappNumber, 16)?.replace(/[\s\-()]/g, "") || null;
    const phone = str(body.phone, 16)?.replace(/[\s\-()]/g, "") || null;
    if (!whatsappNumber && !phone) return NextResponse.json({ error: "Please add a business WhatsApp or phone number" }, { status: 400 });
    if (!validPhone(whatsappNumber) || !validPhone(phone)) return NextResponse.json({ error: "Invalid phone/WhatsApp number" }, { status: 400 });
    const email = str(body.email, 200);
    if (!validEmail(email)) return NextResponse.json({ error: "Invalid business email" }, { status: 400 });
    const website = str(body.website, 300);
    if (!validWebsite(website)) return NextResponse.json({ error: "Website must be a valid https link" }, { status: 400 });

    const status = ["PENDING", "APPROVED", "REJECTED", "ARCHIVED"].includes(String(body.status))
      ? String(body.status) : "PENDING";
    const services = Array.isArray(body.services)
      ? body.services.filter((s: unknown): s is string => typeof s === "string" && s.trim() !== "").slice(0, 10).map((s: string) => s.trim().slice(0, 80))
      : [];

    const row = await db.business.create({
      data: {
        name,
        description,
        category,
        state,
        city,
        address: str(body.address, 300),
        images: JSON.stringify(imgs.images),
        whatsappNumber,
        phone,
        email,
        website,
        hours: str(body.hours, 120),
        services: JSON.stringify(services),
        status,
        ownerName: str(body.ownerName, 80) || user.name || user.username || "Koino",
        ownerEmail: user.email,
        reviewedBy: user.email,
        reviewedAt: new Date(),
        verified: body.verified === true,
        featured: body.featured === true,
      },
      select: { id: true, status: true },
    });
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, business: row }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return NextResponse.json({ error: "The business tables need to be created first" }, { status: 503 });
    console.error("[admin/businesses] create failed:", err);
    return NextResponse.json({ error: "Could not create the business" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const action = typeof body?.action === "string" ? body.action : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const now = new Date();

    if (["approve", "reject", "archive", "verify", "unverify", "feature", "unfeature"].includes(action)) {
      const data: Record<string, unknown> = { reviewedBy: user.email, reviewedAt: now };
      if (action === "approve") Object.assign(data, { status: "APPROVED", rejectionReason: null });
      if (action === "reject") {
        const reason = typeof body?.rejectionReason === "string" && body.rejectionReason.trim()
          ? body.rejectionReason.trim().slice(0, 500) : "";
        if (!reason) return NextResponse.json({ error: "Please give the owner a short reason so they can fix the listing" }, { status: 400 });
        Object.assign(data, { status: "REJECTED", rejectionReason: reason, verified: false, featured: false });
      }
      if (action === "archive") { data.status = "ARCHIVED"; data.verified = false; data.featured = false; }
      if (action === "verify") data.verified = true;
      if (action === "unverify") data.verified = false;
      if (action === "feature") data.featured = true;
      if (action === "unfeature") data.featured = false;
      const updated = await db.business.update({ where: { id }, data, select: { id: true, status: true, verified: true, featured: true } });
      revalidatePath("/", "layout");
      return NextResponse.json({ success: true, business: updated });
    }

    if (action === "edit") {
      const edit = body?.edit && typeof body.edit === "object" ? body.edit : null;
      if (!edit) return NextResponse.json({ error: "edit object is required" }, { status: 400 });
      const data: Record<string, unknown> = { reviewedAt: now };
      if (edit.name != null) {
        const n = str(edit.name, 120);
        if (!n || n.length < 2) return NextResponse.json({ error: "Name must be 2–120 characters" }, { status: 400 });
        data.name = n;
      }
      if (edit.description != null) {
        const d = str(edit.description, 4000);
        if (!d || d.length < 10) return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });
        data.description = d;
      }
      if (edit.category != null) {
        const c = str(edit.category, 80);
        if (!c || !validCategory(c, "business")) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
        data.category = c;
      }
      if (edit.state != null || edit.city != null) {
        const current = await db.business.findUnique({ where: { id }, select: { state: true, city: true } });
        if (!current) return NextResponse.json({ error: "Business not found" }, { status: 404 });
        const state = edit.state != null ? str(edit.state, 60) : current.state;
        const city = edit.city != null ? str(edit.city, 80) : current.city;
        const locErr = validLocation(state, city);
        if (locErr) return NextResponse.json({ error: locErr }, { status: 400 });
        data.state = state;
        data.city = city;
      }
      if (edit.address !== undefined) data.address = str(edit.address, 300);
      if (edit.hours !== undefined) data.hours = str(edit.hours, 120);
      if (edit.website !== undefined) {
        const w = str(edit.website, 300);
        if (!validWebsite(w)) return NextResponse.json({ error: "Website must be a valid https link" }, { status: 400 });
        data.website = w;
      }
      if (edit.email !== undefined) {
        const e = str(edit.email, 200);
        if (!validEmail(e)) return NextResponse.json({ error: "Invalid business email" }, { status: 400 });
        data.email = e;
      }
      if (edit.whatsappNumber !== undefined || edit.phone !== undefined) {
        const current = await db.business.findUnique({ where: { id }, select: { whatsappNumber: true, phone: true } });
        if (!current) return NextResponse.json({ error: "Business not found" }, { status: 404 });
        const whatsappNumber = edit.whatsappNumber !== undefined ? (str(edit.whatsappNumber, 16)?.replace(/[\s\-()]/g, "") || null) : current.whatsappNumber;
        const phone = edit.phone !== undefined ? (str(edit.phone, 16)?.replace(/[\s\-()]/g, "") || null) : current.phone;
        if (!validPhone(whatsappNumber) || !validPhone(phone)) return NextResponse.json({ error: "Invalid phone/WhatsApp number" }, { status: 400 });
        data.whatsappNumber = whatsappNumber;
        data.phone = phone;
      }
      if (edit.services !== undefined) {
        const services = Array.isArray(edit.services)
          ? edit.services.filter((s: unknown): s is string => typeof s === "string" && s.trim() !== "").slice(0, 10).map((s: string) => s.trim().slice(0, 80))
          : [];
        data.services = JSON.stringify(services);
      }
      if (edit.images !== undefined) {
        const imgs = validateImages(edit.images);
        if (!imgs.ok) return NextResponse.json({ error: imgs.error }, { status: 400 });
        data.images = JSON.stringify(imgs.images);
      }
      if (Object.keys(data).length === 1) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      const updated = await db.business.update({ where: { id }, data, select: { id: true, status: true } });
      revalidatePath("/", "layout");
      return NextResponse.json({ success: true, business: updated });
    }

    return NextResponse.json({ error: "action must be approve | reject | verify | unverify | feature | unfeature | archive | edit" }, { status: 400 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Business not found" }, { status: 404 });
    console.error("[admin/businesses] patch failed:", err);
    return NextResponse.json({ error: "Could not update the business" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db.business.delete({ where: { id } });
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Business not found" }, { status: 404 });
    console.error("[admin/businesses] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the business" }, { status: 500 });
  }
}
