import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apologetics-server";

// ─── Prayer Wall shared server helpers ──────────────────────────────────────
// Reuses the existing auth stack (requireAuth/requireAdmin) and the existing
// Notification model. Anonymous identity NEVER leaves the server through
// public shapes — see publicPrayer / publicComment below.

export const PRAYER_CATEGORIES = [
  "Healing", "Family", "Guidance", "Thanksgiving", "Salvation", "Provision",
] as const;

export type PrayerDb = {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  isAnonymous: boolean;
  status: string;
  answered: boolean;
  testimony: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  _count?: { prayers: number; comments: number };
  user?: { id: string; name: string | null; username: string | null } | null;
};

/**
 * Public shape of a prayer request. When isAnonymous is true the author's
 * name/username/id are stripped — no code path may add them back.
 * `isMine`/`canModerate` are computed from the server session (never client).
 */
export function publicPrayer(
  p: PrayerDb,
  viewer: { id: string; role: string } | null
) {
  const mine = !!viewer && p.userId === viewer.id;
  const author = p.isAnonymous
    ? null // anonymous: identity stripped server-side
    : {
        name: p.user?.name || p.user?.username || "Member",
        username: p.user?.username || null,
      };
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    category: p.category,
    isAnonymous: p.isAnonymous,
    status: p.status,
    answered: p.answered,
    testimony: p.testimony,
    answeredAt: p.answeredAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    prayCount: p._count?.prayers ?? 0,
    commentCount: p._count?.comments ?? 0,
    author, // null when anonymous
    isMine: mine,
    canModerate: !!viewer && viewer.role === "admin",
  };
}

/** Public shape of a comment (commenters are never anonymous). */
export function publicComment(
  c: {
    id: string; parentId: string | null; body: string; status: string;
    createdAt: Date; userId: string;
    user?: { name: string | null; username: string | null } | null;
  },
  viewer: { id: string; role: string } | null
) {
  return {
    id: c.id,
    parentId: c.parentId,
    body: c.body,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    author: { name: c.user?.name || c.user?.username || "Member" },
    isMine: !!viewer && c.userId === viewer.id,
    canModerate: !!viewer && viewer.role === "admin",
  };
}

/**
 * Create a notification on the EXISTING Notification model (non-fatal on
 * failure). The Notification model carries no message text — the type +
 * actor are resolved to copy/icons by NotificationsView. Caller must do an
 * exists-check upstream so repeat actions never duplicate notifications.
 */
export async function notifyPrayer(opts: {
  userId: string; // recipient (prayer author / parent-comment author)
  actorId: string | null; // who triggered it
  type: string; // prayer_prayed | prayer_comment | prayer_reply
  prayerId: string;
}) {
  try {
    // Duplicate guard: identical recipient+type+target+actor never re-notifies.
    const dup = await db.notification.findFirst({
      where: { userId: opts.userId, type: opts.type, targetId: opts.prayerId, actorId: opts.actorId },
      select: { id: true },
    });
    if (dup) return;
    await db.notification.create({
      data: {
        userId: opts.userId,
        actorId: opts.actorId,
        type: opts.type,
        targetType: "prayer_request",
        targetId: opts.prayerId,
        href: `/?view=prayer-wall&prayer=${opts.prayerId}`,
      },
    });
  } catch (err) {
    console.error("[prayers] notification failed (non-fatal):", err);
  }
}

export { requireAuth };
