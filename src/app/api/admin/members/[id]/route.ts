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
 * GET /api/admin/members/[id]
 * Returns full member detail. Admin-only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const { id } = await params;
    const member = await db.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, image: true, role: true,
        username: true, dateOfBirth: true, gender: true, state: true, city: true,
        mobileNumber: true, mobileVerified: true, faithStatus: true, faithJourney: true,
        profileCompleted: true, signupMethod: true, createdAt: true, updatedAt: true,
        accountStatus: true, moderationReason: true,
        verified: true, verifiedAt: true, verifiedBy: true,
        contributorType: true, permissions: true,
        totalPoints: true,
      },
    });

    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ member });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/members/[id]
 * Updates member: verify, permissions, contributor type, account status.
 * Admin-only. All fields are validated server-side.
 *
 * Body (any subset):
 *   { verified: bool, contributorType: string, permissions: string[],
 *     accountStatus: "active"|"blocked"|"suspended"|"deactivated", moderationReason: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const data: any = {};

    // Verification
    if (body.verified !== undefined) {
      data.verified = Boolean(body.verified);
      if (body.verified) {
        data.verifiedAt = new Date();
        data.verifiedBy = admin.id;
      } else {
        data.verifiedAt = null;
        data.verifiedBy = null;
      }
    }

    // Contributor type
    if (body.contributorType !== undefined) {
      const validTypes = ["Pastor", "Elder", "Bible Teacher", "Apologist", "Evangelist",
        "Christian Author", "Theologian", "Ministry Leader", "Worship Leader",
        "Christian Counselor", "Other", null];
      if (!validTypes.includes(body.contributorType)) {
        return NextResponse.json({ error: "Invalid contributor type" }, { status: 400 });
      }
      data.contributorType = body.contributorType;
    }

    // Permissions (JSON array of permission strings)
    if (body.permissions !== undefined) {
      const validPerms = [
        "CAN_WRITE_ARTICLES", "CAN_WRITE_BLOG", "CAN_WRITE_APOLOGETICS",
        "CAN_ANSWER_QUESTIONS", "CAN_WRITE_BIBLE_STUDIES", "CAN_WRITE_DEVOTIONALS",
        "CAN_UPLOAD_IMAGES", "CAN_EDIT_OWN_DRAFTS", "CAN_SUBMIT_FOR_REVIEW",
        "CAN_PUBLISH_CONTENT",
      ];
      const perms = Array.isArray(body.permissions) ? body.permissions : [];
      const invalid = perms.filter((p: string) => !validPerms.includes(p));
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Invalid permissions: ${invalid.join(", ")}` }, { status: 400 });
      }
      data.permissions = JSON.stringify(perms);
    }

    // Account status
    if (body.accountStatus !== undefined) {
      const validStatuses = ["active", "blocked", "suspended", "deactivated"];
      if (!validStatuses.includes(body.accountStatus)) {
        return NextResponse.json({ error: "Invalid account status" }, { status: 400 });
      }
      data.accountStatus = body.accountStatus;
      if (body.moderationReason) {
        data.moderationReason = String(body.moderationReason).slice(0, 500);
      }
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, name: true, username: true, image: true, role: true,
        dateOfBirth: true, gender: true, state: true, city: true,
        mobileNumber: true, mobileVerified: true, faithStatus: true, faithJourney: true,
        profileCompleted: true, signupMethod: true, createdAt: true, updatedAt: true,
        accountStatus: true, moderationReason: true,
        verified: true, verifiedAt: true, verifiedBy: true,
        contributorType: true, permissions: true,
        totalPoints: true,
      },
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
