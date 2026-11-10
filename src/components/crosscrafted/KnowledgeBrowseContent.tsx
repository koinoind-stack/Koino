"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Library } from "lucide-react";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";
import { CONTENT_TYPES, type ContentType } from "@/lib/content-taxonomy";
import { KNOWLEDGE_TYPE_KEYS } from "./knowledge-i18n";

// Localized UI chrome for /knowledge/browse — the server page (DB queries,
// redirects, English SEO metadata) passes the listing data down as plain
// serializable props; every visible string renders through the dictionaries.

export type BrowseArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  authorName: string | null;
  publishedAt: string | null; // ISO string — serialized from the server page
  readingMinutes: number | null;
  difficulty: string | null;
  featured: boolean;
  canonicalUrl: string | null;
};

export type BrowseCategory = { id: string; name: string; slug: string };
export type BrowseTopic = { id: string; name: string; slug: string; color: string | null };

type Props = {
  type: ContentType;
  articles: BrowseArticle[];
  categories: BrowseCategory[];
  categoryTopics: BrowseTopic[]; // topics of the selected category, [] when none selected
  selectedCategoryName: string | null;
  selectedTopicName: string | null;
  hasFilters: boolean;
  page: number;
  totalPages: number;
  categorySlug: string;
  topicSlug: string;
};

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

export default function KnowledgeBrowseContent({
  type,
  articles,
  categories,
  categoryTopics,
  selectedCategoryName,
  selectedTopicName,
  hasFilters,
  page,
  totalPages,
  categorySlug,
  topicSlug,
}: Props) {
  const t = useTranslation();
  const { lang } = useLanguage();
  const dateLocale = lang === "te" ? "te-IN" : "en-US";

  return (
    <>
      {/* Breadcrumb + heading */}
      <div className="mb-8">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED]/15 text-[#A78BFA] text-xs font-bold px-3 py-1 mb-4 hover:bg-[#7C3AED]/25 transition-colors"
        >
          <Library size={13} />
          {t("knowledge.title")}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          {t(KNOWLEDGE_TYPE_KEYS[type].label)}
        </h1>
        <p className="text-sm text-[#94A3B8]">
          {selectedTopicName
            ? t("knowledge.list.topic", { name: selectedTopicName })
            : selectedCategoryName
              ? t("knowledge.list.category", { name: selectedCategoryName })
              : t("knowledge.list.everything")}
        </p>
      </div>

      {/* Category navigation — DB taxonomy when available */}
      {categories.length > 0 && (
        <section aria-label={t("knowledge.aria.categories")} className="mb-8">
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildPageHref(type, "", "", 1)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                !categorySlug
                  ? "bg-[#7C3AED]/25 text-white border-[#7C3AED]/50"
                  : "bg-white/[0.03] text-[#94A3B8] border-white/[0.08] hover:text-white"
              }`}
            >
              {t("knowledge.list.all")}
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
              {categoryTopics.map((topic) => (
                <Link
                  key={topic.id}
                  href={buildPageHref(type, categorySlug, topic.slug, 1)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                    topicSlug === topic.slug
                      ? "bg-[#EC4899]/20 text-white border-[#EC4899]/40"
                      : "bg-white/[0.04] text-[#CBD5E1] border-white/[0.08] hover:text-white"
                  }`}
                >
                  {topic.color && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: topic.color }}
                    />
                  )}
                  {topic.name}
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
              ? t("knowledge.list.emptyFiltered")
              : t("knowledge.list.emptyType", { label: t(KNOWLEDGE_TYPE_KEYS[type].label) })}
          </p>
          <p className="text-xs text-[#94A3B8]">
            {t("knowledge.list.emptyHintPre")}{" "}
            <Link href="/knowledge" className="text-[#A78BFA] hover:underline">
              {t("knowledge.title")}
            </Link>
            {t("knowledge.list.emptyHintPost")}
          </p>
        </div>
      ) : (
        <section
          aria-label={t(KNOWLEDGE_TYPE_KEYS[type].label)}
          className="grid sm:grid-cols-2 gap-4"
        >
          {articles.map((a) => {
            // This page only renders ARTICLE / BIBLE_STUDY / DEVOTIONAL /
            // TESTIMONY (Blog and Apologetics redirect to their dedicated
            // listings server-side). A row links out via its explicit
            // canonicalUrl when one is set, otherwise the card is
            // informational. No invented detail system.
            const href = a.canonicalUrl || null;
            const body = (
              <>
                <div className="flex items-center gap-2 mb-1">
                  {a.featured && (
                    <span className="rounded-full bg-[#22C55E]/20 border border-[#22C55E]/40 text-[#22C55E] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                      {t("knowledge.list.featured")}
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
                    ? new Date(a.publishedAt).toLocaleDateString(dateLocale, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : ""}
                  {a.readingMinutes ? ` · ${t("knowledge.list.minRead", { n: a.readingMinutes })}` : ""}
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
              <ChevronLeft size={14} /> {t("knowledge.list.prev")}
            </Link>
          ) : null}
          <span className="text-xs text-[#64748B]">
            {t("knowledge.list.pageOf", { page, total: totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={buildPageHref(type, categorySlug, topicSlug, page + 1)}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white"
            >
              {t("knowledge.list.next")} <ChevronRight size={14} />
            </Link>
          ) : null}
        </div>
      )}

      {/* Cross-type navigation — the landing stays the central hub */}
      <section aria-label={t("knowledge.list.otherTypes")} className="mt-12">
        <h2 className="text-sm font-bold text-white mb-3">{t("knowledge.list.otherTypes")}</h2>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.filter((ct) => ct !== type).map((ct) => (
            <Link
              key={ct}
              href={
                ct === "BLOG"
                  ? "/blog"
                  : ct === "APOLOGETICS"
                    ? "/apologetics"
                    : `/knowledge/browse?type=${ct}`
              }
              className="rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs font-bold text-[#94A3B8] hover:text-white transition-colors"
            >
              {t(KNOWLEDGE_TYPE_KEYS[ct].label)}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
