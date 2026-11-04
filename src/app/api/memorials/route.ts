import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import type { Prisma } from "@prisma/client";

/**
 * In Loving Memory (Part 4) — memorial directory + creation.
 *
 * GET  /api/memorials — public directory. Only status="published" AND
 *      visibility="public" memorials are listed (unlisted/private are NEVER
 *      exposed here; pending/rejected/draft are manager-only). Supports:
 *        ?q=<name substring>     search by the person's name
 *        ?state=<state>          browse by state
 *        ?city=<city>            browse by city
 *        ?cursor=<iso date>      keyset pagination (createdAt cursor)
 * Degrades to { memorials: [] } when the Part-4 tables are not created yet.
 *
 * POST /api/memorials — create a memorial (authentication required).
 *      Body: { fullName, photoUrl?, gallery?, dob?, dod?, city?, state?,
 *              tribute?, lifeStory?, milestones?, qualities?, verse?,
 *              verseRef?, testimony?, creatorRelation, visibility?, status? }
 *      status "draft" saves without submitting; "pending" submits it for
 *      admin review (requires the name + a short tribute for the card).
 *      Dates of birth/passing are optional. The creator becomes the
 *      memorial's first manager (role "owner").
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const state = searchParams.get("state")?.trim();
  const city = searchParams.get("city")?.trim();
  const cursor = searchParams.get("cursor")?.trim();
  const take = 24;

  const where: Prisma.MemorialWhereInput = { status: "published", visibility: "public" };
  if (q) where.fullName = { contains: q, mode: "insensitive" };
  if (state) where.state = state;
  if (city) where.city = city;
  // Keyset pagination (createdAt is not unique, so we filter lt the cursor
  // instead of using Prisma's cursor — which requires a unique column).
  if (cursor) {
    const d = new Date(cursor);
    if (!Number.isNaN(d.getTime())) where.createdAt = { lt: d };
  }

  try {
    const rows = await db.memorial.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        dob: true,
        dod: true,
        city: true,
        state: true,
        tribute: true,
        publishedAt: true,
        createdAt: true,
        creatorName: true,
        _count: {
          select: {
            condolences: { where: { hidden: false } },
            candles: true,
          },
        },
      },
    });
    const hasMore = rows.length === take;
    return Response.json({
      memorials: rows.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        photoUrl: m.photoUrl,
        dob: m.dob,
        dod: m.dod,
        city: m.city,
        state: m.state,
        tribute: m.tribute,
        creatorName: m.creatorName,
        condolenceCount: m._count.condolences,
        candleCount: m._count.candles,
      })),
      nextCursor: hasMore ? rows[rows.length - 1].createdAt.toISOString() : null,
    });
  } catch (err: unknown) {
    // P2021 = table does not exist (SQL not run yet) — degrade gracefully.
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return Response.json({ memorials: [], nextCursor: null });
    }
    console.error("[memorials] list failed:", err);
    return jsonError("Could not load memorials", 500);
  }
}

/** Rejects obvious phone numbers (10+ consecutive digits after removing
 *  separators) so private contact details are not published accidentally.
 *  Dates of birth/passing can never produce 10 consecutive digits. */
function containsPhoneNumber(text: string): boolean {
  return /\d{10}/.test(text.replace(/[\s\-().+]/g, ""));
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`memorial-create:${me.id}`, 10, 60 * 60 * 1000)) {
    return jsonError("Too many memorials created — try again in a while", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const fullName = String(body.fullName || "").trim();
  if (fullName.length < 2 || fullName.length > 120) {
    return jsonError("Please enter the full name (2–120 characters)");
  }

  const str = (key: string, max: number): string | null => {
    const v = body[key];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };
  const date = (key: string): Date | null => {
    const v = body[key];
    if (typeof v !== "string" || !v.trim()) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const dod = date("dod"); // optional per the memorial form spec
  const dob = date("dob");
  if (dob && dod && dob > dod) return jsonError("Date of birth cannot be after the date of passing");

  const photoUrl = str("photoUrl", 600);
  let gallery: string[] = [];
  if (typeof body.gallery === "string" && body.gallery.trim()) {
    try {
      const parsed = JSON.parse(body.gallery);
      if (Array.isArray(parsed)) {
        gallery = parsed.filter((u): u is string => typeof u === "string" && u.startsWith("https://")).slice(0, 12);
      }
    } catch {
      return jsonError("Invalid gallery data");
    }
  }

  const lifeStory = str("lifeStory", 20000);
  const milestones = str("milestones", 10000);
  const qualities = str("qualities", 10000);
  const tribute = str("tribute", 500);
  const testimony = str("testimony", 10000);

  const status = body.status === "pending" ? "pending" : "draft";
  // Submitting for review requires the directory-card fields.
  if (status === "pending") {
    if (!tribute) return jsonError("Please write a short tribute for the memorial card before submitting");
  }

  // Privacy guard: refuse obvious phone numbers in free-text fields.
  for (const [label, text] of [
    ["life story", lifeStory],
    ["tribute", tribute],
    ["milestones", milestones],
    ["qualities", qualities],
  ] as const) {
    if (text && containsPhoneNumber(text)) {
      return jsonError(
        `The ${label} looks like it contains a phone number. Please remove private contact details before saving.`,
      );
    }
  }

  const creatorRelation = str("creatorRelation", 80) || "Family";
  const visibility = ["public", "unlisted", "private"].includes(String(body.visibility))
    ? String(body.visibility)
    : "public";

  try {
    const memorial = await db.$transaction(async (tx) => {
      const row = await tx.memorial.create({
        data: {
          fullName,
          photoUrl,
          gallery: JSON.stringify(gallery),
          dob,
          dod,
          city: str("city", 80),
          state: str("state", 80),
          tribute,
          lifeStory,
          milestones,
          qualities,
          verse: str("verse", 500),
          verseRef: str("verseRef", 120),
          testimony,
          visibility,
          status,
          creatorId: me.id,
          creatorName: str("creatorName", 80) || "A family member",
          creatorRelation,
          publishedAt: null,
        },
        select: { id: true, status: true },
      });
      await tx.memorialManager.create({
        data: { memorialId: row.id, userId: me.id, role: "owner" },
      });
      return row;
    });
    return Response.json({ success: true, memorial }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return jsonError("The memorial feature is not ready yet — the database tables need to be created first", 503);
    }
    console.error("[memorials] create failed:", err);
    return jsonError("Could not create the memorial", 500);
  }
}
