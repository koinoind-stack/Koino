"use client";

// ─── ApologeticsComments — threaded comments for articles & questions ───────
//
// PART 2 shared public component. Backed by /api/apologetics/comments:
//  - GET  → visible comments, threaded (replies nested one level in the UI)
//  - POST → new comment / reply (auth required; rate-limited server-side)
//  - report → POST /api/apologetics/report (apologetics_comment)
//  - admin moderation (hide/unhide/delete) when the server reports
//    canModerate for the current session.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Flag,
  Loader2,
  MessageCircle,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type CommentNode = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  status?: string;
  createdAt: string;
  replies: CommentNode[];
};

export default function ApologeticsComments({
  targetType,
  targetId,
}: {
  targetType: "article" | "question";
  targetId: string;
}) {
  const { isAuthenticated } = useSupabaseUser();
  const t = useTranslation();
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [canModerate, setCanModerate] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/apologetics/comments?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load comments");
      setComments(data.comments || []);
      setCanModerate(!!data.canModerate);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (parentId: string | null, text: string, done: () => void) => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/apologetics/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, body: text, parentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to post comment");
      done();
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  const report = async (commentId: string) => {
    try {
      const res = await fetch("/api/apologetics/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "apologetics_comment",
          targetId: commentId,
          reason: "inappropriate",
          details: reportDetails || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to report");
      toast.success(data.message || "Report received. Thank you.");
      setReportingId(null);
      setReportDetails("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to report");
    }
  };

  const moderate = async (kind: string, commentId: string) => {
    try {
      const res = await fetch("/api/admin/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id: commentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Action failed");
      toast.success("Done");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    }
  };

  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3 flex items-center gap-1">
        <MessageCircle size={11} /> Discussion ({loading ? "…" : total})
      </p>

      {/* New comment */}
      {isAuthenticated ? (
        <div className="mb-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("apo.shareThought")}
            className="neo-input text-xs h-16 resize-none"
            maxLength={1500}
          />
          <div className="flex justify-end mt-1.5">
            <button
              onClick={() => post(null, body, () => setBody(""))}
              disabled={posting || !body.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-[11px] font-bold hover:bg-[#7C3AED]/25 transition-all disabled:opacity-40"
            >
              {posting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {t("apo.postComment")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-[#64748B] mb-4">
          <Link href="/login" className="text-[#38BDF8] underline">{t("apo.signInLink")}</Link> {t("apo.joinTail")}
        </p>
      )}

      {/* Thread */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-[#64748B]" />
        </div>
      ) : total === 0 ? (
        <p className="text-[11px] text-[#64748B] text-center py-3">
          No comments yet — be the first to share a thought.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id}>
              <CommentItem
                node={c}
                canModerate={canModerate}
                onReply={() => {
                  setReplyTo(replyTo === c.id ? null : c.id);
                  setReplyBody("");
                }}
                onReport={() => setReportingId(reportingId === c.id ? null : c.id)}
                onModerate={moderate}
              />
              {/* Replies (one visible level) */}
              {c.replies.length > 0 && (
                <div className="ml-6 mt-2 space-y-2 border-l border-white/[0.06] pl-3">
                  {c.replies.map((r) => (
                    <CommentItem
                      key={r.id}
                      node={r}
                      canModerate={canModerate}
                      isReply
                      onModerate={moderate}
                    />
                  ))}
                </div>
              )}
              {/* Reply box */}
              {replyTo === c.id && isAuthenticated && (
                <div className="ml-6 mt-2">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${c.authorName}…`}
                    className="neo-input text-xs h-14 resize-none"
                    maxLength={1500}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      onClick={() => setReplyTo(null)}
                      className="text-[10px] font-bold text-[#64748B] hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        post(c.id, replyBody, () => {
                          setReplyBody("");
                          setReplyTo(null);
                        })
                      }
                      disabled={posting || !replyBody.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#38BDF8] text-[10px] font-bold hover:bg-[#38BDF8]/20 transition-all disabled:opacity-40"
                    >
                      {posting ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                      Reply
                    </button>
                  </div>
                </div>
              )}
              {/* Report box */}
              {reportingId === c.id && (
                <div className="ml-6 mt-2 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg p-2.5">
                  <p className="text-[10px] font-bold text-[#F39B9B] mb-1.5 flex items-center gap-1">
                    <Flag size={9} /> {t("apo.reportComment")}
                  </p>
                  <input
                    type="text"
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder={t("apo.reportPlaceholder")}
                    className="neo-input text-[11px] h-8"
                    maxLength={300}
                  />
                  <div className="flex justify-end gap-2 mt-1.5">
                    <button
                      onClick={() => setReportingId(null)}
                      className="text-[10px] font-bold text-[#64748B] hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => report(c.id)}
                      className="bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] text-[10px] font-bold rounded-lg px-2.5 py-1 hover:bg-[#EF4444]/25 transition-colors"
                    >
                      {t("apo.submitReport")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  node,
  canModerate,
  isReply,
  onReply,
  onReport,
  onModerate,
}: {
  node: CommentNode;
  canModerate: boolean;
  isReply?: boolean;
  onReply?: () => void;
  onReport?: () => void;
  onModerate: (kind: string, id: string) => void;
}) {
  const t = useTranslation();
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#38BDF8] flex items-center justify-center text-white font-bold shrink-0 ${
            isReply ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]"
          }`}
        >
          {node.authorName.charAt(0).toUpperCase()}
        </div>
        <p className="text-[11px] font-bold text-white">{node.authorName}</p>
        <p className="text-[9px] text-[#64748B]">
          {new Date(node.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
        <div className="ml-auto flex items-center gap-1">
          {!isReply && onReply && (
            <button
              onClick={onReply}
              className="text-[9px] font-bold text-[#64748B] hover:text-[#38BDF8] px-1.5 py-0.5 transition-colors"
            >
              Reply
            </button>
          )}
          {onReport && (
            <button
              onClick={onReport}
              className="text-[#64748B] hover:text-[#F39B9B] p-1 transition-colors"
              aria-label={t("apo.reportAria")}
            >
              <Flag size={10} />
            </button>
          )}
          {canModerate && (
            <div className="flex items-center gap-0.5 border-l border-white/[0.08] pl-1">
              <span title={t("apo.adminModeration")} className="flex items-center">
                <ShieldAlert size={9} className="text-[#A855F7]" />
              </span>
              {node.status !== "hidden" ? (
                <button
                  onClick={() => onModerate("comment_hide", node.id)}
                  className="text-[9px] font-bold text-[#F59E0B] hover:text-white px-1"
                >
                  Hide
                </button>
              ) : (
                <button
                  onClick={() => onModerate("comment_unhide", node.id)}
                  className="text-[9px] font-bold text-[#22C55E] hover:text-white px-1"
                >
                  {t("apo.unhide")}
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(t("apo.deleteConfirm"))) {
                    onModerate("comment_delete", node.id);
                  }
                }}
                className="text-[9px] font-bold text-[#EF4444] hover:text-white px-1"
              >
                {t("apo.delete")}
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-[12px] text-[#A09DB1] leading-relaxed whitespace-pre-line">{node.body}</p>
    </div>
  );
}
