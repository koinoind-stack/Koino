"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  Bookmark,
  BookmarkCheck,
  Loader2,
  AlertCircle,
  X,
  Copy,
  Share2,
  Globe,
  ChevronDown,
  Sparkles,
  Calendar,
  List,
} from "lucide-react";
import { toast } from "sonner";
import {
  BIBLE_BOOKS,
  OT_BOOKS,
  NT_BOOKS,
  TRANSLATIONS,
  getBook,
  fetchChapter,
  isReferenceQuery,
  toggleBookmark,
  isBookmarked,
  getBookmarks,
  type BibleBook,
  type Translation,
  type Bookmark as BookmarkType,
} from "@/lib/bible-data";
import { useTranslation, useLanguage, LANGUAGES } from "@/lib/i18n/LanguageContext";
import StreakBadge from "@/components/crosscrafted/StreakBadge";
import BiblePlansView from "@/components/crosscrafted/BiblePlansView";
import { BookOpen as BookOpenIcon, ArrowRight, Loader2 as ComicLoader, AlertCircle as ComicAlert } from "lucide-react";

type View = "books" | "chapters" | "reader" | "search" | "bookmarks";
type BibleMode = "read" | "comics" | "plans";

type ComicChapterSummary = {
  id: string;
  comicId: string;
  bookId: string;
  chapter: number;
  title: string;
  coverArtUrl: string | null;
  sortOrder: number;
};

