import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock, PenLine, Search, Sparkles } from "lucide-react";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { BRAND, siteUrl } from "@/lib/brand";
import { db } from "@/lib/db";
import { displayArticleAuthor } from "@/lib/blog-server";
import { BLOG_CATEGORIES } from "@/lib/blog";

export const metadata: Metadata = {
  title: `${BRAND.name} Blog — Faith, Fellowship & Christian Community`,
  description: `Articles, Bible studies, devotionals and testimonies from the ${BRAND.name} community.`,
  alternates: { canonical: siteUrl("/blog") },
  openGraph: {
    title: `${BRAND.name} Blog — Faith, Fellowship & Christian Community`,
    description: `Articles, Bible studies, devotionals and testimonies from the ${BRAND.name} community.`,
    type: "website",
    siteName: BRAND.name,
    url: siteUrl("/blog"),
  },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

type SearchParams = { q?: string; category?: string; page?: string };

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = "", category = "", page: pageRaw = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageRaw || "1", 10) || 1);
  const filtersActive = Boolean(q.trim() || category);

  // Dual public-visibility gate (Task 73): legacy boolean + workflow status +
  // schedule. Never shows drafts, pending submissions or rejected articles.
  const visibility = {
    published: true,
    status: "published",
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
  };

  const where = {
    ...visibility,
    ...(category ? { category } : {}),
    ...(q.trim()
      ? {
          OR: [
            { title: { contains: q.trim(), mode: "insensitive" as const } },
            { excerpt: { contains: q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, posts] = await Promise.all([
    db.blogPost.count({ where }),
    db.blogPost.findMany({
      where,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
      include: { authorUser: { select: { id: true, name: true, username: true, image: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const featured = !filtersActive && page === 1 ? (posts.find((p) => p.featured) ?? null) : null;
  const gridPosts = featured ? posts.filter((p) => p.id !== featured.id) : posts;
  const hasNextPage = page * PAGE_SIZE < total;

  const cardMeta = (p: {
    author: string | null;
    tags: string;
    authorUser: { id: string; name: string | null; username: string | null; image: string | null } | null;
  }) => {
    const author = displayArticleAuthor(p);
    let tags: string[] = [];
    try {
      const parsed = JSON.parse(p.tags || "[]");
      if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === "string").slice(0, 3);
    } catch {
      /* legacy */
    }
    return { author, tags };
  };

  const fmtDate = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "Recently";

  const buildPageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (category) sp.set("category", category);
    if (n > 1) sp.set("page", String(n));
    const qs = sp.toString();
    return `/blog${qs ? `?${qs}` : ""}`;
  };

  return (
    <PublicPageLayout>
      {/* Hero */}
      <section className="py-14 px-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-5">
          <BookOpen size={12} /> {BRAND.name} Blog
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Articles &amp; Reflections</h1>
        <p className="text-sm text-[#A09DB1] leading-relaxed max-w-xl mx-auto mb-6">
          Bible studies, devotionals, testimonies and encouragement from the {BRAND.name} community —
          written by members, reviewed by the {BRAND.name} team.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/blog/write"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all hover:-translate-y-px"
          >
            <PenLine size={14} /> Write an Article
          </Link>
          {/* Search — a plain GET form: works with and without JavaScript */}
          <form action="/blog" method="get" className="relative">
            {category && <input type="hidden" name="category" value={category} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search articles…"
              aria-label="Search articles"
              className="w-56 sm:w-72 rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F39B9B]/60"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#726E88] hover:text-white transition-colors"
            >
              <Search size={15} />
            </button>
          </form>
        </div>
      </section>

      {/* Category filter chips */}
      <section className="pb-2 px-6 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={buildPageHref(1).replace(/([?&])page=\d+/, "")}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
              !category
                ? "border-[#F39B9B]/50 bg-[#F39B9B]/10 text-[#F39B9B]"
                : "border-white/10 bg-white/[0.03] text-[#A09DB1] hover:text-white hover:border-white/25"
            }`}
          >
            All
          </Link>
          {BLOG_CATEGORIES.map((c) => {
            const sp = new URLSearchParams();
            if (c) sp.set("category", c);
            if (q.trim()) sp.set("q", q.trim());
            return (
              <Link
                key={c}
                href={`/blog?${sp.toString()}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  category === c
                    ? "border-[#F39B9B]/50 bg-[#F39B9B]/10 text-[#F39B9B]"
                    : "border-white/10 bg-white/[0.03] text-[#A09DB1] hover:text-white hover:border-white/25"
                }`}
              >
                {c}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section className="py-8 px-6 max-w-4xl mx-auto">
          <Link
            href={`/blog/${featured.slug}`}
            className="group block rounded-3xl border border-white/[0.06] bg-[#1C1929] overflow-hidden hover:border-white/[0.15] transition-all"
          >
            <div className="relative aspect-[16/7] bg-[#0F1420]">
              {featured.featuredImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.featuredImage}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#F39B9B]/40">
                  <BookOpen size={40} />
                </div>
              )}
              <span className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#F39B9B] border border-[#F39B9B]/30">
                <Sparkles size={10} /> Featured
              </span>
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#F39B9B] mb-1.5">
                {featured.category}
                {featured.readingMinutes ? ` · ${featured.readingMinutes} min read` : ""}
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-2 group-hover:text-[#F39B9B] transition-colors">
                {featured.title}
              </h2>
              {featured.excerpt && (
                <p className="text-sm text-[#A09DB1] line-clamp-2 mb-3">{featured.excerpt}</p>
              )}
              <p className="text-xs text-[#726E88]">
                {displayArticleAuthor(featured).name} · {fmtDate(featured.publishedAt)}
              </p>
            </div>
          </Link>
        </section>
      )}

      {/* Grid */}
      <section className="py-8 px-6 max-w-4xl mx-auto">
        {gridPosts.length === 0 && !featured ? (
          /* Polished empty state */
          <div className="rounded-3xl border border-white/[0.06] bg-[#1C1929] p-10 text-center">
            <BookOpen size={36} className="mx-auto mb-4 text-[#F39B9B]/50" />
            <h2 className="text-lg font-black text-white mb-2">
              {filtersActive ? "No articles match your search" : "No articles published yet"}
            </h2>
            <p className="text-sm text-[#A09DB1] leading-relaxed max-w-md mx-auto mb-6">
              {filtersActive
                ? "Try a different search term or category — new articles are added as the community writes."
                : `Articles are being prepared. In the meantime, explore everything else ${BRAND.name} has to offer.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {filtersActive && (
                <Link
                  href="/blog"
                  className="rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-5 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider transition-colors"
                >
                  Clear filters
                </Link>
              )}
              <Link
                href="/"
                className="rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] px-5 py-2.5 text-xs font-extrabold text-slate-950 uppercase tracking-wider transition-colors"
              >
                Explore {BRAND.name}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gridPosts.map((p) => {
                const { author, tags } = cardMeta(p);
                return (
                  <Link
                    key={p.id}
                    href={`/blog/${p.slug}`}
                    className="group flex flex-col rounded-2xl border border-white/[0.06] bg-[#1C1929] overflow-hidden hover:border-white/[0.15] hover:-translate-y-0.5 transition-all"
                  >
                    <div className="relative aspect-[16/9] bg-[#0F1420]">
                      {p.featuredImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.featuredImage}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#F39B9B]/30">
                          <BookOpen size={28} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B] mb-1.5">
                        {p.category}
                        {p.readingMinutes ? (
                          <span className="text-[#726E88] normal-case font-semibold inline-flex items-center gap-1 ml-1.5">
                            <Clock size={9} /> {p.readingMinutes} min
                          </span>
                        ) : null}
                      </p>
                      <h3 className="text-sm font-black text-white mb-1.5 line-clamp-2 group-hover:text-[#F39B9B] transition-colors">
                        {p.title}
                      </h3>
                      {p.excerpt && <p className="text-xs text-[#A09DB1] line-clamp-2 mb-2.5">{p.excerpt}</p>}
                      {tags.length > 0 && (
                        <p className="text-[10px] text-[#726E88] mb-2.5 truncate">
                          {tags.map((t) => `#${t}`).join(" ")}
                        </p>
                      )}
                      <p className="mt-auto text-[11px] text-[#726E88]">
                        {author.name} · {fmtDate(p.publishedAt)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Load more / pagination */}
            {(hasNextPage || page > 1) && (
              <div className="mt-8 flex items-center justify-center gap-3">
                {page > 1 && (
                  <Link
                    href={buildPageHref(page - 1)}
                    className="rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-5 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider transition-colors"
                  >
                    Newer
                  </Link>
                )}
                <span className="text-xs text-[#726E88]">
                  Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                </span>
                {hasNextPage && (
                  <Link
                    href={buildPageHref(page + 1)}
                    className="rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-5 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider transition-colors"
                  >
                    Load More
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </PublicPageLayout>
  );
}
