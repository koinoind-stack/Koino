import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

// Admin auth helper — same pattern as the other admin routes.
// Returns 401 (not signed in) vs 403 (signed in but not admin).
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

// ─── Helpers ───────────────────────────────────────────────────────────────

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

// Slugify a title into a URL-safe slug. Lowercase, hyphen-separated, ASCII.
export function slugify(input: string): string {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Generate a unique slug for a KoinoArticle. If the base slug is taken,
// append `-2`, `-3`, etc. Scoped to KoinoArticle (not BlogPost — those are
// separate tables with separate @unique constraints on slug).
async function generateUniqueSlug(base: string): Promise<string> {
  const root = base || "article";
  let candidate = root;
  let n = 2;
  while (n < 22) {
    const existing = await db.koinoArticle.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
  return `${root}-${Date.now()}`;
}

// Serialize a KoinoArticle for the API response.
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

// ─── GET /api/admin/articles ──────────────────────────────────────────────

/**
 * GET /api/admin/articles
 *
 * Admin-only. Returns ALL KoinoArticle records (including drafts and
 * unpublished) for a given contentType. Ordered by updatedAt DESC.
 *
 * Optional query params:
 *   type — contentType filter. Defaults to "APOLOGETICS".
 *          Valid: "ARTICLE" | "BLOG" | "APOLOGETICS" | "BIBLE_STUDY" | "DEVOTIONAL"
 *   status — "draft" → status="draft"
 *            "published" → status="published"
 *            "featured" → featured=true
 *
 * Response: { articles: KoinoArticle[] }
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "APOLOGETICS";
    const status = url.searchParams.get("status");

    const validTypes = ["ARTICLE", "BLOG", "APOLOGETICS", "BIBLE_STUDY", "DEVOTIONAL"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const where: {
      contentType: string;
      status?: string;
      featured?: boolean;
    } = { contentType: type };

    if (status === "draft") where.status = "draft";
    if (status === "published") where.status = "published";
    if (status === "featured") where.featured = true;

    const articles = await db.koinoArticle.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    return NextResponse.json({ articles: articles.map(serializeArticle) });
  } catch (e: any) {
    console.error("[admin/articles] GET error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load articles" },
      { status: 500 }
    );
  }
}

// ─── POST /api/admin/articles ─────────────────────────────────────────────

/**
 * POST /api/admin/articles
 *
 * Admin-only. Creates a new KoinoArticle.
 *
 * Required: title, content, contentType (defaults to "APOLOGETICS")
 * Optional: slug (auto-generated if not provided), category, excerpt,
 *   shortAnswer, coverImageUrl, authorName, status (draft|published),
 *   difficulty, featured, bibleRefs (array|csv), sources (array|csv),
 *   relatedIds (array|csv), scheduledAt, seoTitle, seoDescription,
 *   canonicalUrl
 *
 * Slug: if not provided, generated from title via slugify(). Made unique
 * by appending -2, -3, etc. on collision.
 *
 * If status="published" and publishedAt not provided, defaults to now().
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // ─── Validate required fields ───────────────────────────────────
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const content = typeof body.content === "string" ? body.content : "";
    if (!content && content !== "") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    // contentType — default to APOLOGETICS (the primary use case for this route).
    const validTypes = ["ARTICLE", "BLOG", "APOLOGETICS", "BIBLE_STUDY", "DEVOTIONAL"];
    const contentType = typeof body.contentType === "string" && validTypes.includes(body.contentType)
      ? body.contentType
      : "APOLOGETICS";

    // ─── Slug ────────────────────────────────────────────────────────
    let slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!slug) slug = slugify(title);
    if (!slug) slug = "article";
    slug = await generateUniqueSlug(slug);

    // ─── Status + dates ──────────────────────────────────────────────
    // KoinoArticle.status: "draft" | "submitted" | "changes_requested" |
    // "approved" | "published" | "rejected" | "scheduled" | "archived"
    // Admin-created articles start as "draft" by default; admin can set
    // status="published" directly to skip the contributor workflow.
    const rawStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const validStatuses = ["draft", "submitted", "changes_requested", "approved", "published", "rejected", "scheduled", "archived"];
    const status = validStatuses.includes(rawStatus) ? rawStatus : "draft";

    const featured = coerceBool(body.featured);
    const scheduledAt = coerceDate(body.scheduledAt);

    let publishedAt = coerceDate(body.publishedAt);
    if (status === "published" && !publishedAt) {
      publishedAt = new Date();
    }

    // ─── Build create payload ────────────────────────────────────────
    const created = await db.koinoArticle.create({
      data: {
        title,
        slug,
        contentType,
        category: coerceString(body.category),
        subcategory: coerceString(body.subcategory),
        excerpt: coerceString(body.excerpt),
        shortAnswer: coerceString(body.shortAnswer),
        content,
        coverImageUrl: coerceString(body.coverImageUrl),
        // authorId is set separately if a contributor is selected; null for admin-created.
        authorId: coerceString(body.authorId),
        authorName: coerceString(body.authorName),
        status,
        difficulty: coerceString(body.difficulty),
        featured,
        bibleRefs: coerceStringArrayToJSON(body.bibleRefs),
        sources: coerceStringArrayToJSON(body.sources),
        relatedIds: coerceStringArrayToJSON(body.relatedIds),
        reviewedBy: auth.user.id, // admin who created it
        reviewedAt: new Date(),
        publishedAt,
        scheduledAt,
        seoTitle: coerceString(body.seoTitle),
        seoDescription: coerceString(body.seoDescription),
        canonicalUrl: coerceString(body.canonicalUrl),
      },
    });

    // Invalidate the public apologetics page cache so a newly-published
    // article appears immediately.
    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json(
      { success: true, article: serializeArticle(created) },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("[admin/articles] POST error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create article" },
      { status: 500 }
    );
  }
}