export default function BibleView({ onOpenComic }: { onOpenComic?: (bookId: string, chapter: number) => void }) {
  const t = useTranslation();
  const { lang, setLang } = useLanguage();
  const [view, setView] = useState<View>("books");
  const [mode, setMode] = useState<BibleMode>("read");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [translation, setTranslation] = useState<Translation>("kjv");
  const [chapterText, setChapterText] = useState<string>("");
  const [chapterVerses, setChapterVerses] = useState<{ verse: number; text: string }[]>([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [bookmarkedVerses, setBookmarkedVerses] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Whether Bible text is available in the selected language.
  // bible-api.com only supports English (KJV/WEB). Indian-language
  // Bible translations will be connected in the future — until then,
  // non-English languages show a clear "unavailable" notice + English fallback.
  const bibleTextSupported = lang === "en";

  // Load bookmarks on mount
  useEffect(() => {
    refreshBookmarks();
  }, []);

  const refreshBookmarks = () => {
    const bms = getBookmarks();
    setBookmarks(bms);
    const set = new Set<string>();
    bms.forEach((b) => set.add(b.id));
    setBookmarkedVerses(set);
  };

  // Auto-jump to reader if a chapter is selected
  useEffect(() => {
    if (selectedBook && selectedChapter !== null) {
      setView("reader");
      loadChapter(selectedBook.id, selectedChapter, translation);
    }
  }, [selectedBook, selectedChapter]);

  // Reload chapter when translation changes (if we're in reader)
  useEffect(() => {
    if (view === "reader" && selectedBook && selectedChapter !== null) {
      loadChapter(selectedBook.id, selectedChapter, translation);
    }
  }, [translation]);

  const loadChapter = useCallback(async (bookId: string, chapter: number, trans: Translation) => {
    setChapterLoading(true);
    setChapterError(null);
    try {
      const data = await fetchChapter(bookId, chapter, trans);
      setChapterVerses(data.verses.map((v) => ({ verse: v.verse, text: v.text.trim() })));
      setChapterText(data.verses.map((v) => `${v.verse} ${v.text.trim()}`).join(" "));
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

      // Record Bible reading streak — once per day
      // Call BOTH the localStorage-based streak (for existing UI badges) AND
      // the server-authoritative streak (for Faith Streak milestones + rewards).
      const { recordStreak } = await import("@/lib/streaks");
      const before = JSON.parse(localStorage.getItem("crosscrafted_streaks") || "{}");
      const prevDate = before?.bible_reading?.lastActiveDate;
      const today = new Date().toISOString().split("T")[0];
      if (prevDate !== today) {
        const info = recordStreak("bible_reading");
        if (info.currentStreak === 1) {
          toast("🔥 Streak started!", { description: "Read the Bible daily to keep your streak alive." });
        } else if ([3, 7, 14, 30, 60, 90, 180, 365].includes(info.currentStreak)) {
          toast.success(`🔥 ${info.currentStreak}-day streak!`, {
            description: `You've been reading the Bible for ${info.currentStreak} consecutive days. Keep going!`,
          });
        }

        // Also record server-authoritative streak (for milestone rewards)
        try {
          const res = await fetch("/api/streak/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activity: "bible_reading" }),
          });
          if (res.ok) {
            const streakData = await res.json();
            if (streakData.newRewards && streakData.newRewards.length > 0) {
              for (const reward of streakData.newRewards) {
                toast.success("🎁 New Koino Reward Unlocked!", {
                  description: `Your ${streakData.currentStreak}-day Faith Streak unlocked: ${reward.reward?.name || "a reward"}`,
                });
              }
            }
          }
        } catch {
          // Server streak recording failure is non-fatal
        }
      }
    } catch (e: any) {
      setChapterError(e.message || "Failed to load chapter. Check your connection.");
      toast.error("Failed to load chapter", { description: "Please check your internet connection." });
    } finally {
      setChapterLoading(false);
    }
  }, []);

  const handleSelectBook = (book: BibleBook) => {
    setSelectedBook(book);
    setView("chapters");
  };

  const handleSelectChapter = (chapter: number) => {
    setSelectedChapter(chapter);
  };

  const handlePrevChapter = () => {
    if (!selectedBook || selectedChapter === null) return;
    if (selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
    } else {
      // Go to previous book's last chapter
      const allBooks = selectedBook.testament === "OT" ? OT_BOOKS : NT_BOOKS;
      const idx = allBooks.findIndex((b) => b.id === selectedBook.id);
      if (idx > 0) {
        const prevBook = allBooks[idx - 1];
        setSelectedBook(prevBook);
        setSelectedChapter(prevBook.chapters);
      } else if (selectedBook.testament === "NT") {
        // Wrap to last OT book
        const lastOt = OT_BOOKS[OT_BOOKS.length - 1];
        setSelectedBook(lastOt);
        setSelectedChapter(lastOt.chapters);
      }
    }
  };

  const handleNextChapter = () => {
    if (!selectedBook || selectedChapter === null) return;
    if (selectedChapter < selectedBook.chapters) {
      setSelectedChapter(selectedChapter + 1);
    } else {
      // Go to next book's chapter 1
      const allBooks = selectedBook.testament === "OT" ? OT_BOOKS : NT_BOOKS;
      const idx = allBooks.findIndex((b) => b.id === selectedBook.id);
      if (idx < allBooks.length - 1) {
        const nextBook = allBooks[idx + 1];
        setSelectedBook(nextBook);
        setSelectedChapter(1);
      } else if (selectedBook.testament === "OT") {
        // Wrap to first NT book
        const firstNt = NT_BOOKS[0];
        setSelectedBook(firstNt);
        setSelectedChapter(1);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      // Always treat as a verse reference first (most common use case)
      const result = await (await import("@/lib/bible-data")).fetchVerseByReference(
        searchQuery.trim(),
        translation
      );
      const results = result ? [result] : [];
      setSearchResults(results);
      if (results.length === 0) {
        if (isReferenceQuery(searchQuery)) {
          toast("Verse not found", {
            description: `Couldn't find "${searchQuery}" in ${translation.toUpperCase()}. Check the reference and try again.`,
          });
        } else {
          toast("Keyword search coming soon", {
            description: "Type a verse reference like 'John 3:16' to look up a specific verse.",
          });
        }
      }
    } catch {
      toast.error("Lookup failed", { description: "Check your connection and try again." });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleBookmarkToggle = (book: BibleBook, chapter: number, verse: number, text: string) => {
    const added = toggleBookmark({
      bookId: book.id,
      bookName: book.name,
      chapter,
      verse,
      text,
      translation,
    });
    refreshBookmarks();
    toast(added ? "Verse bookmarked" : "Bookmark removed", {
      description: added ? `${book.name} ${chapter}:${verse}` : undefined,
    });
  };

  const handleShareVerse = (book: BibleBook, chapter: number, verse: number, text: string) => {
    const ref = `${book.name} ${chapter}:${verse} (${translation.toUpperCase()})`;
    const full = `"${text}" — ${ref}`;
    navigator.clipboard.writeText(full);
    toast.success("Verse copied!", { description: ref });
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-28 md:pb-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t("nav.bible")}</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">{t("bible.subtitle")}</p>
        </div>
        {mode === "read" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("search")}
              className={`p-2 rounded-xl text-xs font-semibold transition-all border ${
                view === "search"
                  ? "bg-[#7C3AED]/15 border-[#7C3AED]/30 text-[#A78BFA]"
                  : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
              }`}
              title="Search"
            >
              <Search size={14} />
            </button>
            <button
              onClick={() => setView("bookmarks")}
              className={`relative p-2 rounded-xl text-xs font-semibold transition-all border ${
                view === "bookmarks"
                  ? "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]"
                  : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
              }`}
              title="Bookmarks"
            >
              <Bookmark size={14} />
              {bookmarks.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F59E0B] text-slate-950 text-[9px] font-bold flex items-center justify-center">
                  {bookmarks.length > 9 ? "9+" : bookmarks.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ─── MODE SWITCHER (READ / BIBLE COMICS / READING PLANS) ─── */}
      <div className="mb-5">
        <div className="flex p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl gap-1">
          <button
            onClick={() => setMode("read")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              mode === "read"
                ? "bg-gradient-to-r from-[#7C3AED] to-[#F39B9B] text-white shadow-lg shadow-[#7C3AED]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <BookOpenIcon size={13} /> READ
          </button>
          <button
            onClick={() => setMode("comics")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              mode === "comics"
                ? "bg-gradient-to-r from-[#7C3AED] to-[#F39B9B] text-white shadow-lg shadow-[#7C3AED]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Sparkles size={13} /> COMICS
          </button>
          <button
            onClick={() => setMode("plans")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              mode === "plans"
                ? "bg-gradient-to-r from-[#7C3AED] to-[#F39B9B] text-white shadow-lg shadow-[#7C3AED]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <List size={13} /> PLANS
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          READ MODE — existing Bible experience unchanged
          ────────────────────────────────────────────────────────────────── */}
      {mode === "read" && (
        <>
          {/* Translation picker (KJV/WEB) + language notice */}
          <div className="flex gap-2 mb-4">
            <div className="flex p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              {TRANSLATIONS.map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => setTranslation(tr.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    translation === tr.id ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"
                  }`}
                >
                  {tr.abbr}
                </button>
              ))}
            </div>
            {/* Language indicator — reflects the app-wide LanguageContext selection.
                Uses the globe LanguageSwitcher in the header, not a separate dropdown here. */}
            <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs">
              <span className="flex items-center gap-1.5 text-white">
                <span>{LANGUAGES.find((l) => l.code === lang)?.flag || "🌐"}</span>
                <span className="font-bold">{LANGUAGES.find((l) => l.code === lang)?.nativeName || "English"}</span>
              </span>
              {!bibleTextSupported && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] font-bold">
                  EN text
                </span>
              )}
            </div>
          </div>

          {/* Scripture language notice — clearly tells the user that Bible TEXT
              is only available in English (KJV/WEB), while UI is in their language. */}
          {!bibleTextSupported && view === "reader" && (
            <div className="mb-4 bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3">
              <p className="text-[10px] text-[#A09DB1] leading-relaxed">
                <span className="font-bold text-[#38BDF8]">Notice:</span> The Bible text below is in
                English ({translation.toUpperCase()}). The app interface is in your selected language,
                but Indian-language Bible translations are not yet available. We are working on connecting
                Hindi, Tamil, Telugu, and other translations.
              </p>
            </div>
          )}

          {/* BOOKS VIEW */}
          {view === "books" && (
            <>
              <StreakBadge activity="bible_reading" />
              <div className="h-4" />
              <BooksView onSelectBook={handleSelectBook} />
            </>
          )}

          {/* CHAPTERS VIEW */}
          {view === "chapters" && selectedBook && (
            <ChaptersView
              book={selectedBook}
              onSelectChapter={handleSelectChapter}
              onBack={() => setView("books")}
            />
          )}

          {/* READER VIEW */}
          {view === "reader" && selectedBook && selectedChapter !== null && (
            <ReaderView
              book={selectedBook}
              chapter={selectedChapter}
              verses={chapterVerses}
              loading={chapterLoading}
              error={chapterError}
              translation={translation}
              bookmarkedVerses={bookmarkedVerses}
              scrollRef={scrollRef}
              onPrev={handlePrevChapter}
              onNext={handleNextChapter}
              onBackToChapters={() => setView("chapters")}
              onBookmark={(verse, text) => handleBookmarkToggle(selectedBook, selectedChapter, verse, text)}
              onShare={(verse, text) => handleShareVerse(selectedBook, selectedChapter, verse, text)}
            />
          )}

          {/* SEARCH VIEW */}
          {view === "search" && (
            <SearchView
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSearch={handleSearch}
              loading={searchLoading}
              results={searchResults}
              onSelectResult={(bookId, chapter) => {
                const book = getBook(bookId);
                if (book) {
                  setSelectedBook(book);
                  setSelectedChapter(chapter);
                }
              }}
              translation={translation}
              onQuickLookup={async (ref) => {
                setSearchQuery(ref);
                setSearchLoading(true);
                try {
                  const { fetchVerseByReference } = await import("@/lib/bible-data");
                  const result = await fetchVerseByReference(ref, translation);
                  setSearchResults(result ? [result] : []);
                  if (!result) {
                    toast("Verse not found", {
                      description: `Couldn't find "${ref}" in ${translation.toUpperCase()}.`,
                    });
                  }
                } catch {
                  toast.error("Lookup failed");
                } finally {
                  setSearchLoading(false);
                }
              }}
            />
          )}

          {/* BOOKMARKS VIEW */}
          {view === "bookmarks" && (
            <BookmarksView
              bookmarks={bookmarks}
              onSelect={(bookId, chapter) => {
                const book = getBook(bookId);
                if (book) {
                  setSelectedBook(book);
                  setSelectedChapter(chapter);
                }
              }}
              onRemove={refreshBookmarks}
            />
          )}
        </>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          COMICS MODE — chapter browser using existing /api/comic/list
          ────────────────────────────────────────────────────────────────── */}
      {mode === "comics" && (
        <ComicsBrowserView onOpenComic={(bookId, chapter) => onOpenComic?.(bookId, chapter)} />
      )}

      {/* ──────────────────────────────────────────────────────────────────
          READING PLANS MODE — reuses the existing BiblePlansView component.
          When a plan day's chapter is opened, we switch to READ mode and
          load that chapter inline (no routing change required).
          ────────────────────────────────────────────────────────────────── */}
      {mode === "plans" && (
        <BiblePlansView
          translation={translation}
          onOpenChapter={(bookId, chapter) => {
            // Switch from PLANS → READ mode and load the chosen chapter
            // inside the existing Bible reader.
            const book = getBook(bookId);
            if (book) {
              setSelectedBook(book);
              setSelectedChapter(chapter);
              setMode("read");
            }
          }}
        />
      )}
    </div>
  );
}

