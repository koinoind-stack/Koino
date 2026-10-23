import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { canView, containsPhoneNumber, memorialRole, parseGallery } from "@/lib/memorials";

/**
 * GET /api/memorials/[id] — one memorial, auth-aware.
 *   public/unlisted + published → anyone with the link
 *   private / draft / unpublished → managers and admins only (404 otherwise,
 *   so we never leak the existence of a restricted memorial).
 * Response includes the viewer's management role, the manager list, and
 * condolences (hidden ones only for managers/admins).
 *
 * PATCH  /api/memorials/[id] — managers/owner edit memorial details.
 * DELETE /api/memorials/[id] — owner or admin deletes the memorial.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  const viewer = session.user;

  try {
    const m = await db.memorial.findUnique({
      where: { id },
      select: {
        id: true, fullName: true, photoUrl: true, gallery: true,
        dob: true, dod: true, city: true, state: true,
        tribute: true, lifeStory: true, milestones: true, qualities: true,
        verse: true, verseRef: true,
        visibility: true, status: true,
        creatorId: true, creatorName: true, creatorRelation: true,
        createdAt: true, publishedAt: true,
        managers: {
          select: {
            role: true,
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
      },
    });
    if (!m) return jsonError("Memorial not found", 404);

    const role = await memorialRole(id, viewer?.id);
    const isAdmin = viewer?.role === "admin";
    if (!canView(m, role, isAdmin)) return jsonError("Memorial not found", 404);

    const condolences = await db.memorialCondolence.findMany({
      where: { memorialId: id, ...(role || isAdmin ? {} : { hidden: false }) },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, authorId: true, authorName: true, kind: true,
        body: true, hidden: true, createdAt: true,
      },
    });

    return Response.json({
      memorial: {
        id: m.id,
        fullName: m.fullName,
        photoUrl: m.photoUrl,
        gallery: parseGallery(m.gallery),
        dob: m.dob,
        dod: m.dod,
        city: m.city,
        state: m.state,
        tribute: m.tribute,
        lifeStory: m.lifeStory,
        milestones: m.milestones,
        qualities: m.qualities,
        verse: m.verse,
        verseRef: m.verseRef,
        visibility: m.visibility,
        status: m.status,
        creatorName: m.creatorName,
        creatorRelation: m.creatorRelation,
        createdAt: m.createdAt,
        publishedAt: m.publishedAt,
      },
      viewer: { role, isAdmin: !!isAdmin, userId: viewer?.id ?? null },
      managers: m.managers.map((mm) => ({
        userId: mm.user.id,
        name: mm.user.name || mm.user.username || "Manager",
        username: mm.user.username,
        image: mm.user.image,
        role: mm.role,
      })),
      condolences,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/id] get failed:", err);
    return jsonError("Could not load the memorial", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  const role = await memorialRole(id, me.id);
  if (!role) return jsonError("Only the memorial managers can edit this memorial", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const data: Record<string, unknown> = {};
  const str = (key: string, max: number): string | null | undefined => {
    if (!(key in body)) return undefined;
    const v = body[key];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };

  const fullName = str("fullName", 120);
  if (fullName !== undefined && fullName !== null && fullName.length < 2) {
    return jsonError("Please enter the full name (2–120 characters)");
  }
  if (fullName !== undefined) data.fullName = fullName;

  for (const [key, max] of [
    ["photoUrl", 600], ["city", 80], ["state", 80], ["tribute", 500],
    ["lifeStory", 20000], ["milestones", 10000], ["qualities", 10000],
    ["verse", 500], ["verseRef", 120], ["creatorRelation", 80],
  ] as const) {
    const v = str(key, max);
    if (v !== undefined) data[key] = v;
  }

  for (const key of ["dob", "dod"] as const) {
    if (key in body) {
      const v = body[key];
      if (typeof v === "string" && v.trim()) {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return jsonError(`Invalid ${key === "dob" ? "date of birth" : "date of passing"}`);
        data[key] = d;
      } else {
        data[key] = null;
      }
    }
  }

  if ("gallery" in body) {
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
    data.gallery = JSON.stringify(gallery);
  }

  if ("visibility" in body) {
    const v = String(body.visibility);
    if (!["public", "unlisted", "private"].includes(v)) return jsonError("Invalid visibility");
    data.visibility = v;
  }

  if ("status" in body) {
    const s = String(body.status);
    // Managers may draft / publish / unpublish. Deleting is a separate route.
    if (!["draft", "published", "unpublished"].includes(s)) return jsonError("Invalid status");
    data.status = s;
    if (s === "published") data.publishedAt = new Date();
  }

  // Privacy guard on every free-text field being written.
  for (const key of ["tribute", "lifeStory", "milestones", "qualities"] as const) {
    const v = data[key];
    if (typeof v === "string" && v && containsPhoneNumber(v)) {
      return jsonError(
        `The ${key} looks like it contains a phone number. Please remove private contact details before saving.`,
      );
    }
  }

  if (Object.keys(data).length === 0) return jsonError("Nothing to update");

  try {
    const updated = await db.memorial.update({ where: { id }, data, select: { id: true, status: true } });
    return Response.json({ success: true, memorial: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Memorial not found", 404);
    console.error("[memorials/id] patch failed:", err);
    return jsonError("Could not update the memorial", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  const role = await memorialRole(id, me.id);
  // Only the OWNER (creator) or an admin may delete. Co-managers can unpublish.
  if (role !== "owner" && me.role !== "admin") {
    return jsonError("Only the memorial owner can delete this memorial", 403);
  }

  try {
    await db.memorial.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return jsonError("Memorial not found", 404);
    console.error("[memorials/id] delete failed:", err);
    return jsonError("Could not delete the memorial", 500);
  }
}
