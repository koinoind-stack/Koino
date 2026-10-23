import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError, notify } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { authShape, findMemorial } from "@/lib/memorial/server";
import {
  condolenceSelect,
  serializeCondolence,
} from "@/lib/memorial/condolences";
import {
  MEMORIAL_LIMITS,
  canViewMemorial,
  initialCondolenceStatus,
  visibleCondolenceStatuses,
} from "@/lib/memorial/shared";

/**
 * Part 4 — GET/POST /api/memorials/[id]/condolences
 *
 * GET  ?status=<pending|approved|rejected>&cursor=<iso>
 *   Approved condolences for everyone who can see the memorial; managers
 *   and admin can additionally list the moderation queue (status=pending).
 *   Authors always see their own non-approved messages in the list payload
 *   (flagged so the UI can explain "awaiting approval").
 *
 * POST  add a condolence (signed-in active users). Under the default
 *   "approved" policy the message starts pending and every manager is
 *   notified; "open" policy posts go live immediately.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  const { id } = await ctx.params;
  const memorial = await findMemorial(id);
  if (!memorial) return jsonError("Memorial not found", 404);
  const shape = authShape(memorial);
  const viewer = session.user ? { id: session.user.id, role: session.user.role } : null;

  if (!canViewMemorial(shape, viewer)) {
    return jsonError("You don't have access to this memorial", 403);
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 50);

  const allowed = visibleCondolenceStatuses(shape, viewer);
  const status: string =
    statusParam != null && (allowed as string[]).includes(statusParam) ? statusParam : "approved";

  const rows = await db.memorialCondolence.findMany({
    where: {
      memorialId: id,
      // Managers queueing pending/rejected get exactly that status; everyone
      // else gets approved. Authors' own pending messages are added below so
      // they can see "awaiting approval" without exposing others.
      status,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: condolenceSelect,
  });

  let items = rows.map((r) => serializeCondolence(r, viewer?.id ?? null));

  if (status === "approved" && viewer) {
    // Surface the viewer's own pending/rejected messages inline.
    const own = await db.memorialCondolence.findMany({
      where: { memorialId: id, authorId: viewer.id, status: { not: "approved" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: condolenceSelect,
    });
    items = [...own.map((r) => serializeCondolence(r, viewer.id)), ...items];
  }

  const nextCursor =
    rows.length === limit && rows.length > 0
      ? rows[rows.length - 1].createdAt.toISOString()
      : null;

  return Response.json({ condolences: items, nextCursor });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;
  const { id } = await ctx.params;

  if (!rateLimit(`condolence:${me.id}`, 10, 60 * 60 * 1000)) {
    return jsonError("Too many condolences posted — try again later", 429);
  }

  const memorial = await findMemorial(id);
  if (!memorial) return jsonError("Memorial not found", 404);
  const shape = authShape(memorial);
  const viewer = { id: me.id, role: me.role };

  if (!canViewMemorial(shape, viewer)) {
    return jsonError("You don't have access to this memorial", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return jsonError("Please write a short condolence message");
  if (message.length > MEMORIAL_LIMITS.condolenceMessage) {
    return jsonError(`Condolences are limited to ${MEMORIAL_LIMITS.condolenceMessage} characters`);
  }

  const status = initialCondolenceStatus(memorial.condolencePolicy);

  try {
    const created = await db.memorialCondolence.create({
      data: { memorialId: id, authorId: me.id, message, status },
      select: condolenceSelect,
    });

    if (status === "pending") {
      // Notify every manager (creator + co-managers) except the author.
      const managerIds = [...shape.managerIds, shape.creatorId].filter((uid) => uid !== me.id);
      for (const managerId of managerIds) {
        await notify({
          userId: managerId,
          actorId: me.id,
          type: "memorial_condolence_pending",
          postId: null,
        }).catch(() => {});
      }
    }

    return Response.json({ condolence: serializeCondolence(created, me.id) }, { status: 201 });
  } catch (err) {
    console.error("[condolence-create] failed:", err);
    return jsonError("Could not post the condolence", 500);
  }
}
