"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { X, Send, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Post, Comment } from "./types";
import { api } from "./types";
import PostCard from "./PostCard";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";
import { timeAgo } from "@/lib/social/format";

type Props = {
  postId: string;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onChanged?: () => void;
};

/**
 * Full post detail overlay: the post + paginated comments with one level of
 * replies. Deletion allowed for comment author or post author.
 */
export default function PostDetail({ postId, onClose, onOpenProfile, onHashtag, onChanged }: Props) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [repliesFor, setRepliesFor] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Comment[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ post: Post }>(`/api/social/posts/${postId}`);
        if (cancelled) return;
        setPost(data.post);
        await loadComments();
      } catch (err) {
        toast.error((err as Error).message);
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function loadComments(cursor?: string) {
    const data = await api<{ comments: Comment[]; nextCursor: string | null }>(
      `/api/social/posts/${postId}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    setComments((prev) => (cursor ? [...prev, ...data.comments] : data.comments));
    setNextCursor(data.nextCursor);
  }

  async function loadReplies(commentId: string) {
    const data = await api<{ comment: { replies: Comment[] } }>(
      `/api/social/posts/${postId}/comments/${commentId}`,
    );
    setReplies((prev) => ({ ...prev, [commentId]: data.comment.replies }));
    setRepliesFor(commentId);
  }

  async function submit() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      if (repliesFor) {
        await api(`/api/social/posts/${postId}/comments`, {
          method: "POST",
          body: JSON.stringify({ content, parentId: repliesFor }),
        });
        await loadReplies(repliesFor);
      } else {
        const data = await api<{ comment: Comment }>(`/api/social/posts/${postId}/comments`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
        setComments((prev) => [data.comment, ...prev]);
        setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      }
      setText("");
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    try {
      await api(`/api/social/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setReplies((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      if (repliesFor === commentId) setRepliesFor(null);
      setPost((p) => (p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center">
      <div className="bg-[#12101A] border border-white/10 rounded-t-[28px] md:rounded-[24px] w-full md:max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="font-extrabold text-white">Post</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5">
            <X size={18} className="text-[#94A3B8]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading || !post ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <PostCard
                post={post}
                onOpenDetail={() => {}}
                onOpenProfile={onOpenProfile}
                onHashtag={onHashtag}
                compact
              />
              {/* comments */}
              <div className="px-4 pb-4">
                {comments.map((c) => (
                  <div key={c.id} className="py-3 border-b border-white/[0.04] last:border-0">
                    <CommentRow
                      comment={c}
                      onOpenProfile={onOpenProfile}
                      onDelete={deleteComment}
                      isPostDetail
                    />
                    {c.replyCount && c.replyCount > 0 && (
                      <button
                        onClick={() => (repliesFor === c.id ? setRepliesFor(null) : loadReplies(c.id))}
                        className="ml-12 mt-1 text-[11px] font-bold text-[#64748B] hover:text-white flex items-center gap-1"
                      >
                        <ChevronDown size={11} className={repliesFor === c.id ? "rotate-180" : ""} />
                        {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}
                      </button>
                    )}
                    {repliesFor === c.id && replies[c.id] && (
                      <div className="ml-8 mt-2 space-y-2">
                        {replies[c.id].map((r) => (
                          <CommentRow key={r.id} comment={r} onOpenProfile={onOpenProfile} onDelete={deleteComment} small />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {nextCursor && (
                  <button
                    onClick={() => loadComments(nextCursor!)}
                    className="w-full py-3 text-xs font-bold text-[#7C3AED] hover:text-white"
                  >
                    Load more comments
                  </button>
                )}
                {!loading && comments.length === 0 && (
                  <p className="text-center text-sm text-[#64748B] py-8">
                    No comments yet — be the first to encourage them.
                  </p>
                )}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </div>

        {/* composer */}
        <div className="border-t border-white/[0.06] p-3 flex items-center gap-2">
          <input
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder={repliesFor ? "Write a reply…" : "Write a comment…"}
            maxLength={1000}
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#7C3AED]"
          />
          <EmojiPickerButton
            direction="up"
            align="right"
            onPick={(e) => insertAtCursor(textRef.current, e, setText, 1000)}
          />
          <button
            onClick={submit}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#7C3AED] flex items-center justify-center text-white disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  onOpenProfile,
  onDelete,
  small,
  isPostDetail,
}: {
  comment: Comment;
  onOpenProfile: (username: string) => void;
  onDelete: (id: string) => void;
  small?: boolean;
  isPostDetail?: boolean;
}) {
  const [mine, setMine] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMine(d.id === comment.user.id))
      .catch(() => {});
  }, [comment.user.id]);

  return (
    <div className="flex gap-2.5">
      <button onClick={() => comment.user.username && onOpenProfile(comment.user.username)} className="shrink-0">
        {comment.user.image ? (
          <Image src={comment.user.image} alt="" width={small ? 24 : 32} height={small ? 24 : 32} className={`${small ? "w-6 h-6" : "w-8 h-8"} rounded-full object-cover`} unoptimized />
        ) : (
          <div className={`${small ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"} rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold`}>
            {(comment.user.name || comment.user.username || "?").charAt(0).toUpperCase()}
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="bg-white/[0.04] rounded-2xl px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <button onClick={() => comment.user.username && onOpenProfile(comment.user.username)} className="text-[13px] font-bold text-white hover:underline">
              {comment.user.name || comment.user.username || "Member"}
            </button>
            <span className="text-[10px] text-[#64748B]">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-[13px] text-[#E2E8F0] whitespace-pre-wrap break-words mt-0.5">{comment.content}</p>
        </div>
        {mine && !small && (
          <button
            onClick={() => onDelete(comment.id)}
            className="ml-3 mt-1 text-[10px] font-bold text-[#64748B] hover:text-red-400 flex items-center gap-1"
          >
            <Trash2 size={10} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
