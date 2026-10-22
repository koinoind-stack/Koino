import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import BlogListClient, {
  type PublicBlogPost,
} from "@/components/crosscrafted/BlogListClient";
import Link from "next/link";
import { Calendar, Star, ArrowRight } from "lucide-react";

const db = new PrismaClient();

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Koino Blog — Faith, Fellowship & Christian Community",
  description:
    "Christian articles, teachings, insights and stories to help you grow in faith.",
  openGraph: {
    title: "Koino Blog",
    description:
      "Christian articles, teachings, insights and stories to help you grow in faith.",
    siteName: "Koino",
    url: "https://www.koino.in/blog",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Koino Blog",
    description:
      "Christian articles, teachings, insights and stories to help you grow in faith.",
  },
  alternates: { canonical: "https://www.koino.in/blog" },
};

export default async function BlogPage() {
  // PUBLIC QUERY — only published posts where publishedAt is null OR in the past.
  // Future-scheduled posts and drafts are NEVER shown on the public /blog list.
  const now = new Date();
  const allPublished = await db.blogPost.findMany({
    where: {
      published: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
  });

  // Hero card — first featured post (or fall back to first post if none flagged).
  const featured = allPublished.find((p) => p.featured) ?? allPublished[0] ?? null;
  const rest = featured
    ? allPublished.filter((p) => p.id !== featured.id)
    : allPublished;

  // Distinct categories from the published list (drives the chip bar).
  const categories = Array.from(
    new Set(allPublished.map((p) => p.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Public-safe shape for the client list component (drops content + admin
  // fields so we don't leak anything sensitive to the browser).
  const publicPosts: PublicBlogPost[] = rest.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    featuredImage: p.featuredImage,
    author: p.author,
    category: p.category,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
  }));

  return (
    <PublicPageLayout>
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Heading */}
        <div className="text-center mb-10">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[#F39B9B] mb-2">
            Koino Blog
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
            Christian articles &amp; insights
          </h1>
          <p className="text-sm md:text-base text-[#A09DB1] max-w-2xl mx-auto leading-relaxed">
            Christian articles, teachings, insights and stories to help you grow in faith.
          </p>
        </div>

        {allPublished.length === 0 ? (
          // Empty state — never show drafts here.
          <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-12 text-center">
            <p className="text-sm text-[#94A3B8] mb-2">
              No blog posts published yet.
            </p>
            <p className="text-xs text-[#64748B] mb-4">
              Articles are being prepared. Please check back soon.
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#A78BFA] hover:text-white"
            >
              Learn about Koino <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <>
            {/* Hero / featured post */}
            {featured && (
              <Link
                href={`/blog/${featured.slug}`}
                className="group block bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden mb-8 hover:border-white/[0.15] transition-all"
              >
                <div className="grid md:grid-cols-2 gap-0">
                  {featured.featuredImage && (
                    <div className="relative h-56 md:h-full bg-[#0f0f1a] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={featured.featuredImage}
                        alt={featured.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-3 left-3 bg-[#A855F7] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1">
                        <Star size={9} /> Featured
                      </span>
                    </div>
                  )}
                  <div className="p-6 md:p-8 flex flex-col justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B] mb-2">
                      {featured.category}
                    </span>
                    <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-3 group-hover:text-[#A78BFA] transition-colors">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-sm text-[#A09DB1] leading-relaxed mb-4 line-clamp-3">
                        {featured.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
                      {featured.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(featured.publishedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      )}
                      {featured.author && (
                        <span>
                          by <span className="text-[#94A3B8] font-semibold">{featured.author}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* List (with category + search client-side filter) */}
            <BlogListClient posts={publicPosts} categories={categories} />
          </>
        )}
      </div>
    </PublicPageLayout>
  );
}
