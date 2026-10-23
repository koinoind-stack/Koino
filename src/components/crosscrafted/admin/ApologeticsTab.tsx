"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ImageUploader from "@/components/crosscrafted/admin/ImageUploader";
import InlineImagePopover from "@/components/crosscrafted/admin/InlineImagePopover";
import ImportPdfModal from "@/components/crosscrafted/admin/ImportPdfModal";
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
  ExternalLink,
  Heading2,
  Heading3,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileUp,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

// Mirrors the API response shape from /api/admin/articles.
type KoinoArticle = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  category: string | null;
  subcategory: string | null;
  excerpt: string | null;
  shortAnswer: string | null;
  content: string;
  coverImageUrl: string | null;
  authorId: string | null;
  authorName: string | null;
  status: string; // "draft" | "published" | ...
  difficulty: string | null; // "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  featured: boolean;
  bibleRefs: string; // JSON array string
  sources: string; // JSON array string
  relatedIds: string; // JSON array string
  publishedAt: string | null;
  scheduledAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  title: string;
  slug: string;
  category: string;
  subcategory: string;
  difficulty: string; // "" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  excerpt: string;
  shortAnswer: string;
  content: string;
  coverImageUrl: string;
  authorName: string;
  bibleRefs: string; // CSV
  status: string; // "draft" | "published"
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  category: "",
  subcategory: "",
  difficulty: "",
  excerpt: "",
  shortAnswer: "",
  content: "",
  coverImageUrl: "",
  authorName: "",
  bibleRefs: "",
  status: "draft",
  featured: false,
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
};

// The 11 canonical apologetics categories. Order matches the public page.
const APOLOGETICS_CATEGORIES = [
  "God & Existence",
  "Jesus Christ",
  "Resurrection",
  "Bible",
  "Science & Faith",
  "Suffering & Evil",
  "Morality & Ethics",
  "Other Worldviews",
  "Doubt & Faith",
  "Culture & Christianity",
  "Salvation",
];

const DIFFICULTY_OPTIONS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────

