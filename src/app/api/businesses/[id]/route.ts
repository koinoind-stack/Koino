import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import {
  validateImages, str, validPhone, validCategory, validLocation,
  validWebsite, validEmail, safeParseArray,
} from "@/lib/marketplace";

/**
 * GET /api/businesses/[id] — public detail for an APPROVED business. This is
 * the only endpoint exposing contact details (and only for approved listings).
 * Owners/admins can view their PENDING/REJECTED submissions.
 *
 * PATCH /api/businesses/[id] — owner edits content; may resubmit (PENDING) or
 * archive. Members can never touch another member's business.
 *
 * DELETE /api/businesses/[id] — owner or admin deletes permanently.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await db.business.findUnique({ where: { id } });
    if (!row) return jsonError("Business not found", 404);
    const session = await getSessionUser();
    const isOwner = !!session.user && (session.user.id === row.ownerId || session.user.role === "admin");
    if (row.status !== "APPROVED" && !isOwner) return jsonError("Business not found", 404);

    return Response.json({
      business: {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        state: row.state || "",
        city: row.city || "",
        address: row.address,
        images: safeParseArray(row.images),
        cover_gradient: row.coverGradient,
        hours: row.hours,
        services: safeParseArray(row.services),
        verified: row.verified,
        featured: row.featured,
        website: row.website,
        ownerName: row.ownerName,
        createdAt: row.createdAt.toISOString(),
        status: row.status,
        rejectionReason: isOwner ? row.rejectionReason : undefined,
        ...(row.status === "APPROVED" || isOwner
          ? { whatsappNumber: row.whatsappNumber, phone: row.phone, email: row.email }
          : {}),
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Business not found", 404);
    console.error("[businesses/detail] failed:", err);
    return jsonError("Could not load the business", 500);
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
    const row = await db.business.findUnique({ where: { id }, select: { ownerId: true } });
    if (!row) return jsonError("Business not found", 404);
    const isOwner = row.ownerId === session.user.id;
    if (!isOwner && session.user.role !== "admin") return jsonError("You can only manage your own submissions", 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON body");
    }

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const n = str(body.name, 120);
      if (!n || n.length < 2) return jsonError("Please enter the business name (2–120 characters)");
      data.name = n;
    }
    if ("description" in body) {
      const d = str(body.description, 4000);
      if (!d || d.length < 10) return jsonError("Please write a short description (at least 10 characters)");
      data.description = d;
    }
    if ("category" in body) {
      const c = str(body.category, 80);
      if (!c || !validCategory(c, "business")) return jsonError("Please choose a valid category");
      data.category = c;
    }
    if ("state" in body || "city" in body) {
      const current = await db.business.findUnique({ where: { id }, select: { state: true, city: true } });
      const state = "state" in body ? str(body.state, 60) : current!.state;
      const city = "city" in body ? str(body.city, 80) : current!.city;
      const locErr = validLocation(state, city);
      if (locErr) return jsonError(locErr);
      data.state = state;
      data.city = city;
    }
    if ("address" in body) data.address = str(body.address, 300);
    if ("images" in body) {
      const imgs = validateImages(body.images);
      if (!imgs.ok) return jsonError(imgs.error);
      data.images = JSON.stringify(imgs.images);
    }
    if ("whatsappNumber" in body || "phone" in body) {
      const current = await db.business.findUnique({ where: { id }, select: { whatsappNumber: true, phone: true } });
      const whatsappNumber = "whatsappNumber" in body ? (str(body.whatsappNumber, 16)?.replace(/[\s\-()]/g, "") || null) : current!.whatsappNumber;
      const phone = "phone" in body ? (str(body.phone, 16)?.replace(/[\s\-()]/g, "") || null) : current!.phone;
      if (!whatsappNumber && !phone) return jsonError("Please keep at least one contact number");
      if (!validPhone(whatsappNumber) || !validPhone(phone)) return jsonError("Please enter a valid phone/WhatsApp number (10–15 digits)");
      data.whatsappNumber = whatsappNumber;
      data.phone = phone;
    }
    if ("email" in body) {
      const e = str(body.email, 200);
      if (!validEmail(e)) return jsonError("Please enter a valid business email");
      data.email = e;
    }
    if ("website" in body) {
      const w = str(body.website, 300);
      if (!validWebsite(w)) return jsonError("Website must be a valid https link");
      data.website = w;
    }
    if ("hours" in body) data.hours = str(body.hours, 120);
    if ("services" in body) {
      const services = Array.isArray(body.services)
        ? body.services.filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, 10).map((s) => s.trim().slice(0, 80))
        : [];
      data.services = JSON.stringify(services);
    }
    // Member-allowed status moves (admins use /api/admin/businesses).
    if ("status" in body) {
      if (session.user.role !== "admin") {
        const s = String(body.status);
        if (!["PENDING", "ARCHIVED"].includes(s)) {
          return jsonError("Businesses are approved by Koino admins — you can resubmit or archive your listing");
        }
        data.status = s;
        if (s === "PENDING") data.rejectionReason = null;
      }
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update");

    const updated = await db.business.update({ where: { id }, data, select: { id: true, status: true } });
    return Response.json({ success: true, business: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Business not found", 404);
    console.error("[businesses/patch] failed:", err);
    return jsonError("Could not update the business", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  try {
    const row = await db.business.findUnique({ where: { id }, select: { ownerId: true } });
    if (!row) return jsonError("Business not found", 404);
    if (row.ownerId !== session.user.id && session.user.role !== "admin") {
      return jsonError("You can only delete your own submissions", 403);
    }
    await db.business.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Business not found", 404);
    console.error("[businesses/delete] failed:", err);
    return jsonError("Could not delete the business", 500);
  }
}
