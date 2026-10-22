import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

// Single PrismaClient instance at module scope — same pattern as other admin routes.
const db = new PrismaClient();

// Admin auth helper — same pattern as /api/admin/donation-settings.
// Distinguishes 401 (not signed in) from 403 (signed in but not admin).
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

// Allowed status values for ContactMessage workflow.
const ALLOWED_STATUSES = ["new", "read", "replied", "closed"] as const;

// Maps the action keyword sent by the admin UI → new status string.
const ACTION_TO_STATUS: Record<string, string> = {
  mark_read: "read",
  mark_replied: "replied",
  close: "closed",
  reopen: "new",
};

function serialize(m: any) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    subject: m.subject,
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
 * GET /api/admin/contact-messages
 *
 * Admin-only. Returns every ContactMessage record, newest first.
 * Supports optional `?status=` filter (`new` | `read` | `replied` | `closed`).
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

    const messages = await db.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Compute per-status counts across the unfiltered set so the chip
    // badges in the UI stay consistent regardless of the active filter.
    const allMessages = status
      ? await db.contactMessage.findMany({ select: { status: true } })
      : messages;
    const counts: Record<string, number> = {
      total: allMessages.length,
      new: 0,
      read: 0,
      replied: 0,
      closed: 0,
    };
    for (const m of allMessages) {
      const s = (m as any).status as string;
      if (s in counts) counts[s] += 1;
    }

    return NextResponse.json({
      messages: messages.map(serialize),
      counts,
    });
  } catch (error: any) {
    console.error("[admin/contact-messages] GET error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load" }, { status: 500 });
  }
}

/**
 * POST /api/admin/contact-messages
 *
 * Admin-only. Body: `{ id, action }` where action is one of
 * `mark_read`, `mark_replied`, `close`, `reopen`.
 *
 * Updates the message status, sets `reviewedBy` to the admin's email,
 * sets `reviewedAt` to now. Returns the updated message.
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

    const existing = await db.contactMessage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const newStatus = ACTION_TO_STATUS[action];
    const updated = await db.contactMessage.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: auth.user.email,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ message: serialize(updated) });
  } catch (error: any) {
    console.error("[admin/contact-messages] POST error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update" }, { status: 500 });
  }
}