// URL sanitizer — blocks dangerous protocols (javascript:, data:, vbscript:,
// file:) in markdown links + images. Only allows http(s), mailto, tel, and
// relative URLs. Defense-in-depth on top of react-markdown's built-in filtering.
function safeUrl(url: string | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

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

function toFormState(article: KoinoArticle | null): FormState {
  if (!article) return { ...EMPTY_FORM };
  return {
    title: article.title,
    slug: article.slug,
    category: article.category ?? "",
    subcategory: article.subcategory ?? "",
    difficulty: article.difficulty ?? "",
    excerpt: article.excerpt ?? "",
    shortAnswer: article.shortAnswer ?? "",
    content: article.content,
    coverImageUrl: article.coverImageUrl ?? "",
    authorName: article.authorName ?? "",
    bibleRefs: parseStringArray(article.bibleRefs).join(", "),
    status: article.status === "published" ? "published" : "draft",
    featured: article.featured,
    seoTitle: article.seoTitle ?? "",
    seoDescription: article.seoDescription ?? "",
    canonicalUrl: article.canonicalUrl ?? "",
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ApologeticsTab() {
  const [articles, setArticles] = useState<KoinoArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "featured">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [showImportPdf, setShowImportPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: "APOLOGETICS" });
      if (filter !== "all") params.set("status", filter);
      const url = `/api/admin/articles?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { articles: KoinoArticle[] };
      setArticles(data.articles || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load apologetics articles");
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
    if (!q) return articles;
    return articles.filter((a) =>
      [a.title, a.slug, a.authorName ?? "", a.category ?? ""].some((s) =>
        s.toLowerCase().includes(q)
      )
    );
  }, [articles, search]);

  const counts = useMemo(() => {
    return {
      total: articles.length,
      draft: articles.filter((a) => a.status === "draft").length,
      published: articles.filter((a) => a.status === "published").length,
      featured: articles.filter((a) => a.featured).length,
    };
  }, [articles]);

  const openNew = () => setEditing({ id: null });
  const openEdit = (id: string) => setEditing({ id });
  const closeEditor = () => {
    setEditing(null);
  };

  const handleSaved = () => {
    // Refresh the article list. The modal is already closed by onClose()
    // called directly from save() — this just refreshes the list.
    load();
  };

  const handleDeleted = () => {
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
        <h2 className="text-sm font-bold text-white">Apologetics Articles</h2>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C3AED]/15 text-[#A78BFA]">
          {counts.total}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowImportPdf(true)}
            className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all"
          >
            <FileUp size={12} />
            <span className="hidden sm:inline">Import PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={openNew}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Write Article</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
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
          placeholder="Search by title, slug, author, or category…"
          className="neo-input text-sm pl-9"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <FileText size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">
            {search ? "No articles match your search." : "No apologetics articles yet."}
          </p>
          {!search && (
            <button
              onClick={openNew}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#A78BFA] hover:text-white"
            >
              <Plus size={12} /> Write your first article
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => openEdit(a.id)}
              className="w-full text-left bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3 hover:border-white/[0.15] transition-all flex gap-3"
            >
              {/* Cover image thumbnail — 16:9, ~140px wide on desktop */}
              <div className="w-32 sm:w-36 shrink-0">
                {a.coverImageUrl ? (
                  <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-[#0f0f1a]">
                    <img
                      src={a.coverImageUrl}
                      alt={a.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-gradient-to-br from-[#1C1929] via-[#2B254E] to-[#0f0f1a]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileText size={18} className="text-[#475569]/60" />
                    </div>
                  </div>
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-white truncate">{a.title}</h3>
                    <p className="text-[11px] text-[#94A3B8] truncate">
                      /apologetics/{a.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.featured && <StatusBadge color="#A855F7" label="Featured" />}
                    {a.status === "published" ? (
                      <StatusBadge color="#22C55E" label="Published" />
                    ) : (
                      <StatusBadge color="#F59E0B" label="Draft" />
                    )}
                  </div>
                </div>
                {a.excerpt && (
                  <p className="text-[11px] text-[#A09DB1] line-clamp-1 mb-1.5">{a.excerpt}</p>
                )}
                <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                  {a.category && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] font-bold uppercase tracking-wider">
                      {a.category}
                    </span>
                  )}
                  {a.difficulty && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#A78BFA] font-bold uppercase tracking-wider">
                      {a.difficulty}
                    </span>
                  )}
                  {a.authorName && (
                    <span className="text-[#94A3B8]">
                      by {a.authorName}
                    </span>
                  )}
                  {a.status === "published" && a.publishedAt ? (
                    <span className="flex items-center gap-0.5">
                      <Eye size={9} /> {formatTimeAgo(a.publishedAt)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <Clock size={9} /> {formatTimeAgo(a.updatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <ApologeticsEditorModal
          articleId={editing.id}
          onClose={closeEditor}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {/* Import PDF modal — admin uploads a PDF, server extracts text + cover
          image, creates a draft KoinoArticle, then we open the editor for
          that article so the admin can review + publish. */}
      {showImportPdf && (
        <ImportPdfModal
          onClose={() => setShowImportPdf(false)}
          onImported={(id) => {
            setShowImportPdf(false);
            // Refresh the list so the new draft appears, then open the editor
            // with the freshly-imported article.
            void load();
            openEdit(id);
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

// Apologetics structure helper — predefined markdown headings authors can
// insert with a single click. Optional; just a starting scaffold.
const APOLGETICS_SECTION_SNIPPETS: { label: string; snippet: string }[] = [
  { label: "Question / Objection", snippet: "\n\n## Question / Objection\n\n" },
  { label: "Short Answer", snippet: "\n\n## Short Answer\n\n" },
  { label: "Main Answer", snippet: "\n\n## Main Answer\n\n" },
  { label: "Evidence", snippet: "\n\n## Evidence\n\n" },
  { label: "Common Objection", snippet: "\n\n## Common Objection\n\n" },
  { label: "Response", snippet: "\n\n## Response\n\n" },
  { label: "Biblical Foundation", snippet: "\n\n## Biblical Foundation\n\n" },
  { label: "Conclusion", snippet: "\n\n## Conclusion\n\n" },
];

// Markdown toolbar insert spec. `block` mode inserts a line-prefix at the start
// of the current line (H2/H3/lists/blockquote). `wrap` mode wraps the current
// selection (or inserts a placeholder). `snippet` mode inserts raw text at the
// cursor (used for hr + apologetics structure pills).
type InsertSpec =
  | { mode: "wrap"; prefix: string; suffix: string; placeholder?: string }
  | { mode: "block"; linePrefix: string }
  | { mode: "snippet"; text: string };

// Collapsible section card. All sections start expanded.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A78BFA]">
          {title}
        </span>
        {open ? (
          <ChevronDown size={14} className="text-[#94A3B8]" />
        ) : (
          <ChevronRight size={14} className="text-[#94A3B8]" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// Small icon button used in the formatting toolbar.
function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="shrink-0 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg p-2 text-[#A09DB1] hover:text-white transition-colors flex items-center justify-center"
    >
      {children}
    </button>
  );
}

// Visual divider between toolbar button groups.
function ToolbarDivider() {
  return <div className="shrink-0 w-px h-5 bg-white/[0.08] mx-0.5 self-center" />;
}

// Renders the article content as markdown for the in-modal Preview tab.
// Mirrors the public /apologetics/[slug] layout (cover → title → excerpt →
// short-answer callout → content → bible-ref chips).
function MarkdownPreview({
  content,
  coverImageUrl,
  title,
  excerpt,
  shortAnswer,
  bibleRefs,
}: {
  content: string;
  coverImageUrl: string;
  title: string;
  excerpt: string;
  shortAnswer: string;
  bibleRefs: string;
}) {
  const bibleList = bibleRefs
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return (
    <div className="space-y-4 text-sm text-[#A09DB1]">
      {coverImageUrl && (
        <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0f0f1a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageUrl}
            alt={title || "Cover"}
            className="w-full h-48 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <h1 className="text-2xl font-extrabold text-white leading-tight">
        {title || "Untitled article"}
      </h1>
      {excerpt && <p className="italic text-[#94A3B8]">{excerpt}</p>}
      {shortAnswer && (
        <div className="rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA] mb-1">
            Short Answer
          </p>
          <p className="text-sm text-[#D8D5E8] leading-relaxed whitespace-pre-wrap">
            {shortAnswer}
          </p>
        </div>
      )}
      <div className="prose-invert max-w-none">
        <ReactMarkdown
          components={{
            h1: ({ node: _n, ...props }) => (
              <h1 className="text-xl font-extrabold text-white mt-4 mb-2" {...props} />
            ),
            h2: ({ node: _n, ...props }) => (
              <h2 className="text-lg font-extrabold text-white mt-4 mb-2" {...props} />
            ),
            h3: ({ node: _n, ...props }) => (
              <h3 className="text-base font-bold text-white mt-3 mb-1.5" {...props} />
            ),
            h4: ({ node: _n, ...props }) => (
              <h4 className="text-sm font-bold text-white mt-3 mb-1" {...props} />
            ),
            p: ({ node: _n, ...props }) => (
              <p className="leading-relaxed mb-3 text-[#A09DB1]" {...props} />
            ),
            ul: ({ node: _n, ...props }) => (
              <ul className="list-disc pl-5 space-y-1 mb-3 text-[#A09DB1]" {...props} />
            ),
            ol: ({ node: _n, ...props }) => (
              <ol className="list-decimal pl-5 space-y-1 mb-3 text-[#A09DB1]" {...props} />
            ),
            li: ({ node: _n, ...props }) => <li className="leading-relaxed" {...props} />,
            blockquote: ({ node: _n, ...props }) => (
              <blockquote
                className="border-l-2 border-[#7C3AED]/50 pl-3 italic text-[#94A3B8] my-3"
                {...props}
              />
            ),
            a: ({ node: _n, href, ...props }) => {
              const safeHref = safeUrl(href);
              if (!safeHref) return <span className="text-[#94A3B8]">{props.children}</span>;
              return (
                <a
                  href={safeHref}
                  className="text-[#38BDF8] underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              );
            },
            img: ({ node: _n, src, ...props }) => {
              const safeSrc = safeUrl(src as string);
              if (!safeSrc) return null;
              // eslint-disable-next-line @next/next/no-img-element
              return (
                <img
                  src={safeSrc}
                  className="rounded-xl max-w-full my-3 border border-white/[0.08]"
                  alt=""
                  {...props}
                />
              );
            },
            hr: () => <hr className="border-white/[0.1] my-4" />,
            strong: ({ node: _n, ...props }) => (
              <strong className="text-white font-bold" {...props} />
            ),
            em: ({ node: _n, ...props }) => <em className="italic" {...props} />,
            code: ({ node: _n, ...props }) => (
              <code
                className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[#A78BFA] text-xs"
                {...props}
              />
            ),
            pre: ({ node: _n, ...props }) => (
              <pre
                className="bg-black/30 border border-white/[0.06] rounded-xl p-3 my-3 overflow-x-auto text-xs"
                {...props}
              />
            ),
          }}
        >
          {content && content.trim() ? content : "*No content yet — switch to Edit to start writing.*"}
        </ReactMarkdown>
      </div>
      {bibleList.length > 0 && (
        <div className="pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Bible References
          </p>
          <div className="flex flex-wrap gap-1">
            {bibleList.map((t, i) => (
              <span
                key={i}
                className="bg-[#38BDF8]/10 text-[#38BDF8] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApologeticsEditorModal({
  articleId,
  onClose,
  onSaved,
  onDeleted,
}: {
  articleId: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(articleId !== null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [currentSlug, setCurrentSlug] = useState<string>("");
  const [currentStatus, setCurrentStatus] = useState<string>("draft");
  // New state for the improved editor UX.
  const [activeArticleId, setActiveArticleId] = useState<string | null>(articleId);
  const [previewMode, setPreviewMode] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // State for the inline image upload popover (opened from the Image toolbar
  // button). When open, the admin can pick a file, set alt text, and upload —
  // the resulting ![alt](url) markdown is inserted at the cursor.
  const [showImagePopover, setShowImagePopover] = useState(false);

  // Refs: textarea for cursor-aware markdown insertion, snapshot for the
  // unsaved-changes guard.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const snapshotRef = useRef<FormState>({ ...EMPTY_FORM });

  // Deep-compare current form vs last-saved snapshot. JSON.stringify is fine
  // here — the form is a small flat object.
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(snapshotRef.current),
    [form]
  );

  // Load existing article if editing. For new articles, snapshot the empty
  // form so hasUnsavedChanges starts false.
  useEffect(() => {
    if (!articleId) {
      setLoading(false);
      const initial = { ...EMPTY_FORM };
      setForm(initial);
      snapshotRef.current = initial;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/articles/${articleId}`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { article: KoinoArticle };
        if (cancelled) return;
        const fs = toFormState(data.article);
        setForm(fs);
        snapshotRef.current = fs;
        setCurrentSlug(data.article.slug);
        setCurrentStatus(data.article.status);
        setActiveArticleId(data.article.id);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load article");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId, onClose]);

  // Wrap onClose with the unsaved-changes guard. If the discard dialog is
  // already open, Escape / overlay click just dismisses it instead of
  // triggering another prompt.
  const requestClose = useCallback(() => {
    if (showDiscardConfirm) {
      setShowDiscardConfirm(false);
      return;
    }
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, showDiscardConfirm, onClose]);

  // Escape to close (with guard) + lock body scroll while modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [requestClose]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Auto-generate slug from title if the admin hasn't manually touched the slug.
  const effectiveSlug = slugTouched && form.slug ? form.slug : slugify(form.title);

  // ─── Markdown toolbar ────────────────────────────────────────────────────
  // Inserts markdown syntax at the cursor / around the selection. Updates
  // form.content and restores focus + selection after React re-renders.
  const applyInsert = (spec: InsertSpec) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = ta.value;
    const selected = value.slice(start, end);

    let newValue: string;
    let newSelStart: number;
    let newSelEnd: number;

    if (spec.mode === "snippet") {
      newValue = value.slice(0, start) + spec.text + value.slice(end);
      newSelStart = start + spec.text.length;
      newSelEnd = newSelStart;
    } else if (spec.mode === "block") {
      // Insert the prefix at the start of the current line.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const linePortion = value.slice(lineStart, start);
      const inserted = spec.linePrefix + linePortion;
      newValue = value.slice(0, lineStart) + inserted + value.slice(start);
      newSelStart = start + spec.linePrefix.length;
      newSelEnd = end + spec.linePrefix.length;
    } else {
      // Wrap selection (or insert placeholder) with prefix + suffix.
      const placeholder = spec.placeholder ?? "text";
      const inner = selected || placeholder;
      const insertion = spec.prefix + inner + spec.suffix;
      newValue = value.slice(0, start) + insertion + value.slice(end);
      newSelStart = start + spec.prefix.length;
      newSelEnd = newSelStart + inner.length;
    }

    set("content", newValue);
    // Restore focus + selection after React re-renders the textarea with the
    // new value.
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      t.focus();
      try {
        t.setSelectionRange(newSelStart, newSelEnd);
      } catch {
        // setSelectionRange can throw on some input types; safe to ignore.
      }
    });
  };

  // ─── Save (Draft / Publish / Unpublish) ─────────────────────────────────
  // Keeps the editor OPEN after every successful save. Resets the unsaved-
  // changes snapshot so the close guard doesn't fire. On failure, leaves the
  // snapshot alone so the guard still works.
  const save = async (
    targetStatus: "draft" | "published",
    opts?: { successToast?: string; wasUnpublish?: boolean }
  ) => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Content is required");
      return;
    }
    setSaving(true);
    const wasPublished = currentStatus === "published";
    try {
      const payload: Record<string, unknown> = {
        contentType: "APOLOGETICS",
        title: form.title.trim(),
        slug: form.slug.trim(), // server will slugify + de-dupe if empty
        category: form.category.trim() || null,
        subcategory: form.subcategory.trim() || null,
        difficulty: form.difficulty || null,
        excerpt: form.excerpt,
        shortAnswer: form.shortAnswer,
        content: form.content,
        coverImageUrl: form.coverImageUrl,
        authorName: form.authorName,
        bibleRefs: form.bibleRefs, // CSV → server coerces to JSON array
        status: targetStatus, // "draft" | "published"
        featured: form.featured,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        canonicalUrl: form.canonicalUrl,
      };
      const idForSave = activeArticleId;
      const url = idForSave ? `/api/admin/articles/${idForSave}` : "/api/admin/articles";
      const method = idForSave ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { article: KoinoArticle };
      const updated = toFormState(data.article);

      // Toast messaging per the spec.
      if (opts?.successToast) {
        toast.success(opts.successToast);
      } else if (opts?.wasUnpublish) {
        toast.success("Article unpublished (reverted to draft)");
      } else if (targetStatus === "published") {
        toast.success(wasPublished ? "Article updated" : "Article published");
      } else {
        toast.success("Draft saved");
      }

      // Close the editor FIRST, then refresh the list.
      // We call onClose() directly (not onSaved()) to ensure the modal
      // unmounts immediately. Then we call onSaved() to refresh the list.
      // The order matters: onClose() sets editing=null in the parent,
      // which unmounts this modal. onSaved() then refreshes the article list.
      // We do NOT update modal state (setForm, setSaving, etc.) after this
      // point — the modal is closing, so those updates would be on an
      // unmounted component.
      onClose();
      onSaved();
      return; // Skip the finally block — modal is closing
    } catch (e: any) {
      toast.error(e?.message || "Failed to save article");
      // Do NOT update the snapshot — leave hasUnsavedChanges true so the
      // close guard still fires.
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!activeArticleId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/articles/${activeArticleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Article deleted");
      onClose();
      onDeleted();
      return;
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete article");
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
      onClick={requestClose}
    >
      <div
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={14} className="text-[#A78BFA] shrink-0" />
            <h2 className="text-sm font-extrabold text-white truncate">
              {activeArticleId ? "Edit Article" : "New Article"}
            </h2>
            {hasUnsavedChanges && (
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B]">
                Unsaved
              </span>
            )}
          </div>
          <button
            onClick={requestClose}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body — collapsible sections */}
        <div className="space-y-3">
          {/* ▸ ARTICLE INFORMATION */}
          <Section title="Article Information">
            <Field label="Title" required>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="neo-input text-sm"
                placeholder="Did Jesus Really Rise from the Dead?"
              />
            </Field>

            <Field label="Slug" hint="URL-friendly. Auto-generated from title if empty.">
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  set("slug", e.target.value);
                  setSlugTouched(true);
                }}
                className="neo-input text-sm"
                placeholder={slugify(form.title) || "did-jesus-really-rise"}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
              <p className="mt-1 text-[10px] text-[#64748B]">
                Live preview:{" "}
                <span className="text-[#38BDF8]">/apologetics/{effectiveSlug || "—"}</span>
              </p>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="neo-input text-sm bg-[#1C1929]"
                >
                  <option value="">— None —</option>
                  {APOLOGETICS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subcategory" hint="Optional.">
                <input
                  type="text"
                  value={form.subcategory}
                  onChange={(e) => set("subcategory", e.target.value)}
                  className="neo-input text-sm"
                  placeholder="e.g. Cosmological Argument"
                />
              </Field>
            </div>

            <Field label="Difficulty" hint="Reader level. Optional.">
              <select
                value={form.difficulty}
                onChange={(e) => set("difficulty", e.target.value)}
                className="neo-input text-sm bg-[#1C1929]"
              >
                <option value="">— None —</option>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cover Image" hint="Upload a JPG, PNG, or WEBP image (max 10 MB).">
              <ImageUploader
                value={form.coverImageUrl}
                onChange={(url) => set("coverImageUrl", url)}
              />
            </Field>

            <Field label="Excerpt" hint="Short summary shown on cards.">
              <textarea
                value={form.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
                className="neo-input text-sm h-16 resize-none"
                placeholder="One or two sentences to hook the reader."
              />
            </Field>

            <Field
              label="Short Answer"
              hint="Optional TL;DR shown at the top of the article (one paragraph)."
            >
              <textarea
                value={form.shortAnswer}
                onChange={(e) => set("shortAnswer", e.target.value)}
                className="neo-input text-sm h-20 resize-none"
                placeholder="A one-paragraph summary answer. e.g. Yes — the historical evidence strongly supports the resurrection…"
              />
            </Field>
          </Section>

          {/* ▸ ARTICLE CONTENT */}
          <Section title="Article Content">
            {/* Edit / Preview tabs */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  !previewMode
                    ? "bg-[#7C3AED]/20 text-[#A78BFA]"
                    : "text-[#94A3B8] hover:text-white"
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  previewMode
                    ? "bg-[#7C3AED]/20 text-[#A78BFA]"
                    : "text-[#94A3B8] hover:text-white"
                }`}
              >
                Preview (does not publish)
              </button>
            </div>

            {previewMode ? (
              <MarkdownPreview
                content={form.content}
                coverImageUrl={form.coverImageUrl}
                title={form.title}
                excerpt={form.excerpt}
                shortAnswer={form.shortAnswer}
                bibleRefs={form.bibleRefs}
              />
            ) : (
              <>
                {/* Formatting toolbar — sticky, horizontally scrollable on mobile */}
                <div className="sticky top-0 z-10 bg-[#1C1929] -mx-4 px-4 sm:-mx-0 sm:px-0 py-1">
                  <div className="flex gap-1 overflow-x-auto">
                    <ToolbarButton
                      title="Heading 2"
                      onClick={() => applyInsert({ mode: "block", linePrefix: "## " })}
                    >
                      <Heading2 size={14} />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Heading 3"
                      onClick={() => applyInsert({ mode: "block", linePrefix: "### " })}
                    >
                      <Heading3 size={14} />
                    </ToolbarButton>
                    <ToolbarDivider />
                    <ToolbarButton
                      title="Bold"
                      onClick={() =>
                        applyInsert({ mode: "wrap", prefix: "**", suffix: "**" })
                      }
                    >
                      <Bold size={14} />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Italic"
                      onClick={() =>
                        applyInsert({ mode: "wrap", prefix: "*", suffix: "*" })
                      }
                    >
                      <Italic size={14} />
                    </ToolbarButton>
                    <ToolbarDivider />
                    <ToolbarButton
                      title="Bullet list"
                      onClick={() => applyInsert({ mode: "block", linePrefix: "- " })}
                    >
                      <List size={14} />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Numbered list"
                      onClick={() => applyInsert({ mode: "block", linePrefix: "1. " })}
                    >
                      <ListOrdered size={14} />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Blockquote"
                      onClick={() => applyInsert({ mode: "block", linePrefix: "> " })}
                    >
                      <Quote size={14} />
                    </ToolbarButton>
                    <ToolbarDivider />
                    <ToolbarButton
                      title="Link"
                      onClick={() =>
                        applyInsert({
                          mode: "wrap",
                          prefix: "[",
                          suffix: "](https://)",
                          placeholder: "link text",
                        })
                      }
                    >
                      <LinkIcon size={14} />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Image"
                      onClick={() => setShowImagePopover(true)}
                    >
                      <ImageIcon size={14} />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Horizontal separator"
                      onClick={() =>
                        applyInsert({ mode: "snippet", text: "\n\n---\n\n" })
                      }
                    >
                      <Minus size={14} />
                    </ToolbarButton>
                    <ToolbarButton
                      title="Bible verse (blockquote)"
                      onClick={() => applyInsert({ mode: "block", linePrefix: "> " })}
                    >
                      <BookOpen size={14} />
                    </ToolbarButton>
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={form.content}
                  onChange={(e) => set("content", e.target.value)}
                  className="neo-input text-sm h-80 resize-y font-mono"
                  placeholder={"# Heading\n\nWrite your article here…"}
                />
                <p className="text-[10px] text-[#64748B]">
                  Markdown supported. Preview tab shows how it renders.
                </p>

                {/* Apologetics structure helper — optional section inserts */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Insert section:
                  </p>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {APOLGETICS_SECTION_SNIPPETS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => applyInsert({ mode: "snippet", text: s.snippet })}
                        className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[#7C3AED]/10 text-[#A78BFA] hover:bg-[#7C3AED]/20 transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* ▸ AUTHOR */}
          <Section title="Author">
            <Field label="Author Name">
              <input
                type="text"
                value={form.authorName}
                onChange={(e) => set("authorName", e.target.value)}
                className="neo-input text-sm"
                placeholder="Author name (defaults to Admin)"
              />
            </Field>
          </Section>

          {/* ▸ SEO */}
          <Section title="SEO">
            <Field label="SEO Title" hint="Defaults to title if empty.">
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
          </Section>

          {/* ▸ PUBLISHING */}
          <Section title="Publishing">
            <div className="grid grid-cols-2 gap-2">
              <Toggle
                checked={form.status === "published"}
                onChange={(v) => set("status", v ? "published" : "draft")}
                label="Published"
                hint={form.status === "published" ? "Visible on /apologetics" : "Hidden (draft)"}
                icon={form.status === "published" ? <Eye size={12} /> : <EyeOff size={12} />}
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
            <Field
              label="Bible References"
              hint="Comma-separated. e.g. John 20:1-29, 1 Cor 15"
            >
              <input
                type="text"
                value={form.bibleRefs}
                onChange={(e) => set("bibleRefs", e.target.value)}
                className="neo-input text-sm"
                placeholder="John 20:1-29, 1 Cor 15, Romans 1:20"
              />
              {form.bibleRefs.trim().length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {form.bibleRefs
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
          </Section>

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-white/[0.06]">
            {activeArticleId && (
              <div className="flex items-center gap-2 sm:mr-auto flex-wrap">
                {currentStatus === "published" && currentSlug && (
                  <a
                    href={`/apologetics/${currentSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#38BDF8] hover:bg-[#38BDF8]/10 text-[11px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={12} /> View Public
                  </a>
                )}
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-[#EF4444]" />
                    <span className="text-[11px] text-[#94A3B8]">Delete permanently?</span>
                    <button
                      onClick={remove}
                      disabled={deleting || saving}
                      className="bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] text-[11px] font-bold rounded-lg px-2 py-1 disabled:opacity-50"
                    >
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting || saving}
                      className="text-[#94A3B8] hover:text-white text-[11px] font-bold px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving || deleting}
                    className="text-[#EF4444] hover:bg-[#EF4444]/10 text-[11px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            )}
            <button
              onClick={requestClose}
              disabled={saving || deleting}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            {currentStatus === "published" && (
              <button
                onClick={() => save("draft", { wasUnpublish: true })}
                disabled={saving || deleting}
                className="px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
                Unpublish
              </button>
            )}
            <button
              onClick={() => save("draft")}
              disabled={saving || deleting}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.1] text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Draft
            </button>
            <button
              onClick={() => save("published")}
              disabled={saving || deleting}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-extrabold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all hover:-translate-y-px"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save size={14} />{" "}
                  {currentStatus === "published" ? "Update Published Article" : "Publish"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Discard-changes confirm dialog (rendered as a separate overlay) */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div
            className="bg-[#1C1929] border border-white/[0.1] rounded-2xl p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-[#F59E0B]" />
              <h3 className="text-sm font-extrabold text-white">Unsaved Changes</h3>
            </div>
            <p className="text-xs text-[#94A3B8] mb-4">
              You have unsaved changes. Continue editing?
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-bold"
              >
                Continue Editing
              </button>
              <button
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] text-sm font-bold border border-[#EF4444]/40"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline image upload popover — opened from the Image toolbar button.
          Renders as a separate overlay (z-[70], above the modal at z-50 and
          above the discard dialog at z-[60]). On insert, the markdown
          ![alt](url) is inserted at the current cursor position in the
          content textarea using applyInsert's "snippet" mode. */}
      {showImagePopover && (
        <InlineImagePopover
          onInsert={(markdown) => {
            applyInsert({ mode: "snippet", text: markdown });
            setShowImagePopover(false);
          }}
          onClose={() => setShowImagePopover(false)}
        />
      )}
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
