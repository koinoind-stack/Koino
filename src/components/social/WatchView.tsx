"use client";

/**
 * Koino Watch — the unified viewing hub.
 *
 * One connected experience over the real video surfaces, without
 * merging their storage:
 *  - For You → discovery over everything that actually exists: featured
 *    library videos, the newest library additions, and a strip of real
 *    member Reels (empty sections are hidden, a combined helpful empty
 *    state shows when there is nothing at all);
 *  - Reels tab → inline `ReelsFeed` (existing isReel posts) + one-tap jump to
 *    the optimized full-screen vertical player (existing ReelsOverlay);
 *  - Bible Movies & Stories → published `Video` rows in the Bible categories,
 *    grouped by their real Bible book refs (VideoBibleRef);
 *  - Christian Videos → the sermons / worship / films / documentaries
 *    categories.
 *
 * Everything renders from EXISTING data and endpoints (/api/videos,
 * /api/social/posts?reels=1). No videos are invented; a category with no
 * content shows a compact helpful empty state. Library cards open the
 * existing /videos/[slug] watch page (normal player). The full searchable
 * library stays at /videos, reachable from the hub ("Full library").
 * Bible Comics stays a separate feature — the hub only links to it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, Clapperboard, ChevronRight, Film, Heart, Maximize2, MonitorPlay,
  Palette, Sparkles, TvMinimalPlay,
} from "lucide-react";
import VideoCard, { type VideoCardData } from "@/components/videos/VideoCard";
import { categoryLabel } from "@/lib/videos";
import { getBook } from "@/lib/bible-data";
import ReelsOverlay, { ReelsFeed } from "./ReelsView";
import PostDetail from "./PostDetail";
import { api, type Post } from "./types";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type BibleRef = { bookId: string; chapterStart: number };

type VideoRow = VideoCardData & { bibleRefs?: BibleRef[] };

type Props = {
  onOpenProfile: (username: string) => void;
  onOpenCreate: () => void;
  onOpenComics: () => void;
  onHashtag: (tag: string) => void;
};

type Tab = "foryou" | "reels" | "bible" | "christian";

const TABS: Array<{ id: Tab; labelKey?: string; label: string; icon: typeof Film }> = [
  { id: "foryou", label: "For You", icon: Sparkles },
  { id: "reels", labelKey: "explore.tab.reels", label: "Reels", icon: Film },
  { id: "bible", labelKey: "watch.tab.bible", label: "Bible Movies & Stories", icon: BookOpen },
  { id: "christian", labelKey: "watch.tab.christian", label: "Christian Videos", icon: TvMinimalPlay },
];

const BIBLE_CATEGORIES = [
  "bible_movies", "ot_stories", "nt_stories", "jesus_gospels", "animated", "children",
] as const;

const CHRISTIAN_CATEGORIES = [
  "christian_films", "sermons", "worship", "documentaries",
] as const;

export default function WatchView({ onOpenProfile, onOpenCreate, onOpenComics, onHashtag }: Props) {
  const t = useTranslation();
  const [tab, setTab] = useState<Tab>("foryou");
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [featured, setFeatured] = useState<VideoRow[]>([]);
  const [communityReels, setCommunityReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [bibleCat, setBibleCat] = useState<string>("");
  const [christianCat, setChristianCat] = useState<string>("");
  const [bookFilter, setBookFilter] = useState<string>("");
  const [fullscreenReels, setFullscreenReels] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [libRes, featRes] = await Promise.allSettled([
        fetch("/api/videos?take=48", { cache: "no-store" }),
        fetch("/api/videos?featured=1&take=8", { cache: "no-store" }),
      ]);
      const lib = libRes.status === "fulfilled" && libRes.value.ok
        ? await libRes.value.json()
        : { videos: [] };
      const feat = featRes.status === "fulfilled" && featRes.value.ok
        ? await featRes.value.json()
        : { videos: [] };
      setVideos((lib.videos || []) as VideoRow[]);
      setFeatured((feat.videos || []) as VideoRow[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Community Reels for the For You strip — best-effort, never blocks the
  // hub: any failure (signed-out session, network hiccup) simply hides the
  // section. Reels are member posts and stay separate from the curated
  // library everywhere (spec §3).
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    api<{ posts: Post[] }>("/api/social/posts?reels=1&limit=12", { signal: ctrl.signal })
      .then((d) => {
        if (!cancelled) setCommunityReels((d.posts || []).filter((p) => (p.repostedFrom ?? p).mediaUrls?.length));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  const bibleVideos = useMemo(() => videos.filter((v) => (BIBLE_CATEGORIES as readonly string[]).includes(v.category)), [videos]);
  const christianVideos = useMemo(() => videos.filter((v) => (CHRISTIAN_CATEGORIES as readonly string[]).includes(v.category)), [videos]);

  // Real "By Bible Book" grouping — only books that actually have videos.
  const bookChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of bibleVideos) {
      for (const ref of v.bibleRefs || []) {
        counts.set(ref.bookId, (counts.get(ref.bookId) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([bookId, count]) => ({ bookId, count, name: getBook(bookId)?.name || bookId }));
  }, [bibleVideos]);

  const bibleFiltered = useMemo(() => {
    let list = bibleCat ? bibleVideos.filter((v) => v.category === bibleCat) : bibleVideos;
    if (bookFilter) {
      list = list.filter((v) => (v.bibleRefs || []).some((r) => r.bookId === bookFilter));
    }
    return list;
  }, [bibleVideos, bibleCat, bookFilter]);

  const christianFiltered = useMemo(
    () => (christianCat ? christianVideos.filter((v) => v.category === christianCat) : christianVideos),
    [christianVideos, christianCat],
  );

  // For You — newest library additions (featured deduped so a video never
  // appears twice on the same tab).
  const featuredIds = useMemo(() => new Set(featured.map((v) => v.id)), [featured]);
  const recentVideos = useMemo(() => videos.filter((v) => !featuredIds.has(v.id)).slice(0, 8), [videos, featuredIds]);

  return (
    <div className="max-w-[1100px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      {/* ─── heading + quick links ─── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight inline-flex items-center gap-2">
            <MonitorPlay size={22} className="text-[#C4B5FD]" /> {t("watch.title")}
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8] mt-1">
            {t("watch.subtitle")}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <a
            href="/videos"
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-bold text-[#C4B5FD] hover:border-[#7C3AED]/50"
          >
            <Clapperboard size={13} /> {t("watch.fullLibrary")}
          </a>
          <button
            onClick={onOpenComics}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-bold text-[#C4B5FD] hover:border-[#7C3AED]/50"
          >
            <Palette size={13} /> {t("feature.comics.title")}
          </button>
        </div>
      </div>

      {/* ─── category tabs ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
              tab === tb.id
                ? "bg-[#7C3AED] border-transparent text-white"
                : "bg-white/[0.04] border-white/10 text-[#94A3B8] hover:text-white hover:border-white/25"
            }`}
          >
            <tb.icon size={13} /> {tb.labelKey ? t(tb.labelKey) : tb.label}
          </button>
        ))}
      </div>

      {/* mobile quick links (desktop shows them beside the heading) */}
      <div className="flex sm:hidden items-center gap-2 mb-4">
        <a
          href="/videos"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-bold text-[#C4B5FD]"
        >
          <Clapperboard size={12} /> {t("watch.fullLibrary")}
        </a>
        <button
          onClick={onOpenComics}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-bold text-[#C4B5FD]"
        >
          <Palette size={12} /> {t("feature.comics.title")}
        </button>
      </div>

      {/* ─── library load error ─── */}
      {loadError && (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-[#64748B]">{t("watch.loadError")}</p>
          <button
            onClick={load}
            className="px-4 py-2 rounded-full bg-[#7C3AED] text-xs font-bold text-white hover:bg-[#6D28D9]"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-14">
          <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ───────────── FOR YOU ───────────── */}
          {tab === "foryou" && (
            <>
              {featured.length > 0 && (
                <div className="mb-6">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">
                    <Sparkles size={13} /> {t("explore.featured")}
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {featured.map((v) => (
                      <div key={`feat-${v.id}`} className="shrink-0 w-[220px]">
                        <VideoCard video={{ ...v, featured: true }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {communityReels.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#64748B]">
                      <Film size={13} /> {t("watch.fromCommunity")}
                    </h3>
                    <button
                      onClick={() => setTab("reels")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] hover:text-[#A78BFA]"
                    >
                      {t("common.seeAll")} <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {communityReels.map((p) => {
                      const media = p.repostedFrom ?? p;
                      const thumb = p.thumbnailUrl || media.thumbnailUrl || null;
                      return (
                        <button
                          key={`reel-${p.id}`}
                          onClick={() => setFullscreenReels(true)}
                          className="group shrink-0 w-[120px] text-left"
                          title={p.content || t("watch.reelTitleFallback")}
                        >
                          <div className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-white/[0.08] bg-[#1C1929] group-hover:border-[#7C3AED]/40 transition-colors">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[#7C3AED]/25 via-[#1C1929] to-[#0B1120] flex items-center justify-center">
                                <Film size={22} className="text-[#7C3AED]" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-white truncate">
                                @{p.author.username || p.author.name || t("watch.memberFallback")}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white/90 shrink-0">
                                <Heart size={9} fill="currentColor" /> {p.likeCount}
                              </span>
                            </div>
                            <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 backdrop-blur flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                              <Film size={11} className="text-white" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-2">
                    {t("watch.reelsHint")}
                  </p>
                </div>
              )}

              {recentVideos.length > 0 && (
                <div className="mb-2">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">
                    <MonitorPlay size={13} /> {t("watch.newInLibrary")}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {recentVideos.map((v) => (
                      <VideoCard key={`new-${v.id}`} video={v} />
                    ))}
                  </div>
                </div>
              )}

              {/* everything empty → one combined helpful state */}
              {!loadError && featured.length === 0 && communityReels.length === 0 && recentVideos.length === 0 && (
                <EmptyLibrary
                  icon={MonitorPlay}
                  title={t("watch.emptyTitle")}
                  body={t("watch.emptyBody")}
                />
              )}
            </>
          )}

          {/* ───────────── REELS ───────────── */}
          {tab === "reels" && (
            <>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#64748B]">
                  <Film size={13} /> {t("watch.verticalFeed")}
                </h3>
                <button
                  onClick={() => setFullscreenReels(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] hover:text-[#A78BFA]"
                >
                  <Maximize2 size={12} /> {t("watch.fullScreen")}
                </button>
              </div>
              <ReelsFeed
                className="h-[calc(100dvh-260px)] min-h-[440px] max-h-[720px] w-full rounded-3xl overflow-hidden border border-white/[0.08]"
                onOpenProfile={onOpenProfile}
                onOpenPost={setDetailId}
                onOpenCreate={onOpenCreate}
              />
              <p className="text-[11px] text-[#64748B] mt-2 text-center">
                {t("watch.swipeHint")}
              </p>
            </>
          )}

          {/* ───────────── BIBLE MOVIES & STORIES ───────────── */}
          {tab === "bible" && (
            <>
              {bookChips.length > 0 && (
                <div className="mb-4">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">
                    <BookOpen size={13} /> {t("watch.byBook")}
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      onClick={() => setBookFilter("")}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
                        bookFilter === ""
                          ? "bg-[#7C3AED] border-transparent text-white"
                          : "bg-white/[0.04] border-white/10 text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      {t("watch.allBooks")}
                    </button>
                    {bookChips.map((b) => (
                      <button
                        key={b.bookId}
                        onClick={() => setBookFilter(bookFilter === b.bookId ? "" : b.bookId)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
                          bookFilter === b.bookId
                            ? "bg-[#7C3AED] border-transparent text-white"
                            : "bg-white/[0.04] border-white/10 text-[#94A3B8] hover:text-white"
                        }`}
                      >
                        {b.name} <span className="opacity-60">· {b.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <CategoryChips
                categories={BIBLE_CATEGORIES}
                active={bibleCat}
                onPick={(c) => { setBibleCat(c); setBookFilter(""); }}
              />

              {bibleFiltered.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {bibleFiltered.map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
              ) : (
                <EmptyLibrary
                  icon={BookOpen}
                  title={t("watch.emptyBibleTitle")}
                  body={t("watch.emptyBibleBody")}
                />
              )}
            </>
          )}

          {/* ───────────── CHRISTIAN VIDEOS ───────────── */}
          {tab === "christian" && (
            <>
              <CategoryChips
                categories={CHRISTIAN_CATEGORIES}
                active={christianCat}
                onPick={setChristianCat}
              />
              {christianFiltered.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {christianFiltered.map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
              ) : (
                <EmptyLibrary
                  icon={TvMinimalPlay}
                  title={t("watch.emptyChristianTitle")}
                  body={t("watch.emptyChristianBody")}
                />
              )}
            </>
          )}

          {/* library hint on the curated tabs when the library is empty
              (For You carries its own combined empty state) */}
          {!loadError && (tab === "bible" || tab === "christian") && videos.length === 0 && (
            <a
              href="/videos"
              className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-[#94A3B8] hover:border-[#7C3AED]/40"
            >
              <span>{t("watch.browseLibrary")}</span>
              <ChevronRight size={15} />
            </a>
          )}
        </>
      )}

      {/* full-screen vertical reels — existing optimized player */}
      {fullscreenReels && (
        <ReelsOverlay
          onClose={() => setFullscreenReels(false)}
          onOpenProfile={onOpenProfile}
          onOpenPost={(id) => {
            setFullscreenReels(false);
            setDetailId(id);
          }}
          onOpenCreate={onOpenCreate}
        />
      )}

      {/* comments (existing PostDetail) for reel comments from the inline feed */}
      {detailId && !fullscreenReels && (
        <PostDetail
          postId={detailId}
          onClose={() => setDetailId(null)}
          onOpenProfile={onOpenProfile}
          onHashtag={onHashtag}
        />
      )}
    </div>
  );
}

/** Category sub-chips inside a tab (real VIDEO_CATEGORIES only). */
function CategoryChips({
  categories,
  active,
  onPick,
}: {
  categories: readonly string[];
  active: string;
  onPick: (id: string) => void;
}) {
  const t = useTranslation();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
      <button
        onClick={() => onPick("")}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
          active === ""
            ? "bg-[#7C3AED] border-transparent text-white"
            : "bg-white/[0.04] border-white/10 text-[#94A3B8] hover:text-white"
        }`}
      >
        {t("common.all")}
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onPick(active === c ? "" : c)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
            active === c
              ? "bg-[#7C3AED] border-transparent text-white"
              : "bg-white/[0.04] border-white/10 text-[#94A3B8] hover:text-white"
          }`}
        >
          {categoryLabel(c)}
        </button>
      ))}
    </div>
  );
}

function EmptyLibrary({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
}) {
  const t = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center rounded-2xl border border-dashed border-white/10">
      <Icon size={22} className="text-[#64748B]" />
      <p className="text-sm font-bold text-[#94A3B8]">{title}</p>
      <p className="text-xs text-[#64748B] max-w-sm">{body}</p>
      <a
        href="/videos"
        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:text-[#A78BFA]"
      >
        {t("watch.openLibrary")} <ChevronRight size={13} />
      </a>
    </div>
  );
}
