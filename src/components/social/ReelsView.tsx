"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Post } from "./types";
import { api } from "./types";
import { formatCount } from "@/lib/social/format";

type Props = {
  initialPostId?: string;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
};

/**
 * Full-screen vertical Reels feed: IntersectionObserver autoplay/pause,
 * snap scrolling, tap-to-pause, mute toggle, like/comment actions.
 */
export default function ReelsOverlay({ initialPostId, onClose, onOpenProfile }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    (async () => {
      try {
        let list: Post[] = [];
        if (initialPostId) {
          const d = await api<{ post: Post }>(`/api/social/posts/${initialPostId}`);
          list.push(d.post);
          const more = await api<{ posts: Post[] }>("/api/social/posts?reels=1&limit=10");
          list = [...list.filter((p) => !more.posts.some((m) => m.id === p.id)), ...more.posts];
        } else {
          const more = await api<{ posts: Post[] }>("/api/social/posts?reels=1&limit=10");
          list = more.posts;
        }
        setPosts(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [initialPostId]);

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

  useEffect(() => {
    videoRefs.current.forEach((v) => (v.muted = muted));
  }, [muted]);

  async function like(post: Post) {
    try {
      const res = await api<{ liked: boolean; likeCount: number }>(`/api/social/posts/${post.id}/like`, { method: "POST" });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, viewer: { ...p.viewer, liked: res.liked }, likeCount: res.likeCount } : p)),
      );
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black">
      {/* header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <h2 className="text-white font-extrabold">Reels</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setMuted((m) => !m)} className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur">
            {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur">
            <ChevronDown size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-white/60 text-sm">No reels yet. Share the first one!</p>
        </div>
      ) : (
        <div ref={containerRef} className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
          {posts.map((post) => (
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
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(post.id, el);
                  else videoRefs.current.delete(post.id);
                }}
                src={post.mediaUrls[0]}
                poster={post.thumbnailUrl || undefined}
                loop
                muted={muted}
                playsInline
                preload={posts.indexOf(post) < 2 ? "auto" : "none"}
                className="w-full h-full object-contain"
              />
              {/* actions rail */}
              <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
                <button onClick={() => like(post)} className="flex flex-col items-center gap-1 text-white">
                  <span className={`text-3xl transition-transform ${post.viewer.liked ? "scale-110" : ""}`}>
                    {post.viewer.liked ? "❤️" : "🤍"}
                  </span>
                  <span className="text-[11px] font-bold">{formatCount(post.likeCount)}</span>
                </button>
                <button
                  onClick={() => post.author.username && onOpenProfile(post.author.username)}
                  className="flex flex-col items-center gap-1 text-white"
                >
                  <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-lg">
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
          ))}
        </div>
      )}
    </div>
  );
}
