import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import ApologeticsArticleContent from "@/components/crosscrafted/ApologeticsArticleContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Safe JSON parser for array fields — verifies the parsed value is actually
// an array (not just that JSON.parse didn't throw).
function safeParseArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as T[];
    return fallback;
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await db.koinoArticle.findUnique({ where: { slug } });
  if (!article || article.status !== "published" || article.contentType !== "APOLOGETICS") {
    return { title: "Article Not Found — Koino" };
  }
  const canonical = article.canonicalUrl || `https://www.koino.in/apologetics/${article.slug}`;
  return {
    title: article.seoTitle || `${article.title} — Koino`,
    description: article.seoDescription || article.excerpt || "",
    alternates: { canonical },
    openGraph: {
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt || "",
      images: article.coverImageUrl ? [article.coverImageUrl] : [],
      siteName: "Koino",
      type: "article",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt || "",
      images: article.coverImageUrl ? [article.coverImageUrl] : [],
    },
  };
}

export default async function ApologeticsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // ─── Fetch the article (with PART 2 migration-window tolerance) ───
  // After `prisma generate` but BEFORE the SQL migration is applied, a
  // select-all query fails with P2022 (new columns missing). Retry with only
  // the pre-PART-2 columns and degrade gracefully (no tags, no source-Q box).
  let article: any = null;
  let part2Available = true;
  try {
    article = await db.koinoArticle.findUnique({ where: { slug } });
  } catch (e: any) {
    if (e?.code === "P2022" || /column .* does not exist/i.test(e?.message || "")) {
      part2Available = false;
      article = await db.koinoArticle.findUnique({
        where: { slug },
        select: {
          id: true, title: true, slug: true, contentType: true, category: true,
          subcategory: true, excerpt: true, shortAnswer: true, content: true,
          coverImageUrl: true, authorId: true, authorName: true, status: true,
          difficulty: true, featured: true, bibleRefs: true, sources: true,
          relatedIds: true, publishedAt: true, viewCount: true,
          createdAt: true, updatedAt: true,
        },
      });
    } else {
      throw e;
    }
  }

  // Article not found, or not published, or not APOLOGETICS → 404
  if (!article || article.status !== "published" || article.contentType !== "APOLOGETICS") notFound();

  // ─── Safe JSON parsing ─────────────────────────────────────────────
  const bibleRefs: string[] = safeParseArray<string>(article.bibleRefs, []);
  const tags: string[] = part2Available ? safeParseArray<string>(article.tags, []) : [];
  const sources: any[] = safeParseArray<any>(article.sources, []);
  const relatedIds: string[] = safeParseArray<string>(article.relatedIds, []);

  // Fetch related articles — wrapped in try/catch so a DB error doesn't
  // crash the entire page.
  let relatedArticles: any[] = [];
  if (relatedIds.length > 0) {
    try {
      relatedArticles = await db.koinoArticle.findMany({
        where: { id: { in: relatedIds }, status: "published" },
        select: { id: true, title: true, slug: true, category: true, excerpt: true, coverImageUrl: true },
      });
    } catch (error) {
      console.error("[apologetics/[slug]] Related articles query error:", error);
    }
  }

  // ─── PART 2: source Q&A back-link ────────────────────────────────────
  // If this article was converted from a Q&A, fetch the original question so
  // the page can show "From the Koino Q&A" with the original discussion link.
  let sourceQuestion: { id: string; question: string; answeredByName: string | null } | null = null;
  if (part2Available && article.sourceQuestionId) {
    try {
      const sq = await db.userQuestion.findUnique({
        where: { id: article.sourceQuestionId },
        select: { id: true, question: true, status: true, answeredByName: true },
      });
      if (sq && sq.status === "answered") {
        sourceQuestion = { id: sq.id, question: sq.question, answeredByName: sq.answeredByName };
      }
    } catch (e) {
      console.error("[apologetics/[slug]] sourceQuestion fetch error:", e);
    }
  }

  // ─── Pass ONLY serializable data to the Client Component ──────────
  // All Date objects are converted to ISO strings before passing.
  // All arrays are already parsed + verified as arrays.
  // No functions, no Date objects, no class instances cross the boundary.
  const articleData = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    difficulty: article.difficulty,
    excerpt: article.excerpt,
    shortAnswer: article.shortAnswer,
    content: article.content,
    coverImageUrl: article.coverImageUrl,
    authorName: article.authorName,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    bibleRefs,
    tags,
    sources,
    sourceQuestion,
    relatedArticles,
  };

  return (
    <PublicPageLayout>
      <ApologeticsArticleContent article={articleData} />
    </PublicPageLayout>
  );
}
