"use client";

/**
 * Explore — discovery hub for the Koino social app.
 *
 * Tabs: For You / People / Posts / Reels / Bible Trivia / Churches / Events.
 * Everything renders from REAL Koino data: suggested members (most-followed),
 * engagement-ranked trending posts, actual hashtag counts, real isReel posts
 * (tiles open the existing full-screen ReelsOverlay), the server-ranked
 * trivia leaderboard + Play Trivia deep link into the existing game,
 * published churches & events, curated marketplace / business highlights and
 * featured videos. Nothing is fabricated — a section with no data simply does
 * not render (or shows a compact helpful empty state), so the page never
 * turns into a blank wall.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Search, X, Play, Church, CalendarDays, Store, ShoppingBag,
  Users, Flame, TrendingUp, MapPin, Sparkles, Clapperboard, UserPlus,
  Film, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import type { Post, SocialUser } from "./types";
import { api } from "./types";
import { useFeaturedPicks } from "@/lib/showcase";
import PostDetail from "./PostDetail";
import EventRail from "./EventRail";
import VideoRail from "./VideoRail";
import ReelsOverlay from "./ReelsView";
import { formatCount } from "@/lib/social/format";
import {
  CHURCH_GRADIENTS, QUIZ_CATEGORIES,
  type Product, type Business,
} from "@/lib/crosscrafted-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Props = {
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  initialHashtag?: string | null;
  /** Pre-filled free-text search (right-rail "Search Lordsbook" hand-off). */
  initialQuery?: string | null;
  /** Open a Koino feature view (churches / events / shop / business-directory / reels …). */
  onNavigate?: (view: string) => void;
};

type ExploreUser = SocialUser & {
  bio?: string | null;
  followers?: number;
  viewerFollows?: boolean;
  role?: string | null;
};

type SearchResults = {
  users: ExploreUser[];
  hashtags: Array<{ tag: string; count: number }>;
  posts: Post[];
};

type ChurchItem = {
  id: string;
  name: string;
  denomination?: string | null;
  state?: string | "";
  city?: string | "";
  location?: string | null;
  languages?: string[];
  cover_gradient?: number;
  cover_image?: string | null;
  featured?: boolean;
  pastorName?: string | null;
};

type EventItem = {
  id: string;
  title: string;
  date: string;
  city?: string | "";
  state?: string | "";
  location?: string | null;
  category?: string;
  eventType?: string;
  is_online?: boolean;
  featured?: boolean;
  cover_image?: string | null;
  cover_gradient?: number;
};

type Tab = "foryou" | "people" | "posts" | "reels" | "trivia" | "churches" | "events";

// labelKey = i18n key resolved at render time; label = fallback literal for
// strings with no dictionary key yet (never call t() at module scope).
const TABS: Array<{ id: Tab; labelKey?: string; label: string }> = [
  { id: "foryou", label: "For You" },
  { id: "people", labelKey: "explore.tab.people", label: "People" },
  { id: "posts", labelKey: "explore.tab.posts", label: "Posts" },
  { id: "reels", labelKey: "explore.tab.reels", label: "Reels" },
  { id: "trivia", labelKey: "feature.trivia.title", label: "Bible Trivia" },
  { id: "churches", labelKey: "churches.title", label: "Churches" },
  { id: "events", labelKey: "events.title", label: "Events" },
];

type ForYouData = {
  users: ExploreUser[];
  hashtags: Array<{ tag: string; count: number }>;
  posts: Post[];
  postsTrending: boolean;
  reels: Post[];
  churches: ChurchItem[];
};

type PostsData = {
  hashtags: Array<{ tag: string; count: number }>;
  posts: Post[];
  fromHashtag: boolean;
};

/** Real rows from /api/trivia/leaderboard (public, server-ranked by Faith Points). */
type LeaderboardRow = {
  rank: number;
  name: string;
  emailMasked: string;
  image: string | null;
  points: number;
  tier: string;
  tierIcon: string;
};

