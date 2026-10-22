"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
  Trash2,
  Save,
  Eye,
  Copy as CopyIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Brain,
  Image as ImageIcon,
  Languages,
  Sparkles,
  AlertTriangle,
  ArrowLeft,
  Filter,
  Send,
  Unlink,
  Layers,
  Edit3,
  FileText,
  Wand2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import ImagePicker from "@/components/crosscrafted/ImagePicker";
import ComicArtworkUploader from "@/components/crosscrafted/ComicArtworkUploader";
import { BIBLE_BOOKS } from "@/lib/bible-data";

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = "draft" | "review" | "ready" | "published";

type PanelTranslation = {
  id: string;
  lang: string;
  title: string;
  narration: string;
  captions: string[];
};

type Panel = {
  id: string;
  panelId: string;
  sortOrder: number;
  artworkUrl: string;
  altText: string;
  verseStart: number;
  verseEnd: number;
  bookId: string;
  chapter: number;
  audioUrl: string | null;
  videoUrl: string | null;
  translations: PanelTranslation[];
};

type ChapterTranslation = {
  id: string;
  lang: string;
  title: string;
};

type QuizLink = {
  id: string;
  questionId: string;
  question: string;
  difficulty: string;
  category: string;
  bibleBook: string | null;
  isActive: boolean;
  sortOrder: number;
  isDangling?: boolean;
};

type Chapter = {
  id: string;
  comicId: string;
  bookId: string;
  chapter: number;
  title: string;
  description: string;
  adminNotes: string;
  status: Status;
  coverArtUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  chapterTranslations: ChapterTranslation[];
  panels: Panel[];
  quizLinks: QuizLink[];
};

type ChapterListItem = {
  id: string;
  comicId: string;
  bookId: string;
  chapter: number;
  title: string;
  description: string;
  status: Status;
  coverArtUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  panelCount: number;
  translationCount: number;
  quizCount: number;
  languages: string[];
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  totalChapters: number;
  published: number;
  drafts: number;
  review: number;
  ready: number;
  totalPanels: number;
  chaptersMissingArtwork: number;
  panelsMissingArtwork: number;
  chaptersMissingEnglishTranslation: number;
  panelsMissingEnglishTranslation: number;
  chaptersMissingEnglishTitle: number;
  chaptersMissingEnglishNarration: number;
  chaptersMissingQuiz: number;
  chaptersWithCoverArt: number;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCENT = "#F39B9B";
const ACCENT_DEEP = "#1C1929";

const STATUS_META: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "Draft", color: "#94A3B8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.25)" },
  review: { label: "Review", color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
  ready: { label: "Ready", color: "#38BDF8", bg: "rgba(56,189,248,0.10)", border: "rgba(56,189,248,0.25)" },
  published: { label: "Published", color: "#22C55E", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.25)" },
};

const LANGS = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "hi", label: "Hindi", flag: "🇮🇳" },
  { id: "bn", label: "Bengali", flag: "🇮🇳" },
  { id: "te", label: "Telugu", flag: "🇮🇳" },
  { id: "mr", label: "Marathi", flag: "🇮🇳" },
  { id: "ta", label: "Tamil", flag: "🇮🇳" },
  { id: "gu", label: "Gujarati", flag: "🇮🇳" },
  { id: "ur", label: "Urdu", flag: "🇮🇳" },
  { id: "kn", label: "Kannada", flag: "🇮🇳" },
  { id: "or", label: "Odia", flag: "🇮🇳" },
  { id: "ml", label: "Malayalam", flag: "🇮🇳" },
  { id: "pa", label: "Punjabi", flag: "🇮🇳" },
  { id: "as", label: "Assamese", flag: "🇮🇳" },
];

// ─── Main component ─────────────────────────────────────────────────────────

