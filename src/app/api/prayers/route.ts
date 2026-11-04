import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";
import { PRAYER_CATEGORIES, publicPrayer } from "@/lib/prayers-server";

/**
 * GET /api/prayers — public wall list.
 *   ?category=Healing&q=...&sort=recent|most_prayed&answered=true&limit=50
 * Only status=visible rows leave the server. Anonymous author identity is
 * stripped by publicPrayer() — the userId/real name never leave for
 * anonymous requests, no matter who is asking.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const q = searchParams.get("q");
    const sort = searchParams.get("sort") === "most_prayed" ? "most_prayed" : "recent";
    const answered = searchParams.get("answered") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);

    const where: Record<string, unknown> = { status: "visible" };
    if (category && category !== "All") where.category = category;
    if (answered) where.answered = true;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }

    const viewer = await getAuthUser();
    const v = viewer ? { id: viewer.id, role: viewer.role } : null;

    const prayers = await db.prayerRequest.findMany({
      where,
      orderBy:
        sort === "most_prayed"
          ? [{ prayers: { _count: "desc" } }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }],
      take: limit,
      include: {
        user: { select: { id: true, name: true, username: true } },
        _count: {
          select: {
            prayers: true,
            comments: { where: { status: "visible" } },
          },
        },
      },
    });

    // Which ones has the viewer already prayed for? (server-derived state)
    let myPrayed = new Set<string>();
    if (viewer && prayers.length) {
      const rows = await db.prayerPrayer.findMany({
        where: { userId: viewer.id, prayerId: { in: prayers.map((p) => p.id) } },
        select: { prayerId: true },
      });
      myPrayed = new Set(rows.map((r) => r.prayerId));
    }

    return NextResponse.json({
      prayers: prayers.map((p) => ({
        ...publicPrayer(p, v),
        myPrayed: myPrayed.has(p.id),
      })),
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e?.code === "P2021" || e?.code === "P2022" || /does not exist/i.test(e?.message || "")) {
      // Migration window: table/column not there yet — serve an empty wall.
      return NextResponse.json({ prayers: [], migrationPending: true });
    }
    console.error("[api/prayers] GET failed:", err);
    return NextResponse.json({ error: "Failed to load prayers" }, { status: 500 });
  }
}

/**
 * POST /api/prayers — create a request (auth required, rate limited).
 * Body: { title, content, category, isAnonymous }
 * The author userId is stored server-side ALWAYS (authorship + delete
 * rights + streak integrity); isAnonymous only governs public display.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    if (!rateLimit(`prayers:create:${user.id}`, 3, 10 * 60_000)) {
      return NextResponse.json(
        { error: "You're sharing requests quickly. Please wait a little." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 2000) : "";
    const category = typeof body.category === "string" ? body.category : "";
    const isAnonymous = body.isAnonymous === true;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and details are required" }, { status: 400 });
    }
    if (!(PRAYER_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const prayer = await db.prayerRequest.create({
      data: { userId: user.id, title, content, category, isAnonymous },
      include: { user: { select: { id: true, name: true, username: true } }, _count: { select: { prayers: true, comments: true } } },
    });

    return NextResponse.json(
      { prayer: { ...publicPrayer(prayer, { id: user.id, role: user.role }), myPrayed: false } },
      { status: 201 }
    );
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e?.code === "P2021" || e?.code === "P2022" || /does not exist/i.test(e?.message || "")) {
      return NextResponse.json(
        { error: "The prayer wall is being upgraded — please try again in a few minutes." },
        { status: 503 }
      );
    }
    console.error("[api/prayers] POST failed:", err);
    return NextResponse.json({ error: "Failed to share the request" }, { status: 500 });
  }
}
