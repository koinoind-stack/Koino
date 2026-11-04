"use client";

/**
 * MyArticles (Task 73) — the signed-in member's submission list with live
 * status tracking: drafts, pending review, changes requested (with the
 * admin's feedback), published, rejected, archived.
 */

import { useCallback, useEffect, useState } from "react";
import { Clock, FileText, RefreshCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from "@/lib/blog";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { ArticleEditorInitial } from "./ArticleEditor";

export type MyArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  tags: string;
  featuredImage: string | null;
  status: string;
  reviewNotes: string | null;
  readingMinutes: number | null;
  featured: boolean;
  published: boolean;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/[0.06] text-[#A09DB1] border-white/10",
  pending: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/25",
  changes_requested: "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/25",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  rejected: "bg-red-500/10 text-red-400 border-red-500/25",
  archived: "bg-white/[0.04] text-[#726E88] border-white/[0.06]",
};

export default function MyArticles({
  onEdit,
  refreshKey,
}: {
  onEdit: (article: MyArticle) => void;
  refreshKey: number;
}) {
  const [articles, setArticles] = useState<MyArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const t = useTranslation();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blog/articles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("blog.mine.loadFailed"));
      setArticles(data.articles ?? []);
    } catch (e: any) {
      toast.error(e?.message || t("blog.mine.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const submit = async (a: MyArticle) => {
    setSubmittingId(a.id);
    try {
      const res = await fetch(`/api/blog/articles/${a.id}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("blog.mine.submitFailed"));
      toast.success(t("blog.mine.submitted"));
      load();
    } catch (e: any) {
      toast.error(e?.message || t("blog.mine.submitFailed"));
    } finally {
      setSubmittingId(null);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <section aria-label="My article submissions" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-white uppercase tracking-wider">{t("blog.mine.title")}</h2>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#A09DB1] hover:text-white transition-colors"
        >
          <RefreshCcw size={11} /> {t("blog.mine.refresh")}
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-6 text-center text-sm text-[#A09DB1]">
          {t("common.loadingShort")}
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-6 text-center">
          <FileText size={20} className="mx-auto mb-2 text-[#726E88]" />
          <p className="text-sm text-[#A09DB1]">
            {t("blog.mine.empty")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {articles.map((a) => {
            const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.draft;
            const canSubmit = ["draft", "changes_requested", "rejected"].includes(a.status);
            const canEdit = ["draft", "changes_requested", "rejected", "pending"].includes(a.status);
            return (
              <li key={a.id} className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${style}`}>
                        {ARTICLE_STATUS_LABELS[a.status as ArticleStatus] ?? a.status}
                      </span>
                      <span className="text-[11px] text-[#726E88]">{a.category}</span>
                      {a.readingMinutes != null && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#726E88]">
                          <Clock size={10} /> {t("blog.mine.minRead", { n: a.readingMinutes })}
                        </span>
                      )}
                      <span className="text-[11px] text-[#726E88]">{t("blog.mine.updated", { date: fmtDate(a.updatedAt) })}</span>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{a.title}</p>
                    {a.reviewNotes && a.status !== "published" && (
                      <p className="mt-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-xs text-[#A09DB1]">
                        <span className="font-bold text-[#94A3B8]">{t("blog.mine.adminFeedback")}</span>
                        {a.reviewNotes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.status === "published" && (
                      <a
                        href={`/blog/${a.slug}`}
                        className="rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        {t("blog.mine.action.view")}
                      </a>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(a)}
                        className="rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        {a.status === "pending" ? t("blog.mine.action.view") : t("blog.mine.action.edit")}
                      </button>
                    )}
                    {canSubmit && (
                      <button
                        type="button"
                        onClick={() => submit(a)}
                        disabled={submittingId === a.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F39B9B] hover:bg-[#E27B7B] px-3 py-1.5 text-xs font-extrabold text-slate-950 transition-colors disabled:opacity-40"
                      >
                        <Send size={11} />
                        {submittingId === a.id ? "…" : a.status === "draft" ? t("blog.mine.action.submit") : t("blog.mine.action.resubmit")}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
