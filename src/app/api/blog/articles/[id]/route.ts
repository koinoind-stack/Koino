import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  isBlogCategory,
  estimateReadingMinutes,
  AUTHOR_EDITABLE,
  BLOG_LIMITS,
} from "@/lib/blog";
import { getUniqueBlogSlug, syncArticleFeedWrapper } from "@/lib/blog-server";

/**
 * GET   /api/blog/articles/[id]  — fetch one article (owner sees any status;
 *                                  admin sees any status; public access goes
 *                                  through /blog/[slug] instead).
 * PATCH /api/blog/articles/[id]  — edit.
 *   - Author: only while status ∈ {draft, changes_requested, rejected}
 *     (published content can never be altered by its member author —
 *     revisions go through the review queue instead).
 *   - Admin: may edit any article in any status. Editing a published article
 *     keeps it live (trusted role per spec §4) and refreshes the feed card.
 *
 * Server-side ownership + role checks only — client-sent IDs/roles/statuses
 * are never trusted.
 */

export const dynamic = "force-dynamic";

const articlePatchSchema = z.object({
  title: z
    .string()
    .trim()
    .min(BLOG_LIMITS.titleMin, "Title must be at least 3 characters.")
    .max(BLOG_LIMITS.titleMax, "Title must be under 200 characters.")
    .optional(),
  excerpt: z
    .string()
    .trim()
    .max(BLOG_LIMITS.excerptMax, "Excerpt must be under 500 characters.")
    .nullable()
    .optional(),
  content: z
    .string()
    .min(BLOG_LIMITS.contentMin, "Article content is required.")
    .max(BLOG_LIMITS.contentMax, "Article content is too long.")
    .optional(),
  category: z
    .string()
    .trim()
    .refine(isBlogCategory, "Please choose one of the available categories.")
    .optional(),
  tags: z
    .array(z.string().trim().min(1).max(BLOG_LIMITS.tagLengthMax))
    .max(BLOG_LIMITS.tagMax, `Up to ${BLOG_LIMITS.tagMax} tags.`)
    .optional(),
  coverImageUrl: z
    .string()
    .trim()
    .max(BLOG_LIMITS.coverMaxChars)
    .nullable()
    .optional(),
});

async function getAuthoredContext(id: string) {
  const user = await getAuthUser();
  if (!user) {
    return { user: null, article: null, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  const article = await db.blogPost.findUnique({
    where: { id },
    include: { authorUser: { select: { id: true } } },
  });
  if (!article) {
    return { user, article: null, response: NextResponse.json({ error: "Article not found." }, { status: 404 }) };
  }
  return { user, article, response: null };
}

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, article, response } = await getAuthoredContext(id);
  if (!user || !article) return response;

  const isOwner = article.authorId === user.id;
  const isAdmin = user.role === "admin";
  if (!isOwner && !isAdmin) {
    // IDOR protection: a non-owner member may only fetch the article through
    // the public gate, never by ID here.
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  return NextResponse.json({ article });
}

// ─── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, article, response } = await getAuthoredContext(id);
  if (!user || !article) return response;

  const isAdmin = user.role === "admin";
  const isOwner = article.authorId === user.id;

  if (!isAdmin) {
    if (!isOwner) {
      return NextResponse.json({ error: "You can only edit your own articles." }, { status: 403 });
    }
    const status = article.status;
    if (!(AUTHOR_EDITABLE as readonly string[]).includes(status)) {
      return NextResponse.json(
        {
          error:
            status === "pending"
              ? "This article is under review — you can edit it once an admin responds."
              : "This article can no longer be edited.",
        },
        { status: 403 }
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = articlePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid article data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const nextTitle = data.title ?? article.title;
  const nextContent = data.content ?? article.content;
  const titleChanged = data.title !== undefined && data.title !== article.title;

  const updated = await db.blogPost.update({
    where: { id: article.id },
    data: {
      title: nextTitle,
      // Slug follows the title; uniqueness guaranteed (excluding self).
      ...(titleChanged ? { slug: await getUniqueBlogSlug(nextTitle, article.id) } : {}),
      ...(data.excerpt !== undefined ? { excerpt: data.excerpt || null } : {}),
      ...(data.content !== undefined ? { content: nextContent } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.tags !== undefined ? { tags: JSON.stringify(data.tags) } : {}),
      ...(data.coverImageUrl !== undefined
        ? { featuredImage: data.coverImageUrl || null }
        : {}),
      readingMinutes: estimateReadingMinutes(nextContent),
      // NOTE: status and reviewNotes are intentionally NOT reset here — the
      // author keeps seeing "Changes Requested"/"Rejected" + the admin's
      // feedback until they explicitly resubmit via /submit.
    },
  });

  // Keep the feed card in sync when editing live content (admin edits).
  await syncArticleFeedWrapper(updated);

  return NextResponse.json({ article: updated });
}
