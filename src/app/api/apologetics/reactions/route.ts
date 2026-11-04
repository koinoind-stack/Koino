import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import {
  requireAuth,
  isTargetType,
  resolveTarget,
  createApologeticsNotification,
} from "@/lib/apologetics-server";

export const REACTION_KINDS = ["AMEN", "INSIGHTFUL"] as const;

/**
 * POST /api/apologetics/reactions  — toggle a reaction (auth required).
 * Body: { targetType: "article"|"question", targetId, kind: "AMEN"|"INSIGHTFUL", react?: boolean }
 *
 * Dedupe is DB-enforced (@@unique[targetType,targetId,userId,kind]); the write
 * is an upsert so re-reacting after un-reacting never duplicates. A
 * notification is sent to the content owner (never the actor, never a
 * duplicate for the same actor+type+target).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const user = auth.user;

    if (!rateLimit(`apologetics:react:${user.id}`, 30, 60_000)) {
      return NextResponse.json(
        { error: "Too many reactions — slow down a little." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { targetType, targetId, kind } = body;
    const react = body.react === false ? false : true;

    if (!isTargetType(targetType)) {
      return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
    }
    if (typeof targetId !== "string" || !targetId.trim()) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }
    if (!REACTION_KINDS.includes(kind)) {
      return NextResponse.json(
        { error: `Invalid kind. Must be one of: ${REACTION_KINDS.join(", ")}` },
        { status: 400 }
      );
    }

    const target = await resolveTarget(targetType, targetId);
    if (!target.exists) {
      return NextResponse.json(
        { error: "Target not found or not publicly visible" },
        { status: 404 }
      );
    }

    if (!react) {
      await db.apologeticsReaction.deleteMany({
        where: { targetType, targetId, userId: user.id, kind },
      });
      const count = await db.apologeticsReaction.count({
        where: { targetType, targetId, kind },
      });
      return NextResponse.json({ success: true, reacted: false, count });
    }

    // Upsert — the unique constraint makes this idempotent.
    await db.apologeticsReaction.upsert({
      where: {
        targetType_targetId_userId_kind: { targetType, targetId, userId: user.id, kind },
      },
      create: { targetType, targetId, userId: user.id, kind },
      update: {}, // already exists — no-op
    });

    // Notify the owner (deduped inside the helper; skips self).
    if (target.ownerUserId) {
      await createApologeticsNotification({
        userId: target.ownerUserId,
        actorId: user.id,
        type: "apologetics_reaction",
        targetType: targetType === "article" ? "apologetics_article" : "apologetics_question",
        targetId,
        href: target.href,
      });
    }

    const count = await db.apologeticsReaction.count({
      where: { targetType, targetId, kind },
    });
    return NextResponse.json({ success: true, reacted: true, count });
  } catch (error: any) {
    console.error("[api/apologetics/reactions POST] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to react" },
      { status: 500 }
    );
  }
}
