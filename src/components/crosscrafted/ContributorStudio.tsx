"use client";

// ─── ContributorStudio — contributor workspace on the public hub (PART 2) ───
//
// Visible ONLY to signed-in users with an approved Contributor record
// (server-verified via /api/contributor/me). Contributors can:
//  - see their submissions + review status (draft/submitted/approved/
//    changes_requested/rejected + admin notes)
//  - submit new articles (status draft or submitted-for-review)
//  - edit their own in-progress articles (via the API rules)
//  - propose answers to open questions (pending admin approval)
//
// Server-side rules (never trusted from the client): contributors can never
// publish, feature, or touch other people's articles.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { HelpCircle, Loader2, PenLine, Send, X } from "lucide-react";
import ImageUploader from "@/components/crosscrafted/admin/ImageUploader";
import BibleRefPicker from "@/components/crosscrafted/BibleRefPicker";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const APOLOGETICS_CATEGORIES = [
  "God & Existence", "Jesus Christ", "Resurrection", "Bible", "Science & Faith",
  "Suffering & Evil", "Morality & Ethics", "Other Worldviews", "Doubt & Faith",
  "Culture & Christianity", "Salvation",
];

type MyArticle = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  category: string | null;
  excerpt: string | null;
  reviewNotes: string | null;
  updatedAt: string;
};

type OpenQuestion = {
  id: string;
  question: string;
  category: string;
  status: string;
  myProposal: string | null;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#F5B84A" },
  submitted: { label: "In review", color: "#22D3EE" },
  approved: { label: "Approved — awaiting publish", color: "#22C55E" },
  changes_requested: { label: "Changes requested", color: "#EF4444" },
  rejected: { label: "Rejected", color: "#EF4444" },
  published: { label: "Published", color: "#22C55E" },
  archived: { label: "Archived", color: "#64748B" },
};

// i18n: labels/categories above are English source data — resolved to keys at render.
const STATUS_KEYS: Record<string, string> = {
  draft: "contributor.status.draft",
  submitted: "contributor.status.inReview",
  approved: "contributor.status.approved",
  changes_requested: "contributor.status.changesRequested",
  rejected: "contributor.status.rejected",
  published: "contributor.status.published",
  archived: "contributor.status.archived",
};

const CATEGORY_KEYS: Record<string, string> = {
  "God & Existence": "contributor.cat.god",
  "Jesus Christ": "contributor.cat.jesus",
  Resurrection: "contributor.cat.resurrection",
  Bible: "contributor.cat.bible",
  "Science & Faith": "contributor.cat.science",
  "Suffering & Evil": "contributor.cat.suffering",
  "Morality & Ethics": "contributor.cat.morality",
  "Other Worldviews": "contributor.cat.worldviews",
  "Doubt & Faith": "contributor.cat.doubt",
  "Culture & Christianity": "contributor.cat.culture",
  Salvation: "contributor.cat.salvation",
};

