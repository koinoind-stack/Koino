import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/apologetics-server";

/**
 * GET /api/admin/engagement — admin moderation data.
 *   ?tab=comments  → all apologetics comments (any status), newest first
 *   ?tab=reports   → apologetics reports (pending first)
 * Response: { comments: [...] } or { reports: [...] }
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "comments";

    if (tab === "reports") {
      let reports: any[] = [];
      try {
        reports = await db.report.findMany({
          where: { targetType: { in: ["apologetics_article", "apologetics_question", "apologetics_comment"] } },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: 200,
        });
      } catch (e: any) {
        // Report table always exists — but be tolerant anyway
        if (!/does not exist/i.test(e?.message || "")) throw e;
      }
      return NextResponse.json({
        reports: reports.map((r) => ({
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }

    // comments (default)
    let comments: any[] = [];
    try {
      comments = await db.apologeticsComment.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    } catch (e: any) {
      const msg = e?.message || "";
      if (e?.code === "P2021" || e?.code === "P2022" || /does not exist/i.test(msg)) {
        return NextResponse.json({ comments: [], migrationPending: true });
      }
      throw e;
    }
    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        targetType: c.targetType,
        targetId: c.targetId,
        parentId: c.parentId,
        authorName: c.authorName,
        body: c.body,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[api/admin/engagement GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load moderation data" }, { status: 500 });
  }
}

/**
 * POST /api/admin/engagement — moderation actions.
 * Body: { kind, id }
 *   kind:
 *     "comment_hide"    → comment status "hidden" (invisible to the public,
 *                          retained for the audit trail)
 *     "comment_unhide"  → back to "visible"
 *     "comment_delete"  → hard delete (cascades to replies)
 *     "report_resolve"  → Report.status = "reviewed"
 *     "report_dismiss"  → Report.status = "dismissed"
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const body = await req.json();
    const { kind, id } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    switch (kind) {
      case "comment_hide": {
        const c = await db.apologeticsComment.update({
          where: { id },
          data: { status: "hidden" },
        });
        try { revalidatePath("/", "layout"); } catch {}
        return NextResponse.json({ success: true, status: c.status });
      }
      case "comment_unhide": {
        const c = await db.apologeticsComment.update({
          where: { id },
          data: { status: "visible" },
        });
        try { revalidatePath("/", "layout"); } catch {}
        return NextResponse.json({ success: true, status: c.status });
      }
      case "comment_delete": {
        await db.apologeticsComment.delete({ where: { id } });
        try { revalidatePath("/", "layout"); } catch {}
        return NextResponse.json({ success: true, deleted: true });
      }
      case "report_resolve": {
        await db.report.update({ where: { id }, data: { status: "reviewed" } });
        return NextResponse.json({ success: true, status: "reviewed" });
      }
      case "report_dismiss": {
        await db.report.update({ where: { id }, data: { status: "dismissed" } });
        return NextResponse.json({ success: true, status: "dismissed" });
      }
      default:
        return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[api/admin/engagement POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to moderate" }, { status: 500 });
  }
}
