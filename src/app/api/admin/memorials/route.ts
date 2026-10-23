import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * Admin: In Loving Memory management.
 *
 * GET   /api/admin/memorials?q=&status= — search ALL memorials (any status or
 *       visibility) with condolence/report counts. Admin only.
 * PATCH /api/admin/memorials { id, status: "unpublished" | "published" } —
 *       unpublish (hide) or restore a memorial. Administrators NEVER edit
 *       memorial content — moderation is limited to unpublish/restore so
 *       every action stays accountable and reversible.
 */
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
    const status = ["draft", "published", "unpublished"].includes(statusParam || "")
      ? statusParam!
      : null;

    const where: Record<string, unknown> = {};
    if (q) where.fullName = { contains: q, mode: "insensitive" };
    if (status) where.status = status;

    const rows = await db.memorial.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        city: true,
        state: true,
        visibility: true,
        status: true,
        creatorName: true,
        createdAt: true,
        creator: { select: { username: true, name: true, accountStatus: true } },
        _count: { select: { condolences: true } },
      },
    });

    // Reported memorials in the moderation queue (any report status).
    const reportCounts = await db.report.groupBy({
      by: ["targetId"],
      where: { targetType: "memorial", status: "pending" },
      _count: { id: true },
    });
    const reportMap = new Map(reportCounts.map((r) => [r.targetId, r._count.id]));

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
    const status = typeof body?.status === "string" ? body.status : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (!["published", "unpublished"].includes(status)) {
      return NextResponse.json(
        { error: "Admins may only unpublish or restore — status must be 'published' or 'unpublished'" },
        { status: 400 },
      );
    }

    const updated = await db.memorial.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
    return NextResponse.json({ success: true, memorial: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Memorial not found" }, { status: 404 });
    console.error("[admin/memorials] patch failed:", err);
    return NextResponse.json({ error: "Could not update the memorial" }, { status: 500 });
  }
}
