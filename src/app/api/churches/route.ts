import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";
import { db } from "@/lib/db";

const CHURCH_TYPES = ["Church", "Ministry", "Fellowship", "Prayer Hall", "Other"];

/**
 * GET /api/churches
 * Public — returns all PUBLISHED churches for the Church Directory.
 *
 * Only churches with status='PUBLISHED' are returned. PENDING, REJECTED,
 * and CANCELLED churches are NEVER exposed publicly.
 *
 * Optional query params:
 *   ?state=Karnataka       — filter by state
 *   ?city=Bengaluru       — filter by city
 *   ?denomination=Catholic — filter by denomination
 *   ?language=English      — filter by language (searches the languages JSON array)
 *   ?serviceDay=Sunday     — filter by a service falling on that weekday
 *   ?featured=1           — only featured churches
 *   ?q=bible              — search by name/description/city/location
 *   ?sort=relevance|name|newest
 *
 * relevance (default) = featured DESC, then followers DESC, then name ASC.
 * followers_count is computed LIVE from the ChurchFollow table (_count) —
 * never a stale counter column.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state") || undefined;
    const city = searchParams.get("city") || undefined;
    const denomination = searchParams.get("denomination") || undefined;
    const language = searchParams.get("language") || undefined;
    const serviceDay = searchParams.get("serviceDay") || undefined;
    const featuredOnly = searchParams.get("featured") === "1";
    const q = searchParams.get("q")?.trim() || undefined;
    const sort = ["relevance", "name", "newest"].includes(searchParams.get("sort") || "")
      ? (searchParams.get("sort") as "relevance" | "name" | "newest")
      : "relevance";

    // Build the where clause — always status=PUBLISHED for public
    const where: any = {
      status: "PUBLISHED",
      ...(state ? { state } : {}),
      ...(city ? { city } : {}),
      ...(denomination ? { denomination } : {}),
      ...(featuredOnly ? { featured: true } : {}),
    };

    // Free-text search — case-insensitive contains on name/description/location/city
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { state: { contains: q, mode: "insensitive" } },
      ];
    }

    // Language filter — languages is a JSON array stored as text.
    // We fetch all published churches filtered by other criteria, then
    // filter by language client-side. This is acceptable for a few hundred
    // churches; for thousands, we'd add a GIN index + raw SQL.
    let churches = await db.church.findMany({
      where,
      orderBy:
        sort === "name"
          ? [{ name: "asc" }]
          : sort === "newest"
            ? [{ createdAt: "desc" }]
            : [{ featured: "desc" }, { createdAt: "desc" }, { name: "asc" }],
      include: { _count: { select: { followers: true } } },
    });

    // Client-side language filter (see comment above)
    if (language) {
      churches = churches.filter((c) => {
        try {
          const langs: string[] = JSON.parse(c.languages || "[]");
          return langs.some((l) => l.toLowerCase() === language.toLowerCase());
        } catch {
          return false;
        }
      });
    }

    // Service-day filter — matches any service row whose `day` equals the
    // requested weekday (case-insensitive). Same JSON-array approach.
    if (serviceDay) {
      churches = churches.filter((c) => {
        try {
          const rows: Array<{ day?: string }> = JSON.parse(c.serviceTimes || "[]");
          return rows.some(
            (r) => typeof r.day === "string" && r.day.toLowerCase() === serviceDay.toLowerCase()
          );
        } catch {
          return false;
        }
      });
    }

    // Optional viewer — lets owners see which listings are theirs so the UI
    // can offer "Edit listing". Auth is OPTIONAL here: anonymous visitors get
    // is_owner:false and everything else works exactly as before.
    const viewer = await getAuthUser().catch(() => null);

    return NextResponse.json({
      churches: churches.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        denomination: c.denomination,
        type: c.type || "Church",
        country: c.country,
        state: c.state || "",
        city: c.city || "",
        address: c.address,
        postalCode: c.postalCode,
        location: c.location,
        contactName: c.contactName,
        // Listing contact details — public by design (the owner publishes
        // them so visitors can reach the church), like whatsapp_number.
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        whatsapp_number: c.whatsappNumber,
        website: c.website,
        service_times: safeParseJson(c.serviceTimes, []),
        languages: safeParseJson(c.languages, []),
        cover_gradient: c.coverGradient,
        cover_image: c.coverImage,
        images: safeParseJson<string[]>(c.coverImage ? JSON.stringify([c.coverImage]) : "[]", []),
        verified: c.verified,
        featured: c.featured,
        followers_count: c._count.followers, // LIVE count from ChurchFollow
        is_owner: !!(viewer && c.createdById && viewer.id === c.createdById),
      })),
    });
  } catch (error: any) {
    // If the Church table doesn't exist yet (migration not applied),
    // return an empty list so the public Churches page shows the empty
    // state instead of an error.
    const prismaCode = error?.code;
    const prismaMessage = error?.message || "";
    if (prismaCode === "P2021" || prismaCode === "P2022" || prismaCode === "P1003" ||
        /relation .* does not exist/i.test(prismaMessage) ||
        /table .* does not exist/i.test(prismaMessage)) {
      console.warn("[api/churches GET] Church table not found — migration not applied yet. Returning empty list.");
      return NextResponse.json({ churches: [] });
    }
    console.error("[api/churches GET] Error:", error);
    return NextResponse.json({ churches: [], error: "Failed to load churches" }, { status: 200 });
  }
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * POST /api/churches
 * Authenticated — creates a new church with status='PENDING'.
 *
 * The church is NOT immediately visible publicly. Admin must approve it
 * (Admin → Churches → Approve) before it appears in the public directory.
 *
 * Required fields: name, description, city, state
 * Guard rails:
 *   - rate limit (3 submissions / 10 min)
 *   - duplicate guard: same submitter + same (name, city, state) already
 *     submitted within the last 24h → 409 instead of a silent double-listing
 *   - max 5 photos, ≤ 12 languages, service rows validated to {day,time,language}
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to list your church." }, { status: 401 });
    }

    if (!rateLimit(`churches:create:${user.id}`, 3, 10 * 60_000)) {
      return NextResponse.json(
        { error: "You're submitting listings quickly. Please wait a little." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // ─── Server-side validation ───
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Church name is required." }, { status: 400 });
    }
    if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    if (!body.city || !body.state) {
      return NextResponse.json({ error: "City and State are required." }, { status: 400 });
    }

    const name = String(body.name).trim().slice(0, 300);

    // ─── Duplicate guard (same submitter, same church, last 24h) ───
    const dupe = await db.church.findFirst({
      where: {
        createdById: user.id,
        name: { equals: name, mode: "insensitive" },
        city: { equals: String(body.city).trim(), mode: "insensitive" },
        state: { equals: String(body.state).trim(), mode: "insensitive" },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true, status: true },
    });
    if (dupe) {
      return NextResponse.json(
        {
          error:
            "You already submitted this church (same name, city and state) in the last 24 hours. It is in review — you don't need to submit it again.",
          duplicateOf: dupe.id,
          duplicateStatus: dupe.status,
        },
        { status: 409 }
      );
    }

    // ─── Build the location string if not provided ───
    const locationParts = [body.address, body.city, body.state].filter(Boolean);
    const location = body.location?.trim() || locationParts.join(", ") || "Location not specified";

    // ─── Service times — validated JSON array of {day, time, language} ───
    const rawServices = Array.isArray(body.service_times) ? body.service_times : [];
    const serviceTimes = rawServices
      .slice(0, 14)
      .map((s: any) => ({
        day: DAYS.includes(s?.day) ? s.day : "Sunday",
        time: typeof s?.time === "string" ? s.time.trim().slice(0, 120) : "",
        language: typeof s?.language === "string" ? s.language.trim().slice(0, 60) : "English",
      }))
      .filter((s: { time: string }) => s.time);

    // ─── Languages — JSON array of strings (max 12) ───
    const languages = (Array.isArray(body.languages) ? body.languages : [])
      .filter((l: any) => typeof l === "string" && l.trim())
      .map((l: string) => l.trim().slice(0, 60))
      .slice(0, 12);

    // ─── Images — max 5 (the existing UI limit, now server-enforced) ───
    const images = (Array.isArray(body.images) ? body.images : [])
      .filter((i: any) => typeof i === "string" && i.trim())
      .slice(0, 5);
    const coverImage =
      (typeof body.cover_image === "string" && body.cover_image.trim()) || images[0] || null;

    // ─── Listing type — fixed set (Church / Ministry / Fellowship / …) ───
    const rawType = typeof body.type === "string" ? body.type.trim() : "";
    const type = CHURCH_TYPES.includes(rawType) ? rawType : "Church";

    // ─── Insert into DB with status=PENDING (NEVER auto-published) ───
    const church = await db.church.create({
      data: {
        name,
        description: String(body.description).trim().slice(0, 5000),
        denomination: body.denomination ? String(body.denomination).slice(0, 200) : "",
        type,
        country: body.country || "India",
        state: String(body.state).slice(0, 100),
        city: String(body.city).slice(0, 100),
        address: body.address ? String(body.address).slice(0, 500) : null,
        postalCode: body.postalCode ? String(body.postalCode).slice(0, 20) : null,
        location: location.slice(0, 500),
        contactName: body.contact_name ? String(body.contact_name).slice(0, 200) : null,
        contactEmail: body.contact_email ? String(body.contact_email).slice(0, 200) : null,
        contactPhone: body.contact_phone ? String(body.contact_phone).slice(0, 30) : null,
        whatsappNumber: body.whatsapp_number ? String(body.whatsapp_number).slice(0, 30) : null,
        website: body.website ? String(body.website).slice(0, 500) : null,
        serviceTimes: JSON.stringify(serviceTimes),
        languages: JSON.stringify(languages),
        coverImage: coverImage ? String(coverImage).slice(0, 1000) : null,
        coverGradient: typeof body.cover_gradient === "number" ? body.cover_gradient : Math.floor(Math.random() * 8),
        status: "PENDING",
        featured: false,
        createdById: user.id,
        createdByEmail: user.email,
      },
    });

    console.log(`[api/churches POST] Church created: ${church.id} (status=PENDING, by ${user.email})`);

    return NextResponse.json({
      success: true,
      churchId: church.id,
      status: church.status,
      message: "Church submitted! Our team reviews every listing before it appears in the directory.",
    });
  } catch (error: any) {
    console.error("[api/churches POST] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit church. Please try again." },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
