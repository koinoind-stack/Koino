import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";

/**
 * GET /api/apologetics/engagement — public batch counts for the hub and the
 * article page, plus the current user's own reactions/bookmarks when signed in.
 *
 * Query: ?articles=<id1,id2>&questions=<id1,id2>
 * (pass whichever ids are on screen; both optional)
 *
 * Response: {
 *   articles: { [id]: { AMEN: n, INSIGHTFUL: n, comments: n } },
 *   questions: { [id]: { AMEN: n, INSIGHTFUL: n, comments: n } },
 *   my: { reactions: {[id]: kind[]}, bookmarks: string[] }   // signed-in only
 * }
 *
 * Degrades gracefully to empty counts when the PART 2 tables don't exist yet
 * (migration window).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const articleIds = (searchParams.get("articles") || "")
      .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
    const questionIds = (searchParams.get("questions") || "")
      .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);

    const empty = { ok: true, articles: {}, questions: {}, my: undefined };

    if (articleIds.length === 0 && questionIds.length === 0) {
      return NextResponse.json(empty);
    }

    const articles: Record<string, { AMEN: number; INSIGHTFUL: number; comments: number }> = {};
    const questions: Record<string, { AMEN: number; INSIGHTFUL: number; comments: number }> = {};
    for (const id of articleIds) articles[id] = { AMEN: 0, INSIGHTFUL: 0, comments: 0 };
    for (const id of questionIds) questions[id] = { AMEN: 0, INSIGHTFUL: 0, comments: 0 };

    try {
      const grouped = await db.apologeticsReaction.groupBy({
        by: ["targetType", "targetId", "kind"],
        where: {
          OR: [
            ...(articleIds.length ? [{ targetType: "article", targetId: { in: articleIds } }] : []),
            ...(questionIds.length ? [{ targetType: "question", targetId: { in: questionIds } }] : []),
          ],
        },
        _count: { _all: true },
      });
      for (const g of grouped) {
        const bucket = g.targetType === "article" ? articles[g.targetId] : questions[g.targetId];
        if (bucket) bucket[g.kind] = g._count._all;
      }

      const commentCounts = await db.apologeticsComment.groupBy({
        by: ["targetType", "targetId"],
        where: {
          status: "visible",
          OR: [
            ...(articleIds.length ? [{ targetType: "article", targetId: { in: articleIds } }] : []),
            ...(questionIds.length ? [{ targetType: "question", targetId: { in: questionIds } }] : []),
          ],
        },
        _count: { _all: true },
      });
      for (const c of commentCounts) {
        const bucket = c.targetType === "article" ? articles[c.targetId] : questions[c.targetId];
        if (bucket) bucket.comments = c._count._all;
      }
    } catch (e: any) {
      // Migration window — PART 2 tables not created yet. Return zeros so the
      // page renders normally instead of erroring.
      const msg = e?.message || "";
      if (e?.code === "P2021" || e?.code === "P2022" || /does not exist/i.test(msg)) {
        return NextResponse.json(empty);
      }
      throw e;
    }

    // Current user's own reactions + bookmarks (best-effort; anonymous → my: undefined)
    let my: { reactions: Record<string, string[]>; bookmarks: string[] } | undefined;
    const user = await getAuthUser();
    if (user) {
      try {
        const myReactions = await db.apologeticsReaction.findMany({
          where: {
            userId: user.id,
            OR: [
              ...(articleIds.length ? [{ targetType: "article" as const, targetId: { in: articleIds } }] : []),
              ...(questionIds.length ? [{ targetType: "question" as const, targetId: { in: questionIds } }] : []),
            ],
          },
          select: { targetType: true, targetId: true, kind: true },
        });
        const reactions: Record<string, string[]> = {};
        for (const r of myReactions) {
          reactions[r.targetId] = reactions[r.targetId] || [];
          reactions[r.targetId].push(r.kind);
        }
        const myBookmarks = await db.apologeticsBookmark.findMany({
          where: {
            userId: user.id,
            OR: [
              ...(articleIds.length ? [{ targetType: "article" as const, targetId: { in: articleIds } }] : []),
              ...(questionIds.length ? [{ targetType: "question" as const, targetId: { in: questionIds } }] : []),
            ],
          },
          select: { targetId: true },
        });
        my = { reactions, bookmarks: myBookmarks.map((b) => b.targetId) };
      } catch {
        // migration window — skip personalization
      }
    }

    return NextResponse.json({ ok: true, articles, questions, my });
  } catch (error: any) {
    console.error("[api/apologetics/engagement GET] Error:", error);
    return NextResponse.json({ error: "Failed to load engagement data" }, { status: 500 });
  }
}
