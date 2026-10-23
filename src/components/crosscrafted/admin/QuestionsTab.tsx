"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  HelpCircle,
  Loader2,
  Search,
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Archive,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  FileText,
} from "lucide-react";
import { APOLOGETICS_TOPICS } from "@/lib/crosscrafted-data";

// ─── Types ─────────────────────────────────────────────────────────────────

// Mirrors the API response shape from /api/admin/questions.
type AdminQuestion = {
  id: string;
  question: string;
  askerName: string;
  askerEmail: string | null;
  askerUserId: string | null;
  category: string;
  answer: string; // adminNotes — empty string when unanswered
  status: "new" | "in_review" | "answered" | "turned_into_article" | "archived";
  articleId: string | null;
  createdAt: string;
};

type Counts = {
  all: number;
  new: number;
  in_review: number;
  answered: number;
  turned_into_article: number;
  archived: number;
};

type StatusFilter = "all" | "new" | "in_review" | "answered" | "turned_into_article" | "archived";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Pretty status label + color for a given status string.
function statusMeta(status: string): { label: string; color: string } {
  switch (status) {
    case "new":
      return { label: "New", color: "#F59E0B" };
    case "in_review":
      return { label: "In Review", color: "#3B82F6" };
    case "answered":
      return { label: "Answered", color: "#22C55E" };
    case "turned_into_article":
      return { label: "Article", color: "#A855F7" };
    case "archived":
      return { label: "Archived", color: "#64748B" };
    default:
      return { label: status, color: "#64748B" };
  }
}

// Derive a short title (first line, up to 100 chars) from the question body
// for the list cards.
function deriveTitle(questionText: string): string {
  const firstLine = (questionText || "").split("\n")[0]?.trim() || "";
  return firstLine.slice(0, 100) || (questionText || "").slice(0, 100);
}

