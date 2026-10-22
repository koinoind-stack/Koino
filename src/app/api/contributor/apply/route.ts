import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * POST /api/contributor/apply
 * Public — accepts contributor applications. Stored as ContributorApplication.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.fullName || !body.email || !body.whyContribute) {
      return NextResponse.json({ error: "Missing required fields: fullName, email, whyContribute" }, { status: 400 });
    }
    const app = await db.contributorApplication.create({
      data: {
        fullName: String(body.fullName).slice(0, 200),
        email: String(body.email).slice(0, 200),
        userId: body.userId || null,
        profilePhoto: body.profilePhoto || null,
        church: body.church || null,
        churchRole: body.churchRole || null,
        city: body.city || null,
        state: body.state || null,
        country: body.country || null,
        bio: body.bio || null,
        expertise: JSON.stringify(body.expertise || []),
        website: body.website || null,
        socialLinks: JSON.stringify(body.socialLinks || []),
        whyContribute: String(body.whyContribute).slice(0, 5000),
        contentInterests: JSON.stringify(body.contentInterests || []),
        sampleUrl: body.sampleUrl || null,
      },
    });
    return NextResponse.json({ success: true, applicationId: app.id });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to submit" }, { status: 500 });
  }
}
