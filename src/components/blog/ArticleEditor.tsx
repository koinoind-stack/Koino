"use client";

/**
 * ArticleEditor (Task 73) — the shared rich-text article editor used by
 * members (/blog/write) and admins (BlogTab "Write Article").
 *
 * Content format: Markdown, rendered everywhere through the existing
 * MarkdownRenderer (react-markdown + safeUrl) — raw HTML is never executed.
 * Inline images + cover images upload via POST /api/blog/upload (sharp →
 * WebP → Supabase Storage).
 *
 * Safety rails per spec: unsaved content is autosaved to localStorage and a
 * beforeunload guard warns before leaving with dirty state; all validation
 * errors surface inline; the authoritative validation runs server-side.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Save,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { BLOG_CATEGORIES, estimateReadingMinutes, BLOG_LIMITS } from "@/lib/blog";
import MarkdownRenderer from "@/components/crosscrafted/MarkdownRenderer";
import { insertAtCursor } from "@/components/social/EmojiPicker";

export type ArticleEditorInitial = {
  id?: string;
  title?: string;
  excerpt?: string | null;
  content?: string;
  category?: string;
  tags?: string[];
  coverImageUrl?: string | null;
  status?: string;
};

type Props = {
  initial?: ArticleEditorInitial;
  /** Admin mode: reveals Publish immediately (creates draft then publishes). */
  isAdmin?: boolean;
  onSaved?: (article: { id: string; status: string }) => void;
  onSubmitted?: (article: { id: string; status: string }) => void;
  onCancel?: () => void;
};

const DRAFT_KEY = (id?: string) => `koino-blog-draft-${id || "new"}`;

/** Display-name keys for the (English, DB-stored) category values. */
const CATEGORY_KEY: Record<string, string> = {
  "Bible Study": "blog.category.bibleStudy",
  Devotionals: "blog.category.devotionals",
  Testimonies: "blog.category.testimonies",
  "Christian Living": "blog.category.christianLiving",
  Apologetics: "blog.category.apologetics",
  "Church & Ministry": "blog.category.churchMinistry",
  "Christian News & Community": "blog.category.newsCommunity",
  "Prayer & Encouragement": "blog.category.prayerEncouragement",
};
const categoryKey = (c: string) => CATEGORY_KEY[c] ?? "";

