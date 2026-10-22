import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import Link from "next/link";
import { Calendar, ArrowLeft, Tag } from "lucide-react";
import { notFound } from "next/navigation";

const db = new PrismaClient();

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

  if (!post || !post.published) {
    return { title: "Article Not Found — Koino Blog" };
  }

  // Public visibility gate for SEO too — if the post is future-scheduled,
  // we don't want search engines indexing it yet.
  const now = new Date();
  if (post.publishedAt && post.publishedAt > now) {
    return { title: "Article Not Found — Koino Blog" };
  }

  const title = post.seoTitle || `${post.title} — Koino Blog`;
  const description = post.seoDescription || post.excerpt || "";
  const canonical = post.canonicalUrl || `https://www.koino.in/blog/${post.slug}`;
  const images = post.featuredImage ? [post.featuredImage] : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.seoTitle || post.title,
      description,
      images,
      siteName: "Koino",
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
  const post = await db.blogPost.findUnique({ where: { slug } });

  // Visibility gate — drafts and future-scheduled posts are NOT publicly
  // visible. Call notFound() so the response is a clean 404.
  const now = new Date();
  if (!post || !post.published || (post.publishedAt && post.publishedAt > now)) {
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

  // Fetch related posts — only published, only the ones the admin picked.
  // Exclude the current post defensively (in case the admin accidentally
  // listed the post as related to itself).
  const related =
    relatedIds.length > 0
      ? await db.blogPost.findMany({
          where: {
            AND: [
              { id: { in: relatedIds } },
              { NOT: { id: post.id } },
              { published: true },
              { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
            ],
          },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImage: true,
            category: true,
            publishedAt: true,
          },
          // Preserve the order the admin chose in relatedArticleIds.
        })
      : [];

  // Re-sort the related posts to match the admin's chosen order.
  const orderedRelated = relatedIds
    .map((id) => related.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const canonical = post.canonicalUrl || `/blog/${post.slug}`;

  return (
    <PublicPageLayout>
      <article className="max-w-2xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/blog"
          className="text-xs text-[#A78BFA] hover:text-white flex items-center gap-1 mb-6"
        >
          <ArrowLeft size={12} /> Back to Blog
        </Link>

        {/* Eyebrow + Title */}
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">
          {post.category}
        </span>
        <h1 className="text-3xl md:text-4xl font-black text-white mt-2 mb-3 leading-tight">
          {post.title}
        </h1>

        {/* Byline */}
        {(post.publishedAt || post.author) && (
          <p className="text-[11px] text-[#64748B] mb-6 flex items-center gap-2 flex-wrap">
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
            {post.author && (
              <span>
                · by <span className="text-[#94A3B8] font-semibold">{post.author}</span>
              </span>
            )}
          </p>
        )}

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

        {/* Content — rendered as pre-wrap so admins can paste markdown
            or plain text and have whitespace respected. */}
        <div className="prose prose-invert max-w-none">
          <p className="text-sm text-[#A09DB1] leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
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
            Originally published at{" "}
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
            Related Articles
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
