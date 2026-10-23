"use client";

/**
 * Bible Movies & Video Library — public directory (Part 5).
 *
 * Sections: Continue Watching (signed-in), Featured Videos, Recently Added,
 * and full filtered browsing (search + category chips + language filter +
 * optional Bible passage scope via ?book=&chapter=).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Search, ChevronLeft, BookOpen, PlayCircle } from "lucide-react";
import VideoCard, { type VideoCardData } from "./VideoCard";
import {
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  categoryLabel,
} from "@/lib/videos";
import { getBook } from "@/lib/bible-data";

type Me = {
  username?: string | null;
} | null;

type LibraryResponse = { videos: VideoCardData[]; nextCursor: string | null };
type MeResponse = {
  continueWatching: VideoCardData[];
  watchLater: VideoCardData[];
  favorites: VideoCardData[];
  recentlyWatched: VideoCardData[];
};

export default function VideosLibrary({ initialBook, initialChapter }: { initialBook?: string; initialChapter?: number }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [videos, setVideos] = useState<VideoCardData[]>([]);
  const [featured, setFeatured] = useState<VideoCardData[]>([]);
  const [recent, setRecent] = useState<VideoCardData[]>([]);
  const [continueWatching, setContinueWatching] = useState<VideoCardData[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<Me>(null);
  const nextCursor = useRef<string | null>(null);
  const passageScoped = Boolean(initialBook);

  // Who's signed in (drives the personal-library sections).
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.id) {
          setSignedIn(true);
          setMe({ username: d.username || null });
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (category) params.set("category", category);
        if (language) params.set("language", language);
        if (initialBook) params.set("book", initialBook);
        if (initialChapter) params.set("chapter", String(initialChapter));
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/videos?${params.toString()}`, { cache: "no-store" });
        const data: LibraryResponse = await res.json();
        setVideos((prev) => (cursor ? [...prev, ...(data.videos || [])] : data.videos || []));
        nextCursor.current = data.nextCursor || null;
      } catch {
        // network hiccup — keep what we have
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [q, category, language, initialBook, initialChapter],
  );

  // Debounced reload on filter change.
  useEffect(() => {
    const t = setTimeout(() => load(), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Rails (featured / recently added) + personal library — loaded once.
  useEffect(() => {
    fetch("/api/videos?featured=1&take=8", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d: LibraryResponse) => setFeatured(d.videos || []))
      .catch(() => {});
    if (signedIn) {
      fetch("/api/videos/me", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: MeResponse | null) => {
          if (d) setContinueWatching(d.continueWatching || []);
        })
        .catch(() => {});
    }
  }, [signedIn]);

  // "Recently Added" = plain recent list, only shown when NO filters are active.
  const filtersActive = Boolean(q.trim() || category || language || passageScoped);
  useEffect(() => {
    if (filtersActive) return;
    fetch("/api/videos?take=8", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d: LibraryResponse) => setRecent(d.videos || []))
      .catch(() => {});
  }, [filtersActive]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 pt-8 pb-24">
      {/* ─── heading ─── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 mb-4">
          <Clapperboard size={26} className="text-[#C4B5FD]" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Bible Movies &amp; Videos</h1>
        <p className="text-sm text-[#94A3B8] mt-2 max-w-lg mx-auto leading-relaxed">
          Bible movies, animated Bible stories, Christian films, sermons, and worship —
          connected to the Scriptures they bring to life. Read the Bible. Watch its stories.
        </p>
      </div>

      {/* ─── passage scope banner ─── */}
      {passageScoped && (
        <div className="mb-6 flex items-center justify-between gap-3 bg-[#7C3AED]/[0.08] border border-[#7C3AED]/25 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen size={16} className="text-[#C4B5FD] shrink-0" />
            <p className="text-sm text-[#C4B5FD] font-bold truncate">
              Videos for {getBook(initialBook || "")?.name || initialBook}
              {initialChapter ? ` ${initialChapter}` : ""}
            </p>
          </div>
          <a href="/videos" className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white">
            <ChevronLeft size={13} /> Clear
          </a>
        </div>
      )}

      {/* ─── search + filters ─── */}
      <div className="space-y-3 mb-8">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search videos, stories, teachings…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-full pl-11 pr-4 py-3 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#7C3AED]/50 [&>option]:bg-[#1C1929]"
          >
            <option value="">All languages</option>
            {VIDEO_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeLabel} ({l.name})
              </option>
            ))}
          </select>
          <select
            value=""
            onChange={(e) => {
              // language quick-set for narrow screens is covered by the other select;
              // this one jumps straight to a clean category view
              setCategory(e.target.value);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="md:hidden bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white outline-none [&>option]:bg-[#1C1929]"
          >
            <option value="">All categories</option>
            {VIDEO_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        {/* category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <button
            onClick={() => { setCategory(""); }}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${
              category === ""
                ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white"
            }`}
          >
            All
          </button>
          {VIDEO_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCategory(c.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${
                category === c.id
                  ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                  : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── continue watching ─── */}
      {signedIn && continueWatching.length > 0 && (
        <Section title="Continue Watching" subtitle={me?.username ? `Welcome back, ${me.username}` : undefined}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {continueWatching.slice(0, 4).map((v) => (
              <VideoCard key={`cw-${v.id}`} video={v} />
            ))}
          </div>
        </Section>
      )}

      {/* ─── featured ─── */}
      {!filtersActive && featured.length > 0 && (
        <Section title="Featured Videos">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {featured.slice(0, 8).map((v) => (
              <VideoCard key={`f-${v.id}`} video={{ ...v, featured: true }} />
            ))}
          </div>
        </Section>
      )}

      {/* ─── recently added (unfiltered only) ─── */}
      {!filtersActive && recent.length > 0 && (
        <Section title="Recently Added">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {recent.map((v) => (
              <VideoCard key={`r-${v.id}`} video={v} />
            ))}
          </div>
        </Section>
      )}

      {/* ─── main grid ─── */}
      <Section
        title={
          filtersActive
            ? category
              ? categoryLabel(category)
              : "Search Results"
            : "Browse All Videos"
        }
      >
        {loading && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#94A3B8]">Loading videos…</p>
          </div>
        )}
        {loaded && !loading && videos.length === 0 && (
          <div className="text-center py-14">
            <PlayCircle size={36} className="mx-auto text-[#4B5563] mb-3" />
            <p className="text-sm font-bold text-[#94A3B8]">No videos found</p>
            <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto">
              {filtersActive
                ? "Try different search words or clear a filter."
                : "The library is just getting started — check back soon."}
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
        {nextCursor.current && videos.length > 0 && (
          <div className="text-center mt-6">
            <button
              onClick={() => load(nextCursor.current || undefined)}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-[#94A3B8] hover:text-white disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-9">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-base md:text-lg font-extrabold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
