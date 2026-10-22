import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

// Admin auth helper — same shape as /api/admin/donation-settings.
async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user, response: null };
}

// ─── Helpers (mirror of route.ts) ───────────────────────────────────────────

function coerceString(raw: unknown): string | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function coerceBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw === "true" || raw === "1";
  return false;
}

function coerceStringArrayToJSON(raw: unknown): string {
  if (raw == null) return "[]";
  if (Array.isArray(raw)) {
    const arr = raw
      .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
      .filter((v) => v.length > 0);
    return JSON.stringify(arr);
  }
  if (typeof raw === "string") {
    const arr = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return JSON.stringify(arr);
  }
  return "[]";
}

function coerceDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d;
}

function slugify(input: string): string {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function serializePost(p: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  author: string | null;
  category: string;
  tags: string;
  published: boolean;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  scheduledAt: Date | null;
  canonicalUrl: string | null;
  relatedArticleIds: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    content: p.content,
    featuredImage: p.featuredImage,
    author: p.author,
    category: p.category,
    tags: p.tags,
    published: p.published,
    featured: p.featured,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    canonicalUrl: p.canonicalUrl,
    relatedArticleIds: p.relatedArticleIds,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ─── GET /api/admin/blog/[id] ──────────────────────────────────────────────

/**
 * GET /api/admin/blog/[id]
 *
 * Admin-only. Returns a single BlogPost by id — including drafts and
 * future-scheduled posts (which the public route hides).
 *
 * Response: { post: BlogPost }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post: serializePost(post) });
  } catch (e: any) {
    console.error("[admin/blog/[id]] GET error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load post" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/admin/blog/[id] ────────────────────────────────────────────

/**
 * PATCH /api/admin/blog/[id]
 *
 * Admin-only. Updates any field on the post.
 *
 * Special handling:
 *  - If `published` transitions false → true AND `publishedAt` is not set
 *    (either on the existing row or in this PATCH body), defaults to now().
 *  - If `published` is set to true and `scheduledAt` is in the future, we
 *    still allow it (admin override — they know what they're doing).
 *  - If `slug` is changed, we de-duplicate against other posts (excluding
 *    this one) so we don't violate the @unique constraint.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const existing = await db.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // ─── Build update payload ────────────────────────────────────────
    const data: {
      title?: string;
      slug?: string;
      excerpt?: string | null;
      content?: string;
      featuredImage?: string | null;
      author?: string | null;
      category?: string;
      tags?: string;
      published?: boolean;
      featured?: boolean;
      seoTitle?: string | null;
      seoDescription?: string | null;
      scheduledAt?: Date | null;
      canonicalUrl?: string | null;
      relatedArticleIds?: string;
      publishedAt?: Date | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const t = typeof body.title === "string" ? body.title.trim() : "";
      if (!t) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      data.title = t;
    }

    if (Object.prototype.hasOwnProperty.call(body, "slug")) {
      let slug = typeof body.slug === "string" ? body.slug.trim() : "";
      if (!slug) {
        // If admin clears slug, regenerate from title (existing or new).
        const titleForSlug = data.title ?? existing.title;
        slug = slugify(titleForSlug);
      }
      // De-duplicate against OTHER posts (excluding this one).
      if (slug && slug !== existing.slug) {
        const clash = await db.blogPost.findFirst({
          where: { slug, NOT: { id } },
          select: { id: true },
        });
        if (clash) {
          return NextResponse.json(
            { error: `Slug "${slug}" is already used by another post` },
            { status: 409 }
          );
        }
      }
      data.slug = slug;
    }

    if (Object.prototype.hasOwnProperty.call(body, "excerpt")) {
      data.excerpt = coerceString(body.excerpt);
    }
    if (Object.prototype.hasOwnProperty.call(body, "content")) {
      const c = typeof body.content === "string" ? body.content : "";
      data.content = c;
    }
    if (Object.prototype.hasOwnProperty.call(body, "featuredImage")) {
      data.featuredImage = coerceString(body.featuredImage);
    }
    if (Object.prototype.hasOwnProperty.call(body, "author")) {
      data.author = coerceString(body.author);
    }
    if (Object.prototype.hasOwnProperty.call(body, "category")) {
      const cat = typeof body.category === "string" ? body.category.trim() : "";
      if (!cat) {
        return NextResponse.json({ error: "category cannot be empty" }, { status: 400 });
      }
      data.category = cat;
    }
    if (Object.prototype.hasOwnProperty.call(body, "tags")) {
      data.tags = coerceStringArrayToJSON(body.tags);
    }
    if (Object.prototype.hasOwnProperty.call(body, "featured")) {
      data.featured = coerceBool(body.featured);
    }
    if (Object.prototype.hasOwnProperty.call(body, "seoTitle")) {
      data.seoTitle = coerceString(body.seoTitle);
    }
    if (Object.prototype.hasOwnProperty.call(body, "seoDescription")) {
      data.seoDescription = coerceString(body.seoDescription);
    }
    if (Object.prototype.hasOwnProperty.call(body, "scheduledAt")) {
      // Allow null (clear schedule) — only set when input parses.
      const raw = body.scheduledAt;
      if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
        data.scheduledAt = null;
      } else {
        const d = coerceDate(raw);
        if (d) data.scheduledAt = d;
        else data.scheduledAt = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "canonicalUrl")) {
      data.canonicalUrl = coerceString(body.canonicalUrl);
    }
    if (Object.prototype.hasOwnProperty.call(body, "relatedArticleIds")) {
      data.relatedArticleIds = coerceStringArrayToJSON(body.relatedArticleIds);
    }

    // ─── Published transition handling ──────────────────────────────
    // If `published` is in the body, evaluate the false → true transition.
    if (Object.prototype.hasOwnProperty.call(body, "published")) {
      const newPublished = coerceBool(body.published);
      data.published = newPublished;

      const wasPublished = existing.published;
      if (newPublished && !wasPublished) {
        // Transition false → true.
        // Use `publishedAt` from the PATCH body if provided, else existing,
        // else default to now().
        const bodyPublishedAt = coerceDate(body.publishedAt);
        const effectivePublishedAt =
          bodyPublishedAt ?? existing.publishedAt ?? new Date();
        data.publishedAt = effectivePublishedAt;
      } else if (Object.prototype.hasOwnProperty.call(body, "publishedAt")) {
        // Admin is explicitly setting publishedAt on an already-published
        // post (e.g. back-dating). Respect the value.
        const d = coerceDate(body.publishedAt);
        data.publishedAt = d;
      }
    } else if (Object.prototype.hasOwnProperty.call(body, "publishedAt")) {
      // Admin is editing publishedAt without touching `published`.
      const d = coerceDate(body.publishedAt);
      data.publishedAt = d;
    }

    const updated = await db.blogPost.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, post: serializePost(updated) });
  } catch (e: any) {
    console.error("[admin/blog/[id]] PATCH error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to update post" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/blog/[id] ───────────────────────────────────────────

/**
 * DELETE /api/admin/blog/[id]
 *
 * Admin-only. Hard-deletes the post. No soft-delete column exists on
 * BlogPost — this is permanent.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const existing = await db.blogPost.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await db.blogPost.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    console.error("[admin/blog/[id]] DELETE error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to delete post" },
      { status: 500 }
    );
  }
}