export default function ArticleEditor({
  initial,
  isAdmin = false,
  onSaved,
  onSubmitted,
  onCancel,
}: Props) {
  const router = useRouter();
  const t = useTranslation();
  const [id, setId] = useState<string | undefined>(initial?.id);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [cover, setCover] = useState(initial?.coverImageUrl ?? "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "submit" | "publish" | "cover">("");
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const restoringRef = useRef(true);

  const readingMinutes = useMemo(
    () => estimateReadingMinutes(content),
    [content]
  );

  // ── Unsaved-content protection: localStorage autosave + beforeunload ──
  useEffect(() => {
    if (restoringRef.current) {
      // Restore newest autosave (only for never-saved editors).
      restoringRef.current = false;
      if (!initial?.id) {
        try {
          const raw = localStorage.getItem(DRAFT_KEY(undefined));
          if (raw) {
            const d = JSON.parse(raw);
            if (d?.title || d?.content) {
              setTitle(d.title ?? "");
              setExcerpt(d.excerpt ?? "");
              setContent(d.content ?? "");
              setCategory(d.category ?? "");
              setTags((d.tags ?? []).join(", "));
              setCover(d.coverImageUrl ?? "");
              toast.info(t("blog.editor.restoreDraft"));
            }
          }
        } catch {
          /* corrupted autosave — ignore */
        }
      }
      return;
    }
    try {
      localStorage.setItem(
        DRAFT_KEY(initial?.id),
        JSON.stringify({ title, excerpt, content, category, tags: parseTags(tags), coverImageUrl: cover })
      );
    } catch {
      /* storage full — non-fatal */
    }
  }, [title, excerpt, content, category, tags, cover, initial?.id]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (title.trim() || content.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [title, content]);

  const clearAutosave = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY(initial?.id));
      if (!initial?.id) localStorage.removeItem(DRAFT_KEY(undefined));
    } catch {
      /* ignore */
    }
  }, [initial?.id]);

  // ── Formatting helpers (markdown insertion at cursor) ──
  const wrap = (before: string, after = before) => {
    const el = contentRef.current;
    if (!el) {
      setContent(`${content}${before}selected${after}`);
      return;
    }
    insertAtCursor(el, `${before}selected${after}`, setContent);
  };
  const prefixLine = (prefix: string) => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const next = el.value.slice(0, start) + prefix + el.value.slice(start);
    setContent(next);
    requestAnimationFrame(() => el.focus());
  };
  const insertImage = async (file: File) => {
    setBusy("cover");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/blog/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("blog.editor.error.uploadFailed"));
      const el = contentRef.current;
      if (el) {
        const alt = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60);
        insertAtCursor(el, `\n![${alt}](${data.url})\n`, setContent);
      }
      toast.success(t("blog.editor.imageInserted"));
    } catch (e: any) {
      toast.error(e?.message || t("blog.editor.error.imageUpload"));
    } finally {
      setBusy("");
    }
  };

  // ── Validation + persistence ──
  const validate = (): string | null => {
    if (title.trim().length < BLOG_LIMITS.titleMin) return t("blog.editor.error.titleMin", { n: BLOG_LIMITS.titleMin });
    if (title.trim().length > BLOG_LIMITS.titleMax) return t("blog.editor.error.titleMax");
    if (!category) return t("blog.editor.error.category");
    if (!content.trim()) return t("blog.editor.error.content");
    if (content.length > BLOG_LIMITS.contentMax) return t("blog.editor.error.contentTooLong");
    if ((excerpt || "").length > BLOG_LIMITS.excerptMax) return t("blog.editor.error.excerptMax");
    const tagList = parseTags(tags);
    if (tagList.length > BLOG_LIMITS.tagMax) return t("blog.editor.error.tagMax", { n: BLOG_LIMITS.tagMax });
    return null;
  };

  const payload = () => ({
    title: title.trim(),
    excerpt: excerpt.trim() || null,
    content,
    category,
    tags: parseTags(tags),
    coverImageUrl: cover.trim() || null,
  });

  const save = async (thenSubmit = false, publishNow = false) => {
    const v = validate();
    if (v) {
      setError(v);
      toast.error(v);
      return;
    }
    setError(null);
    setBusy(thenSubmit ? (publishNow ? "publish" : "submit") : "save");
    try {
      // Create or update the draft first.
      const res = id
        ? await fetch(`/api/blog/articles/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload()),
          })
        : await fetch("/api/blog/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(publishNow ? { ...payload(), publishNow: true } : payload()),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("blog.editor.error.save"));
      let article = data.article;

      if (thenSubmit && !publishNow) {
        // Submit for review (works for brand-new and resubmitted articles).
        const sres = await fetch(`/api/blog/articles/${article.id}/submit`, { method: "POST" });
        const sdata = await sres.json();
        if (!sres.ok) throw new Error(sdata.error || t("blog.editor.error.submit"));
        article = sdata.article;
      }

      clearAutosave();
      setId(article.id);
      toast.success(
        publishNow
          ? t("blog.editor.published")
          : thenSubmit
            ? t("blog.editor.submittedForReview")
            : t("blog.editor.draftSaved")
      );
      if (thenSubmit) onSubmitted?.(article);
      else onSaved?.(article);
      router.refresh();
    } catch (e: any) {
      const msg = e?.message || t("blog.editor.error.generic");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy("");
    }
  };

  const uploadCover = async (file: File) => {
    setBusy("cover");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/blog/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("blog.editor.error.uploadFailed"));
      setCover(data.url);
      toast.success(t("blog.editor.coverUploaded"));
    } catch (e: any) {
      toast.error(e?.message || t("blog.editor.error.coverUpload"));
    } finally {
      setBusy("");
    }
  };

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-40";

  return (
    <div className="space-y-4">
      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("blog.editor.titlePlaceholder")}
        maxLength={BLOG_LIMITS.titleMax}
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-lg font-black text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F39B9B]/60 focus:ring-2 focus:ring-[#F39B9B]/20"
      />

      {/* Excerpt */}
      <textarea
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        placeholder={t("blog.editor.excerptPlaceholder")}
        rows={2}
        maxLength={BLOG_LIMITS.excerptMax}
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F39B9B]/60 resize-y"
      />

      {/* Category + tags */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl bg-[#1C1929] border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F39B9B]/60"
        >
          <option value="">{t("blog.editor.chooseCategory")}</option>
          {BLOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryKey(c) ? t(categoryKey(c)) : c}</option>
          ))}
        </select>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("blog.editor.tagsPlaceholder")}
          className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F39B9B]/60"
        />
      </div>

      {/* Cover image */}
      <div className="flex items-center gap-3 flex-wrap">
        {cover ? (
          <div className="relative w-40 h-24 rounded-xl overflow-hidden border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={t("blog.editor.coverPreviewAlt")} className="w-full h-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={() => setCover("")}
              className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white hover:bg-black"
              aria-label={t("blog.editor.removeCover")}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => coverInputRef.current?.click()} disabled={busy === "cover"} className={btn}>
            <ImagePlus size={13} /> {busy === "cover" ? t("blog.editor.uploading") : t("blog.editor.addCover")}
          </button>
        )}
        <p className="text-[11px] text-[#726E88]">
          {t("blog.editor.readingTimeMeta", { n: readingMinutes })}
        </p>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadCover(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Toolbar */}
      {!preview && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
          <button type="button" className={btn} onClick={() => prefixLine("## ")} title={t("blog.editor.tool.heading")}><Heading2 size={13} /> {t("blog.editor.tool.heading")}</button>
          <button type="button" className={btn} onClick={() => wrap("**")} title={t("blog.editor.tool.bold")}><Bold size={13} /></button>
          <button type="button" className={btn} onClick={() => wrap("*")} title={t("blog.editor.tool.italic")}><Italic size={13} /></button>
          <button type="button" className={btn} onClick={() => prefixLine("- ")} title={t("blog.editor.tool.bulletList")}><List size={13} /></button>
          <button type="button" className={btn} onClick={() => prefixLine("1. ")} title={t("blog.editor.tool.numberedList")}><ListOrdered size={13} /></button>
          <button type="button" className={btn} onClick={() => prefixLine("> ")} title={t("blog.editor.tool.quote")}><Quote size={13} /></button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              const el = contentRef.current;
              const url = window.prompt(t("blog.editor.linkPrompt"));
              if (!url) return;
              if (el) insertAtCursor(el, `[link text](${url})`, setContent);
              else setContent(`${content}[link text](${url})`);
            }}
            title={t("blog.editor.tool.link")}
          >
            <Link2 size={13} />
          </button>
          <label className={`${btn} cursor-pointer`}>
            <ImagePlus size={13} /> {t("blog.editor.tool.image")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) insertImage(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {/* Content / preview */}
      {preview ? (
        <div className="min-h-[320px] rounded-xl border border-white/10 bg-[#0F1420] p-5">
          {content.trim() ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm text-[#726E88]">{t("blog.editor.nothingToPreview")}</p>
          )}
        </div>
      ) : (
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("blog.editor.contentPlaceholder")}
          rows={16}
          className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F39B9B]/60 resize-y font-mono leading-relaxed"
        />
      )}

      {error && (
        <p aria-live="polite" className="text-xs font-bold text-[#F87171]">{error}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={btn}
          disabled={busy !== ""}
        >
          <Eye size={13} /> {preview ? t("blog.editor.edit") : t("blog.editor.preview")}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy !== ""}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 px-4 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider transition-colors disabled:opacity-40"
        >
          <Save size={13} /> {busy === "save" ? t("blog.editor.saving") : t("blog.editor.saveDraft")}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy !== ""}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] px-4 py-2.5 text-xs font-extrabold text-slate-950 uppercase tracking-wider transition-colors disabled:opacity-40"
        >
          <Send size={13} /> {busy === "submit" ? t("blog.editor.submitting") : t("blog.editor.submitForReview")}
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => save(true, true)}
            disabled={busy !== ""}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] px-4 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider transition-colors disabled:opacity-40"
          >
            <Send size={13} /> {busy === "publish" ? t("blog.editor.publishing") : t("blog.editor.publishNow")}
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="ml-auto text-xs font-bold text-[#A09DB1] hover:text-white transition-colors">
            {t("common.cancel")}
          </button>
        )}
      </div>

      <p className="text-[11px] text-[#726E88] leading-relaxed">
        {t("blog.editor.footerNote")}
      </p>
    </div>
  );
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, BLOG_LIMITS.tagMax);
}
