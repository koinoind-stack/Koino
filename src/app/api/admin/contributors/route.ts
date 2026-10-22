import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * GET /api/admin/contributors — list all applications + contributors
 * POST /api/admin/contributors — approve application (creates Contributor record)
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

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
 * Body: { applicationId, action: "approve" | "reject" | "suspend", permissions?: [], verified?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
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
