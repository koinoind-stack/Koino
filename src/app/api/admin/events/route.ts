import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

/**
 * GET /api/admin/events
 * Admin-only — returns ALL events (any status) with optional status filter.
 *
 * Optional query params:
 *   ?status=PENDING       — only pending events
 *   ?status=PUBLISHED     — only published events
 *   ?status=REJECTED      — only rejected events
 *   ?status=CANCELLED     — only cancelled events
 *
 * Without ?status, returns ALL events ordered by createdAt DESC (newest first).
 *
 * Server-side admin check via getAuthUser(). NEVER trust client roles.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // PENDING | PUBLISHED | REJECTED | CANCELLED

    const validStatuses = ["PENDING", "PUBLISHED", "REJECTED", "CANCELLED"];
    const where = status && validStatuses.includes(status) ? { status } : {};

    let events: Array<any> = [];
    let counts: { all: number; PENDING: number; PUBLISHED: number; REJECTED: number; CANCELLED: number } = {
      all: 0, PENDING: 0, PUBLISHED: 0, REJECTED: 0, CANCELLED: 0,
    };

    try {
      events = await db.event.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
      });
      counts = {
        all: await db.event.count(),
        PENDING: await db.event.count({ where: { status: "PENDING" } }),
        PUBLISHED: await db.event.count({ where: { status: "PUBLISHED" } }),
        REJECTED: await db.event.count({ where: { status: "REJECTED" } }),
        CANCELLED: await db.event.count({ where: { status: "CANCELLED" } }),
      };
    } catch (dbError: any) {
      // Surface the actual Prisma error so the admin can diagnose.
      // P2021 = "table does not exist" — migration not applied yet.
      // P2022 = "column does not exist" — schema drift.
      // P1003 = "relation does not exist" (Postgres native).
      const prismaCode = dbError?.code;
      const prismaMessage = dbError?.message;
      console.error("[api/admin/events GET] Prisma error:", { code: prismaCode, message: prismaMessage });

      if (prismaCode === "P2021" || prismaCode === "P2022" || prismaCode === "P1003" ||
          /relation .* does not exist/i.test(prismaMessage || "") ||
          /table .* does not exist/i.test(prismaMessage || "")) {
        return NextResponse.json({
          error: "Event table not found in the database. The Prisma migration has not been applied to production yet. Run `npx prisma migrate deploy` (or `npx prisma db push`) with the production DATABASE_URL to create the Event table.",
          prismaCode,
          events: [],
          counts,
        }, { status: 500 });
      }
      throw dbError; // re-throw for the outer catch
    }

    return NextResponse.json({
      events: events.map((e: any) => ({
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
        rejectionReason: e.rejectionReason,
        reviewedBy: e.reviewedBy,
        reviewedAt: e.reviewedAt?.toISOString() || null,
        createdById: e.createdById,
        createdByEmail: e.createdByEmail,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      counts,
    });
  } catch (error: any) {
    console.error("[api/admin/events GET] Error:", error);
    return NextResponse.json({
      error: "Failed to load events",
      detail: error?.message || String(error),
      code: error?.code,
      events: [],
      counts: { all: 0, PENDING: 0, PUBLISHED: 0, REJECTED: 0, CANCELLED: 0 },
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/events
 * Admin-only — performs a moderation action on an event.
 *
 * Body: { id, action, rejectionReason? }
 *
 * Actions:
 *   approve   → status: PENDING → PUBLISHED  (clears rejectionReason)
 *   reject    → status: PENDING → REJECTED   (sets rejectionReason if provided)
 *   cancel    → status: PUBLISHED → CANCELLED
 *   reopen    → status: any → PENDING (re-queue for review)
 *   feature   → featured: true  (event must be PUBLISHED)
 *   unfeature → featured: false
 *
 * After action, revalidates the events cache so the change is immediately
 * visible on the public Events page + admin list.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, rejectionReason } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const validActions = ["approve", "reject", "cancel", "reopen", "feature", "unfeature"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    let newStatus = existing.status;
    let newFeatured = existing.featured;
    let newRejectionReason = existing.rejectionReason;

    switch (action) {
      case "approve":
        newStatus = "PUBLISHED";
        newRejectionReason = null;
        break;
      case "reject":
        newStatus = "REJECTED";
        newRejectionReason = rejectionReason ? String(rejectionReason).slice(0, 1000) : null;
        break;
      case "cancel":
        newStatus = "CANCELLED";
        break;
      case "reopen":
        newStatus = "PENDING";
        newRejectionReason = null;
        break;
      case "feature":
        if (existing.status !== "PUBLISHED") {
          return NextResponse.json({ error: "Only published events can be featured." }, { status: 400 });
        }
        newFeatured = true;
        break;
      case "unfeature":
        newFeatured = false;
        break;
    }

    const updated = await db.event.update({
      where: { id },
      data: {
        status: newStatus,
        featured: newFeatured,
        rejectionReason: newRejectionReason,
        reviewedBy: user.email,
        reviewedAt: new Date(),
      },
    });

    console.log(`[api/admin/events POST] Event ${id}: ${existing.status} → ${newStatus} (by ${user.email})`);

    // Invalidate the events cache so the public page reflects the change
    // immediately. revalidatePath("/", "layout") covers the SPA + any prerendered routes.
    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({
      success: true,
      event: {
        id: updated.id,
        status: updated.status,
        featured: updated.featured,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[api/admin/events POST] Error:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
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
