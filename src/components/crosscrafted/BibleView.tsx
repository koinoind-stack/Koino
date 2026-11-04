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
  Headphones,
  Video,
  Brain,
  Zap,
  Heart,
  MessageCircle,
  Palette,
  ArrowUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  BIBLE_BOOKS,
  OT_BOOKS,
  NT_BOOKS,
  getBook,
  isReferenceQuery,
  toggleBookmark,
  isBookmarked,
  getBookmarks,
  type BibleBook,
  type Bookmark as BookmarkType,
} from "@/lib/bible-data";
import {
  DEFAULT_VERSION_REF,
  VERSION_STORAGE_KEY,
  formatVersionRef,
  parseVersionRef,
  resolveVersionOrGeneric,
  KOINO_FALLBACK_VERSIONS,
  SCRIPTURE_LANGUAGES,
  type BibleVersion,
  type VersionRef,
} from "@/lib/bible-versions";
import {
  fetchChapterVersioned,
  fetchVersionCatalog,
  lookupReferenceVersioned,
  BibleFetchError,
} from "@/lib/bible-fetch";
import { localizedBookName } from "@/lib/bible-book-names";
import { useTranslation, useLanguage } from "@/lib/i18n/LanguageContext";
import StreakBadge from "@/components/crosscrafted/StreakBadge";
import BiblePlansView from "@/components/crosscrafted/BiblePlansView";
import ComicLibraryView from "@/components/crosscrafted/ComicLibraryView";
import { shareLinks } from "@/lib/share/links";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";
import { Play } from "lucide-react";
import { formatDuration, formatBibleRef } from "@/lib/videos";

type View = "books" | "chapters" | "reader" | "search" | "bookmarks";
type BibleMode = "read" | "comics" | "plans";

