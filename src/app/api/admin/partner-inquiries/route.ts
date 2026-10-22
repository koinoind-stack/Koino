import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

// Admin auth helper — distinguishes 401 (not signed in) from 403 (not admin).
async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user, response: null };
}

// Allowed status values for PartnerInquiry workflow.
const ALLOWED_STATUSES = ["new", "contacted", "archived"] as const;

// Maps the action keyword sent by the admin UI → new status string.
const ACTION_TO_STATUS: Record<string, string> = {
  mark_contacted: "contacted",
  archive: "archived",
  reopen: "new",
};

function serialize(m: any) {
  return {
    id: m.id,
    name: m.name,
    organization: m.organization,
    email: m.email,
    phone: m.phone,
    website: m.website,
    partnershipType: m.partnershipType,
    message: m.message,
    status: m.status,
    adminNotes: m.adminNotes,
    reviewedBy: m.reviewedBy,
    reviewedAt: m.reviewedAt ? m.reviewedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/**
 * GET /api/admin/partner-inquiries
 *
 * Admin-only. Returns every PartnerInquiry record, newest first.
 * Supports optional `?status=` filter (`new` | `contacted` | `archived`).
 *
 * The response includes `adminNotes`, `reviewedBy`, and `reviewedAt` —
 * these fields are admin-only and MUST NOT be exposed by any public API.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: { status?: string } = {};
    if (status && (ALLOWED_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }

    const inquiries = await db.partnerInquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Compute per-status counts across the unfiltered set so chip badges
    // in the UI stay consistent regardless of the active filter.
    const allInquiries = status
      ? await db.partnerInquiry.findMany({ select: { status: true } })
      : inquiries;
    const counts: Record<string, number> = {
      total: allInquiries.length,
      new: 0,
      contacted: 0,
      archived: 0,
    };
    for (const m of allInquiries) {
      const s = (m as any).status as string;
      if (s in counts) counts[s] += 1;
    }

    return NextResponse.json({
      inquiries: inquiries.map(serialize),
      counts,
    });
  } catch (error: any) {
    console.error("[admin/partner-inquiries] GET error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load" }, { status: 500 });
  }
}

/**
 * POST /api/admin/partner-inquiries
 *
 * Admin-only. Body: `{ id, action }` where action is one of
 * `mark_contacted`, `archive`, `reopen`.
 *
 * Updates the inquiry status, sets `reviewedBy` to the admin's email,
 * sets `reviewedAt` to now. Returns the updated inquiry.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const body = await req.json();
    const { id, action } = body || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (!action || !(action in ACTION_TO_STATUS)) {
      return NextResponse.json(
        { error: `action must be one of: ${Object.keys(ACTION_TO_STATUS).join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await db.partnerInquiry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    const newStatus = ACTION_TO_STATUS[action];
    const updated = await db.partnerInquiry.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: auth.user.email,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ inquiry: serialize(updated) });
  } catch (error: any) {
    console.error("[admin/partner-inquiries] POST error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update" }, { status: 500 });
  }
}