export default function ContributorStudio({
  displayName,
  onClose,
}: {
  displayName: string;
  onClose: () => void;
}) {
  const t = useTranslation();
  const [tab, setTab] = useState<"submissions" | "write" | "answers">("submissions");
  const [articles, setArticles] = useState<MyArticle[]>([]);
  const [questions, setQuestions] = useState<OpenQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [mountedAt] = useState(() => Date.now());

  // ─── Write form ───
  const [wTitle, setWTitle] = useState("");
  const [wCategory, setWCategory] = useState("");
  const [wExcerpt, setWExcerpt] = useState("");
  const [wShortAnswer, setWShortAnswer] = useState("");
  const [wContent, setWContent] = useState("");
  const [wCover, setWCover] = useState("");
  const [wRefs, setWRefs] = useState<string[]>([]);
  const [wTags, setWTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── Answer form ───
  const [answerQuestionId, setAnswerQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, qRes] = await Promise.all([
        fetch("/api/contributor/articles", { cache: "no-store" }),
        fetch("/api/contributor/answers", { cache: "no-store" }),
      ]);
      const aData = await aRes.json().catch(() => ({}));
      const qData = await qRes.json().catch(() => ({}));
      setArticles(aData.articles || []);
      setQuestions(qData.questions || []);
    } catch {
      // keep lists empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitArticle = async (status: "draft" | "submitted") => {
    if (!wTitle.trim() || !wContent.trim()) {
      toast.error(t("contributor.errRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contributor/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: wTitle,
          category: wCategory || undefined,
          excerpt: wExcerpt || undefined,
          shortAnswer: wShortAnswer || undefined,
          content: wContent,
          coverImageUrl: wCover || undefined,
          bibleRefs: wRefs,
          tags: wTags,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success(
        status === "submitted"
          ? t("contributor.submittedToast")
          : t("contributor.draftSaved")
      );
      setWTitle(""); setWCategory(""); setWExcerpt(""); setWShortAnswer("");
      setWContent(""); setWCover(""); setWRefs([]); setWTags("");
      setTab("submissions");
      load();
    } catch (e: any) {
      toast.error(e?.message || t("contributor.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer = async () => {
    if (!answerQuestionId || answerText.trim().length < 20) {
      toast.error(t("contributor.errAnswerShort"));
      return;
    }
    setSubmittingAnswer(true);
    try {
      const res = await fetch("/api/contributor/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: answerQuestionId, answer: answerText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success(data.message || t("contributor.answerSubmitted"));
      setAnswerQuestionId(null);
      setAnswerText("");
      load();
    } catch (e: any) {
      toast.error(e?.message || t("contributor.answerFailed"));
    } finally {
      setSubmittingAnswer(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-md p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-[#13294A] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] sticky top-0 bg-[#13294A] z-10">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <PenLine size={14} className="text-[#60A5FA]" /> {t("contributor.title")}
            </h2>
            <p className="text-[10px] text-[#94A3B8] truncate">{t("contributor.welcome", { name: displayName })}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white"
            aria-label={t("common.close")}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 pb-0">
          {(["submissions", "write", "answers"] as const).map((tabId) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                tab === tabId ? "bg-[#2563EB]/25 text-[#60A5FA]" : "text-[#94A3B8] hover:text-white"
              }`}
            >
              {tabId === "submissions" ? t("contributor.tab.submissions") : tabId === "write" ? t("contributor.tab.write") : t("contributor.tab.answers")}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#2563EB]" />
            </div>
          ) : tab === "submissions" ? (
            articles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm font-bold text-white mb-1">{t("contributor.empty")}</p>
                <p className="text-xs text-[#94A3B8] mb-3">{t("contributor.emptyDesc")}</p>
                <button
                  onClick={() => setTab("write")}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold"
                >
                  {t("contributor.startWriting")}
                </button>
              </div>
            ) : (
              articles.map((a) => {
                const meta = STATUS_META[a.status] || { label: a.status, color: "#94A3B8" };
                return (
                  <div key={a.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-bold text-white">{a.title}</p>
                      <span
                        className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                      >
                        {t(STATUS_KEYS[a.status] ?? meta.label)}
                      </span>
                    </div>
                    {a.excerpt && <p className="text-[11px] text-[#A09DB1] line-clamp-2 mb-1">{a.excerpt}</p>}
                    {a.reviewNotes && (
                      <p className="text-[10px] text-[#F5B84A] bg-[#F5B84A]/10 border border-[#F5B84A]/20 rounded-lg px-2 py-1 mt-1">
                        {t("contributor.editorNotes", { notes: a.reviewNotes })}
                      </p>
                    )}
                    <p className="text-[9px] text-[#64748B] mt-1">
                      {t("contributor.updated", { date: new Date(a.updatedAt).toLocaleDateString() })}
                      {a.status === "published" && a.slug ? " · " : ""}
                      {a.status === "published" && a.slug && (
                        <a href={`/apologetics/${a.slug}`} target="_blank" rel="noopener noreferrer" className="text-[#22D3EE] underline">
                          {t("contributor.viewLive")}
                        </a>
                      )}
                    </p>
                  </div>
                );
              })
            )
          ) : tab === "write" ? (
            <div className="space-y-3">
              <input
                type="text"
                value={wTitle}
                onChange={(e) => setWTitle(e.target.value)}
                placeholder={t("contributor.titlePlaceholder")}
                className="neo-input text-sm"
                maxLength={300}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={wCategory}
                  onChange={(e) => setWCategory(e.target.value)}
                  className="neo-input text-sm bg-[#13294A]"
                >
                  <option value="">{t("contributor.categoryPlaceholder")}</option>
                  {APOLOGETICS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(CATEGORY_KEYS[c] ?? c)}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={wTags}
                  onChange={(e) => setWTags(e.target.value)}
                  placeholder={t("contributor.tagsPlaceholder")}
                  className="neo-input text-sm"
                />
              </div>
              <textarea
                value={wExcerpt}
                onChange={(e) => setWExcerpt(e.target.value)}
                placeholder={t("contributor.excerptPlaceholder")}
                className="neo-input text-xs h-14 resize-none"
                maxLength={500}
              />
              <textarea
                value={wShortAnswer}
                onChange={(e) => setWShortAnswer(e.target.value)}
                placeholder={t("contributor.shortAnswerPlaceholder")}
                className="neo-input text-xs h-14 resize-none"
                maxLength={2000}
              />
              <ImageUploader value={wCover} onChange={setWCover} />
              <BibleRefPicker value={wRefs} onChange={setWRefs} />
              <textarea
                value={wContent}
                onChange={(e) => setWContent(e.target.value)}
                placeholder={t("contributor.contentPlaceholder")}
                className="neo-input text-sm h-56 resize-y font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => submitArticle("draft")}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] disabled:opacity-50"
                >
                  {t("contributor.saveDraft")}
                </button>
                <button
                  onClick={() => submitArticle("submitted")}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                  {t("contributor.submitForReview")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle size={24} className="mx-auto text-[#475569] mb-2" />
                  <p className="text-xs text-[#94A3B8]">{t("contributor.noQuestions")}</p>
                </div>
              ) : (
                questions.map((q) => (
                  <div key={q.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-xs font-bold text-white line-clamp-2 mb-1">{q.question.split("\n")[0]}</p>
                    <p className="text-[10px] text-[#64748B] mb-2">
                      {q.status === "new" ? t("contributor.qNew") : t("contributor.status.inReview")}
                      {q.myProposal === "pending" && ` ${t("contributor.answerPending")}`}
                      {q.myProposal === "rejected" && ` ${t("contributor.proposalRejected")}`}
                    </p>
                    {answerQuestionId === q.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder={t("contributor.answerPlaceholder")}
                          className="neo-input text-xs h-32 resize-y"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setAnswerQuestionId(null); setAnswerText(""); }}
                            className="flex-1 py-2 rounded-lg text-xs font-semibold bg-white/[0.04] text-[#94A3B8] border border-white/[0.06]"
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            onClick={submitAnswer}
                            disabled={submittingAnswer}
                            className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-[#22D3EE] hover:bg-[#0EA5E9] disabled:opacity-60 flex items-center justify-center gap-1.5"
                          >
                            {submittingAnswer ? <Loader2 size={12} className="animate-spin" /> : <Send size={11} />}
                            {t("contributor.submitForReview")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAnswerQuestionId(q.id); setAnswerText(""); }}
                        className="text-[10px] font-bold text-[#22D3EE] hover:bg-[#22D3EE]/10 rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        {q.myProposal ? t("contributor.reviseProposal") : t("contributor.proposeAnswer")}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
