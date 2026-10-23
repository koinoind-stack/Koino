import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { canView, memorialRole } from "@/lib/memorials";
import type { Prisma } from "@prisma/client";

/**
 * GET  /api/memorials/[id]/condolences — list visible condolences/memories.
 *      Anyone who can view the memorial can read; hidden ones only for
 *      managers/admins. Cursor pagination (?cursor=<iso>).
 * POST /api/memorials/[id]/condolences — leave a condolence or memory.
 *      Body: { body, kind: "condolence" | "memory" } — authentication required.
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
      select: {
        id: true, authorId: true, authorName: true, kind: true,
        body: true, hidden: true, createdAt: true,
      },
    });
    const hasMore = rows.length === take;
    return Response.json({
      condolences: rows,
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
        kind,
        body: text,
      },
      select: { id: true, createdAt: true },
    });
    return Response.json({ success: true, condolence }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/condolences] create failed:", err);
    return jsonError("Could not save your message", 500);
  }
}