export default function BibleComicsAdmin() {
  const [view, setView] = useState<"list" | "editor">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);
  // Bump this to force the list/dashboard to refetch when returning from editor
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setView("editor");
  };

  const handleBack = () => {
    setView("list");
    setSelectedId(null);
    setListRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div
          className="w-1 h-5 rounded-full"
          style={{ background: ACCENT }}
        />
        <h2 className="text-sm font-bold text-white">Bible Comics CMS</h2>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
        >
          {view === "list" ? "Dashboard" : "Editor"}
        </span>
      </div>

      {view === "list" && (
        <DashboardAndList
          onSelect={handleSelect}
          refreshKey={listRefreshKey}
        />
      )}

      {view === "editor" && selectedId && (
        <ChapterEditor
          chapterId={selectedId}
          onBack={handleBack}
          onPreview={(ch) => setPreviewChapter(ch)}
        />
      )}

      <AnimatePresence>
        {previewChapter && (
          <PreviewModal chapter={previewChapter} onClose={() => setPreviewChapter(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Dashboard + Chapter List ────────────────────────────────────────────────

function DashboardAndList({
  onSelect,
  refreshKey,
}: {
  onSelect: (id: string) => void;
  refreshKey: number;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chapters, setChapters] = useState<ChapterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bookFilter, setBookFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch("/api/admin/comics/stats"),
        fetch("/api/admin/comics"),
      ]);
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
      if (listRes.ok) {
        const l = await listRes.json();
        setChapters(l.chapters || []);
      }
    } catch (e: any) {
      toast.error("Failed to load comics", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const filtered = chapters.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (bookFilter !== "all" && c.bookId !== bookFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.title.toLowerCase().includes(q) &&
        !c.comicId.toLowerCase().includes(q) &&
        !c.description.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const onCreated = (id: string) => {
    setShowCreate(false);
    onSelect(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F39B9B] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dashboard stats */}
      {stats && <StatsDashboard stats={stats} />}

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px] flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
          <Search size={12} className="text-[#94A3B8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, comicId, description..."
            className="bg-transparent flex-1 text-xs text-white placeholder:text-[#64748B] focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#64748B] hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-px"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #9786E3)` }}
        >
          <Plus size={14} /> New Chapter
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
          <Filter size={10} /> Status:
        </span>
        {["all", "draft", "review", "ready", "published"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              statusFilter === s
                ? "bg-[#F39B9B] text-slate-950"
                : "bg-white/[0.04] text-[#94A3B8] border border-white/[0.06] hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
          <BookOpen size={10} /> Book:
        </span>
        <select
          value={bookFilter}
          onChange={(e) => setBookFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white focus:outline-none focus:border-[#F39B9B]/40"
        >
          <option value="all">All books</option>
          {BIBLE_BOOKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Chapter list */}
      {filtered.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <BookOpen size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">
            {chapters.length === 0
              ? "No comic chapters yet."
              : "No chapters match your filters."}
          </p>
          <p className="text-[10px] text-[#64748B] mt-1">
            {chapters.length === 0
              ? "Click \"New Chapter\" to create the first one."
              : "Try clearing your search or status filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <ChapterCard key={c.id} chapter={c} onClick={() => onSelect(c.id)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateChapterModal onClose={() => setShowCreate(false)} onCreated={onCreated} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Stats Dashboard ────────────────────────────────────────────────────────

function StatsDashboard({ stats }: { stats: Stats }) {
  const statCards = [
    { label: "Total Chapters", value: stats.totalChapters, icon: BookOpen, color: ACCENT },
    { label: "Published", value: stats.published, icon: CheckCircle2, color: "#22C55E" },
    { label: "Drafts", value: stats.drafts, icon: Edit3, color: "#94A3B8" },
    { label: "In Review", value: stats.review, icon: Eye, color: "#F59E0B" },
    { label: "Ready", value: stats.ready, icon: Send, color: "#38BDF8" },
    { label: "Total Panels", value: stats.totalPanels, icon: Layers, color: "#9786E3" },
  ];

  const issueCards = [
    {
      label: "Missing artwork",
      chapterCount: stats.chaptersMissingArtwork,
      panelCount: stats.panelsMissingArtwork,
      icon: ImageIcon,
      color: "#EF4444",
      isIssue: stats.panelsMissingArtwork > 0,
    },
    {
      label: "Missing EN translations",
      chapterCount: stats.chaptersMissingEnglishTranslation,
      panelCount: stats.panelsMissingEnglishTranslation,
      icon: Languages,
      color: "#F59E0B",
      isIssue: stats.panelsMissingEnglishTranslation > 0,
    },
    {
      label: "Missing EN title or narration",
      chapterCount: stats.chaptersMissingEnglishTitle + stats.chaptersMissingEnglishNarration,
      icon: FileText,
      color: "#F59E0B",
      isIssue: stats.chaptersMissingEnglishTitle > 0 || stats.chaptersMissingEnglishNarration > 0,
    },
    {
      label: "Missing quiz questions",
      chapterCount: stats.chaptersMissingQuiz,
      panelCount: 0,
      icon: Brain,
      color: "#A855F7",
      isIssue: stats.chaptersMissingQuiz > 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3 text-center"
          >
            <s.icon size={14} className="mx-auto mb-1" style={{ color: s.color }} />
            <p className="text-lg font-extrabold text-white leading-none">{s.value}</p>
            <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {issueCards.map((s) => (
          <div
            key={s.label}
            className="bg-[#1C1929] border rounded-xl p-3"
            style={{
              borderColor: s.isIssue ? `${s.color}30` : "rgba(255,255,255,0.06)",
              backgroundColor: s.isIssue ? `${s.color}08` : undefined,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon size={11} style={{ color: s.color }} />
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] truncate">
                {s.label}
              </p>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-base font-extrabold text-white">{s.chapterCount}</p>
              <p className="text-[9px] text-[#64748B] uppercase tracking-wider">chapters</p>
              {(s.panelCount ?? 0) > 0 && (
                <p className="text-[9px] text-[#94A3B8] ml-auto">{s.panelCount ?? 0} panels</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Help banner */}
      <div
        className="rounded-xl p-3 border"
        style={{ backgroundColor: `${ACCENT}08`, borderColor: `${ACCENT}25` }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={11} style={{ color: ACCENT }} />
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            CMS Workflow
          </p>
        </div>
        <p className="text-[11px] text-[#A09DB1] leading-relaxed">
          Create a chapter → add panels (with artwork, verse range, English title + narration) →
          link quiz questions → optionally translate to other languages → click <b className="text-white">Publish</b>.
          Publishing requires every panel to have artwork + a complete English translation. Use the
          status flags (draft / review / ready) to track your editorial pipeline.
        </p>
      </div>
    </div>
  );
}

// ─── Chapter Card ───────────────────────────────────────────────────────────

function ChapterCard({ chapter, onClick }: { chapter: ChapterListItem; onClick: () => void }) {
  const status = STATUS_META[chapter.status];
  const book = BIBLE_BOOKS.find((b) => b.id === chapter.bookId);

  return (
    <button
      onClick={onClick}
      className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3 flex gap-3 hover:border-white/[0.12] hover:-translate-y-px transition-all text-left w-full"
    >
      {/* Cover */}
      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/[0.06] bg-[#0f0f1a] flex items-center justify-center">
        {chapter.coverArtUrl ? (
          <img src={chapter.coverArtUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={20} className="text-[#475569]" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-white line-clamp-1">{chapter.title}</h3>
          <span
            className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0"
            style={{ backgroundColor: status.bg, color: status.color, border: `1px solid ${status.border}` }}
          >
            {status.label}
          </span>
        </div>
        <p className="text-[10px] text-[#94A3B8] mb-1.5">
          {book?.name || chapter.bookId} · Chapter {chapter.chapter} ·{" "}
          <span className="text-[#64748B]">{chapter.comicId}</span>
        </p>
        {chapter.description && (
          <p className="text-[11px] text-[#A09DB1] line-clamp-2 mb-2">{chapter.description}</p>
        )}
        <div className="flex items-center gap-2 text-[9px] text-[#64748B]">
          <span className="flex items-center gap-0.5">
            <Layers size={9} /> {chapter.panelCount} panels
          </span>
          <span className="flex items-center gap-0.5">
            <Languages size={9} /> {chapter.translationCount} trans
          </span>
          <span className="flex items-center gap-0.5">
            <Brain size={9} /> {chapter.quizCount} quiz
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Create Chapter Modal ───────────────────────────────────────────────────

function CreateChapterModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [bookId, setBookId] = useState("genesis");
  const [chapter, setChapter] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const book = BIBLE_BOOKS.find((b) => b.id === bookId);
  const maxChapters = book?.chapters ?? 1;

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (chapter < 1 || chapter > maxChapters) {
      toast.error(`${book?.name} only has ${maxChapters} chapter(s)`);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, chapter, title: title.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Chapter created — "${data.chapter.title}"`);
      onCreated(data.chapter.id);
    } catch (e: any) {
      toast.error("Failed to create chapter", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-md p-5"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Plus size={14} style={{ color: ACCENT }} />
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              New Comic Chapter
            </p>
          </div>
          <button onClick={onClose}>
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Book + Chapter */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Book">
              <select
                value={bookId}
                onChange={(e) => {
                  setBookId(e.target.value);
                  const nb = BIBLE_BOOKS.find((b) => b.id === e.target.value);
                  if (nb && chapter > nb.chapters) setChapter(1);
                }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
              >
                {BIBLE_BOOKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.chapters} ch)
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Chapter (max ${maxChapters})`}>
              <input
                type="number"
                min={1}
                max={maxChapters}
                value={chapter}
                onChange={(e) => setChapter(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
              />
            </Field>
          </div>

          <Field label="Title (English)">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Seventh Day — God Rests"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40"
            />
          </Field>

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary shown on the chapter card..."
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40 resize-none"
            />
          </Field>

          <div className="bg-[#F39B9B]/8 border border-[#F39B9B]/20 rounded-xl p-2.5">
            <p className="text-[10px] text-[#A09DB1] leading-relaxed">
              Chapter will be created with status <b className="text-white">draft</b>. It will not be
              visible to end users until you click <b className="text-white">Publish</b> from the editor.
              comicId will be auto-generated as <code className="text-[#F39B9B]">{bookId}-{chapter}</code>.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8] hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={creating}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
              style={{ background: ACCENT, color: "#1C1929" }}
            >
              {creating ? "Creating..." : "Create Chapter"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Chapter Editor ─────────────────────────────────────────────────────────

function ChapterEditor({
  chapterId,
  onBack,
  onPreview,
}: {
  chapterId: string;
  onBack: () => void;
  onPreview: (ch: Chapter) => void;
}) {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [activeTranslationLang, setActiveTranslationLang] = useState("en");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/comics/${chapterId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChapter(data.chapter);
    } catch (e: any) {
      toast.error("Failed to load chapter", { description: e.message });
      onBack();
    } finally {
      setLoading(false);
    }
  }, [chapterId, onBack]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Save chapter-level fields ───────────────────────────────────
  const [draft, setDraft] = useState<Partial<Chapter>>({});
  useEffect(() => {
    if (chapter) {
      setDraft({
        title: chapter.title,
        description: chapter.description,
        adminNotes: chapter.adminNotes,
        coverArtUrl: chapter.coverArtUrl,
        sortOrder: chapter.sortOrder,
        bookId: chapter.bookId,
        chapter: chapter.chapter,
        status: chapter.status,
      });
    }
  }, [chapter]);
  const dirty = chapter ? JSON.stringify(draft) !== JSON.stringify({
    title: chapter.title,
    description: chapter.description,
    adminNotes: chapter.adminNotes,
    coverArtUrl: chapter.coverArtUrl,
    sortOrder: chapter.sortOrder,
    bookId: chapter.bookId,
    chapter: chapter.chapter,
    status: chapter.status,
  }) : false;

  const saveChapter = async () => {
    if (!chapter || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/comics/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Chapter saved");
      await load();
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/comics/${chapterId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          toast.error(`Cannot publish: ${data.errors.length} issue(s)`, {
            description: data.errors.slice(0, 4).join(" · ") + (data.errors.length > 4 ? " ..." : ""),
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }
      toast.success(data.message || "Published");
      await load();
    } catch (e: any) {
      toast.error("Publish failed", { description: e.message });
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/comics/${chapterId}/unpublish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Unpublished");
      await load();
    } catch (e: any) {
      toast.error("Unpublish failed", { description: e.message });
    } finally {
      setPublishing(false);
    }
  };

  const deleteChapter = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/comics/${chapterId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Chapter deleted");
      onBack();
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F39B9B] animate-spin" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
        <AlertCircle size={28} className="mx-auto text-[#EF4444] mb-2" />
        <p className="text-sm text-[#94A3B8]">Chapter not found.</p>
        <button
          onClick={onBack}
          className="mt-3 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white"
        >
          Back to list
        </button>
      </div>
    );
  }

  const status = STATUS_META[chapter.status];
  const validationIssues = computeValidationIssues(chapter);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8] hover:text-white"
        >
          <ArrowLeft size={12} /> Back
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white line-clamp-1">{chapter.title}</h2>
          <p className="text-[10px] text-[#64748B]">
            {chapter.comicId} · {chapter.panels.length} panels ·{" "}
            {new Date(chapter.updatedAt).toLocaleDateString()}
          </p>
        </div>

        <span
          className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: status.bg, color: status.color, border: `1px solid ${status.border}` }}
        >
          {status.label}
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={saveChapter}
          disabled={!dirty || saving}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>

        <button
          onClick={() => onPreview(chapter)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white hover:bg-white/[0.08]"
        >
          <Eye size={12} /> Preview
        </button>

        {chapter.status === "published" ? (
          <button
            onClick={unpublish}
            disabled={publishing}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-xs font-bold text-[#F59E0B] disabled:opacity-40"
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
            Unpublish
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={publishing}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
            style={{ backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Publish
          </button>
        )}

        <button
          onClick={() => setShowDuplicate(true)}
          disabled={duplicating}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white hover:bg-white/[0.08]"
        >
          {duplicating ? <Loader2 size={12} className="animate-spin" /> : <CopyIcon size={12} />}
          Duplicate
        </button>

        <button
          onClick={() => setShowDelete(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs font-bold text-[#EF4444]"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>

      {/* Validation status */}
      {validationIssues.length > 0 ? (
        <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle size={12} className="text-[#EF4444]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#EF4444]">
              {validationIssues.length} issue{validationIssues.length === 1 ? "" : "s"} blocking publish
            </p>
          </div>
          <ul className="space-y-0.5">
            {validationIssues.slice(0, 6).map((iss, idx) => (
              <li key={idx} className="text-[10px] text-[#A09DB1] flex items-start gap-1.5">
                <span className="text-[#EF4444] mt-0.5">•</span>
                <span>{iss}</span>
              </li>
            ))}
            {validationIssues.length > 6 && (
              <li className="text-[10px] text-[#64748B] italic">
                ...and {validationIssues.length - 6} more
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="bg-[#22C55E]/8 border border-[#22C55E]/20 rounded-xl p-3 flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-[#22C55E]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">
            Ready to publish — all validation checks pass
          </p>
        </div>
      )}

      {/* Chapter details form */}
      <ChapterDetailsForm
        draft={draft}
        setDraft={setDraft}
        chapter={chapter}
        activeTranslationLang={activeTranslationLang}
        onLangChange={setActiveTranslationLang}
        onChapterTitleLangChange={async (lang, title) => {
          // Save immediately (auto-save) — the admin doesn't need to click "Save" for translations
          try {
            const res = await fetch(`/api/admin/comics/${chapterId}/translations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "chapter", lang, title }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(`${lang.toUpperCase()} chapter title saved`);
            load();
          } catch (e: any) {
            toast.error("Failed to save chapter title translation", { description: e.message });
          }
        }}
      />

      {/* Panels */}
      <PanelsManager
        chapter={chapter}
        onReload={load}
        onEditPanel={(panelId) => setEditingPanelId(panelId)}
        onAddPanel={() => setShowAddPanel(true)}
      />

      {/* Quiz manager */}
      <QuizManager chapter={chapter} onReload={load} />

      {/* Translation manager (panel-level) */}
      <PanelTranslationManager chapter={chapter} onReload={load} />

      {/* Modals */}
      <AnimatePresence>
        {editingPanelId && (
          <EditPanelModal
            chapterId={chapterId}
            panelId={editingPanelId}
            panel={chapter.panels.find((p) => p.panelId === editingPanelId) || null}
            onClose={() => setEditingPanelId(null)}
            onSaved={load}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddPanel && (
          <AddPanelModal
            chapterId={chapterId}
            nextSortOrder={(chapter.panels.reduce((max, p) => Math.max(max, p.sortOrder), 0) || 0) + 1}
            bookId={chapter.bookId}
            chapterNum={chapter.chapter}
            onClose={() => setShowAddPanel(false)}
            onCreated={load}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDuplicate && (
          <DuplicateModal
            chapterId={chapterId}
            sourceBookId={chapter.bookId}
            sourceChapter={chapter.chapter}
            sourceTitle={chapter.title}
            onClose={() => setShowDuplicate(false)}
            onDone={(newId) => {
              setShowDuplicate(false);
              toast.success("Chapter duplicated — opening the new copy");
              // Switch to the new chapter
              setTimeout(() => {
                // Force a fresh mount by going back briefly then selecting
                onBack();
                setTimeout(() => {
                  // Note: this is a hack — we'd ideally just swap selectedId.
                  // For now, the admin clicks the new chapter from the list.
                }, 100);
              }, 200);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDelete && (
          <ConfirmDeleteModal
            chapter={chapter}
            onClose={() => setShowDelete(false)}
            onConfirm={deleteChapter}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Compute validation issues (mirrors server-side logic) ──────────────────

function computeValidationIssues(chapter: Chapter): string[] {
  const issues: string[] = [];

  if (!chapter.title || chapter.title.trim().length < 1) {
    issues.push("Chapter has no title");
  }

  const book = BIBLE_BOOKS.find((b) => b.id === chapter.bookId);
  if (!book) {
    issues.push(`Unknown bookId "${chapter.bookId}"`);
  } else if (chapter.chapter < 1 || chapter.chapter > book.chapters) {
    issues.push(
      `Chapter number ${chapter.chapter} is out of range for ${book.name} (max ${book.chapters})`
    );
  }

  if (chapter.panels.length === 0) {
    issues.push("Chapter has no panels (add at least 1 panel)");
  }

  for (const p of chapter.panels) {
    const label = p.panelId;
    if (!p.artworkUrl || p.artworkUrl.trim().length === 0) {
      issues.push(`${label}: missing artwork`);
    }
    if (p.verseStart < 1) {
      issues.push(`${label}: invalid verseStart (${p.verseStart})`);
    }
    if (p.verseEnd < p.verseStart) {
      issues.push(`${label}: verseEnd (${p.verseEnd}) < verseStart (${p.verseStart})`);
    }
    const en = p.translations.find((t) => t.lang === "en");
    if (!en) {
      issues.push(`${label}: missing English translation`);
    } else {
      if (!en.title || en.title.trim().length === 0) {
        issues.push(`${label}: missing English title`);
      }
      if (!en.narration || en.narration.trim().length === 0) {
        issues.push(`${label}: missing English narration`);
      }
    }
  }

  return issues;
}

// ─── Chapter Details Form ───────────────────────────────────────────────────

function ChapterDetailsForm({
  draft,
  setDraft,
  chapter,
  activeTranslationLang,
  onLangChange,
  onChapterTitleLangChange,
}: {
  draft: Partial<Chapter>;
  setDraft: (d: Partial<Chapter>) => void;
  chapter: Chapter;
  activeTranslationLang: string;
  onLangChange: (l: string) => void;
  onChapterTitleLangChange: (lang: string, title: string) => void;
}) {
  const update = (patch: Partial<Chapter>) => setDraft({ ...draft, ...patch });
  const book = BIBLE_BOOKS.find((b) => b.id === draft.bookId);
  const maxChapters = book?.chapters ?? 1;

  // Chapter-level title translation for the active language
  const chapterTitleLang =
    chapter.chapterTranslations.find((t) => t.lang === activeTranslationLang)?.title || "";

  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Edit3 size={14} style={{ color: ACCENT }} />
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
          Chapter Details
        </p>
      </div>

      <div className="space-y-3">
        {/* Book + Chapter + Status */}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Book">
            <select
              value={draft.bookId || ""}
              onChange={(e) => {
                const nb = BIBLE_BOOKS.find((b) => b.id === e.target.value);
                update({
                  bookId: e.target.value,
                  chapter: nb && (draft.chapter || 1) > nb.chapters ? 1 : draft.chapter,
                });
              }}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
            >
              {BIBLE_BOOKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Chapter (max ${maxChapters})`}>
            <input
              type="number"
              min={1}
              max={maxChapters}
              value={draft.chapter || 1}
              onChange={(e) => update({ chapter: parseInt(e.target.value, 10) || 1 })}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
            />
          </Field>
          <Field label="Status">
            <select
              value={draft.status || "draft"}
              onChange={(e) => update({ status: e.target.value as Status })}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
            >
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="ready">Ready</option>
              <option value="published">Published (manual)</option>
            </select>
          </Field>
        </div>

        {/* English title (chapter-level) */}
        <Field label="Title (English — default)">
          <input
            value={draft.title || ""}
            onChange={(e) => update({ title: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea
            value={draft.description || ""}
            onChange={(e) => update({ description: e.target.value })}
            rows={2}
            placeholder="Short summary for the chapter card"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40 resize-none"
          />
        </Field>

        {/* Cover art */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Cover Art (optional)
          </label>
          <ImagePicker
            images={draft.coverArtUrl ? [draft.coverArtUrl] : []}
            onChange={(imgs) => update({ coverArtUrl: imgs[0] || null })}
            max={1}
            label="Chapter Cover"
          />
        </div>

        {/* Admin notes */}
        <Field label="Admin Notes (internal)">
          <textarea
            value={draft.adminNotes || ""}
            onChange={(e) => update({ adminNotes: e.target.value })}
            rows={2}
            placeholder="Private notes for the editorial team (not shown to users)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40 resize-none"
          />
        </Field>

        {/* Sort order */}
        <Field label="Sort Order (lower = appears first)">
          <input
            type="number"
            value={draft.sortOrder ?? 0}
            onChange={(e) => update({ sortOrder: parseInt(e.target.value, 10) || 0 })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
          />
        </Field>

        {/* Chapter title translation (active lang) */}
        <div className="pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-2">
            <Languages size={11} className="text-[#94A3B8]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Chapter Title Translation
            </p>
          </div>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => onLangChange(l.id)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                  activeTranslationLang === l.id
                    ? "bg-[#F39B9B] text-slate-950"
                    : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                }`}
              >
                {l.flag} {l.id.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            key={activeTranslationLang}
            defaultValue={chapterTitleLang}
            placeholder={
              activeTranslationLang === "en"
                ? "Uses English title above — leave blank to inherit"
                : `Chapter title in ${LANGS.find((l) => l.id === activeTranslationLang)?.label || activeTranslationLang}`
            }
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val !== chapterTitleLang) {
                onChapterTitleLangChange(activeTranslationLang, val);
              }
            }}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Panels Manager ─────────────────────────────────────────────────────────

function PanelsManager({
  chapter,
  onReload,
  onEditPanel,
  onAddPanel,
}: {
  chapter: Chapter;
  onReload: () => void;
  onEditPanel: (panelId: string) => void;
  onAddPanel: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const deletePanel = async (panelId: string) => {
    if (!confirm(`Delete panel ${panelId}? This cannot be undone.`)) return;
    setDeleting(panelId);
    try {
      const res = await fetch(`/api/admin/comics/${chapter.id}/panels/${panelId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Panel ${panelId} deleted`);
      onReload();
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers size={14} style={{ color: ACCENT }} />
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            Panels ({chapter.panels.length})
          </p>
        </div>
        <button
          onClick={onAddPanel}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
          style={{ backgroundColor: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, color: ACCENT }}
        >
          <Plus size={11} /> Add Panel
        </button>
      </div>

      {chapter.panels.length === 0 ? (
        <div className="bg-white/[0.02] border border-dashed border-white/[0.10] rounded-xl p-6 text-center">
          <Layers size={24} className="mx-auto text-[#475569] mb-2" />
          <p className="text-xs text-[#94A3B8]">No panels yet.</p>
          <p className="text-[10px] text-[#64748B] mt-1">
            Click "Add Panel" to create the first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {chapter.panels.map((p) => {
            const en = p.translations.find((t) => t.lang === "en");
            const hasArt = !!p.artworkUrl;
            const hasEnTitle = !!(en && en.title && en.title.trim());
            const hasEnNarration = !!(en && en.narration && en.narration.trim());
            return (
              <div
                key={p.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col"
              >
                {/* Thumbnail */}
                <div className="relative w-full aspect-[16/9] bg-[#0f0f1a] flex items-center justify-center">
                  {hasArt ? (
                    <img src={p.artworkUrl} alt={p.altText || p.panelId} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={20} className="text-[#475569]" />
                  )}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold">
                    {p.panelId}
                  </div>
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold">
                    {p.bookId.slice(0, 3).toUpperCase()} {p.chapter}:{p.verseStart}-{p.verseEnd}
                  </div>
                </div>

                {/* Info */}
                <div className="p-2.5 flex-1 flex flex-col">
                  <p className="text-xs font-bold text-white line-clamp-1 mb-0.5">
                    {en?.title || <span className="text-[#EF4444] italic">No English title</span>}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] line-clamp-2 mb-2">
                    {en?.narration || <span className="text-[#EF4444] italic">No English narration</span>}
                  </p>

                  {/* Status indicators */}
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {!hasArt && <IssuePill label="No artwork" />}
                    {!hasEnTitle && <IssuePill label="No EN title" />}
                    {!hasEnNarration && <IssuePill label="No EN narration" />}
                    {hasArt && hasEnTitle && hasEnNarration && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#22C55E]/15 text-[#22C55E] text-[9px] font-bold">
                        ✓ Ready
                      </span>
                    )}
                    <span className="ml-auto text-[9px] text-[#64748B]">
                      {p.translations.length} lang{p.translations.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 mt-auto">
                    <button
                      onClick={() => onEditPanel(p.panelId)}
                      className="flex-1 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold text-white hover:bg-white/[0.08] flex items-center justify-center gap-1"
                    >
                      <Edit3 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => deletePanel(p.panelId)}
                      disabled={deleting === p.panelId}
                      className="px-2 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-bold disabled:opacity-40"
                    >
                      {deleting === p.panelId ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IssuePill({ label }: { label: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded-md bg-[#EF4444]/15 text-[#EF4444] text-[9px] font-bold">
      {label}
    </span>
  );
}

// ─── Add / Edit Panel Modal ─────────────────────────────────────────────────

function AddPanelModal({
  chapterId,
  nextSortOrder,
  bookId,
  chapterNum,
  onClose,
  onCreated,
}: {
  chapterId: string;
  nextSortOrder: number;
  bookId: string;
  chapterNum: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <PanelFormModal
      mode="add"
      chapterId={chapterId}
      panel={null}
      nextSortOrder={nextSortOrder}
      bookId={bookId}
      chapterNum={chapterNum}
      onClose={onClose}
      onSaved={onCreated}
    />
  );
}

function EditPanelModal({
  chapterId,
  panelId,
  panel,
  onClose,
  onSaved,
}: {
  chapterId: string;
  panelId: string;
  panel: Panel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <PanelFormModal
      mode="edit"
      chapterId={chapterId}
      panel={panel}
      nextSortOrder={panel?.sortOrder ?? 1}
      bookId={panel?.bookId ?? "genesis"}
      chapterNum={panel?.chapter ?? 1}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function PanelFormModal({
  mode,
  chapterId,
  panel,
  nextSortOrder,
  bookId,
  chapterNum,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  chapterId: string;
  panel: Panel | null;
  nextSortOrder: number;
  bookId: string;
  chapterNum: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [artwork, setArtwork] = useState<string>(panel?.artworkUrl || "");
  const [altText, setAltText] = useState<string>(panel?.altText || "");
  const [verseStart, setVerseStart] = useState<number>(panel?.verseStart || 1);
  const [verseEnd, setVerseEnd] = useState<number>(panel?.verseEnd || 1);
  const [audioUrl, setAudioUrl] = useState<string>(panel?.audioUrl || "");
  const [videoUrl, setVideoUrl] = useState<string>(panel?.videoUrl || "");
  const [sortOrder, setSortOrder] = useState<number>(panel?.sortOrder ?? nextSortOrder);
  const [saving, setSaving] = useState(false);

  // Compute a panel ID for the artwork uploader filename.
  // In edit mode: use the existing panelId. In add mode: generate from book/chapter/sortOrder.
  const panelIdValue = panel?.panelId || `${bookId.toUpperCase().slice(0, 3)}${chapterNum}-P${String(sortOrder).padStart(2, "0")}`;

  const submit = async () => {
    if (!artwork) {
      toast.error("Artwork is required");
      return;
    }
    if (verseStart < 1 || verseEnd < verseStart) {
      toast.error("Verse range invalid (verseStart >= 1, verseEnd >= verseStart)");
      return;
    }
    setSaving(true);
    try {
      const url =
        mode === "add"
          ? `/api/admin/comics/${chapterId}/panels`
          : `/api/admin/comics/${chapterId}/panels/${panel?.panelId}`;
      const method = mode === "add" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkUrl: artwork,
          altText,
          verseStart,
          verseEnd,
          audioUrl: audioUrl || null,
          videoUrl: videoUrl || null,
          sortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(mode === "add" ? `Panel ${data.panel.panelId} created` : "Panel updated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5"
      >
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#1C1929] -mt-5 pt-5 pb-2 z-10">
          <div className="flex items-center gap-2">
            {mode === "add" ? <Plus size={14} style={{ color: ACCENT }} /> : <Edit3 size={14} style={{ color: ACCENT }} />}
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              {mode === "add" ? "Add Panel" : `Edit Panel ${panel?.panelId}`}
            </p>
          </div>
          <button onClick={onClose}>
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Artwork — uses dedicated ComicArtworkUploader (uploads to Supabase Storage, NOT base64) */}
          <ComicArtworkUploader
            artworkUrl={artwork || null}
            onChange={(url) => setArtwork(url || "")}
            bookId={bookId}
            chapter={chapterNum}
            panelId={panelIdValue}
            chapterId={chapterId}
            label="Panel Artwork (required)"
          />

          {/* Verse range */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Verse Start">
              <input
                type="number"
                min={1}
                value={verseStart}
                onChange={(e) => setVerseStart(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
              />
            </Field>
            <Field label="Verse End">
              <input
                type="number"
                min={1}
                value={verseEnd}
                onChange={(e) => setVerseEnd(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
              />
            </Field>
          </div>

          <p className="text-[10px] text-[#64748B]">
            Will be associated with {bookId} chapter {chapterNum}.
          </p>

          {/* Sort order */}
          <Field label="Sort Order (lower = earlier in panel sequence)">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
            />
          </Field>

          {/* Alt text */}
          <Field label="Alt Text (accessibility — used by screen readers + image fallback)">
            <textarea
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              rows={2}
              placeholder="e.g. A wide illustration of the Garden of Eden with rivers flowing out from a central spring."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40 resize-none"
            />
          </Field>

          {/* Audio URL */}
          <Field label="Audio URL (optional — leave blank for TTS fallback)">
            <input
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://...mp3"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40"
            />
          </Field>

          {/* Video URL */}
          <Field label="Video URL (optional — coming soon)">
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://...mp4"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40"
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8] hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !artwork}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
              style={{ background: ACCENT, color: "#1C1929" }}
            >
              {saving ? "Saving..." : mode === "add" ? "Create Panel" : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Panel Translation Manager ──────────────────────────────────────────────

function PanelTranslationManager({
  chapter,
  onReload,
}: {
  chapter: Chapter;
  onReload: () => void;
}) {
  const [lang, setLang] = useState("en");
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);

  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Languages size={14} style={{ color: ACCENT }} />
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
          Panel Translations
        </p>
      </div>

      {/* Language picker */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              setLang(l.id);
              setEditingPanelId(null);
            }}
            className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
              lang === l.id
                ? "bg-[#F39B9B] text-slate-950"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
          >
            {l.flag} {l.id.toUpperCase()}
          </button>
        ))}
      </div>

      {chapter.panels.length === 0 ? (
        <p className="text-[11px] text-[#64748B] italic">No panels to translate yet.</p>
      ) : (
        <div className="space-y-2">
          {chapter.panels.map((p) => {
            const tr = p.translations.find((t) => t.lang === lang);
            const isExpanded = editingPanelId === p.panelId;
            return (
              <div
                key={p.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setEditingPanelId(isExpanded ? null : p.panelId)}
                  className="w-full p-2.5 flex items-center gap-2 hover:bg-white/[0.04] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 border border-white/[0.06]">
                    {p.artworkUrl ? (
                      <img src={p.artworkUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#0f0f1a]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white line-clamp-1">
                      {tr?.title || (
                        <span className="text-[#94A3B8] italic">[{p.panelId} — no {lang.toUpperCase()} title]</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#64748B] line-clamp-1">
                      {tr?.narration || `No ${lang.toUpperCase()} narration yet`}
                    </p>
                  </div>
                  <span className="text-[9px] text-[#64748B] uppercase">
                    {tr ? "Edit" : "Add"}
                  </span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <PanelTranslationForm
                        chapterId={chapter.id}
                        panel={p}
                        lang={lang}
                        existing={tr}
                        onSaved={onReload}
                        onClose={() => setEditingPanelId(null)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PanelTranslationForm({
  chapterId,
  panel,
  lang,
  existing,
  onSaved,
  onClose,
}: {
  chapterId: string;
  panel: Panel;
  lang: string;
  existing: PanelTranslation | undefined;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title || "");
  const [narration, setNarration] = useState(existing?.narration || "");
  const [captions, setCaptions] = useState<string[]>(existing?.captions || []);
  const [newCaption, setNewCaption] = useState("");
  const [saving, setSaving] = useState(false);

  const addCaption = () => {
    if (!newCaption.trim()) return;
    setCaptions([...captions, newCaption.trim()]);
    setNewCaption("");
  };

  const removeCaption = (idx: number) => {
    setCaptions(captions.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/comics/${chapterId}/translations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "panel",
          panelId: panel.panelId,
          lang,
          title,
          narration,
          captions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${lang.toUpperCase()} translation saved`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 border-t border-white/[0.06] space-y-2.5">
      <Field label="Panel Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Panel title in ${LANGS.find((l) => l.id === lang)?.label || lang}`}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40"
        />
      </Field>

      <Field label="Narration">
        <textarea
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
          rows={3}
          placeholder={`Story text / narration in ${LANGS.find((l) => l.id === lang)?.label || lang}`}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40 resize-none"
        />
      </Field>

      <Field label="Captions (speech bubbles, on-page text)">
        <div className="space-y-1.5">
          {captions.length > 0 && (
            <div className="space-y-1">
              {captions.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5"
                >
                  <span className="text-[10px] text-[#64748B]">{idx + 1}.</span>
                  <p className="flex-1 text-[11px] text-white line-clamp-1">{c}</p>
                  <button
                    onClick={() => removeCaption(idx)}
                    className="text-[#EF4444] hover:text-red-300"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <input
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addCaption();
                }
              }}
              placeholder="Add a caption..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F39B9B]/40"
            />
            <button
              onClick={addCaption}
              className="px-2 py-1.5 rounded-lg bg-[#F39B9B]/15 border border-[#F39B9B]/30 text-[#F39B9B] text-[10px] font-bold"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      </Field>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
          style={{ background: ACCENT, color: "#1C1929" }}
        >
          {saving ? "Saving..." : "Save Translation"}
        </button>
      </div>
    </div>
  );
}

// ─── Quiz Manager ───────────────────────────────────────────────────────────

function QuizManager({ chapter, onReload }: { chapter: Chapter; onReload: () => void }) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/comics/${chapter.id}/quiz?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (res.ok) {
          setSearchResults(data.searchResults || []);
        }
      } catch (e: any) {
        toast.error("Search failed", { description: e.message });
      } finally {
        setSearching(false);
      }
    },
    [chapter.id]
  );

  const onSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(val), 300);
  };

  const linkQuestion = async (questionId: string) => {
    setLinking(questionId);
    try {
      const res = await fetch(`/api/admin/comics/${chapter.id}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Linked ${questionId}`);
      onReload();
      // Re-run search so isLinked flags update
      if (search) runSearch(search);
    } catch (e: any) {
      toast.error("Link failed", { description: e.message });
    } finally {
      setLinking(null);
    }
  };

  const unlinkQuestion = async (questionId: string) => {
    if (!confirm(`Unlink ${questionId} from this chapter?`)) return;
    setUnlinking(questionId);
    try {
      const res = await fetch(`/api/admin/comics/${chapter.id}/quiz/${questionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Unlinked ${questionId}`);
      onReload();
      if (search) runSearch(search);
    } catch (e: any) {
      toast.error("Unlink failed", { description: e.message });
    } finally {
      setUnlinking(null);
    }
  };

  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain size={14} style={{ color: ACCENT }} />
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
          Quiz Questions ({chapter.quizLinks.length})
        </p>
      </div>

      {chapter.quizLinks.length === 0 ? (
        <div className="bg-white/[0.02] border border-dashed border-white/[0.10] rounded-xl p-3 mb-3">
          <p className="text-[11px] text-[#94A3B8]">
            No quiz questions linked yet. Search below to link existing Trivia questions.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 mb-3">
          {chapter.quizLinks.map((q) => (
            <div
              key={q.id}
              className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 flex items-start gap-2"
            >
              <Brain size={11} className="text-[#A855F7] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white line-clamp-2">{q.question}</p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded-md bg-[#A855F7]/15 text-[#A855F7] text-[9px] font-bold uppercase">
                    {q.difficulty}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[#94A3B8] text-[9px] font-bold uppercase">
                    {q.category}
                  </span>
                  <span className="text-[9px] text-[#64748B]">{q.questionId}</span>
                  {q.isDangling && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#EF4444]/15 text-[#EF4444] text-[9px] font-bold uppercase">
                      Dangling
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => unlinkQuestion(q.questionId)}
                disabled={unlinking === q.questionId}
                className="px-2 py-1 rounded-md bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-bold disabled:opacity-40"
                title="Unlink question"
              >
                {unlinking === q.questionId ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search to add */}
      <div className="border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 mb-2">
          <Search size={11} className="text-[#94A3B8]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Trivia questions to link..."
            className="bg-transparent flex-1 text-xs text-white placeholder:text-[#64748B] focus:outline-none"
          />
          {searching && <Loader2 size={11} className="animate-spin text-[#94A3B8]" />}
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {searchResults.map((r: any) => (
              <div
                key={r.questionId}
                className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2 flex items-start gap-2"
              >
                <Brain size={10} className="text-[#94A3B8] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white line-clamp-2">{r.question}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded-md bg-[#A855F7]/15 text-[#A855F7] text-[9px] font-bold uppercase">
                      {r.difficulty}
                    </span>
                    <span className="text-[9px] text-[#64748B]">{r.questionId}</span>
                  </div>
                </div>
                {r.isLinked ? (
                  <span className="px-2 py-1 rounded-md bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold">
                    <CheckCircle size={11} />
                  </span>
                ) : (
                  <button
                    onClick={() => linkQuestion(r.questionId)}
                    disabled={linking === r.questionId}
                    className="px-2 py-1 rounded-md bg-[#F39B9B]/15 border border-[#F39B9B]/30 text-[#F39B9B] text-[10px] font-bold disabled:opacity-40"
                  >
                    {linking === r.questionId ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Duplicate Modal ────────────────────────────────────────────────────────

function DuplicateModal({
  chapterId,
  sourceBookId,
  sourceChapter,
  sourceTitle,
  onClose,
  onDone,
}: {
  chapterId: string;
  sourceBookId: string;
  sourceChapter: number;
  sourceTitle: string;
  onClose: () => void;
  onDone: (newId: string) => void;
}) {
  const [bookId, setBookId] = useState(sourceBookId);
  const [chapter, setChapter] = useState(sourceChapter + 1);
  const [title, setTitle] = useState(`${sourceTitle} (Copy)`);
  const [submitting, setSubmitting] = useState(false);

  const book = BIBLE_BOOKS.find((b) => b.id === bookId);
  const maxChapters = book?.chapters ?? 1;

  const submit = async () => {
    if (chapter < 1 || chapter > maxChapters) {
      toast.error(`${book?.name} only has ${maxChapters} chapter(s)`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/comics/${chapterId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, chapter, title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Duplicated");
      onDone(data.chapter.id);
      onClose();
    } catch (e: any) {
      toast.error("Duplicate failed", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-md p-5"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <CopyIcon size={14} style={{ color: ACCENT }} />
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              Duplicate Chapter
            </p>
          </div>
          <button onClick={onClose}>
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="bg-[#F39B9B]/8 border border-[#F39B9B]/20 rounded-xl p-2.5">
            <p className="text-[10px] text-[#A09DB1] leading-relaxed">
              Clones the chapter metadata, all panels (with new panelIds), all panel translations,
              chapter translations, and quiz links. The new chapter starts as <b className="text-white">draft</b>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Book">
              <select
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
              >
                {BIBLE_BOOKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Chapter (max ${maxChapters})`}>
              <input
                type="number"
                min={1}
                max={maxChapters}
                value={chapter}
                onChange={(e) => setChapter(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
              />
            </Field>
          </div>

          <Field label="New Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#F39B9B]/40"
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8]"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
              style={{ background: ACCENT, color: "#1C1929" }}
            >
              {submitting ? "Duplicating..." : "Duplicate"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────

function ConfirmDeleteModal({
  chapter,
  onClose,
  onConfirm,
  deleting,
}: {
  chapter: Chapter;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-[#1C1929] border border-[#EF4444]/30 rounded-t-[28px] md:rounded-[24px] w-full max-w-md p-5"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#EF4444]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#EF4444]">
              Delete Chapter
            </p>
          </div>
          <button onClick={onClose}>
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        <p className="text-sm text-white mb-2">
          Permanently delete <b>{chapter.title}</b>?
        </p>
        <p className="text-[11px] text-[#A09DB1] leading-relaxed mb-4">
          This will also delete all {chapter.panels.length} panel(s), their translations, and quiz
          links. Linked Trivia questions themselves are NOT deleted — only the link is removed.
          This action cannot be undone.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-[#EF4444] text-white text-xs font-bold disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Permanently"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Preview Modal ─────────────────────────────────────────────────────────

function PreviewModal({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) {
  const [currentPanel, setCurrentPanel] = useState(0);
  const total = chapter.panels.length;

  if (total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[80] p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="bg-[#1C1929] border border-white/[0.08] rounded-2xl p-6 max-w-md text-center"
        >
          <BookOpen size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">No panels to preview.</p>
          <button
            onClick={onClose}
            className="mt-3 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    );
  }

  const panel = chapter.panels[currentPanel];
  const en = panel.translations.find((t) => t.lang === "en");
  const title = en?.title || chapter.title;
  const narration = en?.narration || "";
  const captions = en?.captions || [];
  const progress = ((currentPanel + 1) / total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-end md:items-center justify-center z-[80] p-0 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye size={14} style={{ color: ACCENT }} />
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              Preview · {chapter.title}
            </p>
          </div>
          <button onClick={onClose}>
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#64748B] font-bold">
              Panel {currentPanel + 1} of {total}
            </span>
            <span className="text-[10px] text-[#64748B]">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              className="h-full"
              style={{ background: `linear-gradient(to right, ${ACCENT}, #9786E3)` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Panel */}
        <motion.div
          key={panel.panelId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden mb-3"
        >
          <div className="relative w-full aspect-[16/9] bg-[#0f0f1a]">
            <img
              src={panel.artworkUrl}
              alt={panel.altText || title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
              {chapter.bookId.charAt(0).toUpperCase() + chapter.bookId.slice(1)} {chapter.chapter}:
              {panel.verseStart}-{panel.verseEnd}
            </div>
          </div>

          <div className="p-4">
            {title && <h3 className="text-sm font-bold text-white mb-2">{title}</h3>}
            {narration && (
              <p className="text-[13px] text-[#A09DB1] leading-relaxed">{narration}</p>
            )}
            {captions.length > 0 && (
              <div className="mt-3 space-y-1">
                {captions.map((c, idx) => (
                  <p key={idx} className="text-[11px] text-[#94A3B8] italic">{c}</p>
                ))}
              </div>
            )}
            {!narration && !title && (
              <p className="text-[11px] text-[#EF4444] italic">
                This panel has no English title or narration — it cannot be published as-is.
              </p>
            )}
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPanel((p) => Math.max(0, p - 1))}
            disabled={currentPanel === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={12} /> Previous
          </button>
          <div className="flex gap-1.5">
            {chapter.panels.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPanel(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentPanel ? "bg-[#F39B9B] w-6" : "bg-white/20"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentPanel((p) => Math.min(total - 1, p + 1))}
            disabled={currentPanel === total - 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
