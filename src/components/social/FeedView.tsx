"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Post, StoryGroup, SocialUser } from "./types";
import { api } from "./types";
import PostCard from "./PostCard";
import PostDetail from "./PostDetail";
import StoryBar, { StoryViewer, StoryCreator } from "./Stories";
import ReelsOverlay from "./ReelsView";
import FeedComposer from "./FeedComposer";
import EventRail from "./EventRail";
import VideoRail from "./VideoRail";

type Props = {
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onOpenCreate: () => void;
  onOpenEvents: () => void;
  deepLinkPostId?: string | null;
};

const TABS = ["discover", "following", "trending"] as const;
type FeedTab = (typeof TABS)[number];
const TAB_LABELS: Record<FeedTab, string> = {
  discover: "For You",
  following: "Following",
  trending: "Trending",
};

/**
 * The home feed: stories bar, Following/Discover tabs, infinite scroll,
 * suggestion rail on Discover, and overlays (detail / reels / stories).
 */
export default function FeedView({ onOpenProfile, onHashtag, onOpenCreate, onOpenEvents, deepLinkPostId }: Props) {
  const [tab, setTab] = useState<FeedTab>("discover");
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [openStoryUser, setOpenStoryUser] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(deepLinkPostId ?? null);
  const [reel, setReel] = useState<Post | null>(null);
  const [suggestions, setSuggestions] = useState<SocialUser[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (nextTab: FeedTab, cursor?: string) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await api<{ posts: Post[]; nextCursor: string | null }>(
          `/api/social/posts?tab=${nextTab}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    api<{ groups: StoryGroup[] }>("/api/social/stories")
      .then((d) => setStories(d.groups))
      .catch(() => {});
    api<{ users: SocialUser[] }>("/api/social/search")
      .then((d) => setSuggestions(d.users || []))
      .catch(() => {});
  }, []);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore && !loading) {
          load(tab, nextCursor);
        }
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadingMore, loading, tab, load]);

  function refreshAll() {
    load(tab);
    api<{ groups: StoryGroup[] }>("/api/social/stories")
      .then((d) => setStories(d.groups))
      .catch(() => {});
  }

  // A freshly published quick-post lands at the top of the feed instantly
  // (Trending re-sorts by engagement, so it reloads instead).
  function handlePosted(post: Post) {
    if (tab === "trending") load("trending");
    else setPosts((prev) => [post, ...prev]);
  }

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      {/* stories bar */}
      <StoryBar
        groups={stories}
        onOpen={(username) => setOpenStoryUser(username)}
        onCreate={() => setShowCreator(true)}
        onOpenProfile={onOpenProfile}
      />

      {/* quick composer — "What's on your heart?" */}
      <FeedComposer onPosted={handlePosted} onOpenFull={onOpenCreate} />

      {/* tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              tab === t
                ? "bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* upcoming church events surfaced in the feed — mobile/tablet only;
          xl+ screens show Upcoming Events in the right discovery column */}
      <div className="xl:hidden">
        <EventRail onOpenEvents={onOpenEvents} />
      </div>

      {/* featured Bible movies & videos surfaced in the feed (Part 5) */}
      <VideoRail />

      {/* feed */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3 items-center mb-4">
                <div className="w-9 h-9 rounded-full bg-white/10" />
                <div className="space-y-1.5">
                  <div className="w-28 h-3 bg-white/10 rounded" />
                  <div className="w-16 h-2 bg-white/5 rounded" />
                </div>
              </div>
              <div className="w-full h-56 bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-sm text-[#94A3B8] mb-3">{error}</p>
          <button onClick={() => load(tab)} className="text-xs font-bold text-[#7C3AED]">Try again</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-[#94A3B8] text-sm mb-4">
            {tab === "following"
              ? "Follow people to see their posts here."
              : tab === "trending"
                ? "Nothing trending yet — likes, comments and reposts decide what rises."
                : "No posts yet. Be the first to share something!"}
          </p>
          <button
            onClick={onOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7C3AED] text-white text-sm font-bold"
          >
            <Plus size={16} /> Create your first post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onOpenDetail={(p) => setDetailId(p.id)}
              onOpenProfile={onOpenProfile}
              onHashtag={onHashtag}
              onOpenReel={(p) => setReel(p)}
              onChanged={refreshAll}
            />
          ))}
          {/* suggestion rail on discover — mobile/tablet only; xl+ screens
              show People to follow in the right discovery column */}
          {tab === "discover" && suggestions.length > 0 && (
            <div className="xl:hidden bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-3">People to follow</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => u.username && onOpenProfile(u.username)}
                    className="shrink-0 w-28 flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-[#7C3AED]/40"
                  >
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold">
                        {(u.name || u.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold text-white truncate w-full text-center">
                      {u.name || u.username}
                    </span>
                    <span className="text-[10px] text-[#64748B] truncate w-full text-center">@{u.username}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={sentinel} />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* overlays */}
      {detailId && (
        <PostDetail
          postId={detailId}
          onClose={() => setDetailId(null)}
          onOpenProfile={onOpenProfile}
          onHashtag={onHashtag}
          onChanged={refreshAll}
        />
      )}
      {openStoryUser && (
        <StoryViewer
          groups={stories}
          startUsername={openStoryUser}
          onClose={() => {
            setOpenStoryUser(null);
            refreshAll();
          }}
          onOpenProfile={onOpenProfile}
        />
      )}
      {showCreator && (
        <StoryCreator
          onClose={() => setShowCreator(false)}
          onPosted={() => {
            setShowCreator(false);
            refreshAll();
          }}
        />
      )}
      {reel && <ReelsOverlay initialPostId={reel.id} onClose={() => setReel(null)} onOpenProfile={onOpenProfile} />}
    </div>
  );
}
