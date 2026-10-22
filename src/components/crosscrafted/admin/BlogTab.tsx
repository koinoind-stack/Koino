"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Search,
  X,
  Save,
  Trash2,
  Plus,
  Star,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

// Mirrors the API response shape from /api/admin/blog.
type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  author: string | null;
  category: string;
  tags: string; // JSON array string
  published: boolean;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  scheduledAt: string | null;
  canonicalUrl: string | null;
  relatedArticleIds: string; // JSON array string
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  author: string;
  category: string;
  tags: string; // CSV
  published: boolean;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  scheduledAt: string; // datetime-local string yyyy-MM-ddTHH:mm
  canonicalUrl: string;
  relatedArticleIds: string; // CSV
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  featuredImage: "",
  author: "",
  category: "Bible",
  tags: "",
  published: false,
  featured: false,
  seoTitle: "",
  seoDescription: "",
  scheduledAt: "",
  canonicalUrl: "",
  relatedArticleIds: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Parse a JSON array string safely — returns string[].
function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v ?? "")).filter((v) => v.length > 0);
    }
  } catch {
    // ignore
  }
  return [];
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

// Convert an ISO string to the value expected by <input type="datetime-local">:
// yyyy-MM-ddTHH:mm in the user's local timezone.
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function toFormState(post: BlogPost | null): FormState {
  if (!post) return { ...EMPTY_FORM };
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content,
    featuredImage: post.featuredImage ?? "",
    author: post.author ?? "",
    category: post.category,
    tags: parseStringArray(post.tags).join(", "),
    published: post.published,
    featured: post.featured,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    scheduledAt: toDatetimeLocalValue(post.scheduledAt),
    canonicalUrl: post.canonicalUrl ?? "",
    relatedArticleIds: parseStringArray(post.relatedArticleIds).join(", "),
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function BlogTab() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "featured">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === "all"
          ? "/api/admin/blog"
          : `/api/admin/blog?status=${filter}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { posts: BlogPost[] };
      setPosts(data.posts || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side search across title / slug / author.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      [p.title, p.slug, p.author ?? ""].some((s) => s.toLowerCase().includes(q))
    );
  }, [posts, search]);

  const counts = useMemo(() => {
    return {
      total: posts.length,
      draft: posts.filter((p) => !p.published).length,
      published: posts.filter((p) => p.published).length,
      featured: posts.filter((p) => p.featured).length,
    };
  }, [posts]);

  const openNew = () => setEditing({ id: null });
  const openEdit = (id: string) => setEditing({ id });
  const closeEditor = () => {
    setEditing(null);
  };

  const handleSaved = () => {
    closeEditor();
    load();
  };

  const handleDeleted = () => {
    closeEditor();
    load();
  };

  if (loading) {
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
        <div className="w-1 h-5 rounded-full bg-[#7C3AED]" />
        <h2 className="text-sm font-bold text-white">Blog Posts</h2>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C3AED]/15 text-[#A78BFA]">
          {counts.total}
        </span>
        <button
          onClick={openNew}
          className="ml-auto bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all"
        >
          <Plus size={12} />
          New Post
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={counts.total}
        />
        <FilterChip
          active={filter === "draft"}
          onClick={() => setFilter("draft")}
          label="Drafts"
          count={counts.draft}
          color="#F59E0B"
        />
        <FilterChip
          active={filter === "published"}
          onClick={() => setFilter("published")}
          label="Published"
          count={counts.published}
          color="#22C55E"
        />
        <FilterChip
          active={filter === "featured"}
          onClick={() => setFilter("featured")}
          label="Featured"
          count={counts.featured}
          color="#A855F7"
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
          placeholder="Search by title, slug, or author…"
          className="neo-input text-sm pl-9"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <FileText size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">
            {search ? "No posts match your search." : "No blog posts yet."}
          </p>
          {!search && (
            <button
              onClick={openNew}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#A78BFA] hover:text-white"
            >
              <Plus size={12} /> Create your first post
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => openEdit(p.id)}
              className="w-full text-left bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.15] transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white truncate">{p.title}</h3>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    /{p.slug}
                    {p.author && ` · ${p.author}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.featured && <StatusBadge color="#A855F7" label="Featured" />}
                  {p.published ? (
                    <StatusBadge color="#22C55E" label="Published" />
                  ) : (
                    <StatusBadge color="#F59E0B" label="Draft" />
                  )}
                </div>
              </div>
              {p.excerpt && (
                <p className="text-[11px] text-[#A09DB1] line-clamp-1 mb-1.5">{p.excerpt}</p>
              )}
              <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                <span className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] font-bold uppercase tracking-wider">
                  {p.category}
                </span>
                {p.published && p.publishedAt ? (
                  <span className="flex items-center gap-0.5">
                    <Eye size={9} /> {formatTimeAgo(p.publishedAt)}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} /> {formatTimeAgo(p.updatedAt)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <BlogEditorModal
          postId={editing.id}
          onClose={closeEditor}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
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
  const activeBg = color ? `${color}` : "#7C3AED";
  return (
    <button
      onClick={onClick}
      className={`bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all ${
        active ? "text-white border-transparent" : "text-[#94A3B8] hover:text-white"
      }`}
      style={active ? { backgroundColor: `${activeBg}25`, borderColor: `${activeBg}80`, color } : undefined}
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

// ─── Editor modal ──────────────────────────────────────────────────────────

function BlogEditorModal({
  postId,
  onClose,
  onSaved,
  onDeleted,
}: {
  postId: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(postId !== null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // Load existing post if editing.
  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/blog/${postId}`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { post: BlogPost };
        if (cancelled) return;
        setForm(toFormState(data.post));
      } catch (e: any) {
        toast.error(e?.message || "Failed to load post");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, onClose]);

  // Close on Escape + lock scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Auto-generate slug from title if the admin hasn't manually touched the slug.
  const effectiveSlug = slugTouched && form.slug ? form.slug : slugify(form.title);

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Category is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(), // server will slugify + de-dupe if empty
        excerpt: form.excerpt,
        content: form.content,
        featuredImage: form.featuredImage,
        author: form.author,
        category: form.category.trim(),
        tags: form.tags, // CSV → server coerces to JSON array
        published: form.published,
        featured: form.featured,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        scheduledAt: form.scheduledAt || null,
        canonicalUrl: form.canonicalUrl,
        relatedArticleIds: form.relatedArticleIds, // CSV → server coerces
      };
      const url = postId ? `/api/admin/blog/${postId}` : "/api/admin/blog";
      const method = postId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(postId ? "Post updated" : "Post created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!postId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Post deleted");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-[#A78BFA]" />
            <h2 className="text-sm font-extrabold text-white">
              {postId ? "Edit Post" : "New Post"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3">
          {/* Title */}
          <Field label="Title" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="neo-input text-sm"
              placeholder="The Grace of Quiet Mornings"
            />
          </Field>

          {/* Slug */}
          <Field label="Slug" hint="URL-friendly. Auto-generated from title if empty.">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                set("slug", e.target.value);
                setSlugTouched(true);
              }}
              className="neo-input text-sm"
              placeholder={slugify(form.title) || "the-grace-of-quiet-mornings"}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
            <p className="mt-1 text-[10px] text-[#64748B]">
              Live preview:{" "}
              <span className="text-[#38BDF8]">/blog/{effectiveSlug || "—"}</span>
            </p>
          </Field>

          {/* Category + Author */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Category" required>
              <input
                type="text"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="neo-input text-sm"
                placeholder="Bible / Faith / Christian Living"
              />
            </Field>
            <Field label="Author">
              <input
                type="text"
                value={form.author}
                onChange={(e) => set("author", e.target.value)}
                className="neo-input text-sm"
                placeholder="Author name"
              />
            </Field>
          </div>

          {/* Excerpt */}
          <Field label="Excerpt" hint="Short summary shown on cards.">
            <textarea
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              className="neo-input text-sm h-16 resize-none"
              placeholder="One or two sentences to hook the reader."
            />
          </Field>

          {/* Content */}
          <Field
            label="Content"
            hint="Markdown / plain text. Rendered as whitespace-pre-wrap on /blog/[slug]."
          >
            <textarea
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              className="neo-input text-sm h-44 resize-y font-mono"
              placeholder={"# Heading\n\nWrite your article here…"}
            />
          </Field>

          {/* Featured image */}
          <Field label="Featured Image URL" hint="Paste a Supabase Storage URL.">
            <input
              type="text"
              value={form.featuredImage}
              onChange={(e) => set("featuredImage", e.target.value)}
              className="neo-input text-sm"
              placeholder="https://<supabase-storage>/blog/post-cover.jpg"
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
            {form.featuredImage && (
              <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.featuredImage}
                  alt="Cover preview"
                  className="w-16 h-12 object-cover rounded-md bg-[#0f0f1a]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="text-[10px] text-[#94A3B8] break-all line-clamp-2">
                  {form.featuredImage}
                </span>
              </div>
            )}
          </Field>

          {/* Tags */}
          <Field label="Tags" hint="Comma-separated.">
            <input
              type="text"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              className="neo-input text-sm"
              placeholder="prayer, grace, morning"
            />
            {form.tags.trim().length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {form.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
                  .map((t, i) => (
                    <span
                      key={i}
                      className="bg-[#38BDF8]/10 text-[#38BDF8] text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                    >
                      {t}
                    </span>
                  ))}
              </div>
            )}
          </Field>

          {/* Published + Featured */}
          <div className="grid grid-cols-2 gap-2">
            <Toggle
              checked={form.published}
              onChange={(v) => set("published", v)}
              label="Published"
              hint={form.published ? "Visible on /blog" : "Hidden (draft)"}
              icon={form.published ? <Eye size={12} /> : <EyeOff size={12} />}
              color="#22C55E"
            />
            <Toggle
              checked={form.featured}
              onChange={(v) => set("featured", v)}
              label="Featured"
              hint={form.featured ? "Hero card" : "Standard card"}
              icon={<Star size={12} />}
              color="#A855F7"
            />
          </div>

          {/* SEO */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              SEO
            </p>
            <Field label="SEO Title" hint="Defaults to title — Koino Blog if empty.">
              <input
                type="text"
                value={form.seoTitle}
                onChange={(e) => set("seoTitle", e.target.value)}
                className="neo-input text-sm"
                placeholder="Optional — overrides <title> for search engines"
              />
            </Field>
            <Field label="SEO Description" hint="Defaults to excerpt if empty.">
              <textarea
                value={form.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
                className="neo-input text-sm h-16 resize-none"
                placeholder="Optional — meta description for search engines / social shares"
              />
            </Field>
            <Field label="Canonical URL" hint="For cross-posted articles only.">
              <input
                type="text"
                value={form.canonicalUrl}
                onChange={(e) => set("canonicalUrl", e.target.value)}
                className="neo-input text-sm"
                placeholder="https://medium.com/your-article-123"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
            </Field>
          </div>

          {/* Scheduling + Related */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Scheduled At" hint="Future date = hidden from /blog until then.">
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => set("scheduledAt", e.target.value)}
                className="neo-input text-sm"
              />
            </Field>
            <Field label="Related Article IDs" hint="Comma-separated post IDs.">
              <input
                type="text"
                value={form.relatedArticleIds}
                onChange={(e) => set("relatedArticleIds", e.target.value)}
                className="neo-input text-sm"
                placeholder="clxxxx1, clxxxx2"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.06]">
            {postId && (
              <div className="mr-auto">
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-[#EF4444]" />
                    <span className="text-[11px] text-[#94A3B8]">Delete permanently?</span>
                    <button
                      onClick={remove}
                      disabled={deleting}
                      className="bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] text-[11px] font-bold rounded-lg px-2 py-1 disabled:opacity-50"
                    >
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="text-[#94A3B8] hover:text-white text-[11px] font-bold px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving || deleting}
                    className="text-[#EF4444] hover:bg-[#EF4444]/10 text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || deleting}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all hover:-translate-y-px"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save size={14} /> {postId ? "Save Changes" : "Create Post"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form primitives ───────────────────────────────────────────────────────

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

function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`bg-white/[0.03] border rounded-xl p-3 text-left flex items-start gap-2 transition-all ${
        checked ? "border-white/[0.15]" : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
      style={checked ? { backgroundColor: `${color}15`, borderColor: `${color}50` } : undefined}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-white">{label}</p>
        <p className="text-[10px] text-[#94A3B8]">{hint}</p>
      </div>
      <span
        className={`mt-0.5 w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
          checked ? "" : "border-white/20"
        }`}
        style={checked ? { backgroundColor: color, borderColor: color } : undefined}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5L4 7L8 3"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
