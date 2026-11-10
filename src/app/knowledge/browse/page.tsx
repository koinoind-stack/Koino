import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { CONTENT_TYPE_LABELS, isContentType, type ContentType } from "@/lib/content-taxonomy";
import { listActiveCategories, listActiveTopics } from "@/lib/taxonomy-server";
import { db } from "@/lib/db";
import KnowledgeBrowseContent, {
  type BrowseArticle,
} from "@/components/crosscrafted/KnowledgeBrowseContent";

// Public DB-backed surface — always fresh (matches /blog and /apologetics).
export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

type SearchParams = { type?: string; category?: string; topic?: string; page?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { type = "" } = await searchParams;
  const label = isContentType(type) ? CONTENT_TYPE_LABELS[type] : "Browse";
  return {
    title: `${label} — Articles & Knowledge — Koino`,
    description: `Browse published ${label.toLowerCase()} content on Koino — filtered by category and topic.`,
    robots: { index: false }, // parametric listing — canonical surfaces are /knowledge and the per-type hubs
  };
}

export default async function KnowledgeBrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const type: ContentType = isContentType(raw.type) ? raw.type : "ARTICLE";

  // Blog and Apologetics have dedicated, richer listings — they remain the
  // canonical homes for those types. This page serves the other four.
  if (type === "BLOG") redirect("/blog");
  if (type === "APOLOGETICS") redirect("/apologetics");

  // Optional taxonomy filters — slugs only. An unknown slug simply matches
  // nothing; it can never inject (Prisma parameterizes the value).
  const categorySlug = typeof raw.category === "string" ? raw.category.slice(0, 80) : "";
  const topicSlug = typeof raw.topic === "string" ? raw.topic.slice(0, 80) : "";
  const page = Math.max(1, parseInt(raw.page || "1", 10) || 1);

  // Schedule-aware visibility for the unified model: status gate + any
  // scheduledAt hold that has not elapsed yet (mirrors the BlogPost gate's
  // intent — future-scheduled rows stay private).
  const now = new Date();
  const where = {
    status: "published" as const,
    contentType: type,
    AND: [
      { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
      ...(categorySlug
        ? [{ taxonomyCategory: { slug: categorySlug, isActive: true } }]
        : []),
      ...(topicSlug
        ? [{ topics: { some: { topic: { slug: topicSlug, isActive: true } } } }]
        : []),
    ],
  };

  // The taxonomy tables only exist after the unified_taxonomy migration —
  // never let an unseeded/unmigrated database 500 a public page.
  const [total, articles, categories, topics] = await Promise.all([
    db.koinoArticle.count({ where }).catch(() => 0),
    db.koinoArticle
      .findMany({
        where,
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImageUrl: true,
          authorName: true,
          publishedAt: true,
          readingMinutes: true,
          difficulty: true,
          featured: true,
          canonicalUrl: true,
        },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      })
      .catch(() => []),
    listActiveCategories().catch(() => []),
    listActiveTopics().catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedCategory = categories.find((c) => c.slug === categorySlug) ?? null;
  const selectedTopic = topics.find((t) => t.slug === topicSlug) ?? null;
  const categoryTopics = selectedCategory
    ? topics.filter((t) => t.parentCategory.id === selectedCategory.id)
    : [];
  const hasFilters = Boolean(categorySlug || topicSlug);

  // Minimal serializable contract for the client component.
  const browseArticles: BrowseArticle[] = articles.map((a) => ({
    id: a.id,
    title: a.title,
    excerpt: a.excerpt,
    authorName: a.authorName,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    readingMinutes: a.readingMinutes,
    difficulty: a.difficulty,
    featured: a.featured,
    canonicalUrl: a.canonicalUrl,
  }));

  return (
    <PublicPageLayout>
      <main className="max-w-5xl mx-auto px-4 py-10">
        <KnowledgeBrowseContent
          type={type}
          articles={browseArticles}
          categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
          categoryTopics={categoryTopics.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            color: t.color,
          }))}
          selectedCategoryName={selectedCategory?.name ?? null}
          selectedTopicName={selectedTopic?.name ?? null}
          hasFilters={hasFilters}
          page={page}
          totalPages={totalPages}
          categorySlug={categorySlug}
          topicSlug={topicSlug}
        />
      </main>
    </PublicPageLayout>
  );
}
