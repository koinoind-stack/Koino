import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";

/**
 * GET /api/social/groups — list groups for discovery.
 *   ?mine=1           → the viewer's groups (active + pending requests)
 *   ?category=<c>     → filter by category ("All" = everything)
 *   ?q=<search>       → search name/description
 * Degrades to { groups: [] } when the Round-2 tables are not created yet.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user.id;

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "1";
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (category && category !== "All") where.category = category;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }];
  if (mine) where.members = { some: { userId: me } };

  try {
    const rows = await db.group.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        visibility: true,
        coverGradient: true,
        createdAt: true,
        createdBy: { select: { name: true, username: true } },
        _count: { select: { members: { where: { status: "active" } } } },
        members: {
          where: { userId: me },
          select: { status: true, role: true },
          take: 1,
        },
      },
    });
    const groups = rows.map(({ _count, members, createdBy, ...g }) => ({
      ...g,
      memberCount: _count.members,
      createdByName: createdBy?.name || createdBy?.username || null,
      myMembership: members[0]?.status ?? null,
      myRole: members[0]?.role ?? null,
    }));
    return Response.json({ groups });
  } catch (err) {
    if (isMissingTable(err)) return Response.json({ groups: [] });
    console.error("[social/groups] GET failed:", err);
    return jsonError("Failed to load groups", 500);
  }
}

/**
 * POST /api/social/groups — create a group. Creator becomes owner (active).
 * Body: { name, description?, category?, visibility? }
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;

  if (!rateLimitSafe(`groups:create:${me.id}`, 5)) {
    return jsonError("You're creating groups too fast — try again later", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 3 || name.length > 60) return jsonError("Group name must be 3-60 characters");
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
  const CATEGORIES = ["youth", "bible-study", "prayer", "worship", "entrepreneurs", "church", "fellowship"];
  const category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "fellowship";
  const visibility = body.visibility === "private" ? "private" : "public";

  try {
    const group = await db.group.create({
      data: {
        name,
        description,
        category,
        visibility,
        createdById: me.id,
        members: { create: { userId: me.id, role: "owner", status: "active" } },
      },
      select: {
        id: true, name: true, description: true, category: true,
        visibility: true, coverGradient: true, createdAt: true,
      },
    });
    return Response.json({ group }, { status: 201 });
  } catch (err) {
    if (isMissingTable(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups] POST failed:", err);
    return jsonError("Failed to create group", 500);
  }
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "P2021" || /does not exist/i.test(e?.message || "");
}

// The rate limiter is in-memory on serverless instances; never let it break
// the request path — worst case the limit window is per-instance.
function rateLimitSafe(key: string, max: number): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { rateLimit } = require("@/lib/social/rate-limit");
    return rateLimit(key, max, 60 * 60 * 1000);
  } catch {
    return true;
  }
}