function churchGradient(idx?: number): string {
  const g = CHURCH_GRADIENTS as readonly string[];
  return g[Math.abs(idx ?? 0) % g.length];
}

/** Toggle follow using the existing /follow endpoint (optimistic update). */
function FollowButton({ user }: { user: ExploreUser }) {
  const t = useTranslation();
  const [following, setFollowing] = useState(!!user.viewerFollows);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy || !user.username) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await api<{ following: boolean }>(
        `/api/social/users/${encodeURIComponent(user.username)}/follow`,
        { method: "POST" },
      );
      setFollowing(res.following);
    } catch (err) {
      setFollowing(!next);
      toast.error(err instanceof Error ? err.message : t("explore.followError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold transition-colors disabled:opacity-60 ${
        following
          ? "bg-white/[0.06] border border-white/15 text-[#94A3B8] hover:border-white/30"
          : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
      }`}
    >
      {following ? t("churches.following") : t("churches.follow")}
    </button>
  );
}

function PersonCard({
  user,
  onOpenProfile,
}: {
  user: ExploreUser;
  onOpenProfile: (username: string) => void;
}) {
  const t = useTranslation();
  return (
    <div
      onClick={() => user.username && onOpenProfile(user.username)}
      className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-[#2563EB]/40 cursor-pointer transition-colors"
    >
      {user.image ? (
        <Image
          src={user.image}
          alt=""
          width={44}
          height={44}
          className="w-11 h-11 rounded-full object-cover shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-11 h-11 rounded-full shrink-0 bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white font-bold">
          {(user.name || user.username || "?").charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">{user.name || user.username}</p>
        <p className="text-[11px] text-[#64748B] truncate">
          @{user.username}
          {user.followers !== undefined && ` · ${t("common.followers", { count: formatCount(user.followers) })}`}
        </p>
        {user.role && (
          <p className="text-[11px] font-semibold text-[#93C5FD] mt-0.5 truncate">{user.role}</p>
        )}
        {user.bio && <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-2">{user.bio}</p>}
      </div>
      {user.username && <FollowButton user={user} />}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  seeAll,
  onSeeAll,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  seeAll?: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] inline-flex items-center gap-1.5">
          <Icon size={13} /> {title}
        </h3>
        {seeAll && onSeeAll && (
          <button onClick={onSeeAll} className="text-[11px] font-bold text-[#2563EB] hover:text-[#60A5FA]">
            {seeAll}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** 3-column media/text tile grid for posts (same look as the old Explore). */
function PostGrid({ posts, onOpen }: { posts: Post[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 md:gap-2">
      {posts.map((p) => {
        const media = p.repostedFrom ?? p;
        return (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.04] group"
          >
            {media.mediaType === "video" ? (
              <>
                {media.thumbnailUrl ? (
                  <Image src={media.thumbnailUrl} alt="" fill sizes="220px" className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/40">
                    <Play size={22} className="text-white/70" />
                  </div>
                )}
                <Play size={14} className="absolute top-2 right-2 text-white drop-shadow" />
              </>
            ) : media.mediaUrls[0] ? (
              <Image src={media.mediaUrls[0]} alt="" fill sizes="220px" className="object-cover" unoptimized />
            ) : (
              <p className="p-2 text-[10px] text-[#94A3B8] line-clamp-6 text-left">{p.content}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function HashtagChips({ tags, onPick }: { tags: Array<{ tag: string; count: number }>; onPick: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((h) => (
        <button
          key={h.tag}
          onClick={() => onPick(h.tag)}
          className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-sm font-bold text-[#22D3EE] hover:border-[#22D3EE]/50"
        >
          #{h.tag} <span className="text-[#64748B] text-xs">· {formatCount(h.count)}</span>
        </button>
      ))}
    </div>
  );
}

function CompactEmpty({ icon: Icon, text }: { icon: React.ComponentType<{ size?: number; className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border border-dashed border-white/10">
      <Icon size={20} className="text-[#64748B]" />
      <p className="text-sm text-[#64748B]">{text}</p>
    </div>
  );
}

export default function ExploreView({ onOpenProfile, onHashtag, initialHashtag, initialQuery, onNavigate }: Props) {
  const t = useTranslation();
  const [query, setQuery] = useState(initialHashtag ? `#${initialHashtag}` : (initialQuery ?? ""));
  const [activeTab, setActiveTab] = useState<Tab>("foryou");
  const [activeHashtag, setActiveHashtag] = useState<string | null>(initialHashtag ?? null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [foryou, setForyou] = useState<ForYouData | null>(null);
  const [people, setPeople] = useState<ExploreUser[] | null>(null);
  const [postsData, setPostsData] = useState<PostsData | null>(null);
  const [churches, setChurches] = useState<ChurchItem[] | null>(null);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [reels, setReels] = useState<Post[] | null>(null);
  const [reelOpenId, setReelOpenId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);

  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryRef = useRef(query);

  const load = useCallback(async (tab: Tab, q: string, tag: string | null) => {
    setLoading(true);
    setLoadError(false);
    const ql = q.trim();
    try {
      if (tab === "foryou") {
        if (ql) {
          // Searching: mixed results across people, hashtags and posts.
          const d = await api<SearchResults>(`/api/social/search?q=${encodeURIComponent(ql)}`);
          setForyou({ users: d.users, hashtags: d.hashtags, posts: d.posts, postsTrending: false, reels: [], churches: [] });
        } else {
          const [searchRes, trendingRes, reelsRes, churchesRes] = await Promise.allSettled([
            api<SearchResults>("/api/social/search"),
            api<{ posts: Post[] }>("/api/social/posts?tab=trending&limit=9"),
            api<{ posts: Post[] }>("/api/social/posts?reels=1&limit=6"),
            api<{ churches: ChurchItem[] }>("/api/churches"),
          ]);
          let posts = trendingRes.status === "fulfilled" ? trendingRes.value.posts : [];
          const postsTrending = posts.length > 0;
          if (posts.length === 0 && trendingRes.status === "fulfilled") {
            // No engagement in the trending window yet — fall back to recent.
            try {
              posts = (await api<{ posts: Post[] }>("/api/social/posts?tab=discover&limit=9")).posts;
            } catch {
              /* stays empty — section hides */
            }
          }
          setForyou({
            users: searchRes.status === "fulfilled" ? searchRes.value.users : [],
            hashtags: searchRes.status === "fulfilled" ? searchRes.value.hashtags : [],
            posts,
            postsTrending,
            reels: reelsRes.status === "fulfilled" ? reelsRes.value.posts : [],
            churches: churchesRes.status === "fulfilled" ? churchesRes.value.churches.slice(0, 4) : [],
          });
        }
      } else if (tab === "people") {
        const d = ql
          ? await api<SearchResults>(`/api/social/search?q=${encodeURIComponent(ql)}&type=users&limit=30`)
          : await api<SearchResults>("/api/social/search?suggested_limit=12");
        setPeople(d.users);
      } else if (tab === "posts") {
        if (tag) {
          const d = await api<{ posts: Post[] }>(`/api/social/posts?hashtag=${encodeURIComponent(tag)}&limit=30`);
          setPostsData({ hashtags: [], posts: d.posts, fromHashtag: true });
        } else if (ql) {
          const d = await api<SearchResults>(`/api/social/search?q=${encodeURIComponent(ql)}`);
          setPostsData({ hashtags: d.hashtags, posts: d.posts, fromHashtag: false });
        } else {
          const d = await api<{ posts: Post[] }>("/api/social/posts?tab=discover&limit=30");
          setPostsData({ hashtags: [], posts: d.posts, fromHashtag: false });
        }
      } else if (tab === "reels") {
        // Real isReel posts only — same endpoint the full-screen player uses.
        const d = await api<{ posts: Post[] }>("/api/social/posts?reels=1&limit=30");
        setReels(d.posts.filter((p) => (p.repostedFrom ?? p).mediaUrls?.length));
      } else if (tab === "trivia") {
        // Public, server-ranked leaderboard — best effort: a failure only hides
        // the section, the Play Trivia card always renders.
        try {
          const d = await api<{ leaderboard: LeaderboardRow[] }>("/api/trivia/leaderboard");
          setLeaderboard(d.leaderboard || []);
        } catch {
          setLeaderboard([]);
        }
      } else if (tab === "churches") {
        const d = await api<{ churches: ChurchItem[] }>(`/api/churches${ql ? `?q=${encodeURIComponent(ql)}` : ""}`);
        setChurches(d.churches);
      } else {
        const d = await api<{ events: EventItem[] }>(`/api/events${ql ? `?q=${encodeURIComponent(ql)}` : ""}`);
        setEvents(d.events);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeTab, queryRef.current, activeHashtag);
  }, [activeTab, activeHashtag, load]); // eslint-disable-line react-hooks/exhaustive-deps

  function onQueryChange(v: string) {
    setQuery(v);
    queryRef.current = v;
    setActiveHashtag(null);
    onHashtag("");
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(activeTab, v, null), 350);
  }

  function clearSearch() {
    setQuery("");
    queryRef.current = "";
    setActiveHashtag(null);
    onHashtag("");
    if (debounce.current) clearTimeout(debounce.current);
    load(activeTab, "", null);
  }

  function openHashtag(tag: string) {
    const clean = tag.replace(/^#/, "").trim();
    setActiveHashtag(clean || null);
    onHashtag(clean);
    setQuery(clean ? `#${clean}` : "");
    queryRef.current = clean ? `#${clean}` : "";
    setActiveTab("posts");
  }

  function goTab(tab: Tab) {
    setActiveTab(tab);
  }

  const searching = query.trim().length > 0 && !activeHashtag;

  return (
    <div className="max-w-[1100px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      {/* search box */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("explore.searchPlaceholder")}
          className="w-full bg-white/[0.05] border border-white/10 rounded-full pl-10 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#2563EB]"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10"
          >
            <X size={14} className="text-[#94A3B8]" />
          </button>
        )}
      </div>

      {/* discovery tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => goTab(tb.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
              activeTab === tb.id
                ? "bg-[#2563EB] border-transparent text-white"
                : "bg-white/[0.04] border-white/10 text-[#94A3B8] hover:text-white hover:border-white/25"
            }`}
          >
            {tb.labelKey ? t(tb.labelKey) : tb.label}
          </button>
        ))}
      </div>

      {activeHashtag && (
        <div className="flex items-center justify-between bg-[#2563EB]/15 border border-[#2563EB]/30 rounded-2xl px-4 py-3 mb-4">
          <p className="text-sm font-extrabold text-white">#{activeHashtag}</p>
          <button
            onClick={() => openHashtag("")}
            className="text-xs font-bold text-[#60A5FA]"
          >
            {t("explore.clear")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-14">
          <p className="text-sm text-[#64748B]">{t("explore.loadError")}</p>
          <button
            onClick={() => load(activeTab, queryRef.current, activeHashtag)}
            className="px-4 py-2 rounded-full bg-[#2563EB] text-xs font-bold text-white hover:bg-[#1D4ED8]"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          {/* ───────────── FOR YOU ───────────── */}
          {activeTab === "foryou" && foryou && (
            <>
              {foryou.users.length > 0 && (
                <Section
                  icon={Users}
                  title={t("explore.peopleYouMayKnow")}
                  seeAll={t("common.seeAll")}
                  onSeeAll={() => goTab("people")}
                >
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {foryou.users.map((u) => (
                      <PersonCard key={u.id} user={u} onOpenProfile={onOpenProfile} />
                    ))}
                  </div>
                </Section>
              )}

              {foryou.hashtags.length > 0 && (
                <Section icon={TrendingUp} title={t("explore.trendingHashtags")}>
                  <HashtagChips tags={foryou.hashtags} onPick={openHashtag} />
                </Section>
              )}

              {foryou.posts.length > 0 && (
                <Section
                  icon={foryou.postsTrending ? Flame : Sparkles}
                  title={foryou.postsTrending ? t("explore.trendingNow") : t("explore.recentPosts")}
                  seeAll={t("common.seeAll")}
                  onSeeAll={() => goTab("posts")}
                >
                  <PostGrid posts={foryou.posts} onOpen={setDetailId} />
                </Section>
              )}

              {foryou.reels.length > 0 && (
                <Section icon={Clapperboard} title={t("explore.tab.reels")} seeAll={t("explore.openReels")} onSeeAll={() => onNavigate?.("reels")}>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {foryou.reels.map((p) => {
                      const media = p.repostedFrom ?? p;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setDetailId(p.id)}
                          className="relative shrink-0 w-[108px] aspect-[9/16] rounded-xl overflow-hidden bg-black/40 group"
                        >
                          {media.thumbnailUrl ? (
                            <Image src={media.thumbnailUrl} alt="" fill sizes="120px" className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
                              <Play size={20} className="text-white/70" />
                            </div>
                          )}
                          <Play size={13} className="absolute top-1.5 right-1.5 text-white drop-shadow" />
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* self-fetching rails — render nothing when there is no data */}
              <EventRail onOpenEvents={() => onNavigate?.("events")} />
              <VideoRail />

              {foryou.churches.length > 0 && (
                <Section icon={Church} title={t("explore.discoverChurches")} seeAll={t("explore.openDirectory")} onSeeAll={() => onNavigate?.("churches")}>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {foryou.churches.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onNavigate?.("churches")}
                        className="shrink-0 w-[230px] text-left rounded-2xl overflow-hidden bg-[#0F2038]/60 border border-white/[0.05] hover:border-[#2563EB]/40 transition-colors"
                      >
                        <div className="relative h-20" style={{ backgroundImage: churchGradient(c.cover_gradient) }}>
                          {c.cover_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.cover_image} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : null}
                          {c.featured && (
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[9px] font-extrabold uppercase tracking-wide text-[#FCD34D]">
                              {t("explore.featured")}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <h4 className="text-[13px] font-bold text-white leading-snug truncate">{c.name}</h4>
                          <p className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-1">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{[c.city, c.state].filter(Boolean).join(", ") || c.location || t("explore.fallbackLocation")}</span>
                          </p>
                          {c.denomination && (
                            <p className="text-[10px] text-[#64748B] mt-1 truncate">{c.denomination}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              <MarketplaceHighlights onNavigate={onNavigate} />

              {!searching &&
                foryou.users.length === 0 &&
                foryou.hashtags.length === 0 &&
                foryou.posts.length === 0 &&
                foryou.reels.length === 0 &&
                foryou.churches.length === 0 && (
                  <CompactEmpty icon={Sparkles} text={t("explore.emptyDiscover")} />
                )}
              {searching &&
                foryou.users.length === 0 &&
                foryou.hashtags.length === 0 &&
                foryou.posts.length === 0 && (
                  <p className="text-center text-sm text-[#64748B] py-14">{t("explore.emptySearch")}</p>
                )}
            </>
          )}

          {/* ───────────── PEOPLE ───────────── */}
          {activeTab === "people" && people && (
            <>
              <Section icon={Users} title={searching ? t("explore.peopleMatching", { query: query.trim() }) : t("explore.peopleYouMayKnow")}>
                {people.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {people.map((u) => (
                      <PersonCard key={u.id} user={u} onOpenProfile={onOpenProfile} />
                    ))}
                  </div>
                ) : (
                  <CompactEmpty
                    icon={UserPlus}
                    text={searching ? t("explore.emptyPeople", { query: query.trim() }) : t("explore.noSuggestions")}
                  />
                )}
              </Section>
            </>
          )}

          {/* ───────────── POSTS ───────────── */}
          {activeTab === "posts" && postsData && (
            <>
              {postsData.hashtags.length > 0 && (
                <Section icon={TrendingUp} title={t("explore.hashtags")}>
                  <HashtagChips tags={postsData.hashtags} onPick={openHashtag} />
                </Section>
              )}
              {postsData.posts.length > 0 ? (
                <Section
                  icon={Sparkles}
                  title={postsData.fromHashtag ? t("explore.postsTagged", { tag: activeHashtag ?? "" }) : searching ? t("explore.postsMatching", { query: query.trim() }) : t("explore.recentPosts")}
                >
                  <PostGrid posts={postsData.posts} onOpen={setDetailId} />
                </Section>
              ) : (
                <CompactEmpty
                  icon={Search}
                  text={postsData.fromHashtag ? t("explore.emptyHashtag", { tag: activeHashtag ?? "" }) : searching ? t("explore.emptyPostsSearch", { query: query.trim() }) : t("explore.emptyPosts")}
                />
              )}
            </>
          )}

          {/* ───────────── REELS ───────────── */}
          {activeTab === "reels" && reels && (
            <>
              <Section icon={Film} title={t("explore.reelsToWatch")}>
                {reels.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                    {reels.map((p) => {
                      const media = p.repostedFrom ?? p;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setReelOpenId(p.id)}
                          className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.06] hover:border-[#2563EB]/40 group text-left"
                        >
                          {media.thumbnailUrl ? (
                            <Image src={media.thumbnailUrl} alt="" fill sizes="240px" className="object-cover group-hover:scale-[1.03] transition-transform" unoptimized />
                          ) : media.mediaUrls[0] ? (
                            <video src={media.mediaUrls[0]} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#2563EB]/50 to-[#F97316]/40" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                          <Play size={17} className="absolute top-2.5 right-2.5 text-white drop-shadow" fill="white" />
                          <div className="absolute bottom-0 left-0 right-0 p-2.5">
                            {p.content && <p className="text-[11px] text-white font-semibold line-clamp-2">{p.content}</p>}
                            <p className="text-[10px] text-white/70 mt-1 truncate">
                              @{p.author.username}
                              {p.likeCount > 0 ? ` · ❤ ${formatCount(p.likeCount)}` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <CompactEmpty icon={Film} text={t("explore.emptyReels")} />
                )}
              </Section>
            </>
          )}

          {/* ───────────── BIBLE TRIVIA ───────────── */}
          {activeTab === "trivia" && (
            <>
              <div className="rounded-3xl bg-gradient-to-br from-[#2563EB]/20 via-[#2563EB]/10 to-transparent border border-[#2563EB]/25 p-5 md:p-6 mb-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#2563EB] flex items-center justify-center shrink-0">
                    <Trophy size={22} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-black text-white tracking-tight">{t("feature.trivia.title")}</h3>
                    <p className="text-sm text-[#93C5FD] mt-1 leading-relaxed">
                      {t("explore.triviaDesc")}
                    </p>
                    <button
                      onClick={() => onNavigate?.("trivia")}
                      className="mt-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold"
                    >
                      <Play size={13} fill="white" /> {t("explore.playTrivia")}
                    </button>
                  </div>
                </div>
                {/* Real quiz categories — the same list the game itself uses. */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {QUIZ_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onNavigate?.("trivia")}
                      className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-bold text-white/90 hover:border-white/30"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {leaderboard && leaderboard.length > 0 && (
                <Section icon={Trophy} title={t("explore.topPlayers")} seeAll={t("explore.openTrivia")} onSeeAll={() => onNavigate?.("trivia")}>
                  <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                    {leaderboard.slice(0, 10).map((row, i) => (
                      <div key={`${row.rank}-${row.name}`} className={`flex items-center gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}>
                        <span className={`w-7 text-center text-sm font-black shrink-0 ${i === 0 ? "text-[#FCD34D]" : i === 1 ? "text-[#CBD5E1]" : i === 2 ? "text-[#F5B84A]" : "text-[#64748B]"}`}>
                          {row.rank}
                        </span>
                        {row.image ? (
                          <Image src={row.image} alt="" width={30} height={30} className="w-[30px] h-[30px] rounded-full object-cover shrink-0" unoptimized />
                        ) : (
                          <div className="w-[30px] h-[30px] rounded-full shrink-0 bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white text-xs font-bold">
                            {(row.name || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{row.name}</p>
                          <p className="text-[10px] text-[#64748B] truncate">{row.tierIcon} {row.tier}</p>
                        </div>
                        <span className="text-xs font-extrabold text-[#93C5FD] shrink-0">{t("common.points", { count: formatCount(row.points) })}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ───────────── CHURCHES ───────────── */}
          {activeTab === "churches" && churches && (
            <>
              <Section icon={Church} title={searching ? t("explore.churchesMatching", { query: query.trim() }) : t("explore.discoverChurches")}>
                {churches.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {churches.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onNavigate?.("churches")}
                        className="text-left rounded-2xl overflow-hidden bg-[#0F2038]/60 border border-white/[0.05] hover:border-[#2563EB]/40 transition-colors"
                      >
                        <div className="relative h-28" style={{ backgroundImage: churchGradient(c.cover_gradient) }}>
                          {c.cover_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.cover_image} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : null}
                          {c.featured && (
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[9px] font-extrabold uppercase tracking-wide text-[#FCD34D]">
                              {t("explore.featured")}
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="text-sm font-bold text-white leading-snug line-clamp-1">{c.name}</h4>
                          {c.denomination && <p className="text-[11px] text-[#93C5FD] mt-0.5 truncate">{c.denomination}</p>}
                          <p className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-1">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{[c.city, c.state].filter(Boolean).join(", ") || c.location || t("explore.fallbackLocation")}</span>
                          </p>
                          {(c.pastorName || (c.languages && c.languages.length > 0)) && (
                            <p className="text-[10px] text-[#64748B] mt-1 truncate">
                              {c.pastorName ? t("explore.pastor", { name: c.pastorName }) : ""}
                              {c.pastorName && c.languages && c.languages.length > 0 ? " · " : ""}
                              {c.languages && c.languages.length > 0 ? c.languages.slice(0, 3).join(", ") : ""}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <CompactEmpty
                    icon={Church}
                    text={searching ? t("explore.emptyChurchesSearch", { query: query.trim() }) : t("explore.emptyChurches")}
                  />
                )}
              </Section>
              {!searching && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    onClick={() => onNavigate?.("churches")}
                    className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-xs font-bold text-[#93C5FD] hover:border-[#2563EB]/50"
                  >
                    {t("explore.openFullDirectory")}
                  </button>
                  <button
                    onClick={() => onNavigate?.("list-church")}
                    className="px-4 py-2 rounded-full bg-[#2563EB] text-xs font-bold text-white hover:bg-[#1D4ED8]"
                  >
                    {t("explore.listYourChurch")}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ───────────── EVENTS ───────────── */}
          {activeTab === "events" && events && (
            <>
              <Section icon={CalendarDays} title={searching ? t("explore.eventsMatching", { query: query.trim() }) : t("explore.upcomingEvents")}>
                {events.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {events.slice(0, 12).map((ev) => {
                      const date = new Date(ev.date);
                      const valid = !Number.isNaN(date.getTime());
                      const day = valid ? date.toLocaleDateString("en-IN", { day: "numeric" }) : "";
                      const month = valid ? date.toLocaleDateString("en-IN", { month: "short" }) : "";
                      return (
                        <button
                          key={ev.id}
                          onClick={() => onNavigate?.("events")}
                          className="text-left rounded-2xl overflow-hidden bg-[#0F2038]/60 border border-white/[0.05] hover:border-[#2563EB]/40 transition-colors"
                        >
                          <div className="relative h-20" style={{ backgroundImage: churchGradient(ev.cover_gradient) }}>
                            {ev.cover_image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ev.cover_image} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : null}
                            {valid && (
                              <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-center leading-none">
                                <div className="text-sm font-extrabold text-white">{day}</div>
                                <div className="text-[9px] font-bold uppercase text-white/80">{month}</div>
                              </div>
                            )}
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wide text-white/90">
                              {ev.is_online || ev.eventType === "online" ? t("home.events.online") : ev.eventType === "hybrid" ? t("events.hybrid") : ev.category}
                            </span>
                          </div>
                          <div className="p-2.5">
                            <h4 className="text-[13px] font-bold text-white leading-snug line-clamp-1">{ev.title}</h4>
                            <p className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-1">
                              <MapPin size={10} className="shrink-0" />
                              <span className="truncate">{[ev.city, ev.state].filter(Boolean).join(", ") || ev.location || t("explore.fallbackLocation")}</span>
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <CompactEmpty
                    icon={CalendarDays}
                    text={searching ? t("explore.emptyEventsSearch", { query: query.trim() }) : t("explore.emptyEvents")}
                  />
                )}
              </Section>
              {!searching && events.length > 0 && (
                <button
                  onClick={() => onNavigate?.("events")}
                  className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-xs font-bold text-[#93C5FD] hover:border-[#2563EB]/50"
                >
                  {t("explore.openEvents")}
                </button>
              )}
            </>
          )}
        </>
      )}

      {reelOpenId && (
        <ReelsOverlay
          initialPostId={reelOpenId}
          onClose={() => setReelOpenId(null)}
          onOpenProfile={onOpenProfile}
          onOpenPost={(id) => setDetailId(id)}
        />
      )}

      {detailId && (
        <PostDetail
          postId={detailId}
          onClose={() => setDetailId(null)}
          onOpenProfile={onOpenProfile}
          onHashtag={(tag) => {
            setDetailId(null);
            openHashtag(tag);
          }}
        />
      )}
    </div>
  );
}

/** Marketplace + Business Directory highlights — same curated data the
 *  Shop and Business Directory features render (no invented listings). */
function MarketplaceHighlights({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const t = useTranslation();
  const { products, businesses } = useFeaturedPicks(6);
  if (products.length === 0 && businesses.length === 0) return null;

  return (
    <>
      {products.length > 0 && (
        <Section icon={ShoppingBag} title={t("explore.christianMarketplace")} seeAll={t("explore.openShop")} onSeeAll={() => onNavigate?.("shop")}>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => onNavigate?.("shop")}
                className="shrink-0 w-[150px] text-left rounded-2xl overflow-hidden bg-[#0F2038]/60 border border-white/[0.05] hover:border-[#2563EB]/40 transition-colors"
              >
                <div
                  className="relative h-20 flex items-center justify-center"
                  style={{ backgroundImage: churchGradient(p.cover_gradient) }}
                >
                  {p.cover_image || p.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(p.cover_image || p.images?.[0]) as string}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Store size={18} className="text-white/70" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[12px] font-bold text-white leading-snug line-clamp-2">{p.name}</p>
                  <p className="text-[11px] font-extrabold text-[#93C5FD] mt-1">
                    ₹{p.price.toLocaleString("en-IN")}
                    <span className="text-[10px] font-bold text-[#64748B] ml-1">★ {p.rating.toFixed(1)}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {businesses.length > 0 && (
        <Section icon={Store} title={t("feature.businessDirectory.title")} seeAll={t("explore.openDirectory")} onSeeAll={() => onNavigate?.("business-directory")}>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {businesses.map((b, i) => (
              <button
                key={b.id}
                onClick={() => onNavigate?.("business-directory")}
                className="shrink-0 w-[190px] text-left rounded-2xl overflow-hidden bg-[#0F2038]/60 border border-white/[0.05] hover:border-[#2563EB]/40 transition-colors"
              >
                <div
                  className="relative h-16 flex items-center justify-center"
                  style={{ backgroundImage: churchGradient(i) }}
                >
                  {b.logo || b.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(b.logo || b.cover_image) as string}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Store size={16} className="text-white/70" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[12px] font-bold text-white leading-snug truncate">{b.name}</p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5 truncate">
                    {b.category}
                    {b.city ? ` · ${b.city}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
