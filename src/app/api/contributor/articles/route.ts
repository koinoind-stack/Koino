import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/social/rate-limit";
import { requireContributor } from "@/lib/apologetics-server";
import { canonicalizeBibleRef } from "@/lib/bible-ref";

const APOLOGETICS_CATEGORIES = [
  "God & Existence", "Jesus Christ", "Resurrection", "Bible", "Science & Faith",
  "Suffering & Evil", "Morality & Ethics", "Other Worldviews", "Doubt & Faith",
  "Culture & Christianity", "Salvation",
];

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

async function generateUniqueSlug(base: string): Promise<string> {
  const root = base || "article";
  let candidate = root;
  let n = 2;
  while (n < 22) {
    const existing = await db.koinoArticle.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
  return `${root}-${Date.now()}`;
}

function coerceString(raw: unknown): string | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function coerceTags(raw: unknown): string {
  if (raw == null) return "[]";
  let arr: string[] = [];
  if (Array.isArray(raw)) {
    arr = raw.map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim())).filter(Boolean);
  } else if (typeof raw === "string") {
    arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return JSON.stringify(arr.slice(0, 10).map((t) => t.slice(0, 40)));
}

/**
 * Canonicalize an array of raw reference strings; any invalid ref fails the
 * request with a clear message (never store unvalidated refs).
 */
function canonicalizeRefs(raw: unknown): { refs: string[] } | { error: string } {
  if (raw == null) return { refs: [] };
  const list = Array.isArray(raw)
    ? raw.map((v) => (typeof v === "string" ? v : String(v ?? "")))
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const refs: string[] = [];
  for (const item of list) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const result = canonicalizeBibleRef(trimmed);
    if ("error" in result) return { error: `Bible reference "${trimmed}": ${result.error}` };
    if (!refs.includes(result.canonical)) refs.push(result.canonical);
    if (refs.length >= 20) break;
  }
  return { refs };
}

/**
 * GET /api/contributor/articles — the signed-in contributor's OWN articles
 * (every status), newest first.
 */
export async function GET() {
  try {
    const guard = await requireContributor("CAN_WRITE_ARTICLES");
    if (guard.response) return guard.response;

    const articles = await db.koinoArticle.findMany({
      where: { authorId: guard.contributor.id, contentType: "APOLOGETICS" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, slug: true, status: true, category: true,
        excerpt: true, coverImageUrl: true, featured: true, reviewNotes: true,
        publishedAt: true, createdAt: true, updatedAt: true, viewCount: true,
      },
    });
    return NextResponse.json({
      articles: articles.map((a) => ({ ...a, publishedAt: a.publishedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() })),
    });
  } catch (error: any) {
    console.error("[api/contributor/articles GET] Error:", error);
    return NextResponse.json({ error: "Failed to load your articles" }, { status: 500 });
  }
}

/**
 * POST /api/contributor/articles — create a NEW article as the signed-in
 * contributor. Status: "draft" (default) or "submitted" (send for review).
 *
 * SERVER-ENFORCED (never trusted from the body):
 *  - contentType = "APOLOGETICS"
 *  - authorId = contributor.id, authorName = contributor.displayName
 *  - status ∈ { draft, submitted } — contributors can NEVER publish
 *  - bibleRefs validated against the Koino canon (request fails with the
 *    validation message otherwise)
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireContributor("CAN_WRITE_ARTICLES");
    if (guard.response) return guard.response;
    const contributor = guard.contributor;

    if (!rateLimit(`contributor:article:${contributor.userId}`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 300) {
      return NextResponse.json({ error: "Title is required (max 300 chars)" }, { status: 400 });
    }
    const content = typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    if (content.length > 200_000) {
      return NextResponse.json({ error: "Content is too long" }, { status: 400 });
    }

    const category = coerceString(body.category);
    if (category && !APOLOGETICS_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const difficulty = coerceString(body.difficulty);
    if (difficulty && !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    const refs = canonicalizeRefs(body.bibleRefs);
    if ("error" in refs) {
      return NextResponse.json({ error: refs.error }, { status: 400 });
    }

    const rawStatus = typeof body.status === "string" ? body.status.toLowerCase() : "draft";
    const status = rawStatus === "submitted" ? "submitted" : "draft";

    const slug = await generateUniqueSlug(slugify(title));

    const article = await db.koinoArticle.create({
      data: {
        title,
        slug,
        contentType: "APOLOGETICS",
        category,
        subcategory: coerceString(body.subcategory),
        excerpt: coerceString(body.excerpt)?.slice(0, 500) ?? null,
        shortAnswer: coerceString(body.shortAnswer)?.slice(0, 2000) ?? null,
        content,
        coverImageUrl: coerceString(body.coverImageUrl),
        authorId: contributor.id,
        authorName: contributor.displayName,
        status,
        difficulty,
        featured: false, // only admins feature articles
        bibleRefs: JSON.stringify(refs.refs),
        tags: coerceTags(body.tags),
      },
    });

    try { revalidatePath("/", "layout"); } catch {}

    return NextResponse.json(
      { success: true, article: { id: article.id, slug: article.slug, status: article.status } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/contributor/articles POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to create article" }, { status: 500 });
  }
}
