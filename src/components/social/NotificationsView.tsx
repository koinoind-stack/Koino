"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle, UserPlus, Repeat2, AtSign, Camera, CheckCheck, BookOpen, HelpCircle, PenLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { NotificationItem } from "./types";
import { api } from "./types";
import { timeAgo } from "@/lib/social/format";

type Props = {
  onOpenProfile: (username: string) => void;
  onOpenPost: (postId: string) => void;
};

const ICONS: Record<string, { icon: typeof Heart; color: string }> = {
  like: { icon: Heart, color: "text-red-400" },
  comment: { icon: MessageCircle, color: "text-[#38BDF8]" },
  reply: { icon: MessageCircle, color: "text-[#38BDF8]" },
  follow: { icon: UserPlus, color: "text-[#A78BFA]" },
  mention: { icon: AtSign, color: "text-[#FBBF24]" },
  repost: { icon: Repeat2, color: "text-[#34D399]" },
  story_reply: { icon: Camera, color: "text-[#EC4899]" },
  // Apologetics PART 2
  apologetics_comment: { icon: MessageCircle, color: "text-[#38BDF8]" },
  apologetics_reply: { icon: MessageCircle, color: "text-[#38BDF8]" },
  apologetics_reaction: { icon: BookOpen, color: "text-[#A855F7]" },
  apologetics_submission: { icon: PenLine, color: "text-[#FBBF24]" },
  apologetics_review: { icon: ShieldCheck, color: "text-[#34D399]" },
};

const LABELS: Record<string, string> = {
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to you",
  follow: "started following you",
  mention: "mentioned you",
  repost: "reposted your post",
  story_reply: "replied to your story",
  // Apologetics PART 2
  apologetics_comment: "commented on your apologetics content",
  apologetics_reply: "replied to your comment",
  apologetics_reaction: "reacted to your apologetics content",
  apologetics_submission: "submitted apologetics content for review",
  apologetics_review: "reviewed your apologetics submission",
};

/** Notifications hub: 7 types, unread dots, mark-all-read, pagination. */
export default function NotificationsView({ onOpenProfile, onOpenPost }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    try {
      const data = await api<{ notifications: NotificationItem[]; unreadCount: number; nextCursor: string | null }>(
        `/api/social/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      setItems((prev) => (cursor ? [...prev, ...data.notifications] : data.notifications));
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore) load(nextCursor);
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadingMore, load]);

  async function markAll() {
    try {
      await api("/api/social/notifications", { method: "POST", body: JSON.stringify({ all: true }) });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function open(n: NotificationItem) {
    if (!n.read) {
      api("/api/social/notifications", { method: "POST", body: JSON.stringify({ id: n.id }) }).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    // Apologetics PART 2 notifications carry a deep-link href
    const anyN = n as any;
    if (anyN.href) {
      window.location.href = anyN.href as string;
      return;
    }
    if (n.postId) onOpenPost(n.postId);
    else if (n.actor?.username) onOpenProfile(n.actor.username);
  }

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-extrabold text-white">
          Notifications{unreadCount > 0 && <span className="ml-2 text-xs font-bold text-[#EC4899]">· {unreadCount} new</span>}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAll} className="flex items-center gap-1.5 text-xs font-bold text-[#7C3AED] hover:text-white">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-[#64748B] py-16">No notifications yet. They'll show up here.</p>
      ) : (
        <div className="space-y-1">
          {items.map((n) => {
            const meta = ICONS[n.type] ?? ICONS.like;
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                  n.read ? "hover:bg-white/[0.03]" : "bg-[#7C3AED]/[0.08] hover:bg-[#7C3AED]/[0.14]"
                }`}
              >
                <div className="relative shrink-0">
                  {n.actor?.image ? (
                    <Image src={n.actor.image} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" unoptimized />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold">
                      {(n.actor?.name || n.actor?.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#12101A] flex items-center justify-center ${meta.color}`}>
                    <Icon size={11} fill="currentColor" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white">
                    <span className="font-bold">{n.actor?.name || n.actor?.username || "Someone"}</span>{" "}
                    <span className="text-[#94A3B8]">{LABELS[n.type] ?? n.type}</span>
                  </p>
                  <p className="text-[10px] text-[#64748B]">{timeAgo(n.createdAt)}</p>
                </div>
                {n.post?.mediaUrls?.[0] && (
                  <Image src={n.post.thumbnailUrl || n.post.mediaUrls[0]} alt="" width={40} height={40} className="w-10 h-10 rounded-lg object-cover shrink-0" unoptimized />
                )}
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#EC4899] shrink-0" />}
              </button>
            );
          })}
          <div ref={sentinel} />
          {loadingMore && (
            <div className="flex justify-center py-3">
              <div className="w-5 h-5 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
