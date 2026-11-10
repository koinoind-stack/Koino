import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

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
        include: { _count: { select: { followers: true } } },
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
        type: c.type || "Church",
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
        followers_count: c._count.followers, // LIVE count from ChurchFollow
        verified: c.verified,
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
 *   verify    → verified: true  (admin CONFIRMED this is a real, operating
 *               congregation — e.g. contact responded). NEVER set on a plain
 *               approval; grant deliberately, only after checks.
 *   unverify  → verified: false
 *   transfer  → move the listing to another REGISTERED user — body must
 *               include transferEmail; the user is looked up by email and a
 *               404 is returned when no account matches. Updates
 *               createdById + createdByEmail; audit stays in reviewedBy.
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

    const validActions = ["approve", "reject", "cancel", "reopen", "feature", "unfeature", "verify", "unverify", "transfer"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const existing = await db.church.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Church not found" }, { status: 404 });
    }

    let newStatus = existing.status;
    let newFeatured = existing.featured;
    let newVerified = existing.verified;
    let newRejectionReason = existing.rejectionReason;

    // Transfer ownership — move the listing to its rightful owner (a
    // REGISTERED user, looked up by email). Used when e.g. a pastor's teammate
    // submitted the listing, or the admin created it on someone's behalf.
    let transferToId: string | null = null;
    let transferToEmail: string | null = null;
    if (action === "transfer") {
      const transferEmail = typeof body.transferEmail === "string" ? body.transferEmail.trim() : "";
      if (!transferEmail) {
        return NextResponse.json(
          { error: "transferEmail is required for the transfer action." },
          { status: 400 }
        );
      }
      const target = await db.user.findFirst({
        where: { email: { equals: transferEmail, mode: "insensitive" } },
        select: { id: true, email: true },
      });
      if (!target) {
        return NextResponse.json(
          {
            error: `No registered user found with email "${transferEmail}". Ask them to sign up on Koino first, then transfer the listing to them.`,
          },
          { status: 404 }
        );
      }
      if (target.id === existing.createdById) {
        return NextResponse.json(
          { error: `This listing already belongs to ${target.email}.` },
          { status: 400 }
        );
      }
      transferToId = target.id;
      transferToEmail = target.email;
    }

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
      case "verify":
        if (existing.status !== "PUBLISHED") {
          return NextResponse.json(
            { error: "Only published churches can be verified. Approve it first." },
            { status: 400 }
          );
        }
        newVerified = true;
        break;
      case "unverify":
        newVerified = false;
        break;
    }

    const updated = await db.church.update({
      where: { id },
      data: {
        status: newStatus,
        featured: newFeatured,
        verified: newVerified,
        rejectionReason: newRejectionReason,
        reviewedBy: user.email,
        reviewedAt: new Date(),
        // Ownership transfer (action === "transfer" only — otherwise null-ish
        // no-ops that leave the existing owner untouched)
        ...(transferToId ? { createdById: transferToId, createdByEmail: transferToEmail } : {}),
      },
    });

    console.log(
      `[api/admin/churches POST] Church ${id}: ${existing.status} → ${newStatus}${action === "transfer" ? ` (transferred to ${transferToEmail})` : ""} (by ${user.email})`
    );

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({
      success: true,
      church: {
        id: updated.id,
        status: updated.status,
        featured: updated.featured,
        verified: updated.verified,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt?.toISOString(),
        createdById: updated.createdById,
        createdByEmail: updated.createdByEmail,
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