export default function BibleView({
  onOpenComic,
  initialBookId,
  initialChapter,
  initialVerse,
  onOpenTrivia,
  onPray,
}: {
  onOpenComic?: (bookId: string, chapter: number) => void;
  initialBookId?: string; // Part 5: deep link from video pages (?view=bible&book=&chapter=)
  initialChapter?: number;
  initialVerse?: number | null; // Task 121: shared verse links (?…&verse=)
  onOpenTrivia?: () => void; // Passage panel: opens the existing Trivia/FP hub
  onPray?: () => void; // Passage panel: opens the existing Prayer Wall
}) {
  const t = useTranslation();
  const { lang, setLang } = useLanguage();
  const [view, setView] = useState<View>("books");
  const [mode, setMode] = useState<BibleMode>("read");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  // Unified version selection (YouVersion primary + Koino fallback).
  // Scripture language is INDEPENDENT of the UI language: the user picks the
  // Bible version in the selector; the interface language never changes it.
  const [versionRef, setVersionRef] = useState<VersionRef>(DEFAULT_VERSION_REF);
  const [catalog, setCatalog] = useState<{ enabled: boolean; versions: BibleVersion[] }>({
    enabled: false,
    versions: KOINO_FALLBACK_VERSIONS,
  });
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
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
  // Universal share sheet (single verse / verse range) — Task 121.
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
  // Verse to scroll to after the deep-linked chapter finishes loading.
  const [pendingScrollVerse, setPendingScrollVerse] = useState<number | null>(
    typeof initialVerse === "number" && initialVerse >= 1 ? initialVerse : null
  );

  // Whether English fallback text applies. With the YouVersion provider
  // connected, scripture is available in every language the catalogue lists —
  // the user selects scripture language via the version selector. Without it,
  // only English (KJV/WEB) text exists (existing notice applies).
  const bibleTextSupported = catalog.enabled || lang === "en";
  const availableVersions = catalog.versions.filter((v) => !v.coveredByYouVersion);
  const currentVersion =
    resolveVersionOrGeneric(versionRef, availableVersions) || KOINO_FALLBACK_VERSIONS[0];

  // Load the persisted version selection + the live version catalogue once.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VERSION_STORAGE_KEY);
      if (saved && parseVersionRef(saved)) setVersionRef(saved);
    } catch {
      // storage unavailable — keep default
    }
    let alive = true;
    fetchVersionCatalog()
      .then((c) => {
        if (alive) setCatalog(c);
      })
      .catch(() => {
        // catalogue endpoint failed — fallback versions already in state
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectVersion = (v: BibleVersion) => {
    const ref = formatVersionRef(v);
    setVersionRef(ref);
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, ref);
    } catch {
      // storage unavailable — selection persists for this session only
    }
    setVersionMenuOpen(false);
  };

  // Load bookmarks on mount
  useEffect(() => {
    refreshBookmarks();
  }, []);

  // Part 5: deep-linked passage from video pages — open the EXISTING reader
  // directly at the linked book/chapter (no duplicate reader is created).
  // The auto-jump effect below then switches to the reader view.
  // Task 121: an optional &verse= scrolls to (and highlights) that verse once
  // the chapter text arrives, so shared links open the exact verse.
  useEffect(() => {
    if (!initialBookId) return;
    const book = getBook(initialBookId);
    if (!book) return;
    const ch =
      initialChapter && initialChapter >= 1 && initialChapter <= book.chapters
        ? initialChapter
        : 1;
    setSelectedBook(book);
    setSelectedChapter(ch);
    if (typeof initialVerse === "number" && initialVerse >= 1) {
      setPendingScrollVerse(initialVerse);
    }
  }, [initialBookId, initialChapter, initialVerse]);

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
      loadChapter(selectedBook.id, selectedChapter, versionRef);
    }
  }, [selectedBook, selectedChapter]);

  // Reload chapter when the selected Bible version changes (if we're in reader)
  useEffect(() => {
    if (view === "reader" && selectedBook && selectedChapter !== null) {
      loadChapter(selectedBook.id, selectedChapter, versionRef);
    }
  }, [versionRef]);

  const loadChapter = useCallback(async (bookId: string, chapter: number, vRef: VersionRef) => {
    setChapterLoading(true);
    setChapterError(null);
    try {
      const data = await fetchChapterVersioned(vRef, bookId, chapter);
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
          toast(t("bible.streak.started"), { description: t("bible.streak.startedDesc") });
        } else if ([3, 7, 14, 30, 60, 90, 180, 365].includes(info.currentStreak)) {
          toast.success(t("bible.streak.nDays", { n: info.currentStreak }), {
            description: t("bible.streak.nDaysDesc", { n: info.currentStreak }),
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
                toast.success(t("bible.streak.rewardUnlocked"), {
                  description: t("bible.streak.rewardDesc", { n: streakData.currentStreak, name: reward.reward?.name || t("bible.streak.aReward") }),
                });
              }
            }
          }
        } catch {
          // Server streak recording failure is non-fatal
        }
      }
    } catch (e: any) {
      if (e instanceof BibleFetchError) {
        const msg = versionErrorText(t, e.kind);
        setChapterError(msg);
        toast.error(t("bible.version.unavailableTitle"), { description: msg });
      } else {
        setChapterError(e.message || t("bible.loadChapterError"));
        toast.error(t("bible.loadChapterErrorTitle"), { description: t("bible.loadChapterErrorDesc") });
      }
    } finally {
      setChapterLoading(false);
    }
  }, [t]);

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
      // Unified reference lookup through the selected Bible version
      // (YouVersion primary / Koino fallback — one experience for all).
      const result = await lookupReferenceVersioned(searchQuery.trim(), versionRef);
      const results = result ? [result] : [];
      setSearchResults(results);
      if (results.length === 0) {
        if (isReferenceQuery(searchQuery)) {
          toast(t("bible.verseNotFound"), {
            description: t("bible.verseNotFoundToastDesc", { q: searchQuery, T: currentVersion.abbr }),
          });
        } else {
          toast(t("bible.keywordSearchSoon"), {
            description: t("bible.keywordSearchSoonDesc"),
          });
        }
      }
    } catch {
      toast.error(t("bible.lookupFailed"), { description: t("bible.lookupFailedDesc") });
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
      versionRef: formatVersionRef(currentVersion),
      versionAbbr: currentVersion.abbr === "…" ? undefined : currentVersion.abbr,
    });
    refreshBookmarks();
    toast(added ? t("bible.verseBookmarked") : t("bible.bookmarkRemoved"), {
      description: added ? `${book.name} ${chapter}:${verse}` : undefined,
    });
  };

  const handleShareVerse = (book: BibleBook, chapter: number, verse: number, text: string) => {
    const ref = `${book.name} ${chapter}:${verse} (${currentVersion.abbr})`;
    const full = `"${text}" — ${ref}`;
    navigator.clipboard.writeText(full);
    toast.success(t("bible.verseCopied"), { description: ref });
  };

  // ─── Task 121: universal verse share (single verse or consecutive range) ──
  const openVerseShare = (
    book: BibleBook,
    chapter: number,
    verseStart: number,
    verseEnd: number
  ) => {
    const verses = chapterVerses.filter(
      (v) => v.verse >= verseStart && v.verse <= verseEnd
    );
    if (!verses.length) return;
    const text = verses.map((v) => `${v.verse} ${v.text}`).join(" ");
    const ref =
      verseStart === verseEnd
        ? `${book.name} ${chapter}:${verseStart} (${currentVersion.abbr})`
        : `${book.name} ${chapter}:${verseStart}-${verseEnd} (${currentVersion.abbr})`;
    setShareReq({
      heading: ref,
      shareText: `"${text.slice(0, 2200)}"\n\n— ${ref}`,
      shareUrl: shareLinks.bible(book.id, chapter, verseStart),
      cardUrl: `/api/share-card?type=verse&book=${encodeURIComponent(book.id)}&chapter=${chapter}&vs=${verseStart}&ve=${verseEnd}&translation=${currentVersion.provider === "koino" ? currentVersion.id : "kjv"}&version=${encodeURIComponent(formatVersionRef(currentVersion))}`,
      formats: ["square", "story", "portrait"],
      fileName: `koino-verse-${book.id}-${chapter}-${verseStart}${verseEnd !== verseStart ? `-${verseEnd}` : ""}.png`,
    });
  };

  // ─── Chapter-level share (passage action panel) ──────────────────────────
  // Same universal ShareSheet the verse share uses; the card is the verse
  // card for the whole chapter (the share-card API clamps long excerpts).
  const openChapterShare = (book: BibleBook, chapter: number, verses: { verse: number; text: string }[]) => {
    const ref = `${book.name} ${chapter} (${currentVersion.abbr})`;
    const first = verses[0]?.text?.trim() || "";
    setShareReq({
      heading: t("bible.shareHeading", { book: book.name, chapter }),
      shareText: `${ref}\n\n"${first.slice(0, 160)}${first.length > 160 ? "…" : ""}"\n\n${t("bible.shareTextTail")}`,
      shareUrl: shareLinks.bible(book.id, chapter),
      cardUrl: `/api/share-card?type=verse&book=${encodeURIComponent(book.id)}&chapter=${chapter}&vs=1&ve=${Math.max(verses.length, 1)}&translation=${currentVersion.provider === "koino" ? currentVersion.id : "kjv"}&version=${encodeURIComponent(formatVersionRef(currentVersion))}`,
      formats: ["portrait", "square"],
      fileName: `koino-chapter-${book.id}-${chapter}.png`,
    });
  };

  // Scroll to (and briefly highlight) the deep-linked verse once text arrives.
  useEffect(() => {
    if (pendingScrollVerse === null) return;
    if (!selectedBook || selectedChapter === null || chapterLoading) return;
    if (!chapterVerses.some((v) => v.verse === pendingScrollVerse)) {
      setPendingScrollVerse(null);
      return;
    }
    const el = document.getElementById(
      `verse-${selectedBook.id}-${selectedChapter}-${pendingScrollVerse}`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-[#2563EB]/20");
      const timer = window.setTimeout(
        () => el.classList.remove("bg-[#2563EB]/20"),
        2600
      );
      setPendingScrollVerse(null);
      return () => window.clearTimeout(timer);
    }
  }, [pendingScrollVerse, selectedBook, selectedChapter, chapterLoading, chapterVerses]);

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
                  ? "bg-[#2563EB]/15 border-[#2563EB]/30 text-[#60A5FA]"
                  : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
              }`}
              title={t("common.search")}
            >
              <Search size={14} />
            </button>
            <button
              onClick={() => setView("bookmarks")}
              className={`relative p-2 rounded-xl text-xs font-semibold transition-all border ${
                view === "bookmarks"
                  ? "bg-[#F5B84A]/15 border-[#F5B84A]/30 text-[#F5B84A]"
                  : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
              }`}
              title={t("bible.bookmarks")}
            >
              <Bookmark size={14} />
              {bookmarks.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F5B84A] text-slate-950 text-[9px] font-bold flex items-center justify-center">
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
                ? "bg-gradient-to-r from-[#2563EB] to-[#F97316] text-white shadow-lg shadow-[#2563EB]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <BookOpen size={13} /> {t("bible.mode.read")}
          </button>
          <button
            onClick={() => setMode("comics")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              mode === "comics"
                ? "bg-gradient-to-r from-[#2563EB] to-[#F97316] text-white shadow-lg shadow-[#2563EB]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Sparkles size={13} /> {t("bible.mode.comics")}
          </button>
          <button
            onClick={() => setMode("plans")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              mode === "plans"
                ? "bg-gradient-to-r from-[#2563EB] to-[#F97316] text-white shadow-lg shadow-[#2563EB]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <List size={13} /> {t("bible.mode.plans")}
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          READ MODE — ONE unified Bible reader
          ────────────────────────────────────────────────────────────────── */}
      {mode === "read" && (
        <>
          {/* Unified version selector (YouVersion primary + Koino fallback)
              + scripture-language availability indicator */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setVersionMenuOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs transition-all hover:border-[#2563EB]/40"
              title={t("bible.version.open")}
              aria-label={t("bible.version.open")}
              aria-expanded={versionMenuOpen}
            >
              <BookOpen size={12} className="text-[#60A5FA]" />
              <span className="font-bold text-white">{currentVersion.abbr}</span>
              <ChevronDown size={12} className="text-[#94A3B8]" />
            </button>
            {/* Scripture-language indicator — reflects the SELECTED BIBLE VERSION's
                language (independent of the UI language chosen in the header). */}
            <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs">
              <span className="flex items-center gap-1.5 text-white">
                <Globe size={12} className="text-[#22D3EE]" />
                <span className="font-bold">{currentVersion.nativeLanguageLabel}</span>
              </span>
              {!bibleTextSupported && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F5B84A]/15 text-[#F5B84A] font-bold">
                  {t("bible.enTextBadge")}
                </span>
              )}
            </div>
          </div>

          {/* Scripture language notice — shown only when the YouVersion provider
              is NOT connected: Bible TEXT is then only available in English
              (KJV/WEB), while the UI can be in any language. */}
          {!bibleTextSupported && view === "reader" && (
            <div className="mb-4 bg-[#22D3EE]/8 border border-[#22D3EE]/20 rounded-xl p-3">
              <p className="text-[10px] text-[#A09DB1] leading-relaxed">
                <span className="font-bold text-[#22D3EE]">{t("bible.noticeLabel")}</span>{" "}
                {t("bible.noticeBody", { T: currentVersion.abbr })}
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
              version={currentVersion}
              bookmarkedVerses={bookmarkedVerses}
              scrollRef={scrollRef}
              onPrev={handlePrevChapter}
              onNext={handleNextChapter}
              onBackToChapters={() => setView("chapters")}
              onBookmark={(verse, text) => handleBookmarkToggle(selectedBook, selectedChapter, verse, text)}
              onShare={(verse, text) => handleShareVerse(selectedBook, selectedChapter, verse, text)}
              onShareRange={(start, end) => openVerseShare(selectedBook, selectedChapter, start, end)}
              onOpenComic={onOpenComic}
              onOpenTrivia={onOpenTrivia}
              onPray={onPray}
              onShareChapter={() => openChapterShare(selectedBook, selectedChapter, chapterVerses)}
              onBookmarksChanged={refreshBookmarks}
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
              versionAbbr={currentVersion.abbr}
              onQuickLookup={async (ref) => {
                setSearchQuery(ref);
                setSearchLoading(true);
                try {
                  const result = await lookupReferenceVersioned(ref, versionRef);
                  setSearchResults(result ? [result] : []);
                  if (!result) {
                    toast(t("bible.verseNotFound"), {
                      description: t("bible.verseNotFoundToastDesc", { q: ref, T: currentVersion.abbr }),
                    });
                  }
                } catch {
                  toast.error(t("bible.lookupFailed"));
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
        <ComicLibraryView onOpenComic={(bookId, chapter) => onOpenComic?.(bookId, chapter)} />
      )}

      {/* ──────────────────────────────────────────────────────────────────
          READING PLANS MODE — reuses the existing BiblePlansView component.
          When a plan day's chapter is opened, we switch to READ mode and
          load that chapter inline (no routing change required).
          ────────────────────────────────────────────────────────────────── */}
      {mode === "plans" && (
        <BiblePlansView
          versionRef={versionRef}
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

      {/* ─── UNIVERSAL SHARE SHEET (verses) ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />

      {/* ─── UNIFIED VERSION MENU (YouVersion primary + Koino fallback) ─── */}
      {versionMenuOpen && (
        <VersionMenu
          versions={availableVersions}
          currentRef={formatVersionRef(currentVersion)}
          onSelect={selectVersion}
          onClose={() => setVersionMenuOpen(false)}
        />
      )}
    </div>
  );
}

// ─── BOOKS VIEW ────────────────────────────────────────────────────────────

function BooksView({ onSelectBook }: { onSelectBook: (b: BibleBook) => void }) {
  const t = useTranslation();
  const { lang } = useLanguage();
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
            testament === "OT" ? "bg-[#F5B84A] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          {t("bible.otCount")}
        </button>
        <button
          onClick={() => setTestament("NT")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            testament === "NT" ? "bg-[#22D3EE] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          {t("bible.ntCount")}
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
                  className="p-3 rounded-xl bg-[#13294A] border border-white/[0.06] hover:border-white/[0.15] hover:bg-[#22202F] transition-all text-left group min-h-[60px] flex flex-col justify-center"
                >
                  <p className="text-sm font-bold text-white group-hover:scale-[1.02] transition-transform leading-tight">
                    {/* Localized book name in the UI language where a
                        translation is available; English fallback otherwise. */}
                    {localizedBookName(book, lang)}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">
                    {book.chapters} <span className="hidden sm:inline">{t("bible.chapters")}</span><span className="sm:hidden">{t("bible.chaptersShort")}</span>
                  </p>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* ─── UNIVERSAL SHARE SHEET (verses) — rendered by the main view ─── */}
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
  const t = useTranslation();
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors mb-3"
      >
        <ChevronLeft size={14} /> {t("bible.allBooks")}
      </button>

      <div className="bg-gradient-to-br from-[#13294A] to-[#1A3A66] border border-[#2563EB]/20 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-[#60A5FA]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA]">
            {book.testament === "OT" ? t("bible.ot") : t("bible.nt")} · {book.category}
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-white">{book.name}</h2>
        <p className="text-xs text-[#94A3B8] mt-1">{t("bible.chapterCount", { n: book.chapters })}</p>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">{t("bible.selectChapter")}</p>
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
          <button
            key={ch}
            onClick={() => onSelectChapter(ch)}
            className="aspect-square rounded-xl bg-[#13294A] border border-white/[0.06] hover:border-[#2563EB]/40 hover:bg-[#2563EB]/10 text-white font-bold text-sm transition-all"
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
  version,
  bookmarkedVerses,
  scrollRef,
  onPrev,
  onNext,
  onBackToChapters,
  onBookmark,
  onShare,
  onShareRange,
  onOpenComic,
  onOpenTrivia,
  onPray,
  onShareChapter,
  onBookmarksChanged,
}: {
  book: BibleBook;
  chapter: number;
  verses: { verse: number; text: string }[];
  loading: boolean;
  error: string | null;
  version: BibleVersion;
  bookmarkedVerses: Set<string>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onPrev: () => void;
  onNext: () => void;
  onBackToChapters: () => void;
  onBookmark: (verse: number, text: string) => void;
  onShare: (verse: number, text: string) => void;
  onShareRange: (verseStart: number, verseEnd: number) => void;
  onOpenComic?: (bookId: string, chapter: number) => void;
  onOpenTrivia?: () => void;
  onPray?: () => void;
  onShareChapter: () => void;
  onBookmarksChanged: () => void;
}) {
  const t = useTranslation();

  // ─── Verse range selection (Task 121) ───────────────────────────────────
  // "Select" toggles tap-to-select: first tap marks the start verse, the
  // second tap marks the end of a CONSECUTIVE range. A bar appears with the
  // selected reference + a Share action that opens the universal share sheet.
  const [selectMode, setSelectMode] = useState(false);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);

  const resetSelection = () => {
    setSelectMode(false);
    setSelStart(null);
    setSelEnd(null);
  };

  const handleVerseTap = (verse: number) => {
    if (!selectMode) return;
    if (selStart === null || (selStart !== null && selEnd !== null)) {
      // fresh selection
      setSelStart(verse);
      setSelEnd(null);
    } else {
      if (verse === selStart) {
        // same verse twice = single-verse selection, ready to share
        setSelEnd(verse);
        return;
      }
      if (Math.abs(verse - selStart) >= 50) {
        toast.error(t("bible.rangeTooLong"), {
          description: t("bible.rangeTooLongDesc"),
        });
        return;
      }
      setSelEnd(verse);
    }
  };

  const rangeStart = selStart !== null && selEnd !== null ? Math.min(selStart, selEnd) : null;
  const rangeEnd = selStart !== null && selEnd !== null ? Math.max(selStart, selEnd) : null;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <button
          onClick={onBackToChapters}
          className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors shrink-0"
        >
          <ChevronLeft size={14} /> {t("bible.chaptersNav")}
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] truncate">
            {version.abbr !== "…" ? version.label : ""}
          </span>
          <button
            onClick={() => (selectMode ? resetSelection() : setSelectMode(true))}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
              selectMode
                ? "bg-[#2563EB]/25 border-[#2563EB]/50 text-[#93C5FD]"
                : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white"
            }`}
            title={t("bible.selectVersesTitle")}
          >
            {selectMode ? t("common.cancel") : t("bible.select")}
          </button>
        </div>
      </div>

      {selectMode && (
        <p className="text-[11px] text-[#60A5FA] mb-2">
          {t("bible.selectHint")}
        </p>
      )}

      {/* Version attribution — required copyright notice from the version
          metadata (YouVersion catalogue / Koino public-domain note) */}
      {!loading && !error && version.attribution && (
        <p className="text-[9px] text-[#64748B] leading-relaxed mb-3">
          {version.attribution}
        </p>
      )}

      {/* Chapter header */}
      <div className="bg-gradient-to-br from-[#13294A] to-[#1A3A66] border border-[#2563EB]/20 rounded-2xl p-4 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA] mb-1">
          {book.testament === "OT" ? t("bible.ot") : t("bible.nt")}
        </p>
        <h2 className="text-xl font-extrabold text-white">
          {book.name} <span className="text-[#60A5FA]">{chapter}</span>
        </h2>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={32} className="text-[#2563EB] animate-spin" />
          <p className="text-xs text-[#94A3B8]">{t("bible.loadingChapter")}</p>
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
            className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold"
          >
            {t("bible.retry")}
          </button>
        </div>
      )}

      {/* Verses */}
      {!loading && !error && verses.length > 0 && (
        <div
          ref={scrollRef}
          className="bg-[#13294A] border border-white/[0.06] rounded-2xl p-4 max-h-[60vh] overflow-y-auto"
        >
          <div className="space-y-2">
            {verses.map((v) => {
              const id = `${book.id}-${chapter}-${v.verse}`;
              const isMarked = bookmarkedVerses.has(id);
              const inRange =
                rangeStart !== null &&
                rangeEnd !== null &&
                v.verse >= rangeStart &&
                v.verse <= rangeEnd;
              const isAnchor = selStart === v.verse;
              return (
                <motion.div
                  key={v.verse}
                  id={`verse-${id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(v.verse * 0.01, 0.3) }}
                  onClick={() => handleVerseTap(v.verse)}
                  className={`group flex gap-2 hover:bg-white/[0.03] -mx-2 px-2 py-1 rounded-lg transition-colors ${
                    inRange ? "bg-[#2563EB]/[0.12]" : ""
                  } ${selectMode ? "cursor-pointer" : ""}`}
                >
                  <span
                    className={`text-[11px] font-bold mt-0.5 shrink-0 w-6 text-right select-none ${
                      isAnchor ? "text-[#93C5FD]" : "text-[#2563EB]"
                    }`}
                  >
                    {v.verse}
                  </span>
                  <p className="text-sm text-[#A09DB1] leading-relaxed flex-1">{v.text}</p>
                  <div className="flex items-center gap-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookmark(v.verse, v.text);
                      }}
                      className={`p-1 rounded-md transition-all ${
                        isMarked ? "text-[#F5B84A]" : "text-[#94A3B8] hover:text-white"
                      }`}
                      title={isMarked ? t("bible.removeBookmarkTitle") : t("bible.bookmarkVerseTitle")}
                    >
                      {isMarked ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare(v.verse, v.text);
                      }}
                      className="p-1 rounded-md text-[#94A3B8] hover:text-white transition-colors"
                      title={t("bible.copyVerseTitle")}
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareRange(v.verse, v.verse);
                      }}
                      className="p-1 rounded-md text-[#94A3B8] hover:text-white transition-colors"
                      title={t("bible.shareVerseTitle")}
                    >
                      <Share2 size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection action bar — extended with copy / listen / save for the
          selected passage (share already existed via Task 121) */}
      {!loading && !error && rangeStart !== null && rangeEnd !== null && (
        <div className="mt-3 flex items-center justify-between gap-2 bg-[#2563EB]/15 border border-[#2563EB]/40 rounded-2xl px-3 py-2.5">
          <p className="text-[11px] font-bold text-[#93C5FD] truncate">
            {book.name} {chapter}:{rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`}
            <span className="text-[#94A3B8] font-semibold">
              {" "}· {t("bible.verseCount", { n: rangeEnd - rangeStart + 1 })}
            </span>
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                const selVerses = verses.filter((v) => v.verse >= rangeStart && v.verse <= rangeEnd);
                const ref = `${book.name} ${chapter}:${rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`} (${version.abbr})`;
                const text = selVerses.map((v) => `${v.verse} ${v.text}`).join(" ");
                navigator.clipboard.writeText(`"${text}"\n\n— ${ref}`);
                toast.success(t("bible.passageCopied"), { description: ref });
              }}
              className="p-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[#94A3B8] hover:text-white transition-colors"
              title={t("bible.copyPassageTitle")}
            >
              <Copy size={12} />
            </button>
            <SelectionListenButton
              text={verses
                .filter((v) => v.verse >= rangeStart && v.verse <= rangeEnd)
                .map((v) => v.text)
                .join(" ")}
              refLabel={`${book.name} ${chapter}:${rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`}`}
            />
            <SelectionSaveButton
              bookId={book.id}
              bookName={book.name}
              chapter={chapter}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              verses={verses}
              versionRef={formatVersionRef(version)}
              versionAbbr={version.abbr}
              onChanged={onBookmarksChanged}
            />
            <button
              onClick={resetSelection}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[10px] font-bold text-[#94A3B8] hover:text-white"
            >
              {t("bible.clear")}
            </button>
            <button
              onClick={() => {
                onShareRange(rangeStart, rangeEnd);
                resetSelection();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-[10px] font-bold text-white flex items-center gap-1.5 hover:bg-[#1D4ED8]"
            >
              <Share2 size={11} /> {t("bible.share")}
            </button>
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
            <ChevronLeft size={14} /> {t("bible.prev")}
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all"
          >
            {t("common.next")} <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ─── Part 5: videos connected to this passage ─── */}
      {!loading && !error && <ChapterVideos bookId={book.id} chapter={chapter} />}

      {/* ─── Passage action panel (parity with Bible Comics) ─── */}
      {!loading && !error && verses.length > 0 && (
        <ChapterActionPanel
          book={book}
          chapter={chapter}
          verses={verses}
          versionRef={formatVersionRef(version)}
          versionAbbr={version.abbr}
          onReadTop={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          onOpenComic={onOpenComic}
          onOpenTrivia={onOpenTrivia}
          onPray={onPray}
          onShareChapter={onShareChapter}
          onBookmarksChanged={onBookmarksChanged}
        />
      )}
    </div>
  );
}

// ─── PASSAGE ACTION PANEL (parity with the Bible Comics action bar) ────────
// Mirrors ComicView's end-of-chapter panel using ONLY existing systems:
//   Read → scroll back to the scripture · Listen → browser TTS (same as
//   comics) · Watch → published library videos linked to the passage (the
//   SAME Video/VideoBibleRef records the Watch hub and comic pages use) ·
//   Comic → published comic chapter (existing onOpenComic) · Quiz/Earn FP →
//   existing Trivia hub (points are earned server-side there, never for
//   clicks) · Pray → existing Prayer Wall · Share → existing ShareSheet ·
//   Save → existing verse-bookmark system (chapter = verse-0 marker).
// Buttons whose content does not exist (no videos, no comic, TTS
// unsupported) are HIDDEN; Discuss is not built anywhere on Koino yet, so it
// renders as a dimmed unavailable state exactly like the comics reader.

// Browser TTS — same mechanism ComicView uses for audio narration. No
// professional audio Bible exists yet; the toast says so honestly.
function speakPassage(text: string, onEnd: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}

function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Published comic chapters, fetched once per session for availability checks
// (same endpoint the comic chapter selector uses — published only).
let comicChaptersCache: { at: number; keys: Set<string> } | null = null;
async function fetchComicChapterKeys(): Promise<Set<string>> {
  if (comicChaptersCache && Date.now() - comicChaptersCache.at < 5 * 60 * 1000) {
    return comicChaptersCache.keys;
  }
  const keys = new Set<string>();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("/api/comic/list", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      (data.chapters || []).forEach((ch: { bookId: string; chapter: number }) => {
        keys.add(`${ch.bookId}-${ch.chapter}`);
      });
    }
  } catch {
    // availability check is best-effort → button stays hidden on failure
  }
  comicChaptersCache = { at: Date.now(), keys };
  return keys;
}

function PanelButton({
  icon: Icon,
  label,
  sublabel,
  onClick,
  dimmed = false,
  active = false,
}: {
  icon: typeof BookOpen;
  label: string;
  sublabel: string;
  onClick: () => void;
  dimmed?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border transition-all min-h-[56px] ${
        dimmed
          ? "bg-white/[0.02] border-white/[0.04] text-[#475569] cursor-default"
          : active
            ? "bg-[#2563EB]/20 border-[#2563EB]/50 text-[#93C5FD]"
            : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
      }`}
    >
      <Icon size={18} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{label}</span>
      <span className="text-[8px] text-[#64748B] hidden lg:block text-center leading-tight">{sublabel}</span>
    </button>
  );
}

function ChapterActionPanel({
  book,
  chapter,
  verses,
  versionRef,
  versionAbbr,
  onReadTop,
  onOpenComic,
  onOpenTrivia,
  onPray,
  onShareChapter,
  onBookmarksChanged,
}: {
  book: BibleBook;
  chapter: number;
  verses: { verse: number; text: string }[];
  versionRef: VersionRef;
  versionAbbr: string;
  onReadTop: () => void;
  onOpenComic?: (bookId: string, chapter: number) => void;
  onOpenTrivia?: () => void;
  onPray?: () => void;
  onShareChapter: () => void;
  onBookmarksChanged: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [hasVideos, setHasVideos] = useState(false);
  const [hasComic, setHasComic] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = useTranslation();

  // Watch availability — same endpoint/records the ChapterVideos section and
  // comic pages use. Button only appears when a published video is linked.
  useEffect(() => {
    let cancelled = false;
    setHasVideos(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(`/api/videos?book=${encodeURIComponent(book.id)}&chapter=${chapter}&take=1`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d) => !cancelled && setHasVideos((d.videos || []).length > 0))
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [book.id, chapter]);

  // Comic availability — published comic chapter for this exact passage.
  useEffect(() => {
    let cancelled = false;
    setHasComic(false);
    fetchComicChapterKeys().then(
      (keys) => !cancelled && setHasComic(keys.has(`${book.id}-${chapter}`))
    );
    return () => {
      cancelled = true;
    };
  }, [book.id, chapter]);

  // Chapter save state (verse-0 bookmark marker) — recheck on passage change.
  useEffect(() => {
    setSaved(isBookmarked(book.id, chapter, 0));
  }, [book.id, chapter, onBookmarksChanged]);

  // Stop narration when the passage changes or the reader unmounts.
  useEffect(() => {
    setSpeaking(false);
    if (ttsSupported()) window.speechSynthesis.cancel();
    return () => {
      if (ttsSupported()) window.speechSynthesis.cancel();
    };
  }, [book.id, chapter]);

  const listenChapter = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = `${book.name} chapter ${chapter}. ` + verses.map((v) => `${v.verse}. ${v.text}`).join(" ");
    if (speakPassage(text, () => setSpeaking(false))) {
      setSpeaking(true);
      toast("Audio narration", {
        description: "Using browser voice synthesis. Professional audio coming soon.",
      });
    }
  };

  const toggleChapterSave = () => {
    const added = toggleBookmark({
      bookId: book.id,
      bookName: book.name,
      chapter,
      verse: 0,
      text: t("bible.fullChapterLabel", { book: book.name, ch: chapter, n: verses.length }),
      versionRef,
      versionAbbr: versionAbbr === "…" ? undefined : versionAbbr,
    });
    setSaved(added);
    onBookmarksChanged();
    toast(added ? t("bible.chapterSaved") : t("bible.chapterUnsaved"), {
      description: `${book.name} ${chapter}`,
    });
  };

  const watch = () => {
    // Scroll to the videos section already rendered for this passage; the
    // fallback opens the existing passage-scoped Watch library.
    const section = document.getElementById("chapter-videos");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.location.href = `/videos?book=${encodeURIComponent(book.id)}&chapter=${chapter}`;
    }
  };

  return (
    <div className="mt-5 bg-gradient-to-br from-[#13294A] to-[#1A3A66] border border-[#2563EB]/25 rounded-2xl p-3.5">
      <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-2.5">
        {t("bible.continueJourney", { book: book.name, ch: chapter })}
      </h3>
      <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        <PanelButton icon={BookOpen} label={t("bible.read")} sublabel={t("bible.readSub")} onClick={onReadTop} />
        {ttsSupported() && (
          <PanelButton
            icon={speaking ? X : Headphones}
            label={speaking ? t("bible.stop") : t("bible.listen")}
            sublabel={t("bible.audioNarration")}
            onClick={listenChapter}
            active={speaking}
          />
        )}
        {hasVideos && <PanelButton icon={Video} label={t("bible.watch")} sublabel={t("bible.relatedVideos")} onClick={watch} />}
        {hasComic && onOpenComic && (
          <PanelButton
            icon={Palette}
            label={t("bible.comic")}
            sublabel={t("bible.seeStory")}
            onClick={() => onOpenComic(book.id, chapter)}
          />
        )}
        {onOpenTrivia && (
          <PanelButton icon={Brain} label={t("bible.quiz")} sublabel={t("bible.testKnowledge")} onClick={onOpenTrivia} />
        )}
        {/* FP is earned inside the existing Trivia hub (quizzes/challenges,
            server-verified) — never by clicking here, so no farming. */}
        <PanelButton
          icon={Zap}
          label={t("bible.earnFp")}
          sublabel={t("bible.earnFpSub")}
          dimmed
          onClick={() => toast(t("bible.earnFpToast"), { description: t("bible.earnFpToastDesc") })}
        />
        {onPray && <PanelButton icon={Heart} label={t("bible.pray")} sublabel={t("bible.prayerWallSub")} onClick={onPray} />}
        <PanelButton icon={Share2} label={t("bible.share")} sublabel={t("bible.shareSub")} onClick={onShareChapter} />
        <PanelButton
          icon={saved ? BookmarkCheck : Bookmark}
          label={saved ? t("bible.saved") : t("common.save")}
          sublabel={saved ? t("bible.inBookmarks") : t("bible.bookmarkChapter")}
          onClick={toggleChapterSave}
          active={saved}
        />
        {/* Discussions do not exist anywhere on Koino yet (the comics reader
            shows the same state) — honest unavailable, not a fake link. */}
        <PanelButton
          icon={MessageCircle}
          label={t("bible.discuss")}
          sublabel={t("bible.comingSoon")}
          dimmed
          onClick={() => toast(t("bible.discussSoonToast"), { description: t("bible.discussToastDesc", { book: book.name, ch: chapter }) })}
        />
      </div>
    </div>
  );
}

// ─── Selection-bar helpers (listen / save a selected verse range) ──────────

function SelectionListenButton({ text, refLabel }: { text: string; refLabel: string }) {
  const [speaking, setSpeaking] = useState(false);
  const t = useTranslation();
  useEffect(() => () => { if (ttsSupported()) window.speechSynthesis.cancel(); }, []);
  return (
    <button
      onClick={() => {
        if (speaking) {
          window.speechSynthesis.cancel();
          setSpeaking(false);
          return;
        }
        if (speakPassage(text, () => setSpeaking(false))) {
          setSpeaking(true);
          toast(t("bible.audioNarration"), { description: t("bible.audioNarrationRefDesc", { ref: refLabel }) });
        }
      }}
      className={`p-2 rounded-lg border transition-colors ${
        speaking
          ? "bg-[#2563EB]/25 border-[#2563EB]/50 text-[#93C5FD]"
          : "bg-white/[0.06] border-white/[0.08] text-[#94A3B8] hover:text-white"
      }`}
      title={speaking ? t("bible.stopNarrationTitle") : t("bible.listenPassageTitle")}
    >
      {speaking ? <X size={12} /> : <Headphones size={12} />}
    </button>
  );
}

function SelectionSaveButton({
  bookId,
  bookName,
  chapter,
  rangeStart,
  rangeEnd,
  verses,
  versionRef,
  versionAbbr,
  onChanged,
}: {
  bookId: string;
  bookName: string;
  chapter: number;
  rangeStart: number;
  rangeEnd: number;
  verses: { verse: number; text: string }[];
  versionRef: VersionRef;
  versionAbbr: string;
  onChanged: () => void;
}) {
  const t = useTranslation();
  const inRange = verses.filter((v) => v.verse >= rangeStart && v.verse <= rangeEnd);
  const allSaved = inRange.length > 0 && inRange.every((v) => isBookmarked(bookId, chapter, v.verse));
  return (
    <button
      onClick={() => {
        let added = 0;
        let removed = 0;
        inRange.forEach((v) => {
          const didAdd = toggleBookmark({
            bookId,
            bookName,
            chapter,
            verse: v.verse,
            text: v.text,
            versionRef,
            versionAbbr: versionAbbr === "…" ? undefined : versionAbbr,
          });
          if (didAdd) added++;
          else removed++;
        });
        onChanged();
        if (allSaved) {
          toast(t("bible.bookmarksRemovedToast"), { description: `${bookName} ${chapter}:${rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`}` });
        } else {
          toast(t("bible.bookmarkedCount", { n: added }), {
            description: `${bookName} ${chapter}:${rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`}`,
          });
        }
      }}
      className={`p-2 rounded-lg border transition-colors ${
        allSaved
          ? "bg-[#F5B84A]/15 border-[#F5B84A]/40 text-[#F5B84A]"
          : "bg-white/[0.06] border-white/[0.08] text-[#94A3B8] hover:text-white"
      }`}
      title={allSaved ? t("bible.removeRangeBookmarksTitle") : t("bible.bookmarkAllTitle")}
    >
      {allSaved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
    </button>
  );
}

// ─── CHAPTER VIDEOS (Part 5) ────────────────────────────────────────────────

type ChapterVideoCard = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  youtubeId: string | null;
  durationSec: number | null;
  bibleRefs: { bookId: string; chapterStart: number; verseStart: number | null; chapterEnd: number | null; verseEnd: number | null }[];
};

/**
 * "Watch Related Videos" — published library videos linked to the passage
 * being read (admin-curated via VideoBibleRef). Renders nothing when no
 * videos are linked, so the reading experience stays undisturbed.
 */
function ChapterVideos({ bookId, chapter }: { bookId: string; chapter: number }) {
  const t = useTranslation();
  const [videos, setVideos] = useState<ChapterVideoCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVideos([]);
    setLoaded(false);
    fetch(`/api/videos?book=${encodeURIComponent(bookId)}&chapter=${chapter}&take=6`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d) => {
        if (!cancelled) {
          setVideos(d.videos || []);
          setLoaded(true);
        }
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [bookId, chapter]);

  if (!loaded || videos.length === 0) return null;

  return (
    <div id="chapter-videos" className="mt-5 bg-gradient-to-br from-[#13294A] to-[#1A3A66] border border-[#2563EB]/25 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#93C5FD]">
          <Play size={12} fill="currentColor" /> {t("bible.watchRelated")}
        </h3>
        <span className="text-[10px] text-[#94A3B8] font-bold">{videos.length}</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {videos.map((v) => (
          <a
            key={v.id}
            href={`/videos/${v.slug}`}
            className="group shrink-0 w-36 bg-[#13294A]/80 border border-white/[0.06] rounded-xl overflow-hidden hover:border-[#2563EB]/40 transition-all"
          >
            <div className="relative aspect-video bg-black/60">
              {(v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : null)) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.thumbnailUrl || `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                  alt={v.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#64748B]">
                  <Play size={16} />
                </div>
              )}
              {formatDuration(v.durationSec) && (
                <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-bold text-white">
                  {formatDuration(v.durationSec)}
                </span>
              )}
            </div>
            <p className="p-2 pb-1 text-[11px] font-bold text-white leading-snug line-clamp-2 group-hover:text-[#93C5FD] transition-colors">
              {v.title}
            </p>
            {/* Coverage label — a whole-book video must be visibly "Genesis 1–50",
                never mistaken for a single-chapter clip (P4). */}
            {v.bibleRefs?.length > 0 && (
              <p className="px-2 pb-2 text-[9px] font-extrabold uppercase tracking-wide text-[#7DD3FC] truncate">
                {formatBibleRef(v.bibleRefs[0], (id) => getBook(id)?.name || id)}
              </p>
            )}
          </a>
        ))}
      </div>
      <a
        href={`/videos?book=${encodeURIComponent(bookId)}&chapter=${chapter}`}
        className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-bold text-[#60A5FA] hover:text-white"
      >
        {t("bible.browseVideos")} <ChevronRight size={11} />
      </a>
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
  versionAbbr,
  onQuickLookup,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  loading: boolean;
  results: any[];
  onSelectResult: (bookId: string, chapter: number) => void;
  versionAbbr: string;
  onQuickLookup: (ref: string) => Promise<void>;
}) {
  const t = useTranslation();
  const isRef = isReferenceQuery(query);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder={t("bible.searchPlaceholder")}
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
          className="px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {t("bible.lookup")}
        </button>
      </div>

      <div className="bg-[#13294A] border border-white/[0.06] rounded-2xl p-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA] mb-1">{t("bible.quickLookup")}</p>
        <p className="text-[11px] text-[#A09DB1] leading-relaxed">
          {t("bible.quickLookupDesc")}
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={28} className="text-[#2563EB] animate-spin" />
          <p className="text-xs text-[#94A3B8]">{t("bible.lookingUp", { q: query, T: versionAbbr })}</p>
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
              className="w-full text-left bg-[#13294A] border border-white/[0.06] hover:border-[#2563EB]/40 rounded-xl p-3 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#60A5FA]">
                  {r.bookName} {r.chapter}:{r.verse}
                </span>
                <span className="text-[9px] text-[#64748B] uppercase tracking-wider">{versionAbbr}</span>
              </div>
              <p className="text-[13px] text-[#A09DB1] leading-relaxed">{r.text}</p>
              <p className="text-[10px] text-[#2563EB] mt-2 font-bold">{t("bible.openChapter")}</p>
            </motion.button>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && isRef && (
        <div className="text-center py-12">
          <Search size={32} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8] mb-1">{t("bible.verseNotFound")}</p>
          <p className="text-xs text-[#64748B] max-w-xs mx-auto">
            {t("bible.verseNotFoundHint")}
          </p>
        </div>
      )}

      {!loading && !query && (
        <div className="text-center py-12">
          <Sparkles size={28} className="mx-auto text-[#60A5FA] mb-2" />
          <p className="text-sm text-[#94A3B8] mb-1">{t("bible.lookUpAnyVerse")}</p>
          <p className="text-xs text-[#64748B] max-w-xs mx-auto mb-3">
            {t("bible.tryPopular")}
          </p>
          <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
            {["John 3:16", "Psalm 23:1", "Romans 8:28", "Philippians 4:13", "Jeremiah 29:11", "Isaiah 40:31"].map((ref) => (
              <button
                key={ref}
                onClick={() => onQuickLookup(ref)}
                className="px-3 py-1.5 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/25 text-[#60A5FA] text-[11px] font-bold hover:bg-[#2563EB]/20 transition-all"
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
  const t = useTranslation();
  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <Bookmark size={32} className="mx-auto text-[#475569] mb-3" />
        <p className="text-sm text-[#475569] mb-1">{t("bible.noBookmarks")}</p>
        <p className="text-xs text-[#64748B] max-w-xs mx-auto">
          {t("bible.noBookmarksDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
        {t("bible.savedItems", { n: bookmarks.length })}
      </p>
      {bookmarks.map((bm) => (
        <motion.button
          key={bm.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onSelect(bm.bookId, bm.chapter)}
          className="w-full text-left bg-[#13294A] border border-white/[0.06] hover:border-[#F5B84A]/30 rounded-xl p-3 transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#F5B84A] flex items-center gap-1">
              <BookmarkCheck size={11} />
              {/* verse 0 = whole-chapter marker saved by the reader's action panel */}
              {bm.verse === 0 ? `${bm.bookName} ${bm.chapter}` : `${bm.bookName} ${bm.chapter}:${bm.verse}`}
            </span>
            <span className="text-[9px] text-[#64748B] uppercase tracking-wider">
              {bm.versionAbbr || (bm.translation ? bm.translation.toUpperCase() : "")}
            </span>
          </div>
          <p className="text-[13px] text-[#A09DB1] leading-relaxed line-clamp-2">
            {bm.verse === 0 ? (
              <span className="text-[#F5B84A] font-bold">{t("bible.fullChapterSaved")}</span>
            ) : (
              bm.text
            )}
          </p>
        </motion.button>
      ))}
      <button
        onClick={() => {
          if (confirm(t("bible.clearBookmarksConfirm"))) {
            localStorage.removeItem("cc_bible_bookmarks");
            onRemove();
            toast.success(t("bible.allBookmarksCleared"));
          }
        }}
        className="w-full mt-3 py-2 rounded-xl text-[11px] font-bold text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
      >
        {t("bible.clearAllBookmarks")}
      </button>
    </div>
  );
}

// ─── UNIFIED VERSION MENU ───────────────────────────────────────────────────
// ONE selector for the ONE reader: English + Indian-language versions,
// grouped by language (English first, then the Indian languages). Each row
// shows the version name, abbreviation, language and its provider. Only
// versions Koino is permitted to use are listed (the server catalogue is the
// source of truth; the Koino fallback entries cover YouVersion outages).

function VersionMenu({
  versions,
  currentRef,
  onSelect,
  onClose,
}: {
  versions: BibleVersion[];
  currentRef: string;
  onSelect: (v: BibleVersion) => void;
  onClose: () => void;
}) {
  const t = useTranslation();

  // Group by scripture language in the fixed order (en, hi, ta, te, …);
  // skip languages with no accessible version.
  const groups = SCRIPTURE_LANGUAGES.map((lang) => ({
    lang,
    versions: versions.filter((v) => v.languageTag === lang.tag),
  })).filter((g) => g.versions.length > 0);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("bible.version.selectTitle")}
    >
      <div
        className="w-full max-w-md max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#171522] border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-bold text-white">{t("bible.version.selectTitle")}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white transition-colors"
            aria-label={t("bible.version.close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-3 py-3">
          {groups.map((g) => (
            <div key={g.lang.tag} className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] px-2 mb-1.5">
                {g.lang.nativeLabel} · {g.lang.label}
              </p>
              <div className="space-y-1">
                {g.versions.map((v) => {
                  const ref = formatVersionRef(v);
                  const isCurrent = ref === currentRef;
                  return (
                    <button
                      key={ref}
                      onClick={() => onSelect(v)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${
                        isCurrent
                          ? "bg-[#2563EB]/20 border border-[#2563EB]/40"
                          : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate">
                          {v.label}
                        </span>
                        <span className="block text-[10px] text-[#94A3B8] mt-0.5">
                          {v.abbr} ·{" "}
                          {v.provider === "youversion"
                            ? t("bible.version.providerYV")
                            : t("bible.version.providerKoino")}
                        </span>
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2563EB] text-white">
                          {t("bible.version.current")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Version error text mapping (graceful unavailability) ───────────────────

function versionErrorText(
  t: (key: string, vars?: Record<string, string | number>) => string,
  kind: string
): string {
  switch (kind) {
    case "unlicensed":
      return t("bible.version.error.unlicensed");
    case "rate_limited":
      return t("bible.version.error.rateLimited");
    case "network":
      return t("bible.version.error.network");
    default:
      return t("bible.version.error.generic");
  }
}
