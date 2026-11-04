import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apologetics-server";

/**
 * GET /api/contributor/me — the signed-in user's Contributor record, if any.
 * Powers the "Contributor Studio" entry point on the public apologetics hub:
 * the UI only shows submission tools when status === "approved".
 * Response: { contributor: {...} | null }
 */
export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;

    const contributor = await db.contributor.findUnique({
      where: { userId: auth.user.id },
      select: {
        id: true,
        displayName: true,
        slug: true,
        status: true,
        verified: true,
        permissions: true,
        bio: true,
        churchRole: true,
      },
    });

    return NextResponse.json({ contributor });
  } catch (error: any) {
    console.error("[api/contributor/me GET] Error:", error);
    return NextResponse.json({ error: "Failed to load contributor profile" }, { status: 500 });
  }
}
