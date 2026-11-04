import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * POST /api/admin/comics/[id]/panels/reorder
 *
 * Reorder the pages (panels) of a comic story. Body:
 *   { orderedPanelIds: string[] } — every panelId of this chapter, in the
 *   desired reading order. sortOrder is rewritten 1..N in that order.
 *
 * Validation: the list must contain every panel of the chapter exactly once
 * (no drops, no duplicates, no foreign panels) — a partial list would
 * silently corrupt the reading order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const orderedPanelIds = Array.isArray(body.orderedPanelIds)
      ? body.orderedPanelIds.filter((p: unknown) => typeof p === "string" && p.trim())
      : [];
    if (orderedPanelIds.length === 0) {
      return NextResponse.json({ error: "orderedPanelIds must be a non-empty array of panelIds" }, { status: 400 });
    }

    const chapter = await db.comicChapter.findUnique({
      where: { id },
      include: { panels: { select: { panelId: true } } },
    });
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const current = chapter.panels.map((p) => p.panelId);
    const submitted = orderedPanelIds as string[];

    const sameSet =
      current.length === submitted.length &&
      new Set(current).size === new Set(submitted).size &&
      current.every((pid) => submitted.includes(pid)) &&
      new Set(submitted).size === submitted.length;
    if (!sameSet) {
      return NextResponse.json(
        { error: "orderedPanelIds must contain every panel of this chapter exactly once" },
        { status: 400 }
      );
    }

    // Rewrite sortOrder 1..N in the submitted order. Sequential-per-panel
    // updates keep the invariant clear; panel counts are small (dozens).
    await db.$transaction(
      submitted.map((panelId, idx) =>
        db.comicPanel.updateMany({
          where: { panelId, comicChapterId: id },
          data: { sortOrder: idx + 1 },
        })
      )
    );

    const panels = await db.comicPanel.findMany({
      where: { comicChapterId: id },
      orderBy: { sortOrder: "asc" },
      select: { panelId: true, sortOrder: true },
    });

    return NextResponse.json({ success: true, panels });
  } catch (e: any) {
    console.error("[admin/comics/[id]/panels/reorder] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to reorder panels" }, { status: 500 });
  }
}
