import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * Admin: In Loving Memory management.
 *
 * GET   /api/admin/memorials?q=&status=&filter= — search ALL memorials (any
 *       status or visibility) with condolence/report counts.
 *       status ∈ draft|pending|published|rejected|unpublished
 *       filter=reported → only memorials with pending reports
 *
 * PATCH /api/admin/memorials — action-based moderation (admin only):
 *       { id, action: "approve" }                     → published (review passed)
 *       { id, action: "reject", rejectionReason }     → rejected (family sees the reason)
 *       { id, action: "unpublish" }                   → hidden
 *       { id, action: "restore" }                     → published again
 *       { id, action: "edit", edit: { ...fields } }   → fix critical content issues
 *                                                       (fullName, tribute, lifeStory,
 *                                                        milestones, qualities, verse,
 *                                                        verseRef, testimony)
 *       Every action records moderatedAt so the moderation trail is auditable.
 *
 * DELETE /api/admin/memorials?id= — remove a memorial entirely (reports of
 *       impersonation / no family permission). Cascades videos, candles,
 *       condolences, hearts (DB foreign keys).
 */
const EDITABLE_FIELDS = [
  "fullName", "tribute", "lifeStory", "milestones",
  "qualities", "verse", "verseRef", "testimony",
] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const filter = searchParams.get("filter");
    const status = ["draft", "pending", "published", "rejected", "unpublished"].includes(statusParam || "")
      ? statusParam!
      : null;

    const where: Record<string, unknown> = {};
    if (q) where.fullName = { contains: q, mode: "insensitive" };
    if (status) where.status = status;

    let rows = await db.memorial.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        city: true,
        state: true,
        tribute: true,
        lifeStory: true,
        milestones: true,
        qualities: true,
        verse: true,
        verseRef: true,
        testimony: true,
        gallery: true,
        rejectionReason: true,
        visibility: true,
        status: true,
        creatorName: true,
        creatorRelation: true,
        createdAt: true,
        moderatedAt: true,
        creator: { select: { username: true, name: true, accountStatus: true } },
        _count: { select: { condolences: true, videos: true, candles: true } },
      },
    });

    // Reported memorials in the moderation queue (any report status).
    const reportCounts = await db.report.groupBy({
      by: ["targetId"],
      where: { targetType: "memorial", status: "pending" },
      _count: { id: true },
    });
    const reportMap = new Map(reportCounts.map((r) => [r.targetId, r._count.id]));

    if (filter === "reported") {
      rows = rows.filter((m) => (reportMap.get(m.id) || 0) > 0);
    }

    return NextResponse.json({
      memorials: rows.map((m) => ({
        ...m,
        pendingReports: reportMap.get(m.id) || 0,
      })),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ memorials: [] });
    }
    console.error("[admin/memorials] list failed:", err);
    return NextResponse.json({ error: "Could not load memorials" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const action = typeof body?.action === "string" ? body.action : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const now = new Date();

    if (action === "approve" || action === "restore") {
      const updated = await db.memorial.update({
        where: { id },
        data: {
          status: "published",
          publishedAt: action === "approve" ? now : undefined,
          rejectionReason: null,
          moderatedAt: now,
        },
        select: { id: true, status: true },
      });
      return NextResponse.json({ success: true, memorial: updated });
    }

    if (action === "reject") {
      const reason =
        typeof body?.rejectionReason === "string" && body.rejectionReason.trim()
          ? body.rejectionReason.trim().slice(0, 500)
          : "";
      if (!reason) {
        return NextResponse.json(
          { error: "Please give the family a short reason so they can fix the memorial" },
          { status: 400 },
        );
      }
      const updated = await db.memorial.update({
        where: { id },
        data: { status: "rejected", rejectionReason: reason, moderatedAt: now },
        select: { id: true, status: true },
      });
      return NextResponse.json({ success: true, memorial: updated });
    }

    if (action === "unpublish") {
      const updated = await db.memorial.update({
        where: { id },
        data: { status: "unpublished", moderatedAt: now },
        select: { id: true, status: true },
      });
      return NextResponse.json({ success: true, memorial: updated });
    }

    if (action === "edit") {
      const edit = body?.edit && typeof body.edit === "object" ? body.edit : null;
      if (!edit) return NextResponse.json({ error: "edit object is required" }, { status: 400 });
      const data: Record<string, unknown> = { moderatedAt: now };
      for (const key of EDITABLE_FIELDS) {
        if (typeof edit[key] === "string") {
          const t = (edit[key] as string).trim();
          data[key] = t ? t : null;
        }
      }
      if (Object.keys(data).length === 1) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }
      const updated = await db.memorial.update({ where: { id }, data, select: { id: true, status: true } });
      return NextResponse.json({ success: true, memorial: updated });
    }

    return NextResponse.json(
      { error: "action must be approve | reject | unpublish | restore | edit" },
      { status: 400 },
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Memorial not found" }, { status: 404 });
    console.error("[admin/memorials] patch failed:", err);
    return NextResponse.json({ error: "Could not update the memorial" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await db.memorial.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Memorial not found" }, { status: 404 });
    console.error("[admin/memorials] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the memorial" }, { status: 500 });
  }
}
