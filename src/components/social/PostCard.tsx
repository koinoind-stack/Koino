"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Flag,
  Ban,
  Flower2,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { Post } from "./types";
import { api } from "./types";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";
import { formatCount, timeAgo, tokenizeCaption } from "@/lib/social/format";

type Props = {
  post: Post;
  onOpenDetail: (post: Post) => void;
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onOpenReel?: (post: Post) => void;
  onChanged?: () => void;
  compact?: boolean;
  /** Group managers (owner/admin/moderator) can delete any post in their
   *  group — the server re-verifies the role on DELETE, this only controls
   *  whether the menu shows the option. */
  canModerate?: boolean;
};

/**
 * The universal post card: media carousel, video playback, optimistic
 * like/bookmark/repost toggles, inline caption edit, delete, report/block,
 * and clickable #hashtags / @mentions / Bible references in captions.
 */
export default function PostCard({
  post,
  onOpenDetail,
  onOpenProfile,
  onHashtag,
  onOpenReel,
  onChanged,
  compact,
  canModerate = false,
}: Props) {
  const [state, setState] = useState<Post>(post);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content || "");
  const [busy, setBusy] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const shown = state.repostedFrom ?? state;
  const isVideo = shown.mediaType === "video";
  const images = shown.mediaType === "image" ? shown.mediaUrls : [];
  const aspect = shown.aspectRatio || state.aspectRatio || (state.isReel ? "9:16" : "4:5");

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    const prev = state;
    setState({
      ...state,
      viewer: { ...state.viewer, liked: !state.viewer.liked },
      likeCount: state.likeCount + (state.viewer.liked ? -1 : 1),
    });
    try {
      const res = await api<{ liked: boolean; likeCount: number }>(
        `/api/social/posts/${state.id}/like`,
        { method: "POST" },
      );
      setState((s) => ({ ...s, viewer: { ...s.viewer, liked: res.liked }, likeCount: res.likeCount }));
    } catch (err) {
      setState(prev);
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBookmark() {
    const prev = state;
    setState({
      ...state,
      viewer: { ...state.viewer, bookmarked: !state.viewer.bookmarked },
    });
    try {
      const res = await api<{ bookmarked: boolean }>(
        `/api/social/posts/${state.id}/bookmark`,
        { method: "POST" },
      );
      setState((s) => ({ ...s, viewer: { ...s.viewer, bookmarked: res.bookmarked } }));
    } catch (err) {
      setState(prev);
      toast.error((err as Error).message);
    }
  }

  async function toggleRepost() {
    const prev = state;
    setState({
      ...state,
      viewer: { ...state.viewer },
      repostCount: state.repostCount + 1,
    });
    try {
      const res = await api<{ reposted: boolean; repostCount: number }>(
        `/api/social/posts/${state.id}/repost`,
        { method: "POST" },
      );
      setState((s) => ({ ...s, repostCount: res.repostCount }));
      toast.success(res.reposted ? "Reposted" : "Repost removed");
    } catch (err) {
      setState(prev);
      toast.error((err as Error).message);
    }
  }

  async function saveEdit() {
    const text = editText.trim();
    if (!text) return;
    try {
      const res = await api<{ post: Post }>(`/api/social/posts/${state.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: text }),
      });
      setState((s) => ({ ...s, content: res.post.content, editedAt: res.post.editedAt, hashtags: res.post.hashtags }));
      setEditing(false);
      toast.success("Caption updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removePost() {
    if (!confirm("Delete this post? This can't be undone.")) return;
    try {
      await api(`/api/social/posts/${state.id}`, { method: "DELETE" });
      toast.success("Post deleted");
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function reportPost() {
    try {
      await api("/api/social/report", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetId: state.id, reason: "inappropriate" }),
      });
      toast.success("Report submitted. Thank you.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function blockAuthor() {
    if (!confirm(`Block @${state.author.username}? You won't see each other's content.`)) return;
    try {
      await api("/api/social/block", {
        method: "POST",
        body: JSON.stringify({ username: state.author.username }),
      });
      toast.success("Blocked");
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}/?post=${state.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Koino post", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // user cancelled the share sheet — fine
    }
  }

  const isMine = shown.author.id === state.author.id && !!state.content || editing === false && (state.author.username === shown.author.username && shown.author.id === state.author.id);
  const canEdit = state.repostedFrom === null && shown.author.id === state.author.id;
  const canDelete = canEdit || canModerate;

  return (
    <article className={`bg-[#111827]/60 border border-white/[0.05] rounded-2xl overflow-hidden ${compact ? "" : "mb-4"}`}>
      {/* ─── header ─── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => state.author.username && onOpenProfile(state.author.username)} className="shrink-0">
          {state.author.image ? (
            <Image src={state.author.image} alt="" width={38} height={38} className="w-9 h-9 rounded-full object-cover" unoptimized />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white text-sm font-bold">
              {(state.author.name || state.author.username || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => state.author.username && onOpenProfile(state.author.username)}
              className="font-bold text-sm text-white truncate hover:underline"
            >
              {state.author.name || state.author.username || "Member"}
            </button>
            {state.author.verified && <BadgeCheck size={14} className="text-[#38BDF8] shrink-0" />}
          </div>
          <p className="text-[11px] text-[#64748B]">
            {state.author.username && (
              <button onClick={() => onOpenProfile(state.author.username!)} className="hover:text-white">@{state.author.username} · </button>
            )}
            {timeAgo(state.createdAt)}
            {state.editedAt ? " · edited" : ""}
          </p>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-1.5 rounded-full hover:bg-white/5">
            <MoreHorizontal size={18} className="text-[#94A3B8]" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-50 w-52 bg-[#1C1929] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                {canEdit && (
                  <button
                    onClick={() => { setMenuOpen(false); setEditing(true); setEditText(state.content || ""); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5"
                  >
                    <Pencil size={15} /> Edit caption
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => { setMenuOpen(false); removePost(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={15} /> Delete post
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); reportPost(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5"
                >
                  <Flag size={15} /> Report
                </button>
                {!canEdit && (
                  <button
                    onClick={() => { setMenuOpen(false); blockAuthor(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <Ban size={15} /> Block @{state.author.username}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── reposted-by header ─── */}
      {state.repostedFrom && (
        <div className="px-4 pb-2 -mt-1 flex items-center gap-1.5 text-[11px] text-[#64748B]">
          <Repeat2 size={12} />
          Reposted from @{state.author.username}
        </div>
      )}

      {/* ─── caption ─── */}
      {editing ? (
        <div className="px-4 pb-3">
          <textarea
            ref={editRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            maxLength={2200}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:border-[#7C3AED]"
          />
          <div className="flex items-center gap-2 mt-2">
            <EmojiPickerButton
              align="left"
              onPick={(e) => insertAtCursor(editRef.current, e, setEditText, 2200)}
            />
            <div className="flex-1" />
            <button onClick={saveEdit} className="px-4 py-1.5 rounded-xl bg-[#7C3AED] text-white text-xs font-bold">Save</button>
            <button onClick={() => setEditing(false)} className="px-4 py-1.5 rounded-xl bg-white/5 text-[#94A3B8] text-xs font-bold">Cancel</button>
          </div>
        </div>
      ) : (
        state.content && (
          <div className="px-4 pb-3 text-[14px] leading-relaxed text-[#E2E8F0] whitespace-pre-wrap break-words">
            <CaptionText text={state.content} onHashtag={onHashtag} onMention={onOpenProfile} />
          </div>
        )
      )}

      {/* ─── memorial announcement (Part 4) ─── */}
      {state.memorial && !state.repostedFrom && (
        <a
          href={`/memorials/${state.memorial.id}`}
          className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-[#7C3AED]/[0.07] border border-[#7C3AED]/20 px-3.5 py-2.5 hover:bg-[#7C3AED]/[0.12] transition-colors"
        >
          <Flower2 size={16} className="text-[#C4B5FD] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#C4B5FD] uppercase tracking-wide">In loving memory</p>
            <p className="text-xs text-[#94A3B8] truncate">{state.memorial.fullName}</p>
          </div>
          <span className="shrink-0 text-[11px] font-bold text-[#C4B5FD]">View Memorial →</span>
        </a>
      )}

      {/* ─── shared library video (Part 5) ─── */}
      {shown.video && !state.repostedFrom && (
        <a
          href={`/videos/${shown.video.slug}`}
          className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.08] p-2.5 hover:border-[#7C3AED]/40 transition-colors"
        >
          <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-black/60 shrink-0">
            {shown.video.thumbnailUrl ? (
              <Image src={shown.video.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#64748B]">
                <Clapperboard size={14} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-[#C4B5FD] uppercase tracking-wide">Bible Movies &amp; Videos</p>
            <p className="text-xs text-white font-bold truncate">{shown.video.title}</p>
          </div>
          <span className="shrink-0 text-[11px] font-bold text-[#C4B5FD]">Watch Now →</span>
        </a>
      )}

      {/* ─── media ─── */}
      {isVideo && (
        <div className="relative bg-black" style={{ aspectRatio: aspect.replace(":", "/") }}>
          <video
            src={shown.mediaUrls[0]}
            poster={shown.thumbnailUrl || undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
          />
          {shown.isReel && (
            <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] font-extrabold uppercase tracking-wide text-white pointer-events-none">
              <Clapperboard size={11} /> Reel
            </span>
          )}
        </div>
      )}
      {images.length > 0 && (
        <div className="relative bg-black" style={{ aspectRatio: aspect.replace(":", "/") }}>
          <Image
            src={images[mediaIndex]}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
            unoptimized
          />
          {images.length > 1 && (
            <>
              {mediaIndex > 0 && (
                <button
                  onClick={() => setMediaIndex((i) => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              {mediaIndex < images.length - 1 && (
                <button
                  onClick={() => setMediaIndex((i) => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                >
                  <ChevronRight size={18} />
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setMediaIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === mediaIndex ? "bg-white w-4" : "bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── actions ─── */}
      <div className="flex items-center gap-1 px-2 py-2.5">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
            state.viewer.liked ? "text-red-400" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <Heart size={19} fill={state.viewer.liked ? "currentColor" : "none"} className={state.viewer.liked ? "scale-110 transition-transform" : ""} />
          {formatCount(state.likeCount)}
        </button>
        <button
          onClick={() => onOpenDetail(state)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-[#94A3B8] hover:text-white"
        >
          <MessageCircle size={19} />
          {formatCount(state.commentCount)}
        </button>
        <button
          onClick={toggleRepost}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-[#94A3B8] hover:text-white"
        >
          <Repeat2 size={19} />
          {formatCount(state.repostCount)}
        </button>
        <button
          onClick={() => onOpenReel?.(state)}
          className="hidden"
        />
        <div className="flex-1" />
        <button
          onClick={toggleBookmark}
          className={`p-2 rounded-xl ${state.viewer.bookmarked ? "text-[#38BDF8]" : "text-[#94A3B8] hover:text-white"}`}
        >
          <Bookmark size={19} fill={state.viewer.bookmarked ? "currentColor" : "none"} />
        </button>
        <button onClick={sharePost} className="p-2 rounded-xl text-[#94A3B8] hover:text-white">
          <Share2 size={19} />
        </button>
      </div>
    </article>
  );
}

/** Renders caption tokens: clickable hashtags, mentions, Bible references. */
function CaptionText({
  text,
  onHashtag,
  onMention,
}: {
  text: string;
  onHashtag: (tag: string) => void;
  onMention: (username: string) => void;
}) {
  const tokens = tokenizeCaption(text);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === "hashtag") {
          return (
            <button
              key={i}
              onClick={() => onHashtag(t.value.replace("#", ""))}
              className="text-[#38BDF8] hover:underline"
            >
              {t.value}
            </button>
          );
        }
        if (t.kind === "mention") {
          return (
            <button
              key={i}
              onClick={() => onMention(t.value.replace("@", ""))}
              className="text-[#A78BFA] hover:underline"
            >
              {t.value}
            </button>
          );
        }
        if (t.kind === "bible") {
          return (
            <span key={i} className="text-[#FBBF24]">
              {t.value}
            </span>
          );
        }
        return <span key={i}>{t.value}</span>;
      })}
    </>
  );
}
