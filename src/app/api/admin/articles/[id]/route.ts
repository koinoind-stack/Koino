import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

// Admin auth helper
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

function serializeArticle(a: any) {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    contentType: a.contentType,
    category: a.category,
    subcategory: a.subcategory,
    excerpt: a.excerpt,
    shortAnswer: a.shortAnswer,
    content: a.content,
    coverImageUrl: a.coverImageUrl,
    authorId: a.authorId,
    authorName: a.authorName,
    status: a.status,
    difficulty: a.difficulty,
    featured: a.featured,
    bibleRefs: a.bibleRefs,
    sources: a.sources,
    relatedIds: a.relatedIds,
    reviewedBy: a.reviewedBy,
    reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
    reviewNotes: a.reviewNotes,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    scheduledAt: a.scheduledAt ? a.scheduledAt.toISOString() : null,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    canonicalUrl: a.canonicalUrl,
    viewCount: a.viewCount,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// ─── GET /api/admin/articles/[id] ──────────────────────────────────────────

/**
 * GET /api/admin/articles/[id]
 *
 * Admin-only. Returns a single KoinoArticle by id — including drafts and
 * unpublished articles.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const article = await db.koinoArticle.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({ article: serializeArticle(article) });
  } catch (e: any) {
    console.error("[admin/articles/[id]] GET error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load article" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/admin/articles/[id] ────────────────────────────────────────

/**
 * PATCH /api/admin/articles/[id]
 *
 * Admin-only. Updates any field on the article.
 *
 * Special handling:
 *  - If status transitions to "published" AND publishedAt is not set,
 *    defaults to now().
 *  - If slug is changed, de-duplicates against other articles.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const existing = await db.koinoArticle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const data: any = {};

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
        const titleForSlug = data.title ?? existing.title;
        slug = slugify(titleForSlug);
      }
      if (slug && slug !== existing.slug) {
        const clash = await db.koinoArticle.findFirst({
          where: { slug, NOT: { id } },
          select: { id: true },
        });
        if (clash) {
          return NextResponse.json(
            { error: `Slug "${slug}" is already used by another article` },
            { status: 409 }
          );
        }
      }
      data.slug = slug;
    }

    if (Object.prototype.hasOwnProperty.call(body, "contentType")) {
      const validTypes = ["ARTICLE", "BLOG", "APOLOGETICS", "BIBLE_STUDY", "DEVOTIONAL"];
      const ct = typeof body.contentType === "string" ? body.contentType : "";
      if (validTypes.includes(ct)) data.contentType = ct;
    }

    if (Object.prototype.hasOwnProperty.call(body, "category")) data.category = coerceString(body.category);
    if (Object.prototype.hasOwnProperty.call(body, "subcategory")) data.subcategory = coerceString(body.subcategory);
    if (Object.prototype.hasOwnProperty.call(body, "excerpt")) data.excerpt = coerceString(body.excerpt);
    if (Object.prototype.hasOwnProperty.call(body, "shortAnswer")) data.shortAnswer = coerceString(body.shortAnswer);
    if (Object.prototype.hasOwnProperty.call(body, "content")) {
      data.content = typeof body.content === "string" ? body.content : "";
    }
    if (Object.prototype.hasOwnProperty.call(body, "coverImageUrl")) data.coverImageUrl = coerceString(body.coverImageUrl);
    if (Object.prototype.hasOwnProperty.call(body, "authorId")) data.authorId = coerceString(body.authorId);
    if (Object.prototype.hasOwnProperty.call(body, "authorName")) data.authorName = coerceString(body.authorName);
    if (Object.prototype.hasOwnProperty.call(body, "difficulty")) data.difficulty = coerceString(body.difficulty);
    if (Object.prototype.hasOwnProperty.call(body, "featured")) data.featured = coerceBool(body.featured);
    if (Object.prototype.hasOwnProperty.call(body, "bibleRefs")) data.bibleRefs = coerceStringArrayToJSON(body.bibleRefs);
    if (Object.prototype.hasOwnProperty.call(body, "sources")) data.sources = coerceStringArrayToJSON(body.sources);
    if (Object.prototype.hasOwnProperty.call(body, "relatedIds")) data.relatedIds = coerceStringArrayToJSON(body.relatedIds);
    if (Object.prototype.hasOwnProperty.call(body, "seoTitle")) data.seoTitle = coerceString(body.seoTitle);
    if (Object.prototype.hasOwnProperty.call(body, "seoDescription")) data.seoDescription = coerceString(body.seoDescription);
    if (Object.prototype.hasOwnProperty.call(body, "canonicalUrl")) data.canonicalUrl = coerceString(body.canonicalUrl);
    if (Object.prototype.hasOwnProperty.call(body, "reviewNotes")) data.reviewNotes = coerceString(body.reviewNotes);

    if (Object.prototype.hasOwnProperty.call(body, "scheduledAt")) {
      const raw = body.scheduledAt;
      if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
        data.scheduledAt = null;
      } else {
        const d = coerceDate(raw);
        data.scheduledAt = d;
      }
    }

    // ─── Status + publishedAt transition handling ──────────────────
    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const validStatuses = ["draft", "submitted", "changes_requested", "approved", "published", "rejected", "scheduled", "archived"];
      const newStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
      if (validStatuses.includes(newStatus)) {
        data.status = newStatus;
        // If transitioning to "published" and publishedAt not set, default to now().
        if (newStatus === "published" && existing.status !== "published") {
          const bodyPublishedAt = coerceDate(body.publishedAt);
          data.publishedAt = bodyPublishedAt ?? existing.publishedAt ?? new Date();
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "publishedAt")) {
      const d = coerceDate(body.publishedAt);
      data.publishedAt = d;
    }

    const updated = await db.koinoArticle.update({
      where: { id },
      data,
    });

    // Invalidate the public pages so changes appear immediately.
    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({ success: true, article: serializeArticle(updated) });
  } catch (e: any) {
    console.error("[admin/articles/[id]] PATCH error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to update article" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/articles/[id] ───────────────────────────────────────

/**
 * DELETE /api/admin/articles/[id]
 *
 * Admin-only. Hard-deletes the article. Permanent.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    const existing = await db.koinoArticle.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    await db.koinoArticle.delete({ where: { id } });

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    console.error("[admin/articles/[id]] DELETE error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to delete article" },
      { status: 500 }
    );
  }
}
