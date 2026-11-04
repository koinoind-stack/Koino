import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { memorialRole } from "@/lib/memorials";

/**
 * PATCH  /api/memorials/[id]/condolences/[cid]
 *   - the AUTHOR may edit their own message body (2–2000 chars)
 *   - managers/admins may hide/unhide ({ hidden: true | false })
 * DELETE /api/memorials/[id]/condolences/[cid]
 *   - the AUTHOR may delete their own message
 *   - managers/admins may delete any message (moderation)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  try {
    const msg = await db.memorialCondolence.findUnique({ where: { id: cid } });
    if (!msg || msg.memorialId !== id) return jsonError("Message not found", 404);

    const role = await memorialRole(id, me.id);
    const isAdmin = me.role === "admin";
    const isAuthor = msg.authorId === me.id;
    if (!isAuthor && !role && !isAdmin) return jsonError("Not allowed", 403);

    const data: Record<string, unknown> = {};
    if (typeof body.body === "string") {
      if (!isAuthor) return jsonError("Only the author can edit the message text", 403);
      const text = body.body.trim().slice(0, 2000);
      if (text.length < 2) return jsonError("Please write a short message first");
      data.body = text;
    }
    if ("hidden" in body) {
      if (!role && !isAdmin) return jsonError("Only the memorial managers can hide messages", 403);
      data.hidden = !!body.hidden;
    }
    if (Object.keys(data).length === 0) return jsonError("Nothing to update");

    const updated = await db.memorialCondolence.update({
      where: { id: cid },
      data,
      select: { id: true, body: true, hidden: true },
    });
    return Response.json({ success: true, condolence: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Message not found", 404);
    console.error("[memorials/condolence] patch failed:", err);
    return jsonError("Could not update the message", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  try {
    const msg = await db.memorialCondolence.findUnique({ where: { id: cid } });
    if (!msg || msg.memorialId !== id) return jsonError("Message not found", 404);

    const role = await memorialRole(id, me.id);
    const isAdmin = me.role === "admin";
    const isAuthor = msg.authorId === me.id;
    if (!isAuthor && !role && !isAdmin) return jsonError("Not allowed", 403);

    await db.memorialCondolence.delete({ where: { id: cid } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Message not found", 404);
    console.error("[memorials/condolence] delete failed:", err);
    return jsonError("Could not delete the message", 500);
  }
}
