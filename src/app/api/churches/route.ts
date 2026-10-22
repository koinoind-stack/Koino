import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

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
 *   ?featured=1           — only featured churches
 *   ?q=bible              — search by name/description/city/location
 *
 * Sorted by featured DESC then name ASC.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state") || undefined;
    const city = searchParams.get("city") || undefined;
    const denomination = searchParams.get("denomination") || undefined;
    const language = searchParams.get("language") || undefined;
    const featuredOnly = searchParams.get("featured") === "1";
    const q = searchParams.get("q")?.trim() || undefined;

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
      orderBy: [{ featured: "desc" }, { name: "asc" }],
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

    return NextResponse.json({
      churches: churches.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        denomination: c.denomination,
        country: c.country,
        state: c.state || "",
        city: c.city || "",
        address: c.address,
        postalCode: c.postalCode,
        location: c.location,
        pastorName: c.pastorName,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        whatsapp_number: c.whatsappNumber,
        website: c.website,
        service_times: safeParseJson(c.serviceTimes, []),
        languages: safeParseJson(c.languages, []),
        cover_gradient: c.coverGradient,
        cover_image: c.coverImage,
        followers_count: c.followersCount,
        status: c.status,
        featured: c.featured,
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

/**
 * POST /api/churches
 * Authenticated — creates a new church with status='PENDING'.
 *
 * The church is NOT immediately visible publicly. Admin must approve it
 * (Admin → Churches → Approve) before it appears in the public directory.
 *
 * Required fields: name, description, city, state, location
 * (location is auto-derived from address + city + state if not provided)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to list your church." }, { status: 401 });
    }

    const body = await req.json();

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

    // ─── Build the location string if not provided ───
    const locationParts = [body.address, body.city, body.state].filter(Boolean);
    const location = body.location?.trim() || locationParts.join(", ") || "Location not specified";

    // ─── Service times — JSON array stored as text ───
    const serviceTimes = Array.isArray(body.service_times) ? body.service_times : [];

    // ─── Languages — JSON array of strings ───
    const languages = Array.isArray(body.languages) ? body.languages : [];

    // ─── Cover image: prefer cover_image, fall back to first image in images[] ───
    const coverImage = body.cover_image
      || (Array.isArray(body.images) && body.images.length > 0 ? body.images[0] : null);

    // ─── Insert into DB with status=PENDING (NEVER auto-published) ───
    const church = await db.church.create({
      data: {
        name: String(body.name).trim().slice(0, 300),
        description: String(body.description).trim().slice(0, 5000),
        denomination: body.denomination ? String(body.denomination).slice(0, 200) : "",
        country: body.country || "India",
        state: String(body.state).slice(0, 100),
        city: String(body.city).slice(0, 100),
        address: body.address ? String(body.address).slice(0, 500) : null,
        postalCode: body.postalCode ? String(body.postalCode).slice(0, 20) : null,
        location: location.slice(0, 500),
        pastorName: body.pastorName ? String(body.pastorName).slice(0, 200) : null,
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
      message: "Church submitted! It will appear in the directory once approved by our team.",
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
