import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * Admin reports queue — review reported posts / comments / users / stories.
 *
 * GET   /api/admin/reports?status=pending|reviewed|dismissed  (default: pending)
 * PATCH /api/admin/reports  body: { id, status }  → set review outcome
 *
 * Server-side admin check via getAuthUser(). NEVER trust client roles.
 * Degrades to an empty queue when the Report table is not created yet.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const status = ["pending", "reviewed", "dismissed"].includes(statusParam || "")
      ? statusParam!
      : "pending";

    const reports = await db.report.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
        reporter: { select: { name: true, username: true, image: true } },
      },
    });

    // Resolve target previews per type (best-effort; deleted targets show as removed)
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let preview: string | null = null;
        let targetAuthor: string | null = null;
        try {
          if (r.targetType === "post") {
            const p = await db.post.findUnique({
              where: { id: r.targetId },
              select: { content: true, author: { select: { username: true, name: true } } },
            });
            if (p) {
              preview = p.content?.slice(0, 140) || "(media post)";
              targetAuthor = p.author?.username || p.author?.name || null;
            }
          } else if (r.targetType === "comment") {
            const c = await db.postComment.findUnique({
              where: { id: r.targetId },
              select: {
                content: true,
                user: { select: { username: true, name: true } },
              },
            });
            if (c) {
              preview = c.content.slice(0, 140);
              targetAuthor = c.user?.username || c.user?.name || null;
            }
          } else if (r.targetType === "user") {
            const u = await db.user.findUnique({
              where: { id: r.targetId },
              select: { username: true, name: true, bio: true },
            });
            if (u) {
              preview = u.bio?.slice(0, 140) || null;
              targetAuthor = u.username || u.name || null;
            }
          } else if (r.targetType === "story") {
            const st = await db.story.findUnique({
              where: { id: r.targetId },
              select: { caption: true, user: { select: { username: true, name: true } } },
            }).catch(() => null);
            if (st) {
              preview = (st as { caption?: string | null }).caption?.slice(0, 140) || "(story)";
              targetAuthor = (st as { user?: { username?: string | null; name?: string | null } }).user?.username || null;
            }
          } else if (r.targetType === "prayer") {
            const pr = await db.prayerRequest
              .findUnique({ where: { id: r.targetId }, select: { title: true, content: true } })
              .catch(() => null);
            if (pr) {
              preview = `${pr.title} — ${pr.content.slice(0, 120)}`;
              targetAuthor = "Prayer Wall";
            }
          } else if (r.targetType === "prayer_comment") {
            const pc = await db.prayerComment
              .findUnique({ where: { id: r.targetId }, select: { body: true } })
              .catch(() => null);
            if (pc) {
              preview = pc.body.slice(0, 140);
              targetAuthor = "Prayer Wall comment";
            }
          } else if (r.targetType === "video") {
            const vid = await db.video.findUnique({
              where: { id: r.targetId },
              select: { title: true, summary: true },
            }).catch(() => null);
            if (vid) {
              preview = vid.summary?.slice(0, 140) || vid.title.slice(0, 140);
              targetAuthor = "Video library";
            }
          }
        } catch {
          // target gone or table locked — preview stays null
        }
        return { ...r, targetGone: preview === null && !targetAuthor, preview, targetAuthor };
      }),
    );

    return NextResponse.json({ reports: enriched });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e?.code === "P2021" || /does not exist/i.test(e?.message || "")) {
      return NextResponse.json({ reports: [] });
    }
    console.error("[api/admin/reports] GET failed:", err);
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    let body: { id?: string; status?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { id } = body;
    const status = body.status;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (!["pending", "reviewed", "dismissed"].includes(status || "")) {
      return NextResponse.json({ error: "status must be pending | reviewed | dismissed" }, { status: 400 });
    }

    const updated = await db.report
      .update({ where: { id }, data: { status: status! }, select: { id: true, status: true } })
      .catch(() => null);
    if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[api/admin/reports] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
