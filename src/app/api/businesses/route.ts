import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import {
  validateImages, str, int, validPhone, validCategory, validLocation,
  validWebsite, validEmail, safeParseArray,
} from "@/lib/marketplace";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/businesses — public directory. Only APPROVED businesses are listed.
 *   ?q=&category=&state=&city=&sort=newest|name&featured=1&verified=1
 *   &cursor=&limit=   keyset pagination (createdAt cursor)
 * Contact details are NEVER included in the list — see /api/businesses/[id].
 *
 * POST /api/businesses — member submits a business (auth required).
 *   Always saved PENDING. Admins create businesses via /api/admin/businesses.
 */

const SORTS = ["newest", "name"] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const state = searchParams.get("state")?.trim();
  const city = searchParams.get("city")?.trim();
  const sort = SORTS.includes((searchParams.get("sort") || "") as never)
    ? (searchParams.get("sort") as (typeof SORTS)[number])
    : "newest";
  const featured = searchParams.get("featured") === "1";
  const verified = searchParams.get("verified") === "1";
  const cursor = searchParams.get("cursor")?.trim();
  const limit = Math.min(Math.max(int(searchParams.get("limit")) || 24, 1), 48);

  const where: Prisma.BusinessWhereInput = { status: "APPROVED" };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }];
  if (category) where.category = category;
  if (state) where.state = state;
  if (city) where.city = city;
  if (featured) where.featured = true;
  if (verified) where.verified = true;
  if (cursor) {
    const d = new Date(cursor);
    if (!Number.isNaN(d.getTime())) where.createdAt = { lt: d };
  }

  try {
    const rows = await db.business.findMany({
      where,
      orderBy: sort === "name" ? { name: "asc" } : [{ featured: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      select: {
        id: true, name: true, description: true, category: true, state: true, city: true,
        images: true, coverGradient: true, verified: true, featured: true, hours: true,
        services: true, createdAt: true, ownerName: true,
      },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return Response.json({
      businesses: page.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        category: b.category,
        state: b.state || "",
        city: b.city || "",
        cover_image: safeParseArray(b.images)[0] || null,
        images: safeParseArray(b.images),
        cover_gradient: b.coverGradient,
        verified: b.verified,
        featured: b.featured,
        hours: b.hours,
        services: safeParseArray(b.services),
        ownerName: b.ownerName,
        createdAt: b.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return Response.json({ businesses: [], nextCursor: null });
    }
    console.error("[businesses] list failed:", err);
    return jsonError("Could not load the business directory", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;

  // Tight limit like church submissions (admin-moderated surface).
  if (!rateLimit(`business:create:${me.id}`, 3, 10 * 60 * 1000)) {
    return jsonError("Too many submissions — please try again in a few minutes", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const name = str(body.name, 120);
  if (!name || name.length < 2) return jsonError("Please enter the business name (2–120 characters)");
  const description = str(body.description, 4000);
  if (!description || description.length < 10) return jsonError("Please write a short description (at least 10 characters)");

  const category = str(body.category, 80);
  if (!category || !validCategory(category, "business")) return jsonError("Please choose a valid category");

  const state = str(body.state, 60);
  const city = str(body.city, 80);
  const locErr = validLocation(state, city);
  if (locErr) return jsonError(locErr);

  const imgs = validateImages(body.images);
  if (!imgs.ok) return jsonError(imgs.error);

  const whatsappNumber = str(body.whatsappNumber, 16)?.replace(/[\s\-()]/g, "") || null;
  const phone = str(body.phone, 16)?.replace(/[\s\-()]/g, "") || null;
  if (!whatsappNumber && !phone) return jsonError("Please add a business WhatsApp or phone number");
  if (!validPhone(whatsappNumber) || !validPhone(phone)) {
    return jsonError("Please enter a valid phone/WhatsApp number (10–15 digits)");
  }
  const email = str(body.email, 200);
  if (!validEmail(email)) return jsonError("Please enter a valid business email");
  const website = str(body.website, 300);
  if (!validWebsite(website)) return jsonError("Website must be a valid https link");

  const services = Array.isArray(body.services)
    ? body.services.filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, 10).map((s) => s.trim().slice(0, 80))
    : [];

  try {
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
        status: "PENDING",
        ownerId: me.id,
        ownerName: str(body.ownerName, 80) || "A Koino member",
        ownerEmail: me.email,
      },
      select: { id: true, status: true },
    });
    return Response.json({ success: true, business: row }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return jsonError("The business directory is not ready yet — the database tables need to be created first", 503);
    }
    console.error("[businesses] create failed:", err);
    return jsonError("Could not submit the business", 500);
  }
}
