import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { memorialRole } from "@/lib/memorials";

/**
 * GET    /api/memorials/[id]/managers — manager list (managers/admin only;
 *        the public memorial page already shows the manager names it needs).
 * POST   /api/memorials/[id]/managers  { username } — the OWNER invites a
 *        trusted family member or friend as a co-manager.
 * DELETE /api/memorials/[id]/managers?userId=<id> — the OWNER removes a
 *        co-manager (the owner themselves can never be removed).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  const role = await memorialRole(id, me.id);
  if (!role && me.role !== "admin") return jsonError("Only the memorial managers can view this", 403);

  const rows = await db.memorialManager.findMany({
    where: { memorialId: id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }], // owner first
    select: {
      role: true, createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });
  return Response.json({
    managers: rows.map((r) => ({
      userId: r.user.id,
      name: r.user.name || r.user.username || "Manager",
      username: r.user.username,
      image: r.user.image,
      role: r.role,
      since: r.createdAt,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`memorial-invite:${me.id}`, 20, 60 * 60 * 1000)) {
    return jsonError("Too many invites — try again later", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const username = String(body.username || "").trim().replace(/^@/, "");
  if (!username) return jsonError("Please enter the username of the person to invite");

  const role = await memorialRole(id, me.id);
  if (role !== "owner") return jsonError("Only the memorial owner can invite managers", 403);

  try {
    const invitee = await db.user.findUnique({
      where: { username },
      select: { id: true, name: true, username: true, accountStatus: true },
    });
    if (!invitee) return jsonError("No Koino account found with that username", 404);
    if (invitee.accountStatus !== "active") return jsonError("That account cannot be added", 403);
    if (invitee.id === me.id) return jsonError("You already manage this memorial");

    const existing = await db.memorialManager.findUnique({
      where: { memorialId_userId: { memorialId: id, userId: invitee.id } },
    });
    if (existing) return jsonError("That person already manages this memorial");

    await db.memorialManager.create({
      data: { memorialId: id, userId: invitee.id, role: "manager", addedById: me.id },
    });
    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[memorials/managers] invite failed:", err);
    return jsonError("Could not add the manager", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) return jsonError("userId is required");

  const role = await memorialRole(id, me.id);
  if (role !== "owner") return jsonError("Only the memorial owner can remove managers", 403);

  try {
    const target = await db.memorialManager.findUnique({
      where: { memorialId_userId: { memorialId: id, userId } },
      select: { role: true },
    });
    if (!target) return jsonError("That person is not a manager", 404);
    if (target.role === "owner") return jsonError("The memorial owner cannot be removed", 403);

    await db.memorialManager.delete({
      where: { memorialId_userId: { memorialId: id, userId } },
    });
    return Response.json({ success: true });
  } catch (err) {
    console.error("[memorials/managers] remove failed:", err);
    return jsonError("Could not remove the manager", 500);
  }
}
