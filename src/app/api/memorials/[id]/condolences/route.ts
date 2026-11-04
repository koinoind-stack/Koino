import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { canView, memorialRole } from "@/lib/memorials";
import type { Prisma } from "@prisma/client";

/**
 * GET  /api/memorials/[id]/condolences — list visible condolences/memories
 *      (top-level, newest first, with their replies, heart counts and whether
 *      the viewer liked each). Anyone who can view the memorial can read;
 *      hidden ones only for managers/admins. Cursor pagination (?cursor=<iso>).
 * POST /api/memorials/[id]/condolences — leave a condolence, memory, or a
 *      reply to one ({ parentId }). Authentication required.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  const viewer = session.user;
  const cursor = new URL(req.url).searchParams.get("cursor")?.trim();

  try {
    const m = await db.memorial.findUnique({
      where: { id },
      select: { status: true, visibility: true },
    });
    if (!m) return jsonError("Memorial not found", 404);
    const role = await memorialRole(id, viewer?.id);
    const isAdmin = viewer?.role === "admin";
    if (!canView(m, role, isAdmin)) return jsonError("Memorial not found", 404);

    const take = 50;
    const condolenceWhere: Prisma.MemorialCondolenceWhereInput = {
      memorialId: id,
      parentId: null,
      ...(role || isAdmin ? {} : { hidden: false }),
    };
    // Keyset pagination — createdAt is not unique, so filter lt the cursor.
    if (cursor) {
      const d = new Date(cursor);
      if (!Number.isNaN(d.getTime())) condolenceWhere.createdAt = { lt: d };
    }
    const rows = await db.memorialCondolence.findMany({
      where: condolenceWhere,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
          ...(role || isAdmin ? {} : { where: { hidden: false } }),
          select: {
            id: true, authorId: true, authorName: true, kind: true,
            body: true, hidden: true, parentId: true, createdAt: true,
          },
        },
      },
    });
    const ids = rows.map((c) => c.id);
    const [hearts, myHearts] = ids.length
      ? await Promise.all([
          db.memorialCondolenceHeart.groupBy({
            by: ["condolenceId"],
            where: { condolenceId: { in: ids } },
            _count: { id: true },
          }),
          viewer ? db.memorialCondolenceHeart.findMany({
            where: { condolenceId: { in: ids }, userId: viewer.id },
            select: { condolenceId: true },
          }) : Promise.resolve([]),
        ])
      : [[], []];
    const heartMap = new Map(hearts.map((h) => [h.condolenceId, h._count.id]));
    const myHeartSet = new Set(myHearts.map((h) => h.condolenceId));

    const withHearts = (c: {
      id: string; authorId: string; authorName: string; kind: string;
      body: string; hidden: boolean; parentId: string | null; createdAt: Date;
    }) => ({
      id: c.id, authorId: c.authorId, authorName: c.authorName, kind: c.kind,
      body: c.body, hidden: c.hidden, parentId: c.parentId, createdAt: c.createdAt,
      heartCount: heartMap.get(c.id) || 0,
      likedByViewer: myHeartSet.has(c.id),
    });

    const hasMore = rows.length === take;
    return Response.json({
      condolences: rows.map((c) => ({
        ...withHearts(c),
        replies: c.replies.map(withHearts),
      })),
      nextCursor: hasMore ? rows[rows.length - 1].createdAt.toISOString() : null,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/condolences] list failed:", err);
    return jsonError("Could not load condolences", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Please sign in to leave a message", 401);
  const me = session.user;

  if (!rateLimit(`condolence:${me.id}`, 30, 60 * 60 * 1000)) {
    return jsonError("Too many messages — please try again in a few minutes", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  if (text.length < 2) return jsonError("Please write a short message first");
  const kind = body.kind === "memory" ? "memory" : "condolence";

  // Replies: only 1 level — a reply must reference a top-level message on
  // the same memorial.
  let parentId: string | null = null;
  if (typeof body.parentId === "string" && body.parentId.trim()) {
    const parent = await db.memorialCondolence.findUnique({
      where: { id: body.parentId.trim() },
      select: { memorialId: true, parentId: true, hidden: true },
    });
    if (!parent || parent.memorialId !== id) return jsonError("The message you replied to was not found", 404);
    if (parent.parentId) return jsonError("Replies to replies are not supported — reply to the original message", 400);
    parentId = body.parentId.trim();
  }

  try {
    const m = await db.memorial.findUnique({
      where: { id },
      select: { status: true, visibility: true },
    });
    if (!m) return jsonError("Memorial not found", 404);
    const role = await memorialRole(id, me.id);
    const isAdmin = me.role === "admin";
    if (!canView(m, role, isAdmin)) return jsonError("Memorial not found", 404);

    const author = await db.user.findUnique({
      where: { id: me.id },
      select: { name: true, username: true },
    });

    const condolence = await db.memorialCondolence.create({
      data: {
        memorialId: id,
        authorId: me.id,
        authorName: author?.name || author?.username || "A friend",
        kind: parentId ? "condolence" : kind,
        body: text,
        parentId,
      },
      select: { id: true, parentId: true, createdAt: true },
    });
    return Response.json({ success: true, condolence }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/condolences] create failed:", err);
    return jsonError("Could not save your message", 500);
  }
}