// ─── COMICS BROWSER VIEW ────────────────────────────────────────────────────
// Lists all published comic chapters from /api/comic/list (sorted by
// sortOrder + bookId + chapter) and lets the user open any chapter —
// which hands control to the existing ComicView (via onOpenComic).

function ComicsBrowserView({ onOpenComic }: { onOpenComic: (bookId: string, chapter: number) => void }) {
  const [chapters, setChapters] = useState<ComicChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/comic/list");
        const text = await res.text();
        if (!text) throw new Error("Empty response from server");
        const data = JSON.parse(text);
        if (!res.ok) throw new Error(data.error || "Failed to load comics");
        // Defensive sort — preserve sortOrder ordering, then bookId, then chapter.
        const list: ComicChapterSummary[] = (data.chapters || []).slice().sort((a: ComicChapterSummary, b: ComicChapterSummary) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          if (a.bookId !== b.bookId) return a.bookId.localeCompare(b.bookId);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <ComicLoader size={28} className="text-[#F39B9B] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <ComicAlert size={28} className="mx-auto text-[#EF4444] mb-3" />
        <p className="text-sm text-[#94A3B8]">{error}</p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-16">
        <Sparkles size={28} className="mx-auto text-[#475569] mb-3" />
        <p className="text-sm text-[#94A3B8]">No comics published yet.</p>
      </div>
    );
  }

  const bookName = (bid: string) => bid.charAt(0).toUpperCase() + bid.slice(1);

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F39B9B]">
            BIBLE COMICS
          </p>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            Visual Bible storytelling — pick a chapter to begin
          </p>
        </div>
      </div>

      {/* Chapter grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {chapters.map((ch, idx) => {
          const cover = ch.coverArtUrl;
          return (
            <button
              key={ch.id}
              onClick={() => onOpenComic(ch.bookId, ch.chapter)}
              className="group bg-[#1C1929] border border-white/[0.06] hover:border-white/[0.15] hover:-translate-y-px rounded-2xl overflow-hidden transition-all text-left flex flex-col"
            >
              {/* Cover (uses ComicChapter.coverArtUrl when available) */}
              <div className="relative w-full aspect-[16/9] bg-[#0f0f1a] overflow-hidden">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={ch.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpenIcon size={28} className="text-[#475569]" />
                  </div>
                )}

                {/* Top gradient for legibility */}
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
                {/* Bottom gradient for legibility */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                {/* Chapter number overlay (top-left) */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#F39B9B] text-slate-950 text-[9px] font-black">
                  {idx + 1}
                </div>

                {/* Chapter title + reference overlay (bottom-left) */}
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs font-extrabold text-white drop-shadow leading-tight line-clamp-2">
                    {ch.title}
                  </p>
                  <p className="text-[9px] text-white/80 mt-0.5 font-bold">
                    {bookName(ch.bookId)} {ch.chapter}
                  </p>
                </div>
              </div>

              {/* CTA bar */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04]">
                <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
                  Continue Reading
                </span>
                <ArrowRight
                  size={14}
                  className="text-[#94A3B8] group-hover:text-white group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── BOOKS VIEW ────────────────────────────────────────────────────────────

function BooksView({ onSelectBook }: { onSelectBook: (b: BibleBook) => void }) {
  const [testament, setTestament] = useState<"OT" | "NT">("OT");
  const books = testament === "OT" ? OT_BOOKS : NT_BOOKS;
  const grouped = books.reduce<Record<string, BibleBook[]>>((acc, b) => {
    (acc[b.category] = acc[b.category] || []).push(b);
    return acc;
  }, {});

  return (
    <div>
      {/* Testament toggle */}
      <div className="flex p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl mb-4">
        <button
          onClick={() => setTestament("OT")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            testament === "OT" ? "bg-[#F59E0B] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          Old Testament · 39
        </button>
        <button
          onClick={() => setTestament("NT")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            testament === "NT" ? "bg-[#38BDF8] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          New Testament · 27
        </button>
      </div>

      {/* Books grouped by category */}
      <div className="space-y-5">
        {Object.entries(grouped).map(([category, bookList]) => (
          <div key={category}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">{category}</p>
            {/* 2 columns on mobile (full book names fit comfortably),
                3 on small tablets, 4 on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {bookList.map((book, i) => (
                <motion.button
                  key={book.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => onSelectBook(book)}
                  className="p-3 rounded-xl bg-[#1C1929] border border-white/[0.06] hover:border-white/[0.15] hover:bg-[#22202F] transition-all text-left group min-h-[60px] flex flex-col justify-center"
                >
                  <p className="text-sm font-bold text-white group-hover:scale-[1.02] transition-transform leading-tight">
                    {book.name}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">
                    {book.chapters} <span className="hidden sm:inline">chapters</span><span className="sm:hidden">ch</span>
                  </p>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CHAPTERS VIEW ──────────────────────────────────────────────────────────

function ChaptersView({
  book,
  onSelectChapter,
  onBack,
}: {
  book: BibleBook;
  onSelectChapter: (c: number) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors mb-3"
      >
        <ChevronLeft size={14} /> All Books
      </button>

      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-[#A78BFA]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">
            {book.testament === "OT" ? "Old Testament" : "New Testament"} · {book.category}
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-white">{book.name}</h2>
        <p className="text-xs text-[#94A3B8] mt-1">{book.chapters} chapters</p>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Select Chapter</p>
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
          <button
            key={ch}
            onClick={() => onSelectChapter(ch)}
            className="aspect-square rounded-xl bg-[#1C1929] border border-white/[0.06] hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/10 text-white font-bold text-sm transition-all"
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── READER VIEW ────────────────────────────────────────────────────────────

function ReaderView({
  book,
  chapter,
  verses,
  loading,
  error,
  translation,
  bookmarkedVerses,
  scrollRef,
  onPrev,
  onNext,
  onBackToChapters,
  onBookmark,
  onShare,
}: {
  book: BibleBook;
  chapter: number;
  verses: { verse: number; text: string }[];
  loading: boolean;
  error: string | null;
  translation: Translation;
  bookmarkedVerses: Set<string>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onPrev: () => void;
  onNext: () => void;
  onBackToChapters: () => void;
  onBookmark: (verse: number, text: string) => void;
  onShare: (verse: number, text: string) => void;
}) {
  const transLabel = TRANSLATIONS.find((t) => t.id === translation)?.label || "";

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <button
          onClick={onBackToChapters}
          className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors shrink-0"
        >
          <ChevronLeft size={14} /> Chapters
        </button>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] truncate">
          {transLabel}
        </span>
      </div>

      {/* Chapter header */}
      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-2xl p-4 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA] mb-1">
          {book.testament === "OT" ? "Old Testament" : "New Testament"}
        </p>
        <h2 className="text-xl font-extrabold text-white">
          {book.name} <span className="text-[#A78BFA]">{chapter}</span>
        </h2>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={32} className="text-[#7C3AED] animate-spin" />
          <p className="text-xs text-[#94A3B8]">Loading chapter...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <AlertCircle size={32} className="text-[#EF4444]" />
          <p className="text-sm text-[#94A3B8] max-w-xs">{error}</p>
          <button
            onClick={() => {
              // Trigger reload via chapter state change
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Verses */}
      {!loading && !error && verses.length > 0 && (
        <div
          ref={scrollRef}
          className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 max-h-[60vh] overflow-y-auto"
        >
          <div className="space-y-2">
            {verses.map((v) => {
              const id = `${book.id}-${chapter}-${v.verse}`;
              const isMarked = bookmarkedVerses.has(id);
              return (
                <motion.div
                  key={v.verse}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(v.verse * 0.01, 0.3) }}
                  className="group flex gap-2 hover:bg-white/[0.03] -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <span className="text-[#7C3AED] text-[11px] font-bold mt-0.5 shrink-0 w-6 text-right select-none">
                    {v.verse}
                  </span>
                  <p className="text-sm text-[#A09DB1] leading-relaxed flex-1">{v.text}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => onBookmark(v.verse, v.text)}
                      className={`p-1 rounded-md transition-all ${
                        isMarked ? "text-[#F59E0B]" : "text-[#94A3B8] hover:text-white"
                      }`}
                      title={isMarked ? "Remove bookmark" : "Bookmark verse"}
                    >
                      {isMarked ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                    </button>
                    <button
                      onClick={() => onShare(v.verse, v.text)}
                      className="p-1 rounded-md text-[#94A3B8] hover:text-white transition-colors"
                      title="Copy verse"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prev/Next chapter nav */}
      {!loading && !error && (
        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            onClick={onPrev}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition-all"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SEARCH VIEW ───────────────────────────────────────────────────────────

function SearchView({
  query,
  onQueryChange,
  onSearch,
  loading,
  results,
  onSelectResult,
  translation,
  onQuickLookup,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  loading: boolean;
  results: any[];
  onSelectResult: (bookId: string, chapter: number) => void;
  translation: Translation;
  onQuickLookup: (ref: string) => Promise<void>;
}) {
  const isRef = isReferenceQuery(query);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Enter a reference (e.g. John 3:16, Romans 8:28)"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          className="neo-input text-sm flex-1"
        />
        <button
          onClick={onSearch}
          disabled={loading || !query.trim()}
          className="px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Lookup
        </button>
      </div>

      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA] mb-1">Quick lookup</p>
        <p className="text-[11px] text-[#A09DB1] leading-relaxed">
          Enter a verse reference like <span className="font-bold text-white">John 3:16</span>,{" "}
          <span className="font-bold text-white">Romans 8:28</span>, or{" "}
          <span className="font-bold text-white">Psalm 23:1</span> to jump straight to that verse.
          Free-text keyword search across the whole Bible is being prepared — for now, browse by book &amp; chapter.
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={28} className="text-[#7C3AED] animate-spin" />
          <p className="text-xs text-[#94A3B8]">Looking up "{query}" in {translation.toUpperCase()}...</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelectResult(r.bookId, r.chapter)}
              className="w-full text-left bg-[#1C1929] border border-white/[0.06] hover:border-[#7C3AED]/40 rounded-xl p-3 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#A78BFA]">
                  {r.bookName} {r.chapter}:{r.verse}
                </span>
                <span className="text-[9px] text-[#64748B] uppercase tracking-wider">{translation}</span>
              </div>
              <p className="text-[13px] text-[#A09DB1] leading-relaxed">{r.text}</p>
              <p className="text-[10px] text-[#7C3AED] mt-2 font-bold">Open chapter →</p>
            </motion.button>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && isRef && (
        <div className="text-center py-12">
          <Search size={32} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8] mb-1">Verse not found</p>
          <p className="text-xs text-[#64748B] max-w-xs mx-auto">
            Check the reference and try again. Make sure the book name is spelled correctly.
          </p>
        </div>
      )}

      {!loading && !query && (
        <div className="text-center py-12">
          <Sparkles size={28} className="mx-auto text-[#A78BFA] mb-2" />
          <p className="text-sm text-[#94A3B8] mb-1">Look up any verse</p>
          <p className="text-xs text-[#64748B] max-w-xs mx-auto mb-3">
            Try these popular verses:
          </p>
          <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
            {["John 3:16", "Psalm 23:1", "Romans 8:28", "Philippians 4:13", "Jeremiah 29:11", "Isaiah 40:31"].map((ref) => (
              <button
                key={ref}
                onClick={() => onQuickLookup(ref)}
                className="px-3 py-1.5 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/25 text-[#A78BFA] text-[11px] font-bold hover:bg-[#7C3AED]/20 transition-all"
              >
                {ref}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOOKMARKS VIEW ────────────────────────────────────────────────────────

function BookmarksView({
  bookmarks,
  onSelect,
  onRemove,
}: {
  bookmarks: BookmarkType[];
  onSelect: (bookId: string, chapter: number) => void;
  onRemove: () => void;
}) {
  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <Bookmark size={32} className="mx-auto text-[#475569] mb-3" />
        <p className="text-sm text-[#475569] mb-1">No bookmarks yet</p>
        <p className="text-xs text-[#64748B] max-w-xs mx-auto">
          Open any chapter and tap the bookmark icon next to a verse to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
        {bookmarks.length} saved {bookmarks.length === 1 ? "verse" : "verses"}
      </p>
      {bookmarks.map((bm) => (
        <motion.button
          key={bm.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onSelect(bm.bookId, bm.chapter)}
          className="w-full text-left bg-[#1C1929] border border-white/[0.06] hover:border-[#F59E0B]/30 rounded-xl p-3 transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#F59E0B] flex items-center gap-1">
              <BookmarkCheck size={11} />
              {bm.bookName} {bm.chapter}:{bm.verse}
            </span>
            <span className="text-[9px] text-[#64748B] uppercase tracking-wider">{bm.translation}</span>
          </div>
          <p className="text-[13px] text-[#A09DB1] leading-relaxed line-clamp-2">{bm.text}</p>
        </motion.button>
      ))}
      <button
        onClick={() => {
          if (confirm("Remove all bookmarks? This cannot be undone.")) {
            localStorage.removeItem("cc_bible_bookmarks");
            onRemove();
            toast.success("All bookmarks cleared");
          }
        }}
        className="w-full mt-3 py-2 rounded-xl text-[11px] font-bold text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
      >
        Clear all bookmarks
      </button>
    </div>
  );
}
