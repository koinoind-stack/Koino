import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

/**
 * GET /api/admin/churches
 * Admin-only — returns ALL churches (any status) with optional status filter.
 *
 * Optional query params:
 *   ?status=PENDING       — only pending churches
 *   ?status=PUBLISHED     — only published churches
 *   ?status=REJECTED      — only rejected churches
 *   ?status=CANCELLED     — only cancelled churches
 *
 * Without ?status, returns ALL churches ordered by createdAt DESC (newest first).
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

    let churches: any[] = [];
    let counts: { all: number; PENDING: number; PUBLISHED: number; REJECTED: number; CANCELLED: number } = {
      all: 0, PENDING: 0, PUBLISHED: 0, REJECTED: 0, CANCELLED: 0,
    };

    try {
      churches = await db.church.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
      });
      counts = {
        all: await db.church.count(),
        PENDING: await db.church.count({ where: { status: "PENDING" } }),
        PUBLISHED: await db.church.count({ where: { status: "PUBLISHED" } }),
        REJECTED: await db.church.count({ where: { status: "REJECTED" } }),
        CANCELLED: await db.church.count({ where: { status: "CANCELLED" } }),
      };
    } catch (dbError: any) {
      // Surface the actual Prisma error so the admin can diagnose.
      // P2021 = "table does not exist" — migration not applied yet.
      const prismaCode = dbError?.code;
      const prismaMessage = dbError?.message;
      console.error("[api/admin/churches GET] Prisma error:", { code: prismaCode, message: prismaMessage });

      if (prismaCode === "P2021" || prismaCode === "P2022" || prismaCode === "P1003" ||
          /relation .* does not exist/i.test(prismaMessage || "") ||
          /table .* does not exist/i.test(prismaMessage || "")) {
        return NextResponse.json({
          error: "Church table not found in the database. The Prisma migration has not been applied to production yet. Run `npx prisma migrate deploy` (or `npx prisma db push`) with the production DATABASE_URL to create the Church table.",
          prismaCode,
          churches: [],
          counts,
        }, { status: 500 });
      }
      throw dbError;
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
        rejectionReason: c.rejectionReason,
        reviewedBy: c.reviewedBy,
        reviewedAt: c.reviewedAt?.toISOString() || null,
        createdById: c.createdById,
        createdByEmail: c.createdByEmail,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      counts,
    });
  } catch (error: any) {
    console.error("[api/admin/churches GET] Error:", error);
    return NextResponse.json({
      error: "Failed to load churches",
      detail: error?.message || String(error),
      code: error?.code,
      churches: [],
      counts: { all: 0, PENDING: 0, PUBLISHED: 0, REJECTED: 0, CANCELLED: 0 },
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/churches
 * Admin-only — performs a moderation action on a church.
 *
 * Body: { id, action, rejectionReason? }
 *
 * Actions:
 *   approve   → status: PENDING → PUBLISHED  (clears rejectionReason)
 *   reject    → status: PENDING → REJECTED   (sets rejectionReason if provided)
 *   cancel    → status: PUBLISHED → CANCELLED
 *   reopen    → status: any → PENDING (re-queue for review)
 *   feature   → featured: true  (church must be PUBLISHED)
 *   unfeature → featured: false
 *
 * After action, revalidates the cache so the change is immediately visible
 * on the public Churches directory + admin list.
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

    const existing = await db.church.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Church not found" }, { status: 404 });
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
          return NextResponse.json({ error: "Only published churches can be featured." }, { status: 400 });
        }
        newFeatured = true;
        break;
      case "unfeature":
        newFeatured = false;
        break;
    }

    const updated = await db.church.update({
      where: { id },
      data: {
        status: newStatus,
        featured: newFeatured,
        rejectionReason: newRejectionReason,
        reviewedBy: user.email,
        reviewedAt: new Date(),
      },
    });

    console.log(`[api/admin/churches POST] Church ${id}: ${existing.status} → ${newStatus} (by ${user.email})`);

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({
      success: true,
      church: {
        id: updated.id,
        status: updated.status,
        featured: updated.featured,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[api/admin/churches POST] Error:", error);
    return NextResponse.json({ error: "Failed to update church" }, { status: 500 });
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
