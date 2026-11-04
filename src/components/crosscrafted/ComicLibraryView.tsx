"use client";

// ─── BIBLE COMICS LIBRARY ───────────────────────────────────────────────────
// The Comics library surface: heading + subtitle, search, Old/New Testament
// filters, book selection grouped by testament, chapter cards with cover
// artwork / full chapter title / Bible reference / reading status, a
// Continue Reading action where progress exists, and useful empty states.
//
// Data comes exclusively from the existing published comic records via
// GET /api/comic/list (ComicChapter + ComicPanel _count) — nothing is
// hardcoded. Reading status comes from the client-side comic progress
// store (cc_comic_progress in @/lib/bible-data), written by the reader
// (ComicView) as panels are actually seen.
//
// Used in two places (single source of truth):
//   • BibleView → COMICS mode (bible hub tab)
//   • page.tsx  → sidebar "Bible Comics" view (library-first, reader on tap)

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  X,
  Sparkles,
  BookOpen,
  ArrowRight,
  Clock3,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Loader2,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import {
  BIBLE_BOOKS,
  getBook,
  getAllComicProgress,
  type ComicProgress,
} from "@/lib/bible-data";
import {
  fetchServerComicBookmarks,
  fetchServerComicProgress,
  pushComicBookmarks,
} from "@/lib/comic-sync";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/use-user";

type ComicChapterSummary = {
  id: string;
  comicId: string;
  bookId: string;
  chapter: number;
  title: string;
  description: string | null;
  coverArtUrl: string | null;
  sortOrder: number;
  kidsFriendly: boolean;
  kidsAgeGroup: string | null;
  pageMode: string;
  panelCount: number;
};

type TestamentFilter = "all" | "OT" | "NT" | "kids";

// sessionStorage key for the library's filter state (survives reader round-trips)
const FILTERS_KEY = "cc_comic_library_filters";

// Rough listening/reading pace: ~30s per illustrated panel, min 1 minute.
const estimateReadMinutes = (panelCount: number) =>
  Math.max(1, Math.round(panelCount * 0.5));

