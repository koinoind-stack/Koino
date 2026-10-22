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

/**
 * PATCH /api/admin/contributor-applications/[id]
 *
 * Admin-only. Body: `{ adminNotes }` and/or `{ verified: boolean }`.
 * - `adminNotes` updates the application's internal notes (admin-only).
 * - `verified` toggles the linked Contributor's `verified` field. Only
 *   allowed when the application is already in "approved" status —
 *   returns 400 otherwise.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await req.json() || {};

    const existing = await db.contributorApplication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // ── adminNotes ──────────────────────────────────────────────────────
    if (body.adminNotes != null) {
      const s =
        typeof body.adminNotes === "string" ? body.adminNotes : String(body.adminNotes);
      const adminNotes = s.length === 0 ? null : s;
      await db.contributorApplication.update({
        where: { id },
        data: { adminNotes },
      });
    }

    // ── verified ────────────────────────────────────────────────────────
    // Toggles the linked Contributor's `verified` field. Only meaningful
    // for approved applications — reject otherwise.
    if (typeof body.verified === "boolean") {
      if (existing.status !== "approved") {
        return NextResponse.json(
          { error: "Can only toggle verified status on approved applications" },
          { status: 400 }
        );
      }
      const linked = await db.contributor.findUnique({ where: { applicationId: id } });
      if (!linked) {
        return NextResponse.json(
          { error: "No linked Contributor record — re-approve the application first" },
          { status: 400 }
        );
      }
      await db.contributor.update({
        where: { id: linked.id },
        data: { verified: body.verified },
      });
    }

    const updated = await db.contributorApplication.findUnique({
      where: { id },
      include: {
        contributor: {
          select: {
            id: true,
            userId: true,
            displayName: true,
            slug: true,
            verified: true,
            status: true,
            applicationId: true,
          },
        },
      },
    });

    return NextResponse.json({
      application: {
        id: updated!.id,
        status: updated!.status,
        adminNotes: updated!.adminNotes,
        reviewedBy: updated!.reviewedBy,
        reviewedAt: updated!.reviewedAt ? updated!.reviewedAt.toISOString() : null,
        updatedAt: updated!.updatedAt.toISOString(),
        contributor: updated!.contributor
          ? {
              id: updated!.contributor.id,
              verified: updated!.contributor.verified,
              status: updated!.contributor.status,
              slug: updated!.contributor.slug,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("[admin/contributor-applications/[id]] PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/contributor-applications/[id]
 *
 * Admin-only. Hard-deletes an application. Does NOT cascade-delete the
 * linked Contributor record (if any) — that has its own lifecycle and
 * may already have published articles.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await db.contributorApplication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    await db.contributorApplication.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("[admin/contributor-applications/[id]] DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete" }, { status: 500 });
  }
}
