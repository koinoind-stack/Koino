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
 * GET /api/admin/members
 *
 * Returns the list of members (users) with profile + signup info.
 * Admin-only — non-admins get 403.
 *
 * Query params:
 *   ?search=     — search by username, name, email, mobile, state, city
 *   ?state=       — filter by state
 *   ?city=        — filter by city
 *   ?signupMethod= — "google" | "email"
 *   ?profileCompleted= "true" | "false"
 *   ?limit=       — default 50, max 200
 *   ?offset=      — for pagination
 *   ?stats=       — "true" returns dashboard stats instead of member list
 *
 * Returns:
 *   { members: [...], total: number }
 *   OR (when ?stats=true):
 *   { totalMembers, newToday, newThisWeek, newThisMonth, recentSignups: [...] }
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const stats = searchParams.get("stats") === "true";

    // ─── Stats mode (for dashboard) ───
    if (stats) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Sunday start
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalMembers, newToday, newThisWeek, newThisMonth, recentSignups] = await Promise.all([
        db.user.count(),
        db.user.count({ where: { createdAt: { gte: startOfToday } } }),
        db.user.count({ where: { createdAt: { gte: startOfWeek } } }),
        db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
        db.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            image: true,
            state: true,
            city: true,
            signupMethod: true,
            createdAt: true,
            profileCompleted: true,
          },
        }),
      ]);

      return NextResponse.json({
        totalMembers,
        newToday,
        newThisWeek,
        newThisMonth,
        recentSignups,
      });
    }

    // ─── List mode ───
    const search = searchParams.get("search") || "";
    const state = searchParams.get("state") || "";
    const city = searchParams.get("city") || "";
    const signupMethod = searchParams.get("signupMethod") || "";
    const profileCompletedParam = searchParams.get("profileCompleted");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobileNumber: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }
    if (state) where.state = state;
    if (city) where.city = city;
    if (signupMethod) where.signupMethod = signupMethod;
    if (profileCompletedParam === "true") where.profileCompleted = true;
    if (profileCompletedParam === "false") where.profileCompleted = false;

    const [members, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          image: true,
          dateOfBirth: true,
          gender: true,
          state: true,
          city: true,
          mobileNumber: true,
          mobileVerified: true,
          faithStatus: true,
          faithJourney: true,
          profileCompleted: true,
          signupMethod: true,
          createdAt: true,
          updatedAt: true,
          role: true,
          totalPoints: true,
          accountStatus: true,
          verified: true,
          contributorType: true,
          permissions: true,
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({ members, total });
  } catch (error: any) {
    console.error("[admin/members] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load members" },
      { status: 500 }
    );
  }
}
