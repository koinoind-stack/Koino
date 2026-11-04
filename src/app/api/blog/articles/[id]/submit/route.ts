import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import { SUBMITTABLE_FROM } from "@/lib/blog";

/**
 * POST /api/blog/articles/[id]/submit
 *
 * Author submits their article for admin review: status → "pending".
 * Allowed from draft / changes_requested / rejected (re-submission).
 *
 * Ownership is verified SERVER-side (authorId === session user); admins use
 * the moderation route to publish — a member can never publish by calling
 * this endpoint repeatedly or by manipulating the body (no body fields are
 * read at all).
 */

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Abuse protection.
  if (!rateLimit(`blog-submit:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  const article = await db.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      category: true,
      status: true,
      authorId: true,
    },
  });
  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  if (article.authorId !== user.id) {
    return NextResponse.json(
      { error: "You can only submit your own articles." },
      { status: 403 }
    );
  }
  if (!(SUBMITTABLE_FROM as readonly string[]).includes(article.status)) {
    return NextResponse.json(
      {
        error:
          article.status === "pending"
            ? "This article is already awaiting review."
            : article.status === "published"
              ? "This article is already published."
              : "This article cannot be submitted for review.",
      },
      { status: 409 }
    );
  }

  // Completeness guard — an article must be submittable as-is.
  if (
    article.title.trim().length < 3 ||
    article.content.trim().length < 1 ||
    article.category.trim().length < 1
  ) {
    return NextResponse.json(
      { error: "Add a title, category and content before submitting." },
      { status: 400 }
    );
  }

  const updated = await db.blogPost.update({
    where: { id: article.id },
    data: {
      status: "pending",
      submittedAt: new Date(),
      // Fresh review cycle — previous feedback stays visible to the author
      // until the admin records a new decision on this submission.
    },
    select: { id: true, status: true, submittedAt: true },
  });

  return NextResponse.json({ article: updated });
}
