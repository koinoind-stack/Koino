import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { authShape, findMemorial, serializeMemorialFull } from "@/lib/memorial/server";
import { MEMORIAL_LIMITS, canManageManagers } from "@/lib/memorial/shared";

/**
 * Part 4 — POST /api/memorials/[id]/managers
 *
 * Add a co-manager. Creator (owner) or admin only. The target must be an
 * existing active user, addressed by userId or username. The creator can
 * never be added as a co-manager of their own memorial (they are already
 * the implicit owner). Max MEMORIAL_LIMITS.maxManagers co-managers.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id } = await ctx.params;

  if (!rateLimit(`memorial-managers:${session.user.id}`, 30, 60 * 60 * 1000)) {
    return jsonError("Too many manager changes — try again later", 429);
  }

  const memorial = await findMemorial(id);
  if (!memorial) return jsonError("Memorial not found", 404);

  const viewer = { id: session.user.id, role: session.user.role };
  if (!canManageManagers(authShape(memorial), viewer)) {
    return jsonError("Only the memorial's creator or an admin can add managers", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const username = typeof body.username === "string" ? body.username.trim().replace(/^@/, "") : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!username && !userId) return jsonError("Provide a username or userId to add");

  const target = username
    ? await db.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" } },
        select: { id: true, name: true, username: true, image: true, accountStatus: true },
      })
    : await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true, image: true, accountStatus: true },
      });

  if (!target) return jsonError("No Koino member found with that username", 404);
  if (target.accountStatus !== "active") return jsonError("That member's account is not active", 400);
  if (target.id === memorial.creatorId) {
    return jsonError("The creator already manages this memorial", 400);
  }

  const existing = await db.memorialManager.findMany({
    where: { memorialId: id },
    select: { userId: true },
  });
  if (existing.some((e) => e.userId === target.id)) {
    return jsonError("That member is already a manager", 400);
  }
  if (existing.length >= MEMORIAL_LIMITS.maxManagers) {
    return jsonError(`A memorial can have at most ${MEMORIAL_LIMITS.maxManagers} co-managers`, 400);
  }

  try {
    await db.memorialManager.create({
      data: { memorialId: id, userId: target.id, addedById: session.user.id },
    });
  } catch (err) {
    console.error("[memorial-managers] create failed:", err);
    return jsonError("Could not add the manager", 500);
  }

  const fresh = await findMemorial(id);
  return Response.json(
    { success: true, memorial: fresh ? serializeMemorialFull(fresh, session.user.id) : null },
    { status: 201 },
  );
}
