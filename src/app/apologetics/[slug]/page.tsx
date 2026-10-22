import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import ApologeticsArticleContent from "@/components/crosscrafted/ApologeticsArticleContent";
import { notFound } from "next/navigation";

const db = new PrismaClient();
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

  const article = await db.koinoArticle.findUnique({
    where: { slug },
  });

  // Article not found, or not published, or not APOLOGETICS → 404
  if (!article || article.status !== "published" || article.contentType !== "APOLOGETICS") notFound();

  // ─── Safe JSON parsing ─────────────────────────────────────────────
  const bibleRefs: string[] = safeParseArray<string>(article.bibleRefs, []);
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
    sources,
    relatedArticles,
  };

  return (
    <PublicPageLayout>
      <ApologeticsArticleContent article={articleData} />
    </PublicPageLayout>
  );
}
