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
 * PATCH /api/admin/contact-messages/[id]
 *
 * Admin-only. Body: `{ adminNotes }` — updates internal admin notes.
 * `adminNotes` is NEVER exposed to the public (only by the admin GET endpoint).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await req.json();

    // Only `adminNotes` is patchable from this endpoint. Coerce to string|null.
    let adminNotes: string | null = null;
    if (body.adminNotes != null) {
      const s = typeof body.adminNotes === "string" ? body.adminNotes : String(body.adminNotes);
      adminNotes = s.length === 0 ? null : s;
    }

    const existing = await db.contactMessage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const updated = await db.contactMessage.update({
      where: { id },
      data: { adminNotes },
    });

    return NextResponse.json({ message: serialize(updated) });
  } catch (error: any) {
    console.error("[admin/contact-messages/[id]] PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/contact-messages/[id]
 *
 * Admin-only. Hard-deletes a contact message (admin cleanup).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await db.contactMessage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await db.contactMessage.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("[admin/contact-messages/[id]] DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete" }, { status: 500 });
  }
}
