import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";

/**
 * POST /api/contributor/apply
 * Public — accepts contributor applications. Stored as ContributorApplication.
 *
 * Phase 1 security fix 14: the application's account link is resolved from
 * the SERVER-side session, never from the request body. The old code stored
 * a client-supplied `userId` verbatim — a forged payload could attach the
 * application to an arbitrary member and the link was honored at approval
 * time. A signed-in member's application is linked to their session account
 * (this also fixes the real /partner form, which never sends a userId and
 * so silently lost the account link); anonymous applications store null.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.fullName || !body.email || !body.whyContribute) {
      return NextResponse.json({ error: "Missing required fields: fullName, email, whyContribute" }, { status: 400 });
    }
    // Server-side identity: ignore any client-provided userId entirely.
    const sessionUser = await getAuthUser();
    const app = await db.contributorApplication.create({
      data: {
        fullName: String(body.fullName).slice(0, 200),
        email: String(body.email).slice(0, 200),
        userId: sessionUser?.id ?? null,
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
