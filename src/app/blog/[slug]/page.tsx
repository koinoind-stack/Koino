import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import Link from "next/link";
import { Calendar, ArrowLeft, Clock, Tag } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { T } from "@/components/crosscrafted/T";
import { BRAND, siteUrl } from "@/lib/brand";
import { displayArticleAuthor } from "@/lib/blog-server";
import MarkdownRenderer from "@/components/crosscrafted/MarkdownRenderer";
import ArticleShareBar from "@/components/blog/ArticleShareBar";

export const dynamic = "force-dynamic";

// ─── generateMetadata ──────────────────────────────────────────────────────

/**
 * Returns SEO metadata for the article. Uses seoTitle / seoDescription
 * if provided, falling back to the post title / excerpt. Includes
 * openGraph (type=article) and twitter (summary_large_image) cards.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({ where: { slug } });

  // Dual public-visibility gate for SEO (Task 73): legacy boolean + workflow
  // status + schedule — unpublished content must never be indexed.
  const now = new Date();
  if (
    !post ||
    !post.published ||
    post.status !== "published" ||
    (post.publishedAt && post.publishedAt > now)
  ) {
    return { title: "Article Not Found — Koino Blog" };
  }

  const title = post.seoTitle || `${post.title} — Koino Blog`;
  const description = post.seoDescription || post.excerpt || "";
  const canonical = post.canonicalUrl || siteUrl(`/blog/${post.slug}`);
  const images = post.featuredImage ? [post.featuredImage] : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.seoTitle || post.title,
      description,
      images,
      siteName: BRAND.name,
      url: canonical,
      type: "article",
      ...(post.publishedAt
        ? { publishedTime: post.publishedAt.toISOString() }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle || post.title,
      description,
      images,
    },
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: {
      authorUser: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  // Visibility gate — drafts, pending submissions, rejected/archived and
  // future-scheduled posts are NOT publicly visible (dual gate). Call
  // notFound() so the response is a clean 404.
  const now = new Date();
  if (
    !post ||
    !post.published ||
    post.status !== "published" ||
    (post.publishedAt && post.publishedAt > now)
  ) {
    notFound();
  }

  // Parse tags + related article IDs (stored as JSON-array TEXT columns).
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(post.tags || "[]");
    if (Array.isArray(parsed)) {
      tags = parsed.map((v) => String(v ?? "")).filter((v) => v.length > 0);
    }
  } catch {
    tags = [];
  }

  let relatedIds: string[] = [];
  try {
    const parsed = JSON.parse(post.relatedArticleIds || "[]");
    if (Array.isArray(parsed)) {
      relatedIds = parsed
        .map((v) => String(v ?? "").trim())
        .filter((v) => v.length > 0);
    }
  } catch {
    relatedIds = [];
  }

  // Fetch related posts — admin-picked first; if none were chosen, fall back
  // to the latest published posts in the same category (Task 73).
  const relatedVisibility = {
    published: true,
    status: "published",
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
  const relatedSelect = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    featuredImage: true,
    category: true,
    publishedAt: true,
    readingMinutes: true,
  } as const;

  const picked =
    relatedIds.length > 0
      ? await db.blogPost.findMany({
          where: {
            AND: [
              { id: { in: relatedIds } },
              { NOT: { id: post.id } },
              relatedVisibility,
            ],
          },
          select: relatedSelect,
        })
      : [];

  // Re-sort the picked posts to match the admin's chosen order.
  let orderedRelated = relatedIds
    .map((id) => picked.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  // Auto-related fallback: same category, newest first.
  if (orderedRelated.length < 3) {
    const auto = await db.blogPost.findMany({
      where: {
        AND: [
          { category: post.category },
          { NOT: { id: post.id } },
          { id: { notIn: orderedRelated.map((r) => r.id) } },
          relatedVisibility,
        ],
      },
      select: relatedSelect,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: 3 - orderedRelated.length,
    });
    orderedRelated = [...orderedRelated, ...auto];
  }

  const canonical = post.canonicalUrl || siteUrl(`/blog/${post.slug}`);
  const author = displayArticleAuthor(post);

  // JSON-LD Article schema (SEO)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.featuredImage || undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: author.name },
    publisher: { "@type": "Organization", name: BRAND.name, url: BRAND.url },
    mainEntityOfPage: canonical,
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-2xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/blog"
          className="text-xs text-[#A78BFA] hover:text-white flex items-center gap-1 mb-6"
        >
          <ArrowLeft size={12} /> <T k="page.blog.back" />
        </Link>

        {/* Eyebrow + Title */}
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">
          {post.category}
        </span>
        <h1 className="text-3xl md:text-4xl font-black text-white mt-2 mb-3 leading-tight">
          {post.title}
        </h1>

        {/* Byline */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="text-[11px] text-[#64748B] flex items-center gap-2 flex-wrap">
            {post.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
            <span>
              · by <span className="text-[#94A3B8] font-semibold">{author.name}</span>
            </span>
            {post.readingMinutes != null && (
              <span className="inline-flex items-center gap-1">
                · <Clock size={11} /> {post.readingMinutes} min read
              </span>
            )}
          </div>
          <ArticleShareBar
            title={post.title}
            excerpt={post.excerpt}
            slug={post.slug}
            imageUrl={post.featuredImage}
            shareUrl={canonical}
          />
        </div>

        {/* Featured image */}
        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full rounded-2xl mb-6 max-h-96 object-cover border border-white/[0.06]"
          />
        )}

        {/* Excerpt as lead */}
        {post.excerpt && (
          <p className="text-base text-[#A09DB1] leading-relaxed mb-6 font-semibold border-l-2 border-[#F39B9B]/40 pl-4">
            {post.excerpt}
          </p>
        )}

        {/* Content — Markdown rendered through the existing MarkdownRenderer
            (react-markdown + safeUrl): headings, bold/italic, lists, quotes,
            links and inline images; raw HTML is never executed. */}
        <div className="prose prose-invert max-w-none">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-1.5 items-center">
            <Tag size={11} className="text-[#64748B]" />
            {tags.map((t, i) => (
              <span
                key={i}
                className="bg-[#38BDF8]/10 text-[#38BDF8] text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Canonical link notice (for cross-posted articles) */}
        {post.canonicalUrl && (
          <p className="mt-6 text-[10px] text-[#64748B]">
            <T k="page.blog.publishedAt" />{" "}
            <a
              href={post.canonicalUrl}
              className="text-[#A78BFA] hover:text-white underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {post.canonicalUrl}
            </a>
          </p>
        )}
      </article>

      {/* Related Articles */}
      {orderedRelated.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#94A3B8] mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-[#7C3AED]" />
            <T k="apo.relatedArticles" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {orderedRelated.map((r) => (
              <Link
                key={r.id}
                href={`/blog/${r.slug}`}
                className="group bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.15] hover:-translate-y-0.5 transition-all"
              >
                {r.featuredImage && (
                  <div className="h-32 bg-[#0f0f1a] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.featuredImage}
                      alt={r.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-4">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#F39B9B]">
                    {r.category}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1 leading-snug group-hover:text-[#A78BFA] transition-colors line-clamp-2">
                    {r.title}
                  </h3>
                  {r.excerpt && (
                    <p className="text-[11px] text-[#A09DB1] mt-1 line-clamp-2">{r.excerpt}</p>
                  )}
                  {r.publishedAt && (
                    <p className="text-[9px] text-[#64748B] mt-2 flex items-center gap-1">
                      <Calendar size={9} />
                      {new Date(r.publishedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PublicPageLayout>
  );
}
