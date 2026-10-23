"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Search, X } from "lucide-react";

// Public post shape — a subset of the admin BlogPost. Only fields the
// public /blog list actually needs.
export type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  author: string | null;
  category: string;
  publishedAt: string | null;
};

/**
 * BlogListClient
 *
 * Pure client component that takes a pre-fetched list of published posts
 * and renders:
 *  - a category filter chip bar (categories derived from the post list)
 *  - a free-text search input
 *  - a responsive 1- or 2-col grid of post cards
 *
 * The search + category filter are entirely client-side, so the /blog page
 * stays a server component for SEO + fast first paint.
 */
export default function BlogListClient({
  posts,
  categories,
}: {
  posts: PublicBlogPost[];
  categories: string[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.author ?? "").toLowerCase().includes(q) ||
        (p.excerpt ?? "").toLowerCase().includes(q)
      );
    });
  }, [posts, search, category]);

  return (
    <div className="space-y-6">
      {/* Category chips + Search */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
          />
          {categories.map((c) => (
            <CategoryChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={c}
            />
          ))}
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…"
            className="w-full bg-[#1C1929] border border-white/[0.06] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#7C3AED]/60 focus:bg-[#22202F] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Post grid */}
      {filtered.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-10 text-center">
          <p className="text-sm text-[#94A3B8] mb-2">
            {search || category !== "all"
              ? "No articles match your filter."
              : "No articles published yet."}
          </p>
          <Link
            href="/about"
            className="inline-flex items-center text-xs font-bold text-[#A78BFA] hover:text-white"
          >
            Learn about Koino →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="group bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.15] hover:-translate-y-0.5 transition-all"
            >
              {p.featuredImage && (
                <div className="relative h-44 bg-[#0f0f1a] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.featuredImage}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#F39B9B]">
                    {p.category}
                  </span>
                  {p.publishedAt && (
                    <span className="text-[10px] text-[#64748B] flex items-center gap-1">
                      <Calendar size={9} />
                      {new Date(p.publishedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white leading-snug mb-2 group-hover:text-[#A78BFA] transition-colors">
                  {p.title}
                </h3>
                {p.excerpt && (
                  <p className="text-xs text-[#A09DB1] leading-relaxed line-clamp-2 mb-3">
                    {p.excerpt}
                  </p>
                )}
                {p.author && (
                  <p className="text-[10px] text-[#64748B]">
                    by <span className="text-[#94A3B8] font-semibold">{p.author}</span>
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
        active
          ? "bg-[#7C3AED] border-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/20"
          : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white hover:border-white/[0.15]"
      }`}
    >
      {label}
    </button>
  );
}
