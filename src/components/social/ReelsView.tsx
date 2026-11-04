"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Clapperboard, MessageCircle, Send, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import type { Post } from "./types";
import { api } from "./types";
import { formatCount } from "@/lib/social/format";
import { shareLinks } from "@/lib/share/links";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Reels — full-screen vertical video feed for posts flagged `isReel`.
 *
 * The same core feed powers two surfaces:
 *  - `ReelsFeed` (named export): inline, embeddable feed (Koino Watch hub tab)
 *  - `ReelsOverlay` (default export): fixed full-screen wrapper (sidebar Reels
 *    view, FeedView reel taps, ?reel= deep links — all unchanged)
 *
 * Hardened against the reported "endless spinner / black screen":
 *  - every fetch has an AbortController timeout → a visible Retry state, the
 *    spinner can never hang forever;
 *  - per-video `onError` fallback card → a dead/empty video never becomes a
 *    silent black screen, and the feed stays swipeable;
 *  - posts without playable media are filtered out at load;
 *  - empty state carries a Create CTA, error state carries Retry.
 *
 * Actions use existing functionality only: like → /like, comments → the
 * existing PostDetail overlay (via onOpenPost), share → Web Share API with
 * clipboard fallback, profile → existing profile navigation.
 */

type Props = {
  initialPostId?: string;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
  /** Open the existing PostDetail overlay for comments. */
  onOpenPost?: (postId: string) => void;
  /** Empty-state CTA → the existing Create flow. */
  onOpenCreate?: () => void;
};

const FETCH_TIMEOUT_MS = 12_000;

