import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/events
 * Public — returns all PUBLISHED events.
 *
 * Only events with status='PUBLISHED' are returned. PENDING, REJECTED, and
 * CANCELLED events are NEVER exposed publicly. This is the source of truth
 * for the public Events page.
 *
 * Optional query params:
 *   ?state=Karnataka   — filter by state
 *   ?city=Bengaluru    — filter by city
 *   ?category=worship  — filter by category
 *   ?online=1          — only online events (eventType='online' or 'hybrid')
 *   ?featured=1        — only featured events
 *
 * Sorted by startDate ascending (upcoming first).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state") || undefined;
    const city = searchParams.get("city") || undefined;
    const category = searchParams.get("category") || undefined;
    const onlineOnly = searchParams.get("online") === "1";
    const featuredOnly = searchParams.get("featured") === "1";

    let events: any[] = [];
    try {
      events = await db.event.findMany({
        where: {
          // CRITICAL: only PUBLISHED events are publicly visible
          status: "PUBLISHED",
          ...(state ? { state } : {}),
          ...(city ? { city } : {}),
          ...(category ? { category } : {}),
          ...(onlineOnly ? { isOnline: true } : {}),
          ...(featuredOnly ? { featured: true } : {}),
        },
        orderBy: [{ featured: "desc" }, { startDate: "asc" }],
      });
    } catch (dbError: any) {
      // If the Event table doesn't exist yet (migration not applied),
      // return an empty list — do NOT throw a 500 to the public page.
      // The public Events page will show "No events published yet"
      // which is the correct UX for an empty/new database.
      const prismaCode = dbError?.code;
      const prismaMessage = dbError?.message || "";
      if (prismaCode === "P2021" || prismaCode === "P2022" || prismaCode === "P1003" ||
          /relation .* does not exist/i.test(prismaMessage) ||
          /table .* does not exist/i.test(prismaMessage)) {
        console.warn("[api/events GET] Event table not found — migration not applied yet. Returning empty list.");
        return NextResponse.json({ events: [] });
      }
      throw dbError;
    }

    // Serialize dates + parse languages JSON
    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.startDate.toISOString(),
        end_date: e.endDate?.toISOString() || null,
        startTime: e.startTime,
        endTime: e.endTime,
        allDay: e.allDay,
        country: e.country,
        state: e.state || "",
        city: e.city || "",
        address: e.address,
        venueName: e.venueName,
        location: e.location,
        languages: safeParseJson(e.languages, []),
        category: e.category,
        eventType: e.eventType,
        is_online: e.isOnline,
        onlineUrl: e.onlineUrl,
        registrationType: e.registrationType,
        ticketUrl: e.ticketUrl,
        whatsappNumber: e.whatsappNumber,
        organizerName: e.organizerName,
        organizerEmail: e.organizerEmail,
        organizerPhone: e.organizerPhone,
        organizerWebsite: e.organizerWebsite,
        is_free: e.isFree,
        price: e.price,
        cover_gradient: e.coverGradient,
        cover_image: e.coverImage,
        church: e.church || "",
        whatsapp_number: e.whatsappNumber,
        status: e.status,
        featured: e.featured,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[api/events GET] Error:", error);
    // Graceful fallback — return empty list, not a 500 error, so the
    // public Events page doesn't crash.
    return NextResponse.json({ events: [], error: "Failed to load events" }, { status: 200 });
  }
}

