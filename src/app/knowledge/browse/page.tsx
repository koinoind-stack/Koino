import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Library } from "lucide-react";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  isContentType,
  type ContentType,
} from "@/lib/content-taxonomy";
import { listActiveCategories, listActiveTopics } from "@/lib/taxonomy-server";
import { db } from "@/lib/db";

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

function buildPageHref(
  type: ContentType,
  category: string,
  topic: string,
  page: number
): string {
  const params = new URLSearchParams({ type });
  if (category) params.set("category", category);
  if (topic) params.set("topic", topic);
  if (page > 1) params.set("page", String(page));
  return `/knowledge/browse?${params.toString()}`;
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
  const label = CONTENT_TYPE_LABELS[type];
  const selectedCategory = categories.find((c) => c.slug === categorySlug) ?? null;
  const selectedTopic = topics.find((t) => t.slug === topicSlug) ?? null;
  const categoryTopics = selectedCategory
    ? topics.filter((t) => t.parentCategory.id === selectedCategory.id)
    : [];
  const hasFilters = Boolean(categorySlug || topicSlug);

  return (
    <PublicPageLayout>
      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Breadcrumb + heading */}
        <div className="mb-8">
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED]/15 text-[#A78BFA] text-xs font-bold px-3 py-1 mb-4 hover:bg-[#7C3AED]/25 transition-colors"
          >
            <Library size={13} />
            Articles &amp; Knowledge
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{label}</h1>
          <p className="text-sm text-[#94A3B8]">
            {selectedTopic
              ? `Topic: ${selectedTopic.name}`
              : selectedCategory
                ? `Category: ${selectedCategory.name}`
                : "Everything published in this content type, newest first."}
          </p>
        </div>

        {/* Category navigation — DB taxonomy when available */}
        {categories.length > 0 && (
          <section aria-label="Categories" className="mb-8">
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildPageHref(type, "", "", 1)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                  !categorySlug
                    ? "bg-[#7C3AED]/25 text-white border-[#7C3AED]/50"
                    : "bg-white/[0.03] text-[#94A3B8] border-white/[0.08] hover:text-white"
                }`}
              >
                All
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={buildPageHref(type, c.slug, "", 1)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                    categorySlug === c.slug
                      ? "bg-[#7C3AED]/25 text-white border-[#7C3AED]/50"
                      : "bg-white/[0.03] text-[#94A3B8] border-white/[0.08] hover:text-white"
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
            {categoryTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {categoryTopics.map((t) => (
                  <Link
                    key={t.id}
                    href={buildPageHref(type, categorySlug, t.slug, 1)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                      topicSlug === t.slug
                        ? "bg-[#EC4899]/20 text-white border-[#EC4899]/40"
                        : "bg-white/[0.04] text-[#CBD5E1] border-white/[0.08] hover:text-white"
                    }`}
                  >
                    {t.color && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                    )}
                    {t.name}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Results */}
        {articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] p-10 text-center">
            <p className="text-sm font-bold text-white mb-1">
              {hasFilters
                ? "Nothing matches this filter yet."
                : `No ${label.toLowerCase()} content has been published yet.`}
            </p>
            <p className="text-xs text-[#94A3B8]">
              Everything published in this content type appears here automatically —
              check back soon, or explore the other content types on{" "}
              <Link href="/knowledge" className="text-[#A78BFA] hover:underline">
                Articles &amp; Knowledge
              </Link>
              .
            </p>
          </div>
        ) : (
          <section aria-label={`${label} articles`} className="grid sm:grid-cols-2 gap-4">
            {articles.map((a) => {
              // This page only renders ARTICLE / BIBLE_STUDY / DEVOTIONAL /
              // TESTIMONY (Blog and Apologetics redirect to their dedicated
              // listings above). Detail pages for these types arrive with the
              // Phase 3/4 unified surface — until then a row links out via
              // its explicit canonicalUrl when one is set, otherwise the card
              // is informational. No invented detail system.
              const href = a.canonicalUrl || null;
              const body = (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    {a.featured && (
                      <span className="rounded-full bg-[#22C55E]/20 border border-[#22C55E]/40 text-[#22C55E] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                        Featured
                      </span>
                    )}
                    {a.difficulty && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#A78BFA]">
                        {a.difficulty}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white">{a.title}</span>
                  {a.excerpt && (
                    <span className="text-xs text-[#94A3B8] line-clamp-2">{a.excerpt}</span>
                  )}
                  <span className="text-[10px] text-[#64748B] mt-auto pt-2">
                    {a.authorName ? `${a.authorName} · ` : ""}
                    {a.publishedAt
                      ? new Date(a.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                    {a.readingMinutes ? ` · ${a.readingMinutes} min read` : ""}
                  </span>
                </>
              );
              const cardClass =
                "rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#7C3AED]/40 p-4 flex flex-col gap-1 transition-all";
              return href ? (
                <Link key={a.id} href={href} className={cardClass}>
                  {body}
                  <ExternalLink size={12} className="text-[#64748B]" />
                </Link>
              ) : (
                <div key={a.id} className={`${cardClass} opacity-80`}>
                  {body}
                </div>
              );
            })}
          </section>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            {page > 1 ? (
              <Link
                href={buildPageHref(type, categorySlug, topicSlug, page - 1)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white"
              >
                <ChevronLeft size={14} /> Previous
              </Link>
            ) : null}
            <span className="text-xs text-[#64748B]">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageHref(type, categorySlug, topicSlug, page + 1)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white"
              >
                Next <ChevronRight size={14} />
              </Link>
            ) : null}
          </div>
        )}

        {/* Cross-type navigation — the landing stays the central hub */}
        <section aria-label="Other content types" className="mt-12">
          <h2 className="text-sm font-bold text-white mb-3">Other content types</h2>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.filter((t) => t !== type).map((t) => (
              <Link
                key={t}
                href={
                  t === "BLOG"
                    ? "/blog"
                    : t === "APOLOGETICS"
                      ? "/apologetics"
                      : `/knowledge/browse?type=${t}`
                }
                className="rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs font-bold text-[#94A3B8] hover:text-white transition-colors"
              >
                {CONTENT_TYPE_LABELS[t]}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </PublicPageLayout>
  );
}
