import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import { syncArticleFeedWrapper, createArticleNotification } from "@/lib/blog-server";

/**
 * POST /api/admin/blog/[id]/moderate
 *
 * Admin-only workflow actions on a blog article (spec §3):
 *   publish          — approve & publish (status→published, published=true,
 *                      publishedAt=now, publisher recorded, feed card synced,
 *                      author notified)
 *   unpublish        — remove from public (status→draft, published=false,
 *                      feed card hidden; engagement preserved)
 *   feature          — feature on Blog page + feed ordering
 *   unfeature
 *   request_changes  — status→changes_requested + feedback to the author
 *   reject           — status→rejected + reason to the author
 *   archive          — status→archived, published=false (feed hidden)
 *
 * Authorization follows the exact server-side pattern used by every
 * /api/admin/* route (getAuthUser + role check). Client-sent status values,
 * author IDs and timestamps are ignored entirely.
 */

export const dynamic = "force-dynamic";

const moderateSchema = z.object({
  action: z.enum([
    "publish",
    "unpublish",
    "feature",
    "unfeature",
    "request_changes",
    "reject",
    "archive",
  ]),
  feedback: z.string().trim().max(2000).optional(),
});

const REVIEW_ACTIONS = ["request_changes", "reject", "archive"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Authorization (server-side admin gate, uniform admin-route pattern) ──
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (!rateLimit(`blog-moderate:${user.id}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many actions. Slow down." }, { status: 429 });
  }

  // ── Input ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = moderateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid moderation action." },
      { status: 400 }
    );
  }
  const { action, feedback } = parsed.data;

  if ((REVIEW_ACTIONS as readonly string[]).includes(action) && !feedback) {
    return NextResponse.json(
      {
        error:
          action === "reject"
            ? "Please provide a rejection reason."
            : "Please describe the changes you're requesting.",
      },
      { status: 400 }
    );
  }

  const article = await db.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      content: true,
      published: true,
      status: true,
      publishedAt: true,
      authorId: true,
    },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }

  const now = new Date();
  let updated;
  let notifyType: "article_published" | "article_rejected" | "article_changes_requested" | null = null;

  switch (action) {
    case "publish": {
      updated = await db.blogPost.update({
        where: { id },
        data: {
          status: "published",
          published: true,
          publishedAt: now,
          publishedById: user.id,
          reviewedById: user.id,
          reviewedAt: now,
          reviewNotes: feedback || null,
          // Publishing clears a legacy schedule (see share-card gate note).
          scheduledAt: null,
        },
      });
      notifyType = "article_published";
      break;
    }
    case "unpublish": {
      updated = await db.blogPost.update({
        where: { id },
        data: {
          status: "draft",
          published: false,
          publishedAt: null,
          reviewedById: user.id,
          reviewedAt: now,
        },
      });
      break;
    }
    case "feature": {
      updated = await db.blogPost.update({
        where: { id },
        data: { featured: true },
      });
      break;
    }
    case "unfeature": {
      updated = await db.blogPost.update({
        where: { id },
        data: { featured: false },
      });
      break;
    }
    case "request_changes": {
      updated = await db.blogPost.update({
        where: { id },
        data: {
          status: "changes_requested",
          published: false,
          publishedAt: null,
          reviewNotes: feedback!,
          reviewedById: user.id,
          reviewedAt: now,
        },
      });
      notifyType = "article_changes_requested";
      break;
    }
    case "reject": {
      updated = await db.blogPost.update({
        where: { id },
        data: {
          status: "rejected",
          published: false,
          publishedAt: null,
          reviewNotes: feedback!,
          reviewedById: user.id,
          reviewedAt: now,
        },
      });
      notifyType = "article_rejected";
      break;
    }
    case "archive": {
      updated = await db.blogPost.update({
        where: { id },
        data: { status: "archived", published: false, publishedAt: null },
      });
      break;
    }
  }

  // Feed card follows public visibility in every case (sync handles
  // create/refresh/hide and never duplicates — articleId is unique).
  await syncArticleFeedWrapper(updated);

  // Author notification (skips self-actions; deduped; never throws).
  if (notifyType && updated.authorId) {
    await createArticleNotification({
      userId: updated.authorId,
      actorId: user.id,
      type: notifyType,
      article: { id: updated.id, slug: updated.slug, title: updated.title },
    });
  }

  return NextResponse.json({ article: updated });
}
