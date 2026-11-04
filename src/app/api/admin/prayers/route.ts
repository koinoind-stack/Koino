import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";

/**
 * GET /api/admin/prayers — admin-only list of ALL prayer requests
 * (visible/hidden/removed) WITH real author identity. Anonymous requests
 * show their true author here — moderation needs it, and this route is
 * admin-gated on the server. Also returns pending reports for prayers.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const prayers = await db.prayerRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, username: true, email: true } },
        _count: { select: { prayers: true, comments: true } },
      },
    });

    const reports = await db.report.findMany({
      where: { targetType: { in: ["prayer", "prayer_comment"] }, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { reporter: { select: { name: true, username: true } } },
    });

    const reportPreviews = await Promise.all(
      reports.map(async (r) => {
        if (r.targetType === "prayer") {
          const p = await db.prayerRequest.findUnique({
            where: { id: r.targetId }, select: { title: true, content: true },
          });
          return { ...r, preview: p ? `${p.title} — ${p.content.slice(0, 120)}` : null };
        }
        const c = await db.prayerComment.findUnique({
          where: { id: r.targetId }, select: { body: true },
        });
        return { ...r, preview: c?.body.slice(0, 140) ?? null };
      })
    );

    return NextResponse.json({
      prayers: prayers.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        category: p.category,
        isAnonymous: p.isAnonymous,
        status: p.status,
        answered: p.answered,
        testimony: p.testimony,
        createdAt: p.createdAt.toISOString(),
        prayCount: p._count.prayers,
        commentCount: p._count.comments,
        // Real identity — admin only (this endpoint is server-gated).
        author: {
          name: p.user.name || p.user.username || "Member",
          username: p.user.username,
          email: p.user.email,
        },
      })),
      reports: reportPreviews.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
        preview: r.preview,
        reporter: r.reporter?.name || r.reporter?.username || "Member",
      })),
    });
  } catch (err) {
    console.error("[api/admin/prayers] GET failed:", err);
    return NextResponse.json({ error: "Failed to load prayers" }, { status: 500 });
  }
}
