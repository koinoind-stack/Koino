import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * GET /api/admin/trivia/competitions
 * Returns all competitions (including drafts) for admin management.
 *
 * POST /api/admin/trivia/competitions
 * Creates a new competition. Admin-only.
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // hostGroup ships with migration 20261026000000 — degrade gracefully
    // while the column is missing (P2022) instead of failing the admin list.
    // NOTE: the fallback needs an explicit select — Prisma selects every
    // scalar of the schema for include-only queries, so omitting hostGroup
    // from the include is not enough while the column is missing.
    let competitions;
    try {
      competitions = await db.triviaCompetition.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          prize: true,
          hostGroup: { select: { id: true, name: true } },
          _count: { select: { attempts: true, winners: true } },
        },
      });
    } catch (e: any) {
      const missing =
        e?.code === "P2021" || e?.code === "P2022" || /hostGroupId does not exist/i.test(e?.message || "");
      if (!missing) throw e;
      competitions = await db.triviaCompetition.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          type: true,
          category: true,
          difficulty: true,
          questionCount: true,
          attemptLimit: true,
          winnerCount: true,
          rules: true,
          status: true,
          startAt: true,
          endAt: true,
          claimDeadlineDays: true,
          prizeId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          prize: true,
          _count: { select: { attempts: true, winners: true } },
        },
      });
    }

    return NextResponse.json({ competitions });
  } catch (error: any) {
    console.error("[admin/trivia/competitions] GET error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const required = ["title", "type", "category", "difficulty", "startAt", "endAt"];
    for (const f of required) {
      if (!body[f]) {
        return NextResponse.json({ error: `Missing required field: ${f}` }, { status: 400 });
      }
    }

    const competition = await db.triviaCompetition.create({
      data: {
        title: body.title,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        type: body.type,
        category: body.category,
        difficulty: body.difficulty,
        questionCount: body.questionCount || 10,
        attemptLimit: body.attemptLimit || 1,
        winnerCount: body.winnerCount || 3,
        rules: body.rules || null,
        status: body.status || "draft",
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        claimDeadlineDays: body.claimDeadlineDays || 7,
        prizeId: body.prizeId || null,
        createdById: admin.id,
      },
    });

    return NextResponse.json({ success: true, competition });
  } catch (error: any) {
    console.error("[admin/trivia/competitions] POST error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
