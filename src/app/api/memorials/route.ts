import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import {
  authShape,
  memorialSelect,
  serializeMemorialSummary,
  viewerFrom,
} from "@/lib/memorial/server";
import {
  canViewMemorial,
  sanitizeSearchQuery,
  validateMemorialInput,
} from "@/lib/memorial/shared";

/**
 * Part 4 — GET/POST /api/memorials
 *
 * GET  ?q=<text>&cursor=<iso>&limit=<n>
 *   List/search memorials the viewer may see. Signed-out visitors see only
 *   public ones. Archived memorials never appear in lists (managers reach
 *   them through their management view — future work per spec).
 *   Search is case-insensitive contains on fullName (sanitized in shared.ts).
 *
 * POST  create — any active signed-in user can create a memorial; the
 *   creator becomes the implicit owner (no MemorialManager row needed for
 *   the owner; the owner is creatorId itself). Rate-limited per user.
 */

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  const viewer = viewerFrom(session.user);
  const viewerId = viewer?.id ?? null;

  const { searchParams } = new URL(req.url);
  const q = sanitizeSearchQuery(searchParams.get("q"));
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 30);

  // visibility filter: rows must be one of the types the viewer can see.
  const where: Record<string, unknown> = { archived: false };
  if (viewerId) {
    where.visibility = { in: ["public", "members"] };
  } else {
    where.visibility = "public";
  }
  if (q) {
    where.fullName = { contains: q, mode: "insensitive" };
  }

  try {
    const rows = await db.memorial.findMany({
      where: cursor
        ? { AND: [where, { createdAt: { lt: new Date(cursor) } }] }
        : where,
      select: memorialSelect,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // Per-row visibility check (pure rule) — defense in depth on top of the
    // where-clause, and it keeps list behavior identical to detail access.
    const memorials = page
      .filter((m) => canViewMemorial(authShape(m as never), viewer))
      .map((m) => serializeMemorialSummary(m as never, viewerId));

    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null;
    return Response.json({ memorials, nextCursor });
  } catch (err) {
    console.error("[memorials] list failed:", err);
    return jsonError("Could not load memorials", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`memorial-create:${me.id}`, 10, 24 * 60 * 60 * 1000)) {
    return jsonError("Too many memorials created — try again tomorrow", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = validateMemorialInput(body);
  if (!parsed.ok) return jsonError(parsed.error);

  try {
    const memorial = await db.memorial.create({
      data: {
        creatorId: me.id,
        ...parsed.value,
      },
      select: memorialSelect,
    });
    return Response.json({ memorial: serializeMemorialSummary(memorial as never, me.id) }, { status: 201 });
  } catch (err) {
    console.error("[memorials] create failed:", err);
    return jsonError("Could not create the memorial", 500);
  }
}