/**
 * POST /api/events
 * Authenticated — creates a new event with status='PENDING'.
 *
 * The event is NOT immediately visible publicly. Admin must approve it
 * (Admin → Events → Approve) before it appears in the public list.
 *
 * Required fields: title, description, startDate, category, eventType, location
 * (location is auto-derived from venueName + address + city + state if not provided)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to submit an event." }, { status: 401 });
    }

    const body = await req.json();

    // ─── Server-side validation ───
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    if (!body.startDate) {
      return NextResponse.json({ error: "Start date is required." }, { status: 400 });
    }
    if (!body.category) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }

    const eventType = (body.eventType === "online" || body.eventType === "hybrid") ? body.eventType : "in-person";
    const allDay = Boolean(body.allDay);

    if (!allDay && !body.startTime) {
      return NextResponse.json({ error: "Start time is required (or check 'All Day')." }, { status: 400 });
    }
    if (eventType === "online" && !body.onlineUrl) {
      return NextResponse.json({ error: "Online event link is required for online events." }, { status: 400 });
    }
    if ((eventType === "in-person" || eventType === "hybrid") && (!body.city || !body.state)) {
      return NextResponse.json({ error: "City and State are required for in-person/hybrid events." }, { status: 400 });
    }

    // ─── Build the location string if not provided ───
    const locationParts = [body.venueName, body.address, body.city, body.state].filter(Boolean);
    const location = body.location?.trim() || locationParts.join(", ") || "Online";

    // ─── Parse dates ───
    const startDate = new Date(body.startDate);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
    }
    let endDate: Date | null = null;
    if (body.endDate) {
      endDate = new Date(body.endDate);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
      }
      if (endDate < startDate) {
        return NextResponse.json({ error: "End date cannot be before start date." }, { status: 400 });
      }
    }

    // ─── Determine isFree / price ───
    const registrationType = body.registrationType || "free";
    const isFree = registrationType === "free";
    const price = typeof body.price === "number" && body.price >= 0 ? body.price : 0;

    // ─── Languages (JSON array stored as string) ───
    const languages = Array.isArray(body.languages) ? body.languages : [];

    // ─── Insert into DB with status=PENDING ───
    const event = await db.event.create({
      data: {
        title: String(body.title).trim().slice(0, 300),
        description: String(body.description).trim().slice(0, 5000),
        startDate,
        endDate,
        startTime: body.startTime ? String(body.startTime).slice(0, 10) : null,
        endTime: body.endTime ? String(body.endTime).slice(0, 10) : null,
        allDay,
        country: body.country || "India",
        state: body.state || null,
        city: body.city || null,
        address: body.address ? String(body.address).slice(0, 500) : null,
        venueName: body.venueName ? String(body.venueName).slice(0, 200) : null,
        location: location.slice(0, 500),
        eventType,
        isOnline: eventType === "online" || eventType === "hybrid",
        onlineUrl: body.onlineUrl ? String(body.onlineUrl).slice(0, 500) : null,
        registrationType,
        ticketUrl: body.ticketUrl ? String(body.ticketUrl).slice(0, 500) : null,
        isFree,
        price,
        organizerName: body.organizerName ? String(body.organizerName).slice(0, 200) : null,
        organizerEmail: body.organizerEmail ? String(body.organizerEmail).slice(0, 200) : null,
        organizerPhone: body.organizerPhone ? String(body.organizerPhone).slice(0, 30) : null,
        organizerWebsite: body.organizerWebsite ? String(body.organizerWebsite).slice(0, 500) : null,
        whatsappNumber: body.whatsappNumber ? String(body.whatsappNumber).slice(0, 30) : null,
        category: String(body.category).slice(0, 100),
        languages: JSON.stringify(languages),
        church: body.church ? String(body.church).slice(0, 200) : null,
        coverImage: body.coverImage ? String(body.coverImage).slice(0, 1000) : null,
        coverGradient: typeof body.coverGradient === "number" ? body.coverGradient : 0,
        // CRITICAL: user-submitted events always start as PENDING
        status: "PENDING",
        featured: false,
        createdById: user.id,
        createdByEmail: user.email,
      },
    });

    console.log(`[api/events POST] Event created: ${event.id} (status=PENDING, by ${user.email})`);

    return NextResponse.json({
      success: true,
      eventId: event.id,
      status: event.status,
      message: "Event submitted! It will appear publicly once approved by our team.",
    });
  } catch (error: any) {
    console.error("[api/events POST] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit event. Please try again." },
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
