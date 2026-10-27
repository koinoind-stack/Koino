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

export default function ArticleEditor({
  initial,
  isAdmin = false,
  onSaved,
  onSubmitted,
  onCancel,
}: Props) {
  const router = useRouter();
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
              toast.info("Restored your unsaved draft from this device.");
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
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const el = contentRef.current;
      if (el) {
        const alt = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60);
        insertAtCursor(el, `\n![${alt}](${data.url})\n`, setContent);
      }
      toast.success("Image inserted");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload the image.");
    } finally {
      setBusy("");
    }
  };

  // ── Validation + persistence ──
  const validate = (): string | null => {
    if (title.trim().length < BLOG_LIMITS.titleMin) return `Title must be at least ${BLOG_LIMITS.titleMin} characters.`;
    if (title.trim().length > BLOG_LIMITS.titleMax) return "Title must be under 200 characters.";
    if (!category) return "Choose a category.";
    if (!content.trim()) return "Write some content first.";
    if (content.length > BLOG_LIMITS.contentMax) return "Article content is too long.";
    if ((excerpt || "").length > BLOG_LIMITS.excerptMax) return "Excerpt must be under 500 characters.";
    const tagList = parseTags(tags);
    if (tagList.length > BLOG_LIMITS.tagMax) return `Up to ${BLOG_LIMITS.tagMax} tags.`;
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
      if (!res.ok) throw new Error(data.error || "Couldn't save the article.");
      let article = data.article;

      if (thenSubmit && !publishNow) {
        // Submit for review (works for brand-new and resubmitted articles).
        const sres = await fetch(`/api/blog/articles/${article.id}/submit`, { method: "POST" });
        const sdata = await sres.json();
        if (!sres.ok) throw new Error(sdata.error || "Couldn't submit for review.");
        article = sdata.article;
      }

      clearAutosave();
      setId(article.id);
      toast.success(
        publishNow
          ? "Article published."
          : thenSubmit
            ? "Submitted for review — an admin will take a look."
            : "Draft saved."
      );
      if (thenSubmit) onSubmitted?.(article);
      else onSaved?.(article);
      router.refresh();
    } catch (e: any) {
      const msg = e?.message || "Something went wrong. Your draft is safe on this device.";
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
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCover(data.url);
      toast.success("Cover image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload the cover image.");
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
        placeholder="Article title"
        maxLength={BLOG_LIMITS.titleMax}
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-lg font-black text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F39B9B]/60 focus:ring-2 focus:ring-[#F39B9B]/20"
      />

      {/* Excerpt */}
      <textarea
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        placeholder="Optional excerpt / subtitle — shown on cards and the feed (max 500 chars)"
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
          <option value="">Choose a category…</option>
          {BLOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma separated, up to 8)"
          className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F39B9B]/60"
        />
      </div>

      {/* Cover image */}
      <div className="flex items-center gap-3 flex-wrap">
        {cover ? (
          <div className="relative w-40 h-24 rounded-xl overflow-hidden border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="Cover preview" className="w-full h-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={() => setCover("")}
              className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white hover:bg-black"
              aria-label="Remove cover image"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => coverInputRef.current?.click()} disabled={busy === "cover"} className={btn}>
            <ImagePlus size={13} /> {busy === "cover" ? "Uploading…" : "Add cover image"}
          </button>
        )}
        <p className="text-[11px] text-[#726E88]">
          Reading time: <span className="font-bold text-[#A09DB1]">{readingMinutes} min</span> · JPG/PNG/WEBP, max 10 MB
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
          <button type="button" className={btn} onClick={() => prefixLine("## ")} title="Heading"><Heading2 size={13} /> Heading</button>
          <button type="button" className={btn} onClick={() => wrap("**")} title="Bold"><Bold size={13} /></button>
          <button type="button" className={btn} onClick={() => wrap("*")} title="Italic"><Italic size={13} /></button>
          <button type="button" className={btn} onClick={() => prefixLine("- ")} title="Bullet list"><List size={13} /></button>
          <button type="button" className={btn} onClick={() => prefixLine("1. ")} title="Numbered list"><ListOrdered size={13} /></button>
          <button type="button" className={btn} onClick={() => prefixLine("> ")} title="Quote"><Quote size={13} /></button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              const el = contentRef.current;
              const url = window.prompt("Link URL (https://…)");
              if (!url) return;
              if (el) insertAtCursor(el, `[link text](${url})`, setContent);
              else setContent(`${content}[link text](${url})`);
            }}
            title="Link"
          >
            <Link2 size={13} />
          </button>
          <label className={`${btn} cursor-pointer`}>
            <ImagePlus size={13} /> Image
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
            <p className="text-sm text-[#726E88]">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"Write your article… (Markdown supported: ## headings, **bold**, *italic*, lists, > quotes, [links](url))"}
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
          <Eye size={13} /> {preview ? "Edit" : "Preview"}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy !== ""}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 px-4 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider transition-colors disabled:opacity-40"
        >
          <Save size={13} /> {busy === "save" ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy !== ""}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] px-4 py-2.5 text-xs font-extrabold text-slate-950 uppercase tracking-wider transition-colors disabled:opacity-40"
        >
          <Send size={13} /> {busy === "submit" ? "Submitting…" : "Submit for Review"}
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => save(true, true)}
            disabled={busy !== ""}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] px-4 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider transition-colors disabled:opacity-40"
          >
            <Send size={13} /> {busy === "publish" ? "Publishing…" : "Publish Immediately"}
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="ml-auto text-xs font-bold text-[#A09DB1] hover:text-white transition-colors">
            Cancel
          </button>
        )}
      </div>

      <p className="text-[11px] text-[#726E88] leading-relaxed">
        Members submit articles for admin review before they appear publicly. Drafts are
        also kept on this device so you never lose unsaved work. Koino may edit articles
        for clarity before publishing.
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
