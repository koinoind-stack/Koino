import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

// Single PrismaClient instance at module scope — same pattern as the other
// admin routes (comics, donation-settings, contributor-applications, etc.).
const db = new PrismaClient();

// Admin auth helper — same shape as /api/admin/donation-settings.
// Distinguishes 401 (not signed in) from 403 (signed in but not admin) so
// the client can route appropriately.
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

// Convert a string-ish body value into `string | null` (empty → null).
function coerceString(raw: unknown): string | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Convert a boolean-ish body value into `boolean`.
function coerceBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw === "true" || raw === "1";
  return false;
}

// Convert a comma-separated string OR string[] OR null into a JSON-encoded
// string array. Stored in the DB as `tags` / `relatedArticleIds` (TEXT).
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

// Parse an ISO datetime string OR a datetime-local string (yyyy-MM-ddTHH:mm)
// into a Date. Returns null on garbage input.
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
// Non-ASCII characters are dropped (we don't transliterate here — Koino
// articles are English by default).
export function slugify(input: string): string {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // strip punctuation/symbols
    .replace(/[\s_-]+/g, "-")      // collapse whitespace/underscores
    .replace(/^-+|-+$/g, "")      // trim leading/trailing hyphens
    .slice(0, 80);                // cap length
}

// Generate a unique slug. If the base slug is taken, append `-2`, `-3`, etc.
// Used by POST when creating a new post from a title (slug not provided).
async function generateUniqueSlug(base: string): Promise<string> {
  const root = base || "post";
  let candidate = root;
  let n = 2;
  // Cap at 20 attempts to avoid an infinite loop on pathological inputs.
  while (n < 22) {
    const existing = await db.blogPost.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
  // Final fallback — append a timestamp so we never throw.
  return `${root}-${Date.now()}`;
}

// Serialize a BlogPost for the API response. Converts Date fields to ISO
// strings so the client receives a stable, JSON-safe shape.
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

// ─── GET /api/admin/blog ──────────────────────────────────────────────────

/**
 * GET /api/admin/blog
 *
 * Admin-only. Returns ALL BlogPost records (including drafts and
 * future-scheduled posts — the public /blog page filters those out).
 * Ordered by updatedAt DESC.
 *
 * Optional query params:
 *   status — "draft"     → published=false
 *           "published" → published=true
 *           "featured"  → featured=true
 *
 * Response:
 *   { posts: BlogPost[] }
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const where: {
      published?: boolean;
      featured?: boolean;
    } = {};
    if (status === "draft") where.published = false;
    if (status === "published") where.published = true;
    if (status === "featured") where.featured = true;

    const posts = await db.blogPost.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    return NextResponse.json({ posts: posts.map(serializePost) });
  } catch (e: any) {
    console.error("[admin/blog] GET error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load blog posts" },
      { status: 500 }
    );
  }
}

// ─── POST /api/admin/blog ─────────────────────────────────────────────────

/**
 * POST /api/admin/blog
 *
 * Admin-only. Creates a new BlogPost. Accepts the full field set:
 *   title (required), slug?, excerpt?, content (required), featuredImage?,
 *   author?, category (required), tags (array | csv), published (bool),
 *   featured (bool), seoTitle?, seoDescription?, scheduledAt (ISO),
 *   canonicalUrl?, relatedArticleIds (array | csv).
 *
 * Slug: if not provided, generated from title via `slugify()`. Made unique
 * by appending `-2`, `-3`, etc. on collision.
 *
 * If `published=true` and `publishedAt` not provided, defaults to now().
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
      // `content` is required by schema (NOT NULL); allow empty string for
      // drafts that the admin wants to save as a stub.
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const category = typeof body.category === "string" ? body.category.trim() : "";
    if (!category) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    // ─── Slug ────────────────────────────────────────────────────────
    let slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!slug) slug = slugify(title);
    if (!slug) slug = "post"; // ultra-defensive fallback
    slug = await generateUniqueSlug(slug);

    // ─── Booleans + dates ────────────────────────────────────────────
    const published = coerceBool(body.published);
    const featured = coerceBool(body.featured);
    const scheduledAt = coerceDate(body.scheduledAt);

    let publishedAt = coerceDate(body.publishedAt);
    if (published && !publishedAt) {
      publishedAt = new Date();
    }

    // ─── Build create payload ────────────────────────────────────────
    const created = await db.blogPost.create({
      data: {
        title,
        slug,
        excerpt: coerceString(body.excerpt),
        content,
        featuredImage: coerceString(body.featuredImage),
        author: coerceString(body.author),
        category,
        tags: coerceStringArrayToJSON(body.tags),
        published,
        featured,
        seoTitle: coerceString(body.seoTitle),
        seoDescription: coerceString(body.seoDescription),
        scheduledAt,
        canonicalUrl: coerceString(body.canonicalUrl),
        relatedArticleIds: coerceStringArrayToJSON(body.relatedArticleIds),
        publishedAt,
      },
    });

    return NextResponse.json({ success: true, post: serializePost(created) }, { status: 201 });
  } catch (e: any) {
    console.error("[admin/blog] POST error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create blog post" },
      { status: 500 }
    );
  }
}
