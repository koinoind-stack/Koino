import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/profile/check-username?username=john123
 *
 * Checks if a username is available (not taken by another user).
 * Used by the onboarding form for real-time username validation.
 *
 * Returns: { available: boolean, suggestions: string[] }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const username = (searchParams.get("username") || "").trim();

    if (!username || username.length < 3) {
      return NextResponse.json({ available: false, error: "Username must be at least 3 characters" });
    }

    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      return NextResponse.json({ available: false, error: "Only letters, numbers, underscores, and periods" });
    }

    // Check if taken by another user (case-insensitive)
    const existing = await db.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        NOT: { id: user.id },
      },
      select: { id: true },
    });

    if (existing) {
      // Generate suggestions by appending numbers
      const suggestions = [
        `${username}${Math.floor(Math.random() * 100)}`,
        `${username}_${Math.floor(Math.random() * 1000)}`,
        `${username}${new Date().getFullYear()}`,
      ];
      return NextResponse.json({ available: false, suggestions });
    }

    return NextResponse.json({ available: true });
  } catch (error: any) {
    console.error("[profile/check-username] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to check username" },
      { status: 500 }
    );
  }
}
