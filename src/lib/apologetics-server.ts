import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

// ─── Apologetics PART 2: shared server helpers ──────────────────────────────

export type ApologeticsUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

/** Same auth shape as the admin routes: 401 vs 403 with clear messages. */
export async function requireAuth(): Promise<
  { user: ApologeticsUser; response: null } | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  return {
    user: { id: user.id, email: user.email, name: user.name ?? null, role: user.role },
    response: null,
  };
}

export async function requireAdmin(): Promise<
  { user: ApologeticsUser; response: null } | { user: null; response: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.response) return auth;
  if (auth.user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return auth;
}

/**
 * Server-side contributor guard for /api/contributor/* routes. Requires the
 * signed-in user to have an APPROVED Contributor record that still carries the
 * given permission. Never trust the client — this is the single gate.
 */
export async function requireContributor(
  permission?: string
): Promise<
  | { contributor: { id: string; userId: string; displayName: string; slug: string; verified: boolean }; response: null }
  | { contributor: null; response: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.response) return { contributor: null, response: auth.response };

  const contributor = await db.contributor.findUnique({
    where: { userId: auth.user.id },
  });
  if (!contributor || contributor.status !== "approved") {
    return {
      contributor: null,
      response: NextResponse.json(
        { error: "Approved contributor access required" },
        { status: 403 }
      ),
    };
  }
  if (permission) {
    let perms: string[] = [];
    try {
      const parsed = JSON.parse(contributor.permissions || "[]");
      if (Array.isArray(parsed)) perms = parsed.map(String);
    } catch {
      // malformed permissions → treat as empty
    }
    if (!perms.includes(permission)) {
      return {
        contributor: null,
        response: NextResponse.json(
          { error: `Missing permission: ${permission}` },
          { status: 403 }
        ),
      };
    }
  }
  return {
    contributor: {
      id: contributor.id,
      userId: contributor.userId,
      displayName: contributor.displayName,
      slug: contributor.slug,
      verified: contributor.verified,
    },
    response: null,
  };
}

// ─── Notifications (existing model, new apologetics types) ──────────────────

export type ApologeticsNotificationInput = {
  userId: string; // recipient
  actorId: string | null; // who triggered it
  type:
    | "apologetics_comment"
    | "apologetics_reply"
    | "apologetics_reaction"
    | "apologetics_submission"
    | "apologetics_review";
  targetType: "apologetics_article" | "apologetics_question" | "apologetics_comment";
  targetId: string;
  href?: string | null;
};

/**
 * Create a notification for the apologetics engagement types, with an
 * exists-check so the same actor can't spam duplicates for the same
 * (recipient, type, target) — e.g. reacting, un-reacting and re-reacting.
 * Never notifies the actor about their own action.
 */
export async function createApologeticsNotification(
  input: ApologeticsNotificationInput
): Promise<void> {
  try {
    if (input.actorId && input.actorId === input.userId) return; // no self-notify

    const existing = await db.notification.findFirst({
      where: {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        targetId: input.targetId,
      },
      select: { id: true },
    });
    if (existing) return; // dedupe

    await db.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? undefined,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        href: input.href ?? null,
      },
    });
  } catch (e) {
    // Notifications must never break the main action — log and continue.
    console.error("[apologetics/notifications] create failed:", e);
  }
}

// ─── Target resolution ───────────────────────────────────────────────────────

export const APOLOGETICS_TARGET_TYPES = ["article", "question"] as const;
export type ApologeticsTargetType = (typeof APOLOGETICS_TARGET_TYPES)[number];

export function isTargetType(v: unknown): v is ApologeticsTargetType {
  return v === "article" || v === "question";
}

/**
 * Verify a reaction/comment/bookmark target actually exists and is publicly
 * visible (published article / answered question). Returns the owner userId
 * (when one exists) for notification routing.
 */
export async function resolveTarget(
  targetType: ApologeticsTargetType,
  targetId: string
): Promise<{ exists: boolean; ownerUserId: string | null; href: string | null }> {
  if (targetType === "article") {
    const article = await db.koinoArticle.findUnique({
      where: { id: targetId },
      select: { id: true, status: true, contentType: true, slug: true, authorId: true },
    });
    if (!article || article.status !== "published" || article.contentType !== "APOLOGETICS") {
      return { exists: false, ownerUserId: null, href: null };
    }
    let ownerUserId: string | null = null;
    if (article.authorId) {
      const contributor = await db.contributor.findUnique({
        where: { id: article.authorId },
        select: { userId: true },
      });
      ownerUserId = contributor?.userId ?? null;
    }
    return { exists: true, ownerUserId, href: `/apologetics/${article.slug}` };
  }

  // question
  const question = await db.userQuestion.findUnique({
    where: { id: targetId },
    select: { id: true, status: true, askerUserId: true },
  });
  if (!question || question.status !== "answered") {
    return { exists: false, ownerUserId: null, href: null };
  }
  return {
    exists: true,
    ownerUserId: question.askerUserId,
    href: `/?view=apologetics&question=${question.id}`,
  };
}
