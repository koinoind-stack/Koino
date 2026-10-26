"use client";

// ─── EngagementModeration — admin comments + reports moderation (PART 2) ────
//
// Rendered inside the ApologeticsTab "Comments & Reports" surface. Backed by
// /api/admin/engagement (GET list / POST moderation actions). Shows every
// apologetics comment (visible/hidden/removed) with hide/unhide/delete, and
// the report queue with resolve/dismiss.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCheck,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";

type AdminComment = {
  id: string;
  targetType: string; // "article" | "question"
  targetId: string;
  parentId: string | null;
  authorName: string;
  body: string;
  status: string; // visible | hidden | removed
  createdAt: string;
};

type AdminReport = {
  id: string;
  targetType: string; // apologetics_article | apologetics_question | apologetics_comment
  targetId: string;
  reason: string | null;
  details: string | null;
  status: string; // pending | reviewed | dismissed
  createdAt: string;
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  apologetics_article: "Article",
  apologetics_question: "Question",
  apologetics_comment: "Comment",
};

export default function EngagementModeration() {
  const [tab, setTab] = useState<"comments" | "reports">("comments");
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "comments") {
        const res = await fetch("/api/admin/engagement?tab=comments", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setComments(data.comments || []);
        setMigrationPending(!!data.migrationPending);
      } else {
        const res = await fetch("/api/admin/engagement?tab=reports", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setReports(data.reports || []);
        setMigrationPending(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load moderation data");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (kind: string, id: string) => {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success("Done");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const pendingReports = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-[#7C3AED]" />
        <h2 className="text-sm font-bold text-white">Engagement moderation</h2>
        {tab === "reports" && pendingReports > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444]/15 text-[#EF4444]">
            {pendingReports} pending
          </span>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit">
        <button
          onClick={() => setTab("comments")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            tab === "comments" ? "bg-[#7C3AED]/25 text-[#A78BFA]" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          Comments
        </button>
        <button
          onClick={() => setTab("reports")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            tab === "reports" ? "bg-[#7C3AED]/25 text-[#A78BFA]" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          Reports
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-7 h-7 rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
        </div>
      ) : migrationPending ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <p className="text-sm text-[#94A3B8]">
            The engagement tables aren't in the database yet — run the PART 2
            migration SQL in Supabase, then reload.
          </p>
        </div>
      ) : tab === "comments" ? (
        comments.length === 0 ? (
          <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
            <MessageCircle size={28} className="mx-auto text-[#475569] mb-2" />
            <p className="text-sm text-[#94A3B8]">No comments yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div
                key={c.id}
                className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {c.authorName}
                      <span className="ml-2 font-normal text-[10px] text-[#64748B]">
                        on {c.targetType === "article" ? "an article" : "a question"} · {timeAgo(c.createdAt)}
                        {c.parentId ? " · reply" : ""}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      c.status === "visible"
                        ? "bg-[#22C55E]/15 text-[#22C55E]"
                        : c.status === "hidden"
                          ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                          : "bg-[#EF4444]/15 text-[#EF4444]"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#A09DB1] leading-relaxed line-clamp-3 mb-2">{c.body}</p>
                <div className="flex items-center gap-2">
                  {busy === c.id ? (
                    <Loader2 size={12} className="animate-spin text-[#94A3B8]" />
                  ) : (
                    <>
                      {c.status === "visible" ? (
                        <button
                          onClick={() => act("comment_hide", c.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#F59E0B] hover:bg-[#F59E0B]/10 rounded-lg px-2 py-1 transition-colors"
                        >
                          <EyeOff size={11} /> Hide
                        </button>
                      ) : c.status === "hidden" ? (
                        <button
                          onClick={() => act("comment_unhide", c.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#22C55E] hover:bg-[#22C55E]/10 rounded-lg px-2 py-1 transition-colors"
                        >
                          <Eye size={11} /> Unhide
                        </button>
                      ) : null}
                      <button
                        onClick={() => {
                          if (confirm("Delete this comment permanently? Replies are deleted too.")) {
                            act("comment_delete", c.id);
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg px-2 py-1 transition-colors"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : reports.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <CheckCheck size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">No reports — all clear.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-bold text-white">
                  <AlertTriangle size={11} className="inline text-[#F59E0B] mr-1 -mt-0.5" />
                  {REPORT_TYPE_LABEL[r.targetType] || r.targetType} reported
                  <span className="ml-2 font-normal text-[10px] text-[#64748B]">{timeAgo(r.createdAt)}</span>
                </p>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                    r.status === "pending"
                      ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                      : r.status === "reviewed"
                        ? "bg-[#22C55E]/15 text-[#22C55E]"
                        : "bg-white/[0.06] text-[#94A3B8]"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              {r.reason && <p className="text-[11px] text-[#A09DB1]">Reason: {r.reason}</p>}
              {r.details && <p className="text-[10px] text-[#94A3B8] line-clamp-2">“{r.details}”</p>}
              <p className="text-[9px] text-[#64748B] mt-1 font-mono break-all">
                target: {r.targetId}
              </p>
              {r.status === "pending" && busy !== r.id && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => act("report_resolve", r.id)}
                    className="text-[10px] font-bold text-[#22C55E] hover:bg-[#22C55E]/10 rounded-lg px-2 py-1 transition-colors flex items-center gap-1"
                  >
                    <CheckCheck size={11} /> Resolve
                  </button>
                  <button
                    onClick={() => act("report_dismiss", r.id)}
                    className="text-[10px] font-bold text-[#94A3B8] hover:bg-white/[0.06] rounded-lg px-2 py-1 transition-colors flex items-center gap-1"
                  >
                    <X size={11} /> Dismiss
                  </button>
                </div>
              )}
              {busy === r.id && <Loader2 size={12} className="animate-spin text-[#94A3B8] mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
