import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import {
  isBlogCategory,
  estimateReadingMinutes,
  BLOG_LIMITS,
} from "@/lib/blog";
import { getUniqueBlogSlug } from "@/lib/blog-server";

/**
 * GET  /api/blog/articles        — the signed-in member's own articles
 *                                  (ALL statuses — drafts, pending, rejected,
 *                                  published — so they can track submissions).
 * POST /api/blog/articles        — create a new article (draft or, for admins,
 *                                  optionally publish immediately).
 *
 * Auth: any signed-in, active user. Admin capability (publish immediately)
 * is derived from the SERVER-side session role — never from the client body.
 */

export const dynamic = "force-dynamic";

const articleInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(BLOG_LIMITS.titleMin, "Title must be at least 3 characters.")
    .max(BLOG_LIMITS.titleMax, "Title must be under 200 characters."),
  excerpt: z
    .string()
    .trim()
    .max(BLOG_LIMITS.excerptMax, "Excerpt must be under 500 characters.")
    .optional()
    .nullable(),
  content: z
    .string()
    .min(BLOG_LIMITS.contentMin, "Article content is required.")
    .max(BLOG_LIMITS.contentMax, "Article content is too long."),
  category: z
    .string()
    .trim()
    .refine(isBlogCategory, "Please choose one of the available categories."),
  tags: z
    .array(z.string().trim().min(1).max(BLOG_LIMITS.tagLengthMax))
    .max(BLOG_LIMITS.tagMax, `Up to ${BLOG_LIMITS.tagMax} tags.`)
    .optional(),
  coverImageUrl: z
    .string()
    .trim()
    .max(BLOG_LIMITS.coverMaxChars)
    .optional()
    .nullable(),
});

async function requireActiveUser() {
  const user = await getAuthUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { accountStatus: true },
  });
  if (!account || account.accountStatus !== "active") {
    return { user: null, response: NextResponse.json({ error: "Your account cannot write articles." }, { status: 403 }) };
  }
  return { user, response: null };
}

// ─── GET: my submissions ────────────────────────────────────────────────────
export async function GET() {
  const { user, response } = await requireActiveUser();
  if (!user) return response;

  const articles = await db.blogPost.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      category: true,
      tags: true,
      featuredImage: true,
      status: true,
      reviewNotes: true,
      readingMinutes: true,
      featured: true,
      published: true,
      submittedAt: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ articles });
}

// ─── POST: create draft (or admin instant-publish) ─────────────────────────
export async function POST(req: NextRequest) {
  const { user, response } = await requireActiveUser();
  if (!user) return response;

  // Abuse protection — matches the contributor-article convention (5/hour).
  if (!rateLimit(`blog-article-create:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many articles created. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = articleInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid article data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Server-side identity: author is ALWAYS the authenticated user.
  // Admins may publish immediately (skip review) — members never can.
  const isAdmin = user.role === "admin";
  const wantPublish = isAdmin && (body as { publishNow?: boolean })?.publishNow === true;
  const now = new Date();
  const readingMinutes = estimateReadingMinutes(data.content);
  const slug = await getUniqueBlogSlug(data.title);

  const article = await db.blogPost.create({
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content,
      category: data.category,
      tags: JSON.stringify(data.tags ?? []),
      featuredImage: data.coverImageUrl || null,
      // Legacy display-name column — kept in sync for the existing admin list.
      author: user.name || user.username || "Koino member",
      // Workflow columns
      authorId: user.id,
      status: wantPublish ? "published" : "draft",
      published: wantPublish,
      publishedAt: wantPublish ? now : null,
      publishedById: wantPublish ? user.id : null,
      readingMinutes,
    },
  });

  return NextResponse.json({ article }, { status: 201 });
}
