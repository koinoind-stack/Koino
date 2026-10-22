import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * PATCH /api/admin/comics/[id]/panels/[panelId]
 *
 * Update a single panel's editable fields. The chapter id in the URL is
 * redundant (panelId is globally unique) but kept in the route for clarity.
 *
 * Body (any subset):
 *   verseStart, verseEnd, artworkUrl, altText, audioUrl, videoUrl, sortOrder
 *
 * Book + chapter cannot be changed here (they're denormalized from the
 * chapter — to move a panel across chapters, delete it and recreate).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; panelId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id, panelId } = await params;
    const body = await req.json();

    const panel = await db.comicPanel.findFirst({
      where: { panelId, comicChapterId: id },
    });
    if (!panel) {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }

    const data: any = {};

    if (body.verseStart !== undefined) {
      const vs = parseInt(body.verseStart, 10);
      if (isNaN(vs) || vs < 1) {
        return NextResponse.json({ error: "verseStart must be a positive integer" }, { status: 400 });
      }
      data.verseStart = vs;
    }
    if (body.verseEnd !== undefined) {
      const ve = parseInt(body.verseEnd, 10);
      if (isNaN(ve) || ve < 1) {
        return NextResponse.json({ error: "verseEnd must be a positive integer" }, { status: 400 });
      }
      data.verseEnd = ve;
    }
    // Cross-check verse range if both are being updated (or one is and we know the other)
    const finalVs = data.verseStart ?? panel.verseStart;
    const finalVe = data.verseEnd ?? panel.verseEnd;
    if (finalVe < finalVs) {
      return NextResponse.json({ error: "verseEnd must be >= verseStart" }, { status: 400 });
    }

    if (body.artworkUrl !== undefined) {
      if (typeof body.artworkUrl !== "string" || body.artworkUrl.trim().length < 1) {
        return NextResponse.json({ error: "artworkUrl cannot be empty" }, { status: 400 });
      }
      data.artworkUrl = body.artworkUrl.trim();
    }
    if (body.altText !== undefined) {
      data.altText =
        typeof body.altText === "string" && body.altText.trim() ? body.altText.trim() : null;
    }
    if (body.audioUrl !== undefined) {
      data.audioUrl =
        typeof body.audioUrl === "string" && body.audioUrl.trim() ? body.audioUrl.trim() : null;
    }
    if (body.videoUrl !== undefined) {
      data.videoUrl =
        typeof body.videoUrl === "string" && body.videoUrl.trim() ? body.videoUrl.trim() : null;
    }
    if (typeof body.sortOrder === "number" && !isNaN(body.sortOrder)) {
      data.sortOrder = body.sortOrder;
    }

    const updated = await db.comicPanel.update({ where: { id: panel.id }, data });

    return NextResponse.json({ success: true, panelId: updated.panelId });
  } catch (e: any) {
    console.error("[admin/comics/[id]/panels/[panelId]] PATCH error:", e);
    return NextResponse.json({ error: e.message || "Failed to update panel" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/comics/[id]/panels/[panelId]
 *
 * Hard-delete a panel. The Prisma schema cascades this to delete the panel's
 * translations automatically.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; panelId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id, panelId } = await params;

    const panel = await db.comicPanel.findFirst({
      where: { panelId, comicChapterId: id },
    });
    if (!panel) {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }

    await db.comicPanel.delete({ where: { id: panel.id } });

    return NextResponse.json({ success: true, deletedPanelId: panelId });
  } catch (e: any) {
    console.error("[admin/comics/[id]/panels/[panelId]] DELETE error:", e);
    return NextResponse.json({ error: e.message || "Failed to delete panel" }, { status: 500 });
  }
}
