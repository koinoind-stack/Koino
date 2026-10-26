import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * Admin: memorial video moderation.
 *
 * GET    /api/admin/memorials/videos?status=pending — the review queue with
 *        memorial names. Status ∈ pending | approved | rejected (default all).
 * PATCH  /api/admin/memorials/videos { id, status: "approved" | "rejected",
 *        rejectionReason? } — approve or reject a video. Rejected videos are
 *        hidden from the public memorial page immediately.
 * DELETE /api/admin/memorials/videos?id= — remove a video entirely
 *        (unauthorized uploads, inappropriate content).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const statusParam = new URL(req.url).searchParams.get("status");
    const status = ["pending", "approved", "rejected"].includes(statusParam || "")
      ? statusParam!
      : null;

    const rows = await db.memorialVideo.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        memorialId: true,
        videoId: true,
        url: true,
        title: true,
        description: true,
        category: true,
        status: true,
        rejectionReason: true,
        addedByName: true,
        createdAt: true,
        memorial: { select: { fullName: true, status: true } },
      },
    });

    // Safe preview data: thumbnails come from YouTube's image CDN — no embed,
    // no autoplay, nothing plays until an admin chooses to.
    return NextResponse.json({
      videos: rows.map((v) => ({
        ...v,
        thumbUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        watchUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
      })),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ videos: [] });
    }
    console.error("[admin/memorials/videos] list failed:", err);
    return NextResponse.json({ error: "Could not load videos" }, { status: 500 });
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
    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      status,
      moderatedAt: new Date(),
      rejectionReason: null,
    };
    if (status === "rejected") {
      const reason =
        typeof body?.rejectionReason === "string" && body.rejectionReason.trim()
          ? body.rejectionReason.trim().slice(0, 500)
          : "Does not fit this memorial";
      data.rejectionReason = reason;
    }

    const updated = await db.memorialVideo.update({
      where: { id },
      data,
      select: { id: true, status: true },
    });
    return NextResponse.json({ success: true, video: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Video not found" }, { status: 404 });
    console.error("[admin/memorials/videos] patch failed:", err);
    return NextResponse.json({ error: "Could not update the video" }, { status: 500 });
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

    await db.memorialVideo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Video not found" }, { status: 404 });
    console.error("[admin/memorials/videos] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the video" }, { status: 500 });
  }
}