// Find the topic label for a given category id (e.g. "gods_existence" →
// "God's Existence"). Returns null for unknown categories.
function topicLabel(categoryId: string): string | null {
  if (!categoryId) return null;
  const topic = APOLOGETICS_TOPICS.find((t) => t.id === categoryId);
  return topic?.label || null;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function QuestionsTab() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, new: 0, in_review: 0, answered: 0, turned_into_article: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // ─── Fetch all questions + counts ───
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/questions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setCounts(
        data.counts || { all: 0, new: 0, answered: 0, archived: 0 }
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load questions");
      toast.error(e?.message || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side filter by status (chips) + search (text).
  const filtered = useMemo(() => {
    let list = questions;
    if (filter !== "all") {
      list = list.filter((q) => q.status === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          (item.askerName || "").toLowerCase().includes(q) ||
          (item.askerEmail || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [questions, filter, search]);

  const openEdit = (q: AdminQuestion) => setEditing(q);
  const closeEdit = () => setEditing(null);
  const openCreate = () => setShowCreate(true);
  const closeCreate = () => setShowCreate(false);

  const handleMutated = () => {
    // Refresh the list after a moderation action. Keep the modal open so the
    // admin can iterate (e.g. answer → reopen → answer again).
    load();
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-[#38BDF8]" />
        <h2 className="text-sm font-bold text-white">Apologetics Q&amp;A</h2>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#38BDF8]/15 text-[#38BDF8]">
          {counts.all}
        </span>
        <button
          onClick={openCreate}
          className="ml-auto bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all"
        >
          <Plus size={12} />
          Create Q&amp;A
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={counts.all}
        />
        <FilterChip
          active={filter === "new"}
          onClick={() => setFilter("new")}
          label="New"
          count={counts.new}
          color="#F59E0B"
        />
        <FilterChip
          active={filter === "in_review"}
          onClick={() => setFilter("in_review")}
          label="In Review"
          count={counts.in_review}
          color="#3B82F6"
        />
        <FilterChip
          active={filter === "answered"}
          onClick={() => setFilter("answered")}
          label="Answered"
          count={counts.answered}
          color="#22C55E"
        />
        <FilterChip
          active={filter === "turned_into_article"}
          onClick={() => setFilter("turned_into_article")}
          label="Turned Into Article"
          count={counts.turned_into_article}
          color="#A855F7"
        />
        <FilterChip
          active={filter === "archived"}
          onClick={() => setFilter("archived")}
          label="Archived"
          count={counts.archived}
          color="#64748B"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by question, asker name, or email…"
          className="neo-input text-sm pl-9"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-2xl p-4 text-center">
          <AlertCircle size={20} className="mx-auto text-[#EF4444] mb-2" />
          <p className="text-sm font-bold text-[#EF4444] mb-1">Failed to load questions</p>
          <p className="text-xs text-[#A09DB1] mb-3">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <HelpCircle size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">
            {search || filter !== "all"
              ? "No questions match your filters."
              : "No questions yet. User-submitted questions will appear here."}
          </p>
          {!search && filter === "all" && (
            <button
              onClick={openCreate}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#A78BFA] hover:text-white"
            >
              <Plus size={12} /> Create the first Q&amp;A
            </button>
          )}
        </div>
      )}

      {/* List */}
      {!error && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((q) => {
            const meta = statusMeta(q.status);
            const topic = topicLabel(q.category);
            const title = deriveTitle(q.question);
            return (
              <button
                key={q.id}
                onClick={() => openEdit(q)}
                className="w-full text-left bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.15] transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-bold text-white line-clamp-2 flex-1 min-w-0">
                    {title}
                  </h3>
                  <StatusBadge color={meta.color} label={meta.label} />
                </div>
                <p className="text-[11px] text-[#A09DB1] line-clamp-2 mb-2">
                  {q.question}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#64748B]">
                  {topic && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] font-bold uppercase tracking-wider">
                      {topic}
                    </span>
                  )}
                  <span className="text-[#94A3B8]">by {q.askerName || "Anonymous"}</span>
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} /> {formatTimeAgo(q.createdAt)}
                  </span>
                  {q.answer ? (
                    <span className="flex items-center gap-0.5 text-[#22C55E] font-bold">
                      <CheckCircle2 size={9} /> Answered
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[#F59E0B] font-bold">
                      <MessageCircle size={9} /> No answer
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <QuestionDetailModal
          question={editing}
          onClose={closeEdit}
          onMutated={handleMutated}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateQAModal
          onClose={closeCreate}
          onCreated={() => {
            closeCreate();
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
}) {
  const activeBg = color || "#7C3AED";
  return (
    <button
      onClick={onClick}
      className={`bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
        active ? "text-white border-transparent" : "text-[#94A3B8] hover:text-white"
      }`}
      style={active ? { backgroundColor: `${activeBg}25`, borderColor: `${activeBg}80`, color: activeBg } : undefined}
    >
      {label}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-md ${
          active ? "bg-white/20" : "bg-white/[0.06] text-[#94A3B8]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0"
      style={{ backgroundColor: `${color}25`, color }}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
        {label} {required && <span className="text-[#F39B9B]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-[#64748B] leading-relaxed">{hint}</p>}
    </div>
  );
}

// ─── Question detail / moderation modal ───────────────────────────────────

function QuestionDetailModal({
  question,
  onClose,
  onMutated,
}: {
  question: AdminQuestion;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [answer, setAnswer] = useState(question.answer || "");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [turning, setTurning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-sync the answer textarea if the question prop changes after a refresh.
  useEffect(() => {
    setAnswer(question.answer || "");
  }, [question.id, question.answer]);

  const meta = statusMeta(question.status);
  const topic = topicLabel(question.category);

  // ─── Save Answer ───
  const handleSaveAnswer = async () => {
    const trimmed = answer.trim();
    if (!trimmed) {
      toast.error("Answer text is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: question.id,
          action: "answer",
          answer: trimmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Answer saved successfully");
      onMutated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save answer");
    } finally {
      setSaving(false);
    }
  };

  // ─── Close (archive) ───
  const handleClose = async () => {
    setClosing(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: question.id, action: "close" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Question closed");
      onMutated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to close question");
    } finally {
      setClosing(false);
    }
  };

  // ─── Reopen ───
  const handleReopen = async () => {
    setReopening(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: question.id, action: "reopen" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Question reopened");
      onMutated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to reopen question");
    } finally {
      setReopening(false);
    }
  };

  // ─── Turn Into Article ───
  // Creates a KoinoArticle (contentType=APOLOGETICS, status=draft) from the
  // question, links UserQuestion.articleId, sets status=turned_into_article.
  // The article is NOT auto-published — admin edits + publishes from Articles tab.
  const handleTurnIntoArticle = async () => {
    if (!confirm("Turn this question into a draft Apologetics article? You'll be able to edit and publish it from the Articles tab.")) return;
    setTurning(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: question.id, action: "turn_into_article" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Turned into a draft article!", {
        description: "Edit and publish it from the Articles tab.",
      });
      onMutated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to turn question into article");
    } finally {
      setTurning(false);
    }
  };

  // ─── Delete (permanent) ───
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/questions/${question.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Question deleted");
      onMutated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete question");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const isArchived = question.status === "archived";
  const isAnswered = question.status === "answered" || !!question.answer;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !deleting) onClose();
      }}
    >
      <div
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle size={14} className="text-[#38BDF8] shrink-0" />
            <h2 className="text-sm font-extrabold text-white truncate">Question Details</h2>
            <StatusBadge color={meta.color} label={meta.label} />
          </div>
          <button
            onClick={onClose}
            disabled={saving || deleting}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Question text */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              Question
            </p>
            <p className="text-sm text-white leading-relaxed whitespace-pre-line">
              {question.question}
            </p>
          </div>

          {/* Asker info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Asked by
              </p>
              <p className="text-sm font-bold text-white">{question.askerName || "Anonymous"}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1 flex items-center gap-1">
                <Mail size={9} /> Email
              </p>
              <p className="text-xs text-white break-all">
                {question.askerEmail || "—"}
              </p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1 flex items-center gap-1">
                <Clock size={9} /> Submitted
              </p>
              <p className="text-xs text-white">{formatDate(question.createdAt)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Category
              </p>
              <p className="text-xs text-white">{topic || "—"}</p>
            </div>
          </div>

          {/* Current answer (read-only display) */}
          {question.answer && (
            <div className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/8 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E] mb-1 flex items-center gap-1">
                <CheckCircle2 size={10} /> Current Answer
              </p>
              <p className="text-sm text-[#A09DB1] leading-relaxed whitespace-pre-line">
                {question.answer}
              </p>
            </div>
          )}

          {/* Answer editor */}
          <Field
            label="Answer"
            hint="Saving an answer marks this question as status=answered and exposes it publicly on /apologetics."
          >
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write a thoughtful, biblically-grounded answer…"
              className="neo-input text-sm h-40 resize-y"
              disabled={saving}
            />
          </Field>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
            <button
              onClick={handleSaveAnswer}
              disabled={saving || !answer.trim()}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              Save Answer
            </button>

            {!isArchived ? (
              <button
                onClick={handleClose}
                disabled={closing || saving || deleting}
                className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {closing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Archive size={12} />
                )}
                Close
              </button>
            ) : (
              <button
                onClick={handleReopen}
                disabled={reopening || saving || deleting}
                className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {reopening ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RotateCcw size={12} />
                )}
                Reopen
              </button>
            )}

            {/* Turn Into Article — only show if not already turned into an article */}
            {!question.articleId && question.status !== "turned_into_article" && (
              <button
                onClick={handleTurnIntoArticle}
                disabled={turning || saving || deleting}
                className="bg-[#A855F7]/10 hover:bg-[#A855F7]/20 border border-[#A855F7]/30 text-[#A855F7] text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {turning ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
                Turn Into Article
              </button>
            )}

            {/* If already turned into an article, show a link to it */}
            {question.articleId && (
              <a
                href={`/apologetics`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#A855F7]/10 border border-[#A855F7]/30 text-[#A855F7] text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all"
              >
                <FileText size={12} /> Article Created
              </a>
            )}

            <div className="ml-auto">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || deleting}
                  className="bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444] text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Trash2 size={12} /> Delete
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-2 py-1.5">
                  <span className="text-[10px] font-bold text-[#EF4444] mr-1">Sure?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-[#EF4444] hover:bg-[#DC2626] text-white text-[10px] font-bold rounded-lg px-2 py-1 flex items-center gap-1 disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Trash2 size={10} />
                    )}
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="bg-white/[0.04] hover:bg-white/[0.08] text-[#94A3B8] text-[10px] font-bold rounded-lg px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Hint when archived/answered */}
          {isAnswered && !isArchived && (
            <p className="text-[10px] text-[#64748B] flex items-center gap-1">
              <CheckCircle2 size={10} className="text-[#22C55E]" />
              This question is published publicly on the Apologetics Q&amp;A page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Q&A modal ──────────────────────────────────────────────────────

function CreateQAModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [askerName, setAskerName] = useState("Koino");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Question is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          answer: answer.trim() || undefined,
          category: category || undefined,
          askerName: askerName.trim() || "Koino",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Q&A created successfully");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create Q&A");
      // Keep modal open + preserve form content so admin can retry.
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !creating) onClose();
      }}
    >
      <div
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Plus size={14} className="text-[#A78BFA] shrink-0" />
            <h2 className="text-sm font-extrabold text-white truncate">Create Q&amp;A</h2>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Question" required hint="The full question text shown publicly.">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How can we know God exists?"
              className="neo-input text-sm h-28 resize-y"
              required
              disabled={creating}
            />
          </Field>

          <Field
            label="Answer"
            hint="Optional. If provided, this Q&A is created as status=answered (publicly visible). If omitted, it's created as status=new (hidden until you answer it)."
          >
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write the answer here…"
              className="neo-input text-sm h-40 resize-y"
              disabled={creating}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="neo-input text-sm bg-[#1C1929]"
                disabled={creating}
              >
                <option value="">— None —</option>
                {APOLOGETICS_TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Asker Name">
              <input
                type="text"
                value={askerName}
                onChange={(e) => setAskerName(e.target.value)}
                placeholder="Koino"
                className="neo-input text-sm"
                disabled={creating}
              />
            </Field>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !question.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Plus size={14} /> Create Q&amp;A
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