export default function ComicLibraryView({
  onOpenComic,
}: {
  onOpenComic: (bookId: string, chapter: number) => void;
}) {
  const t = useTranslation();
  const { isAuthenticated } = useSupabaseUser();
  const [chapters, setChapters] = useState<ComicChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters — persisted in sessionStorage so returning from the reader via
  // "← Comics Library" (or the browser back button) restores the book,
  // testament and search state the member was browsing (Task 121, Part 1).
  const [testament, setTestament] = useState<TestamentFilter>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const saved = JSON.parse(sessionStorage.getItem(FILTERS_KEY) || "{}");
      return saved.testament === "OT" || saved.testament === "NT" ? saved.testament : "all";
    } catch {
      return "all";
    }
  });
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = JSON.parse(sessionStorage.getItem(FILTERS_KEY) || "{}");
      return typeof saved.selectedBookId === "string" ? saved.selectedBookId : null;
    } catch {
      return null;
    }
  });
  const [query, setQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = JSON.parse(sessionStorage.getItem(FILTERS_KEY) || "{}");
      return typeof saved.query === "string" ? saved.query : "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ testament, selectedBookId, query })
      );
    } catch {
      /* storage unavailable — filters simply won't persist */
    }
  }, [testament, selectedBookId, query]);

  // Reading progress (cc_comic_progress) — refreshed on mount + window focus
  const [progress, setProgress] = useState<Record<string, ComicProgress>>({});
  useEffect(() => {
    const refresh = () => setProgress(getAllComicProgress());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // ── Server reading sync (signed-in members; spec Part 2 §4) ──
  // Server-side progress is what makes completion status + Continue Reading
  // follow the member across devices. Merged with the "highest progress
  // wins" policy — progress never regresses. Guests keep pure local state.
  const [serverProgress, setServerProgress] = useState<Record<string, ComicProgress> | null>(null);
  useEffect(() => {
    if (!isAuthenticated) {
      setServerProgress(null);
      return;
    }
    let cancelled = false;
    const load = () =>
      fetchServerComicProgress().then((p) => {
        if (!cancelled) setServerProgress(p);
      });
    load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, [isAuthenticated]);

  const mergedProgress = useMemo(() => {
    if (!serverProgress) return progress;
    const merged = { ...progress };
    for (const [key, sp] of Object.entries(serverProgress)) {
      const lp = merged[key];
      if (!lp) {
        merged[key] = sp;
      } else if (sp.lastPanel > lp.lastPanel) {
        merged[key] = {
          ...lp,
          lastPanel: sp.lastPanel,
          totalPanels: sp.totalPanels || lp.totalPanels,
          completed: sp.completed || lp.completed,
          updatedAt: Math.max(lp.updatedAt, sp.updatedAt),
        };
      } else if (sp.completed && !lp.completed) {
        merged[key] = { ...lp, completed: true, updatedAt: Math.max(lp.updatedAt, sp.updatedAt) };
      }
    }
    return merged;
  }, [progress, serverProgress]);

  // ── Story bookmarks (server-side; spec Part 2 §4 "Bookmark stories") ──
  // Keyed "${bookId}-${chapter}" → bookmarked page numbers (may be empty for
  // a story-level bookmark). A key existing means the story is bookmarked.
  const [bookmarks, setBookmarks] = useState<Record<string, number[]>>({});
  useEffect(() => {
    if (!isAuthenticated) {
      setBookmarks({});
      return;
    }
    let cancelled = false;
    fetchServerComicBookmarks().then((b) => {
      if (!cancelled && b) setBookmarks(b);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const toggleStoryBookmark = (ch: ComicChapterSummary) => {
    if (!isAuthenticated) {
      toast.error(t("comics2.bookmarkSignIn"));
      return;
    }
    const key = `${ch.bookId}-${ch.chapter}`;
    const isOn = Object.prototype.hasOwnProperty.call(bookmarks, key);
    setBookmarks((prev) => {
      const next = { ...prev };
      if (isOn) delete next[key];
      else next[key] = [];
      return next;
    });
    // ON → story-level row (empty page list still creates it); OFF → removes it.
    pushComicBookmarks(ch.bookId, ch.chapter, [], { storyLevel: !isOn });
  };

  // Load published chapters from the existing public API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/comic/list");
        const text = await res.text();
        if (!text) throw new Error(t("comics.error.emptyResponse"));
        const data = JSON.parse(text);
        if (!res.ok) throw new Error(data.error || "Failed to load comics");
        const list: ComicChapterSummary[] = (data.chapters || []).slice();
        // Order: admin sortOrder first, then canonical Bible book order, then chapter.
        const bookIndex = (bid: string) => {
          const idx = BIBLE_BOOKS.findIndex((b) => b.id === bid);
          return idx === -1 ? 999 : idx;
        };
        list.sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          const bi = bookIndex(a.bookId) - bookIndex(b.bookId);
          if (bi !== 0) return bi;
          return a.chapter - b.chapter;
        });
        if (!cancelled) setChapters(list);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load comics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Derived data ────────────────────────────────────────────────────────

  // Chapters per book (only books with published comics get counts)
  const countByBook = useMemo(() => {
    const map = new Map<string, number>();
    chapters.forEach((ch) => map.set(ch.bookId, (map.get(ch.bookId) || 0) + 1));
    return map;
  }, [chapters]);

  const otCount = useMemo(
    () =>
      chapters.filter((ch) => getBook(ch.bookId)?.testament === "OT").length,
    [chapters]
  );
  const ntCount = useMemo(
    () =>
      chapters.filter((ch) => getBook(ch.bookId)?.testament === "NT").length,
    [chapters]
  );
  const kidsCount = useMemo(
    () => chapters.filter((ch) => ch.kidsFriendly).length,
    [chapters]
  );

  // Most recent in-progress chapter (for the Continue Reading strip)
  const continueEntry = useMemo(() => {
    let best: { chapter: ComicChapterSummary; prog: ComicProgress } | null = null;
    for (const ch of chapters) {
      const prog = mergedProgress[`${ch.bookId}-${ch.chapter}`];
      if (!prog || prog.completed) continue;
      if (!best || prog.updatedAt > best.prog.updatedAt) {
        best = { chapter: ch, prog };
      }
    }
    return best;
  }, [chapters, mergedProgress]);

  // Filtered chapter list: testament × kids × book × search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chapters.filter((ch) => {
      const book = getBook(ch.bookId);
      if (testament === "kids") {
        if (!ch.kidsFriendly) return false;
      } else if (testament !== "all" && book?.testament !== testament) {
        return false;
      }
      if (selectedBookId && ch.bookId !== selectedBookId) return false;
      if (q) {
        const haystack = [
          book?.name || "",
          ch.bookId,
          book?.abbr || "",
          String(ch.chapter),
          `${book?.name || ""} ${ch.chapter}`,
          ch.title,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [chapters, testament, selectedBookId, query]);

  const selectedBook = selectedBookId ? getBook(selectedBookId) : null;
  const hasAnyComic = chapters.length > 0;
  const bookHasComics = selectedBookId ? (countByBook.get(selectedBookId) || 0) > 0 : true;
  const filtersActive = testament !== "all" || !!selectedBookId || query.trim().length > 0;

  // Featured story for the hero — first story with cover artwork, else first.
  const featured = useMemo(
    () => chapters.find((ch) => ch.coverArtUrl) || chapters[0] || null,
    [chapters]
  );

  const statusFor = (ch: ComicChapterSummary): "new" | "progress" | "done" => {
    const prog = mergedProgress[`${ch.bookId}-${ch.chapter}`];
    if (!prog) return "new";
    return prog.completed ? "done" : "progress";
  };

  // ─── Loading / error / global-empty states ───────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="text-[#F39B9B] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle size={28} className="mx-auto text-[#EF4444] mb-3" />
        <p className="text-sm text-[#94A3B8]">{error}</p>
      </div>
    );
  }

  if (!hasAnyComic) {
    return (
      <div className="text-center py-16">
        <Sparkles size={28} className="mx-auto text-[#475569] mb-3" />
        <p className="text-sm font-bold text-white">{t("comics.empty.title")}</p>
        <p className="text-xs text-[#64748B] mt-1">
          {t("comics.empty.desc")}
        </p>
      </div>
    );
  }

  // ─── Library ─────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0">
      {/* ─── HERO — Koino Comic Bible ─── */}
      <ComicHero
        featured={featured}
        onOpen={(bookId, chapter) => onOpenComic(bookId, chapter)}
      />

      {/* ─── Continue Reading strip ─── */}
      {continueEntry && (
        <ContinueReadingStrip
          chapter={continueEntry.chapter}
          prog={continueEntry.prog}
          onContinue={() =>
            onOpenComic(continueEntry.chapter.bookId, continueEntry.chapter.chapter)
          }
        />
      )}

      {/* ─── Search ─── */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("comics.searchPlaceholder")}
          aria-label={t("comics.searchAria")}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#7C3AED]/50 focus:bg-white/[0.06] transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label={t("comics.clearSearchAria")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ─── Story tabs (All / OT / NT / For Kids) ─── */}
      <div className="flex p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl mb-3">
        {(
          [
            { id: "all", label: t("comics2.allStories"), count: chapters.length },
            { id: "OT", label: t("bible.ot"), count: otCount },
            { id: "NT", label: t("bible.nt"), count: ntCount },
            { id: "kids", label: t("comics2.forKids"), count: kidsCount },
          ] as { id: TestamentFilter; label: string; count: number }[]
        ).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setTestament(opt.id)}
            className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${
              testament === opt.id
                ? "bg-gradient-to-r from-[#7C3AED] to-[#F39B9B] text-white shadow-lg shadow-[#7C3AED]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {opt.label}
            <span
              className={`ml-1 text-[9px] font-black ${
                testament === opt.id ? "text-white/80" : "text-[#64748B]"
              }`}
            >
              {opt.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Book selection grouped by testament ─── */}
      <BookPicker
        testament={testament}
        selectedBookId={selectedBookId}
        countByBook={countByBook}
        onSelect={(bid) => setSelectedBookId(bid)}
      />

      {/* ─── Chapter grid / empty states ─── */}
      {filtered.length === 0 ? (
        !bookHasComics && !query.trim() ? (
          // Selected book has no published chapters (or testament filter emptied it)
          <div className="text-center py-14 px-4">
            <span className="inline-flex w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] items-center justify-center mb-3">
              <BookOpen size={20} className="text-[#475569]" />
            </span>
            <p className="text-sm font-bold text-white">
              {selectedBook ? t("comics.bookComingSoon", { book: selectedBook.name }) : t("comics.noChapters")}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-xs mx-auto leading-relaxed">
              {t("comics.noChaptersDesc")}
            </p>
            <button
              onClick={() => {
                setSelectedBookId(null);
                setTestament("all");
                setQuery("");
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-xs font-bold hover:bg-[#7C3AED]/25 transition-all"
            >
              {t("comics.browseAll")}
            </button>
          </div>
        ) : (
          // Search (or filter combination) matched nothing
          <div className="text-center py-14 px-4">
            <Search size={22} className="mx-auto text-[#475569] mb-3" />
            <p className="text-sm font-bold text-white">
              {t("comics.noResults", { q: query.trim() })}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              {t("comics.noResultsDesc")}
            </p>
            <button
              onClick={() => {
                setQuery("");
                setSelectedBookId(null);
                setTestament("all");
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] text-xs font-bold hover:text-white transition-all"
            >
              {t("comics.clearFilters")}
            </button>
          </div>
        )
      ) : (
        <>
          {filtersActive && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-2">
              {t("comics.chapterCount", { n: filtered.length })}
              {selectedBook ? ` · ${selectedBook.name}` : ""}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((ch, idx) => {
              const book = getBook(ch.bookId);
              const status = statusFor(ch);
              const prog = mergedProgress[`${ch.bookId}-${ch.chapter}`];
              return (
                <ComicChapterCard
                  key={ch.id}
                  chapter={ch}
                  bookName={book?.name || ch.bookId}
                  index={idx}
                  status={status}
                  prog={prog || null}
                  bookmarked={Object.prototype.hasOwnProperty.call(bookmarks, `${ch.bookId}-${ch.chapter}`)}
                  onToggleBookmark={() => toggleStoryBookmark(ch)}
                  onOpen={() => onOpenComic(ch.bookId, ch.chapter)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Comic Hero — Koino Comic Bible ───────────────────────────────────────────
// Cinematic dashboard hero: gold comic-book typography on deep navy, with the
// featured story's cover artwork as the backdrop when one exists.

function ComicHero({
  featured,
  onOpen,
}: {
  featured: ComicChapterSummary | null;
  onOpen: (bookId: string, chapter: number) => void;
}) {
  const t = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#14121F] mb-5">
      {/* Featured artwork backdrop */}
      {featured?.coverArtUrl ? (
         
        <img
          src={featured.coverArtUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          loading="eager"
          decoding="async"
        />
      ) : null}
      {/* Legibility gradients (always on, even over artwork) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B0A12]/95 via-[#0B0A12]/80 to-[#0B0A12]/40" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0B0A12] to-transparent" />

      <div className="relative p-5 sm:p-7">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#F39B9B] mb-1.5">
          {t("comics.eyebrow")}
        </p>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-[#FDE68A] via-[#F59E0B] to-[#FBBF24] bg-clip-text text-transparent drop-shadow-sm">
          {t("comics2.heroTitle")}
        </h1>
        <p className="text-sm sm:text-base font-extrabold text-white mt-1">{t("comics2.heroSubtitle")}</p>
        <p className="text-[11px] sm:text-xs text-[#A09DB1] mt-1 max-w-md leading-relaxed">
          {t("comics2.heroDesc")}
        </p>

        {featured && (
          <button
            onClick={() => onOpen(featured.bookId, featured.chapter)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#F39B9B] text-white text-xs font-black shadow-lg shadow-[#7C3AED]/30 hover:opacity-90 active:scale-[0.98] transition-all min-h-[40px]"
          >
            <PlayCircle size={15} />
            {t("comics2.heroCta")}
            <span className="hidden sm:inline font-bold text-white/85">· {featured.title}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Continue Reading strip ──────────────────────────────────────────────────

function ContinueReadingStrip({
  chapter,
  prog,
  onContinue,
}: {
  chapter: ComicChapterSummary;
  prog: ComicProgress;
  onContinue: () => void;
}) {
  const t = useTranslation();
  const book = getBook(chapter.bookId);
  const bookName = book?.name || chapter.bookId;
  const total = prog.totalPanels || chapter.panelCount || 0;
  const nextPanel = Math.min(prog.lastPanel + 1, Math.max(total, 1));
  const pct = total > 0 ? Math.min(100, Math.round((prog.lastPanel / total) * 100)) : 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onContinue}
      className="w-full group text-left mb-4 rounded-2xl p-[1px] bg-gradient-to-r from-[#7C3AED]/60 via-[#F39B9B]/50 to-[#7C3AED]/60 hover:from-[#7C3AED] hover:to-[#F39B9B] transition-all"
      aria-label={t("comics.continueAria", { title: chapter.title, n: nextPanel, total })}
    >
      <div className="rounded-2xl bg-[#1C1929] p-3 flex items-center gap-3">
        {/* Cover thumbnail */}
        <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[#0f0f1a] border border-white/[0.06]">
          {chapter.coverArtUrl ? (
             
            <img
              src={chapter.coverArtUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={16} className="text-[#475569]" />
            </div>
          )}
        </div>

        {/* Text + progress */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F39B9B]">
            {t("comics.continueReading")}
          </p>
          <p className="text-xs font-extrabold text-white truncate mt-0.5">{chapter.title}</p>
          <p className="text-[10px] text-[#94A3B8] font-bold">
            {t("comics.panelProgress", { book: bookName, ch: chapter.chapter, n: nextPanel, total: total || "?", pct })}
          </p>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-white/[0.06] mt-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#F39B9B]"
              style={{ width: `${Math.max(6, pct)}%` }}
            />
          </div>
        </div>

        <PlayCircle
          size={22}
          className="shrink-0 text-[#F39B9B] group-hover:scale-110 transition-transform"
        />
      </div>
    </motion.button>
  );
}

// ─── Book picker (grouped by testament, horizontal scroll) ──────────────────

function BookPicker({
  testament,
  selectedBookId,
  countByBook,
  onSelect,
}: {
  testament: TestamentFilter;
  selectedBookId: string | null;
  countByBook: Map<string, number>;
  onSelect: (bookId: string | null) => void;
}) {
  const t = useTranslation();
  const groups: { label: string; books: typeof BIBLE_BOOKS }[] = [];
  if (testament !== "NT") groups.push({ label: t("bible.ot"), books: BIBLE_BOOKS.filter((b) => b.testament === "OT") });
  if (testament !== "OT") groups.push({ label: t("bible.nt"), books: BIBLE_BOOKS.filter((b) => b.testament === "NT") });

  return (
    <div className="mb-4 space-y-2.5">
      {/* All books shortcut */}
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
          selectedBookId === null
            ? "bg-[#7C3AED] border-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/25"
            : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white hover:border-white/[0.2]"
        }`}
      >
        {t("comics.allBooks")}
      </button>

      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-1.5">
            {group.label}
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:thin]">
            {group.books.map((book) => {
              const count = countByBook.get(book.id) || 0;
              const selected = selectedBookId === book.id;
              return (
                <button
                  key={book.id}
                  onClick={() => onSelect(book.id)}
                  title={
                    count > 0
                      ? t("comics.bookChaptersTitle", { name: book.name, n: count })
                      : t("comics.bookComingSoonTitle", { name: book.name })
                  }
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
                    selected
                      ? "bg-[#7C3AED] border-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/25"
                      : count > 0
                        ? "bg-white/[0.04] border-white/[0.08] text-white hover:border-[#F39B9B]/50"
                        : "bg-white/[0.02] border-white/[0.04] text-[#64748B] hover:text-[#94A3B8]"
                  }`}
                >
                  {book.name}
                  {count > 0 && (
                    <span
                      className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                        selected ? "bg-white/25 text-white" : "bg-[#F39B9B]/20 text-[#F39B9B]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Chapter card ────────────────────────────────────────────────────────────

function ComicChapterCard({
  chapter,
  bookName,
  index,
  status,
  prog,
  bookmarked,
  onToggleBookmark,
  onOpen,
}: {
  chapter: ComicChapterSummary;
  bookName: string;
  index: number;
  status: "new" | "progress" | "done";
  prog: ComicProgress | null;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onOpen: () => void;
}) {
  const t = useTranslation();
  const total = chapter.panelCount;
  const pct = prog && total > 0 ? Math.min(100, Math.round((prog.lastPanel / total) * 100)) : 0;

  return (
    // div (not button): the card hosts a nested bookmark control — buttons
    // cannot nest. Keyboard + click behavior is preserved explicitly.
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer bg-[#1C1929] border border-white/[0.06] hover:border-white/[0.15] hover:-translate-y-px rounded-2xl overflow-hidden transition-all text-left flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/60"
      aria-label={t("comics.cardAria", { title: chapter.title, book: bookName, ch: chapter.chapter })}
    >
      {/* Cover */}
      <div className="relative w-full aspect-[16/9] bg-[#0f0f1a] overflow-hidden">
        {chapter.coverArtUrl ? (
           
          <img
            src={chapter.coverArtUrl}
            alt={t("comics.coverAlt", { title: chapter.title, book: bookName, ch: chapter.chapter })}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={28} className="text-[#475569]" />
          </div>
        )}

        {/* Top gradient for legibility */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        {/* Bottom gradient for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Reading status badge (top-left) */}
        <div className="absolute top-2 left-2">
          {status === "done" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E] text-slate-950 text-[9px] font-black">
              <CheckCircle2 size={10} /> {t("comics.completed")}
            </span>
          ) : status === "progress" ? (
            <span className="px-2 py-0.5 rounded-full bg-[#F39B9B] text-slate-950 text-[9px] font-black">
              {t("comics.pctRead", { pct })}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-[#7C3AED] text-white text-[9px] font-black">
              {t("comics.new")}
            </span>
          )}
        </div>

        {/* Top-right: kids badge + age band + story bookmark */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {chapter.kidsFriendly && (
            <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/90 text-slate-950 text-[9px] font-black uppercase">
              {t("comics.kidsBadge")}
            </span>
          )}
          {chapter.kidsFriendly && chapter.kidsAgeGroup && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] text-[9px] font-black">
              {t("comics2.agesChip", { ages: chapter.kidsAgeGroup })}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation(); // don't open the story — just toggle the bookmark
              onToggleBookmark();
            }}
            aria-label={bookmarked ? t("comics2.bookmarkRemoveAria") : t("comics2.bookmarkAddAria")}
            aria-pressed={bookmarked}
            title={bookmarked ? t("comics2.bookmarkRemoveAria") : t("comics2.bookmarkAddAria")}
            className={`p-1.5 rounded-full border backdrop-blur-sm transition-all ${
              bookmarked
                ? "bg-[#F59E0B] border-[#F59E0B] text-slate-950"
                : "bg-black/60 border-white/20 text-white/80 hover:text-white hover:border-white/50"
            }`}
          >
            <Bookmark size={11} fill={bookmarked ? "currentColor" : "none"} />
          </button>
        </div>

        {/* In-progress thin bar along the cover bottom */}
        {status === "progress" && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40">
            <div
              className="h-full bg-gradient-to-r from-[#7C3AED] to-[#F39B9B]"
              style={{ width: `${Math.max(6, pct)}%` }}
            />
          </div>
        )}

        {/* Reference (bottom-right) */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white/90 text-[9px] font-bold">
          {bookName} {chapter.chapter}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-xs font-extrabold text-white leading-snug line-clamp-2">
          {chapter.title}
        </p>
        {chapter.description && (
          <p className="text-[10px] text-[#94A3B8] leading-relaxed line-clamp-2 mt-1">
            {chapter.description}
          </p>
        )}
        <p className="text-[9px] text-[#64748B] font-bold mt-1.5 flex items-center gap-1">
          <Clock3 size={9} />
          {total > 0 ? (
            <>
              {t("comics.panelMeta", { panels: total, mins: estimateReadMinutes(total) })}
            </>
          ) : (
            <>{t("comics.illustratedStory")}</>
          )}
        </p>
      </div>

      {/* CTA bar — Continue Reading only where progress exists */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04]">
        {status === "progress" ? (
          <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-[#A78BFA] to-[#F39B9B] bg-clip-text text-transparent">
            {t("comics.continueReading")}
          </span>
        ) : status === "done" ? (
          <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
            {t("comics.readAgain")}
          </span>
        ) : (
          <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
            {t("comics.startReading")}
          </span>
        )}
        <ArrowRight
          size={14}
          className="text-[#94A3B8] group-hover:text-white group-hover:translate-x-0.5 transition-all"
        />
      </div>
    </motion.div>
  );
}
