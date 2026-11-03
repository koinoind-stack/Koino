import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * Phase 1 security fix 12a: this route's copy-pasted guard used to merge
 * unauthenticated and unauthorized callers into a single bare 403. It now
 * follows the shared 401/403 semantics every other admin guard uses
 * (401 "Authentication required" / 403 "Admin access required"). The
 * structural dedupe (importing the one shared helper) lands in Phase 5 —
 * deliberately NOT bundled into this security patch.
 */
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
 * GET /api/admin/contributors — list all applications + contributors
 * POST /api/admin/contributors — approve application (creates Contributor record)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const admin = auth.user;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const applications = await db.contributorApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    const contributors = await db.contributor.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { articles: true } } },
    });

    return NextResponse.json({ applications, contributors });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/contributors
 * Body (existing): { applicationId, action: "approve" | "reject" | "suspend", permissions?, verified? }
 * Body (PART 2):   { action: "designate", userId, displayName?, permissions?, verified? }
 *   → Admin directly designates an EXISTING member as a Contributor without
 *     an application. Server verifies the user exists, upserts the
 *     Contributor record (status approved). No separate auth system — the
 *     member keeps their normal login; Contributor permissions are checked
 *     server-side on every contributor action.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const admin = auth.user;

    const body = await req.json();

    // ─── PART 2: designate an existing member as a Contributor ──────────
    if (body.action === "designate") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

      const permissions = JSON.stringify(
        Array.isArray(body.permissions) && body.permissions.length
          ? body.permissions.map(String)
          : ["CAN_WRITE_ARTICLES", "CAN_WRITE_ANSWERS"]
      );

      const existing = await db.contributor.findUnique({ where: { userId } });
      let contributor;
      if (existing) {
        contributor = await db.contributor.update({
          where: { id: existing.id },
          data: {
            status: "approved",
            permissions,
            verified: body.verified === true,
          },
        });
      } else {
        const slug =
          (user.username ||
            user.name ||
            `contributor-${userId.slice(-6)}`)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 50) || `contributor-${Date.now()}`;
        contributor = await db.contributor.create({
          data: {
            userId,
            displayName: body.displayName?.trim() || user.name || user.email.split("@")[0],
            slug,
            permissions,
            verified: body.verified === true,
            status: "approved",
          },
        });
      }
      return NextResponse.json({ success: true, contributor });
    }

    const { applicationId, action } = body;

    const application = await db.contributorApplication.findUnique({ where: { id: applicationId } });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    if (action === "approve") {
      // Update application status
      await db.contributorApplication.update({
        where: { id: applicationId },
        data: { status: "approved", reviewedBy: admin.id, reviewedAt: new Date() },
      });

      // Generate slug from display name
      const slug = (application.fullName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `contributor-${Date.now()}`).slice(0, 50);

      // Check if a contributor already exists for this user
      let contributor: any = null;
      if (application.userId) {
        contributor = await db.contributor.findUnique({ where: { userId: application.userId } });
      }

      if (!contributor) {
        contributor = await db.contributor.create({
          data: {
            userId: application.userId || `pending-${applicationId}`,
            displayName: application.fullName,
            slug,
            profilePhoto: application.profilePhoto,
            bio: application.bio,
            church: application.church,
            churchRole: application.churchRole,
            location: application.city ? `${application.city}, ${application.state || ""}` : null,
            expertise: application.expertise,
            website: application.website,
            socialLinks: application.socialLinks,
            verified: body.verified === true,
            status: "approved",
            permissions: JSON.stringify(body.permissions || ["CAN_WRITE_ARTICLES"]),
            applicationId,
          },
        });
      }

      return NextResponse.json({ success: true, contributor });
    } else if (action === "reject") {
      await db.contributorApplication.update({
        where: { id: applicationId },
        data: { status: "rejected", reviewedBy: admin.id, reviewedAt: new Date(), adminNotes: body.reason || null },
      });
      return NextResponse.json({ success: true });
    } else if (action === "suspend") {
      // Suspend an existing contributor
      const contributorId = body.contributorId;
      if (!contributorId) return NextResponse.json({ error: "contributorId required for suspend" }, { status: 400 });
      await db.contributor.update({
        where: { id: contributorId },
        data: { status: "suspended", verified: false },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