/** api() with a hard timeout — a hanging request can never spin forever. */
async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await api<T>(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reel sharing now goes through the universal ShareSheet (Task 121) —
 * branded card + caption + canonical /?post= link.
 */

export function ReelsFeed({
  initialPostId,
  onOpenProfile,
  onOpenPost,
  onOpenCreate,
  className,
}: Omit<Props, "onClose"> & { className?: string }) {
  const t = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  // Universal share sheet — Task 121 (replaces the raw Web Share call).
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let list: Post[] = [];
      if (initialPostId) {
        const d = await fetchJson<{ post: Post }>(`/api/social/posts/${initialPostId}`);
        list.push(d.post);
        try {
          const more = await fetchJson<{ posts: Post[] }>("/api/social/posts?reels=1&limit=10");
          list = [...list.filter((p) => !more.posts.some((m) => m.id === p.id)), ...more.posts];
        } catch {
          /* couldn't extend the feed — the deep-linked reel still plays */
        }
      } else {
        const more = await fetchJson<{ posts: Post[] }>("/api/social/posts?reels=1&limit=10");
        list = more.posts;
      }
      // Drop posts with no playable media up front (never a black slide).
      setPosts(list.filter((p) => (p.repostedFrom ?? p).mediaUrls?.length));
    } catch (err) {
      setPosts([]);
      setError(err instanceof Error ? err.message : t("reels.loadError"));
    } finally {
      setLoading(false);
    }
  }, [initialPostId]);

  useEffect(() => {
    load();
  }, [load]);

  // Autoplay the visible video, pause others.
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        const video = videoRefs.current.get((entry.target as HTMLElement).dataset.postid || "");
        if (!video) continue;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    },
    [],
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root || loading) return;
    const obs = new IntersectionObserver(onIntersect, { root, threshold: [0, 0.6, 1] });
    root.querySelectorAll("[data-postid]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [posts, loading, onIntersect]);

  async function like(post: Post) {
    try {
      const res = await api<{ liked: boolean; likeCount: number }>(`/api/social/posts/${post.id}/like`, { method: "POST" });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, viewer: { ...p.viewer, liked: res.liked }, likeCount: res.likeCount } : p)),
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("reels.likeError"));
    }
  }

  function openReelShare(post: Post) {
    const target = (post.repostedFrom ?? post).id;
    setShareReq({
      heading: t("reels.shareHeading"),
      shareText: (post.repostedFrom ?? post).content?.slice(0, 600) || t("reels.shareTextFallback"),
      shareUrl: shareLinks.post(target),
      cardUrl: `/api/share-card?type=post&id=${encodeURIComponent(target)}`,
      formats: ["square"],
      fileName: `koino-reel-${target}.png`,
    });
  }

  return (
    <div className={`relative bg-black ${className ?? "h-full"}`}>
      {/* floating mute toggle (works in both inline and full-screen mode) */}
      {!loading && !error && posts.length > 0 && (
        <button
          onClick={() => setMuted((m) => !m)}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur"
          aria-label={muted ? t("reels.unmute") : t("reels.mute")}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}

      {loading ? (
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Clapperboard size={28} className="text-white/40" />
          <p className="text-white/70 text-sm">{t("reels.errorHeading")}</p>
          <p className="text-white/40 text-xs max-w-xs truncate">{error}</p>
          <button
            onClick={load}
            className="mt-1 px-5 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Clapperboard size={28} className="text-white/40" />
          <p className="text-white/70 text-sm font-bold">{t("reels.emptyTitle")}</p>
          <p className="text-white/40 text-xs max-w-xs">{t("reels.emptyBody")}</p>
          {onOpenCreate && (
            <button
              onClick={onOpenCreate}
              className="mt-1 px-5 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold"
            >
              {t("reels.createCta")}
            </button>
          )}
        </div>
      ) : (
        <div ref={containerRef} className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
          {posts.map((post) => {
            const media = post.repostedFrom ?? post;
            const isBroken = broken.has(post.id);
            return (
              <div
                key={post.id}
                data-postid={post.id}
                className="h-full w-full snap-start relative flex items-center justify-center"
                onClick={(e) => {
                  const video = videoRefs.current.get(post.id);
                  if (video && e.target === video) {
                    if (video.paused) video.play().catch(() => {});
                    else video.pause();
                  }
                }}
              >
                {isBroken || !media.mediaUrls[0] ? (
                  /* per-video fallback — never a silent black screen */
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-8 text-center">
                    {media.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media.thumbnailUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
                      />
                    ) : null}
                    <Clapperboard size={26} className="relative text-white/50" />
                    <p className="relative text-white/70 text-sm font-bold">{t("reels.brokenTitle")}</p>
                    <p className="relative text-white/40 text-xs">{t("reels.brokenHint")}</p>
                  </div>
                ) : (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(post.id, el);
                      else videoRefs.current.delete(post.id);
                    }}
                    src={media.mediaUrls[0]}
                    poster={post.thumbnailUrl || undefined}
                    loop
                    muted={muted}
                    playsInline
                    preload={posts.indexOf(post) < 2 ? "auto" : "metadata"}
                    onError={() => setBroken((prev) => new Set(prev).add(post.id))}
                    className="w-full h-full object-contain"
                  />
                )}
                {/* actions rail */}
                <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
                  <button onClick={() => like(post)} className="flex flex-col items-center gap-1 text-white">
                    <span className={`text-3xl transition-transform ${post.viewer.liked ? "scale-110" : ""}`}>
                      {post.viewer.liked ? "❤️" : "🤍"}
                    </span>
                    <span className="text-[11px] font-bold">{formatCount(post.likeCount)}</span>
                  </button>
                  {onOpenPost && (
                    <button onClick={() => onOpenPost(post.id)} className="flex flex-col items-center gap-1 text-white">
                      <MessageCircle size={26} />
                      <span className="text-[11px] font-bold">{formatCount(post.commentCount || 0)}</span>
                    </button>
                  )}
                  <button onClick={() => openReelShare(post)} className="flex flex-col items-center gap-1 text-white">
                    <Send size={24} />
                    <span className="text-[11px] font-bold">{t("common.share")}</span>
                  </button>
                  <button
                    onClick={() => post.author.username && onOpenProfile(post.author.username)}
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-lg">
                      {(post.author.name || post.author.username || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[11px] font-bold max-w-[72px] truncate">@{post.author.username}</span>
                  </button>
                </div>
                {/* caption */}
                {post.content && (
                  <div className="absolute left-4 right-24 bottom-24 z-10">
                    <p className="text-white text-sm drop-shadow-lg line-clamp-3">{post.content}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── UNIVERSAL SHARE SHEET ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />
    </div>
  );
}

/** Full-screen vertical Reels experience (existing mount points unchanged). */
export default function ReelsOverlay({
  initialPostId,
  onClose,
  onOpenProfile,
  onOpenPost,
  onOpenCreate,
}: Props) {
  const t = useTranslation();
  return (
    <div className="fixed inset-0 z-[80] bg-black">
      {/* header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <h2 className="text-white font-extrabold">{t("reels.title")}</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur"
          aria-label={t("reels.closeAria")}
        >
          <ChevronDown size={20} />
        </button>
      </div>
      <ReelsFeed
        initialPostId={initialPostId}
        onOpenProfile={onOpenProfile}
        onOpenPost={onOpenPost}
        onOpenCreate={onOpenCreate}
        className="h-full pt-0"
      />
    </div>
  );
}
