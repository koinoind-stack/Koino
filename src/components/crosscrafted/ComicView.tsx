"use client";

// ─── COMIC BIBLE READER ───────────────────────────────────────────────────────
// Professional graphic-novel reader (Comic Bible redesign):
//   • Two-page spread on desktop ("individual" pageMode) or one pre-composed
//     spread per view ("spread" pageMode); single page on mobile with swipe.
//   • Toolbar: library, story title + Bible reference, LANGUAGE selector,
//     text size, zoom, fullscreen, bookmark.
//   • Language inherits the user's Bible translation preference
//     (resolveComicLanguage); switching language keeps the same page and
//     re-renders narration/dialogue in the new language. Languages without a
//     published translation are clearly marked "coming soon" — the reader
//     never silently substitutes another language (it explicitly falls back
//     to the English edition with a notice).
//   • Key Bible verse text is fetched LIVE from the existing Bible
//     translation system (/api/bible/*) in the selected comic language —
//     comic dialogue is never presented as Scripture.
//   • Reading progress is page-based and saved to cc_comic_progress
//     (same store the library's Continue Reading uses).

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  BookMarked,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Heart,
  Headphones,
  Languages,
  Loader2,
  Maximize,
  Minimize,
  MessageCircle,
  Share2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
  Video,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { getBook, getComicProgress, saveComicProgress, BIBLE_BOOKS } from "@/lib/bible-data";
import { fetchVersionCatalog, fetchChapterVersioned } from "@/lib/bible-fetch";
import { formatVersionRef } from "@/lib/bible-versions";
import {
  comicLanguageLabel,
  getComicLanguageSync,
  resolveComicLanguage,
  saveComicLanguage,
} from "@/lib/comic-language";
import { shareLinks } from "@/lib/share/links";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";

// ─── Types ────────────────────────────────────────────────────────────────

type ComicPanel = {
  panelId: string;
  sortOrder: number;
  artworkUrl: string;
  altText: string | null;
  verseStart: number;
  verseEnd: number;
  bookId: string;
  chapter: number;
  audioUrl: string | null;
  videoUrl: string | null;
  title: string | null;
  narration: string | null;
  captions: string[];
  isFallback: boolean;
  hasTranslation: boolean;
};

type KeyVerseRef = { book: string; chapter: number; start: number; end: number };

type ComicChapter = {
  id: string;
  comicId: string;
  bookId: string;
  chapter: number;
  title: string;
  coverArtUrl: string | null;
  sortOrder: number;
  kidsFriendly: boolean;
  pageMode: string;
  introduction: string | null;
  lesson: string | null;
  prayer: string | null;
  keyVerse: KeyVerseRef | null;
  panels: ComicPanel[];
  titleIsFallback: boolean;
  langAvailable: boolean;
  languages: { lang: string; available: boolean; publishedPanels: number; totalPanels: number }[];
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const BOOKMARKS_KEY = "cc_comic_bookmarks";
const TEXT_SIZE_KEY = "cc_comic_textsize";

type TextSize = "s" | "m" | "l";
const TEXT_SIZE_PX: Record<TextSize, string> = { s: "12px", m: "14px", l: "16px" };

function loadBookmarks(): Record<string, number[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadTextSize(): TextSize {
  try {
    const raw = localStorage.getItem(TEXT_SIZE_KEY);
    return raw === "s" || raw === "m" || raw === "l" ? raw : "m";
  } catch {
    return "m";
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

type Props = {
  bookId: string;
  chapter: number;
  onNavigateChapter: (bookId: string, chapter: number) => void;
  onReadChapter: (bookId: string, chapter: number) => void;
  onPray: (prayerPrompt: string) => void;
  onDiscuss: (topic: string) => void;
  onBackToLibrary?: () => void;
};

export default function ComicView({ bookId, chapter, onNavigateChapter, onReadChapter, onPray, onDiscuss, onBackToLibrary }: Props) {
  const { lang: uiLang } = useLanguage();
  const t = useTranslation();
  const { isAuthenticated } = useSupabaseUser();

  // ── Comic content language ──
  // First paint uses the synchronous best-effort (explicit pick → UI lang →
  // en); the authoritative resolution (saved Bible version → catalogue) runs
  // once on mount and is what the story fetch waits for, so a Telugu Bible
  // reader opens Telugu comics directly.
  const [contentLang, setContentLang] = useState<string>(() => getComicLanguageSync(uiLang));
  const langResolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    resolveComicLanguage(uiLang).then((resolved) => {
      if (cancelled) return;
      langResolvedRef.current = true;
      // resolveComicLanguage already honors an explicit pick saved meanwhile
      // (pickLanguage writes storage before state), so this can never clobber
      // a manual choice — it only upgrades the inherited default.
      setContentLang(resolved);
    });
    return () => {
      cancelled = true;
    };
     
  }, []);

  // ── Story data ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterData, setChapterData] = useState<ComicChapter | null>(null);
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);

  // ── Reader state ──
  const [page, setPage] = useState(1); // 1-based single-page index (left page of a spread on desktop)
  const [isWide, setIsWide] = useState(false); // desktop breakpoint → two-page spread
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>("m");
  const [bookmarks, setBookmarks] = useState<Record<string, number[]>>({});
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [keyVerse, setKeyVerse] = useState<{ text: string; abbr: string | null; attribution: string | null } | null>(null);

  // ── Quiz / TTS state (kept from the original reader) ──
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const readerRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const comicKey = `${bookId}-${chapter}`;

  // ── Load story (refetches on language change; keeps the current page) ──
  const loadComic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comic/${bookId}/${chapter}?lang=${contentLang}`);
      const text = await res.text();
      if (!text) throw new Error(t("comics.error.emptyResponse"));
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || t("comics.error.loadFailed"));
      setChapterData(data.chapter);
    } catch (e: any) {
      setError(e.message || t("comics.error.loadFailed"));
    } finally {
      setLoading(false);
    }
     
  }, [bookId, chapter, contentLang]);

  useEffect(() => {
    loadComic();
  }, [loadComic]);

  // ── Breakpoint: two-page spread on desktop ──
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ── Restore reader prefs (text size, bookmarks) ──
  useEffect(() => {
    setTextSize(loadTextSize());
    setBookmarks(loadBookmarks());
  }, []);

  // ── Page management ──
  const totalPanels = chapterData?.panels.length || 0;
  const spreadMode = isWide && chapterData?.pageMode !== "spread"; // 2 pages per view
  const pagesPerView = spreadMode ? 2 : 1;
  const totalViews = Math.max(1, Math.ceil(totalPanels / pagesPerView));

  const clampPage = useCallback(
    (p: number) => {
      if (totalPanels === 0) return 1;
      // Snap to the left page of the spread when in spread mode.
      if (spreadMode) {
        const spreadStart = Math.floor((Math.min(Math.max(p, 1), totalPanels) - 1) / 2) * 2 + 1;
        return spreadStart;
      }
      return Math.min(Math.max(p, 1), totalPanels);
    },
    [totalPanels, spreadMode]
  );

  // Reset to page 1 whenever the STORY changes (not on language switch —
  // spec: changing translation keeps the same page).
  useEffect(() => {
    setPage(1);
  }, [bookId, chapter]);

  // Re-clamp when the viewport crosses the spread breakpoint.
  useEffect(() => {
    setPage((p) => clampPage(p));
  }, [clampPage]);

  // ── Resume from the last read page (progress) + mark started ──
  const resumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!chapterData || totalPanels === 0) return;
    if (resumedRef.current === comicKey) return;
    resumedRef.current = comicKey;
    const prog = getComicProgress(bookId, chapter);
    if (prog && prog.lastPanel > 0 && !prog.completed) {
      setPage(clampPage(Math.min(prog.lastPanel, totalPanels)));
    } else {
      saveComicProgress(bookId, chapter, 0, totalPanels);
    }
  }, [chapterData, totalPanels, comicKey, bookId, chapter, clampPage]);

  // ── Persist page-based reading progress ──
  useEffect(() => {
    if (!chapterData || totalPanels === 0) return;
    const highestSeen = Math.min(totalPanels, page + pagesPerView - 1);
    saveComicProgress(bookId, chapter, highestSeen, totalPanels);
  }, [page, pagesPerView, totalPanels, chapterData, bookId, chapter]);

  const goNext = useCallback(() => {
    setPage((p) => {
      const next = p + pagesPerView;
      return next <= totalPanels ? clampPage(next) : p;
    });
  }, [pagesPerView, totalPanels, clampPage]);

  const goPrev = useCallback(() => {
    setPage((p) => {
      const prev = p - pagesPerView;
      return prev >= 1 ? clampPage(prev) : p;
    });
  }, [pagesPerView, clampPage]);

  // Keyboard navigation (desktop) — ignored while typing or in modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape" && showLangMenu) setShowLangMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, showLangMenu]);

  // Swipe navigation (mobile) — only when not zoomed (zoom uses horizontal pan).
  const onTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (zoom > 1 || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // scroll, not a page turn
    if (dx < 0) goNext();
    else goPrev();
  };

  // ── Fullscreen ──
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (readerRef.current) {
        await readerRef.current.requestFullscreen();
      }
    } catch {
      toast.error(t("comicsReader.fullscreenUnavailable"));
    }
  };

  // ── Zoom ──
  const ZOOM_STEPS = [1, 1.5, 2, 2.5];
  const zoomIn = () => setZoom((z) => ZOOM_STEPS.find((s) => s > z) || z);
  const zoomOut = () => setZoom((z) => [...ZOOM_STEPS].reverse().find((s) => s < z) || z);

  // ── Bookmark (current page) ──
  const visiblePages = useMemo(
    () => Array.from({ length: pagesPerView }, (_, i) => page + i).filter((p) => p <= totalPanels),
    [page, pagesPerView, totalPanels]
  );
  const isBookmarked = visiblePages.some((p) => (bookmarks[comicKey] || []).includes(p));

  const toggleBookmark = () => {
    setBookmarks((prev) => {
      const next = { ...prev };
      const list = new Set(next[comicKey] || []);
      visiblePages.forEach((p) => (list.has(p) ? list.delete(p) : list.add(p)));
      next[comicKey] = Array.from(list).sort((a, b) => a - b);
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    if (isBookmarked) toast(t("comicsReader.bookmarkRemovedToast"));
    else toast(t("comicsReader.bookmarkedToast", { n: visiblePages.join(", ") }));
  };

  // ── Text size ──
  const cycleTextSize = () => {
    const order: TextSize[] = ["s", "m", "l"];
    const next = order[(order.indexOf(textSize) + 1) % order.length];
    setTextSize(next);
    try {
      localStorage.setItem(TEXT_SIZE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  // ── Language selection ──
  const languageMenu = chapterData?.languages || [];
  const pickLanguage = (lang: string, available: boolean) => {
    setShowLangMenu(false);
    if (!available) {
      const { nativeLabel } = comicLanguageLabel(lang);
      toast.error(t("comicsReader.comingSoonLang", { lang: nativeLabel }));
      return;
    }
    if (lang === contentLang) return;
    saveComicLanguage(lang);
    setContentLang(lang); // refetch happens via loadComic dependency; page is kept
  };

  // ── Key Bible verse — fetched LIVE from the existing Bible system ──
  const kv = chapterData?.keyVerse || null;
  useEffect(() => {
    if (!kv) {
      setKeyVerse(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const catalog = await fetchVersionCatalog();
        const langVersions = catalog.versions.filter((v) => v.languageTag === contentLang && !v.coveredByYouVersion);
        const version =
          langVersions[0] ||
          (contentLang === "en" ? catalog.versions.find((v) => v.provider === "koino" && v.id === "kjv") : undefined);
        if (!version || cancelled) return;
        const chapterText = await fetchChapterVersioned(formatVersionRef(version), kv.book, kv.chapter);
        if (cancelled) return;
        const verses = (chapterText.verses || []).filter((v) => v.verse >= kv.start && v.verse <= kv.end);
        if (verses.length === 0) return;
        setKeyVerse({
          text: verses.map((v) => v.text.trim()).join(" "),
          abbr: chapterText.versionAbbr || null,
          attribution: chapterText.attribution || null,
        });
      } catch {
        // Verse text unavailable — the reference alone is still rendered.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kv?.book, kv?.chapter, kv?.start, kv?.end, contentLang]);  

  // ── TTS (kept from the original reader) ──
  const handleListen = () => {
    if (!chapterData) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const fullNarration = chapterData.panels
      .map((p, i) => `${t("comics.ttsPanelTemplate", { i: i + 1, title: p.title || "" })} ${p.narration || ""}`)
      .join(" ");
    const utterance = new SpeechSynthesisUtterance(fullNarration);
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    toast(t("comics.audioNarration"), { description: t("comics.audioNarrationDesc") });
  };

  // ── Share (kept from the original reader) ──
  const openChapterShare = () => {
    if (!chapterData) return;
    setShareReq({
      heading: t("comics.shareChapterHeading", { title: chapterData.title }),
      shareText: t("comics.shareText", { title: chapterData.title }),
      shareUrl: shareLinks.comic(chapterData.bookId, chapterData.chapter),
      cardUrl: `/api/share-card?type=comic-chapter&book=${encodeURIComponent(chapterData.bookId)}&chapter=${chapterData.chapter}&lang=${contentLang}`,
      formats: ["portrait", "square"],
      fileName: `koino-comic-${bookId}-${chapter}.png`,
    });
  };

  const openPanelShare = (panel: ComicPanel, verseRef: string) => {
    setShareReq({
      heading: t("comics.sharePanelHeading", { title: panel.title || verseRef }),
      shareText: t("comics.sharePanelText", { title: panel.title || verseRef, ref: verseRef }),
      shareUrl: shareLinks.comic(bookId, chapter),
      cardUrl: `/api/share-card?type=comic-panel&panel=${encodeURIComponent(panel.panelId)}&lang=${contentLang}`,
      formats: ["square", "story"],
      imageUrl: panel.artworkUrl || undefined,
      imageLabel: t("comics.originalIllustration"),
      fileName: `koino-comic-panel-${panel.panelId}.png`,
    });
  };

  // ── Quiz (kept from the original reader) ──
  const startQuiz = async () => {
    if (!chapterData) return;
    if (!isAuthenticated) {
      toast.error(t("comics.quizSignInRequired"));
      return;
    }
    setShowQuiz(true);
    setQuizLoading(true);
    try {
      const res = await fetch(`/api/comic/quiz/${chapterData.id}?lang=${contentLang}&mode=EARN_POINTS`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuizQuestions(data.questions || []);
    } catch (e: any) {
      toast.error(t("comics.quizLoadFailed"), { description: e.message });
    } finally {
      setQuizLoading(false);
    }
  };

  // ── Preload the next view's artwork ──
  useEffect(() => {
    if (!chapterData || totalPanels === 0) return;
    const nextPage = page + pagesPerView;
    for (let p = nextPage; p < Math.min(nextPage + pagesPerView, totalPanels + 1); p++) {
      const panel = chapterData.panels[p - 1];
      if (panel?.artworkUrl) {
        const img = new Image();
        img.src = panel.artworkUrl;
      }
    }
  }, [page, pagesPerView, totalPanels, chapterData]);

  // ── Render: loading / error states ──
  if (loading && !chapterData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-[#F39B9B] animate-spin" />
      </div>
    );
  }

  if (error || !chapterData) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={32} className="mx-auto text-[#EF4444] mb-3" />
        <p className="text-sm text-[#94A3B8]">{error || t("comics.error.notFound")}</p>
        <button onClick={loadComic} className="mt-4 px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold">
          {t("comics.retry")}
        </button>
      </div>
    );
  }

  const bookName = getBook(bookId)?.name || bookId.charAt(0).toUpperCase() + bookId.slice(1);
  const panels = chapterData.panels;
  const progressPct = totalPanels > 0 ? Math.min(100, Math.round((Math.min(totalPanels, page + pagesPerView - 1) / totalPanels) * 100)) : 0;
  const chapterCompleted = totalPanels > 0 && page + pagesPerView - 1 >= totalPanels;
  const isRTL = contentLang === "ur";
  const viewIndex = Math.floor((page - 1) / pagesPerView) + 1;
  const prayerPrompt =
    chapterData.prayer ||
    panels[0]?.captions?.[0] ||
    t("comics.prayerFallback", { title: chapterData.title });

  return (
    <div ref={readerRef} className="max-w-[1200px] mx-auto px-4 py-5 pb-28 md:pb-5 bg-[#0B0A12] md:rounded-3xl">
      {/* ─── TOOLBAR ─── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {onBackToLibrary && (
          <button
            onClick={onBackToLibrary}
            aria-label={t("comics.backToLibraryAria")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white/90 hover:bg-white/[0.12] text-xs font-bold transition-all min-h-[40px]"
          >
            <ArrowLeft size={14} /> <span className="hidden sm:inline">{t("comicsReader.library")}</span>
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-black text-white truncate leading-tight">{chapterData.title}</h1>
          <p className="text-[11px] font-bold text-[#A78BFA]">
            {bookName} {chapter}
            {chapterData.kidsFriendly && (
              <span className="ml-2 px-1.5 py-0.5 rounded-md bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[9px] font-black uppercase">
                {t("comics.kidsBadge")}
              </span>
            )}
          </p>
        </div>

        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu((v) => !v)}
            aria-label={t("comicsReader.languageAria")}
            aria-expanded={showLangMenu}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] hover:bg-[#7C3AED]/25 text-xs font-bold transition-all min-h-[40px]"
          >
            <Languages size={14} />
            <span>{comicLanguageLabel(contentLang).nativeLabel}</span>
            <ChevronDown size={12} className={showLangMenu ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          <AnimatePresence>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-0 top-full mt-1 z-50 w-64 max-h-[60vh] overflow-y-auto rounded-2xl bg-[#171522] border border-white/[0.1] shadow-2xl p-1.5"
                  role="listbox"
                  aria-label={t("comicsReader.languageAria")}
                >
                  <p className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#64748B]">
                    {t("comicsReader.languageHint")}
                  </p>
                  {languageMenu.map(({ lang, available }) => {
                    const { nativeLabel, label } = comicLanguageLabel(lang);
                    const active = lang === contentLang;
                    return (
                      <button
                        key={lang}
                        role="option"
                        aria-selected={active}
                        onClick={() => pickLanguage(lang, available)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          active
                            ? "bg-[#7C3AED]/25 text-white"
                            : available
                              ? "text-[#C9C5DB] hover:bg-white/[0.06] hover:text-white"
                              : "text-[#5A5670]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={available || active ? "" : "opacity-60"}>{nativeLabel}</span>
                          <span className="text-[9px] text-[#64748B] font-bold">{label}</span>
                        </span>
                        {available ? (
                          <CheckCircle2 size={13} className={active ? "text-[#A78BFA]" : "text-[#22C55E]"} />
                        ) : (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B]">
                            {t("comicsReader.soon")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Text size */}
        <button
          onClick={cycleTextSize}
          aria-label={t("comicsReader.textSizeAria")}
          title={t("comicsReader.textSizeAria")}
          className="p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-[#94A3B8] hover:text-white transition-all min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
        >
          <span className="flex items-center justify-center leading-none font-black">
            <Type size={12} />
            <span className="text-[8px] mt-2">{textSize.toUpperCase()}</span>
          </span>
        </button>

        {/* Zoom */}
        <div className="hidden sm:inline-flex items-center rounded-xl bg-white/[0.06] border border-white/[0.12] overflow-hidden min-h-[40px]">
          <button onClick={zoomOut} aria-label={t("comicsReader.zoomOutAria")} className="px-2.5 py-2 text-[#94A3B8] hover:text-white transition-colors">
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-black text-[#94A3B8] px-1">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} aria-label={t("comicsReader.zoomInAria")} className="px-2.5 py-2 text-[#94A3B8] hover:text-white transition-colors">
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Bookmark */}
        <button
          onClick={toggleBookmark}
          aria-label={isBookmarked ? t("comicsReader.bookmarkRemoveAria") : t("comicsReader.bookmarkAria")}
          aria-pressed={isBookmarked}
          className={`p-2.5 rounded-xl border transition-all min-h-[40px] min-w-[40px] inline-flex items-center justify-center ${
            isBookmarked
              ? "bg-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B]"
              : "bg-white/[0.06] border-white/[0.12] text-[#94A3B8] hover:text-white"
          }`}
        >
          <BookMarked size={14} />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? t("comicsReader.exitFullscreenAria") : t("comicsReader.fullscreenAria")}
          className="p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-[#94A3B8] hover:text-white transition-all min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      </div>

      {/* ─── TRANSLATION AVAILABILITY NOTICE ─── */}
      {!chapterData.langAvailable && contentLang !== "en" && (
        <div className="mb-4 p-3 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 flex items-start gap-2.5">
          <Languages size={15} className="text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[#F59E0B]">
              {t("comicsReader.notAvailableTitle", { lang: comicLanguageLabel(contentLang).nativeLabel })}
            </p>
            <p className="text-[11px] text-[#A09DB1] mt-0.5">{t("comicsReader.notAvailableDesc")}</p>
          </div>
        </div>
      )}

      {/* ─── STAGE ─── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative rounded-3xl bg-[#0f0e18] border border-white/[0.07] overflow-hidden select-none"
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center">
            <Loader2 size={26} className="text-[#F39B9B] animate-spin" />
          </div>
        )}
        <div
          className="flex flex-col lg:flex-row items-stretch lg:items-start gap-0"
          style={{ transform: zoom > 1 ? `scale(${zoom})` : undefined, transformOrigin: "top center", transition: "transform 160ms ease" }}
        >
          {visiblePages.map((p) => {
            const panel = panels[p - 1];
            if (!panel) return null;
            return (
              <ReaderPage
                key={panel.panelId}
                panel={panel}
                pageNumber={p}
                bookName={bookName}
                chapterNum={chapter}
                textSizePx={TEXT_SIZE_PX[textSize]}
                isRTL={isRTL}
                onShare={(panel_, ref) => openPanelShare(panel_, ref)}
                lang={contentLang}
              />
            );
          })}
        </div>

        {/* Edge tap zones (desktop) */}
        <button
          onClick={goPrev}
          aria-label={t("comicsReader.prevPageAria")}
          disabled={page === 1}
          className="hidden lg:flex absolute left-0 top-0 bottom-24 w-14 items-center justify-start pl-2 text-white/40 hover:text-white disabled:opacity-0 transition-all"
        >
          <ChevronLeft size={30} />
        </button>
        <button
          onClick={goNext}
          aria-label={t("comicsReader.nextPageAria")}
          disabled={page + pagesPerView - 1 >= totalPanels}
          className="hidden lg:flex absolute right-0 top-0 bottom-24 w-14 items-center justify-end pr-2 text-white/40 hover:text-white disabled:opacity-0 transition-all"
        >
          <ChevronRight size={30} />
        </button>
      </div>

      {/* ─── PAGE CONTROLS ─── */}
      <div className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goPrev}
            disabled={page === 1}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs font-bold text-white/90 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.12] transition-all min-h-[40px]"
          >
            <ChevronLeft size={14} /> {t("comicsReader.prev")}
          </button>

          <div className="text-center min-w-0">
            <p className="text-[11px] font-black text-white">
              {t("comicsReader.pageOf", { n: viewIndex, total: totalViews })}
            </p>
            <div className="h-1 w-32 sm:w-44 rounded-full bg-white/[0.08] overflow-hidden mt-1.5 mx-auto">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#F39B9B] transition-all duration-300"
                style={{ width: `${Math.max(4, progressPct)}%` }}
              />
            </div>
            <p className="text-[9px] font-bold text-[#64748B] mt-1 sm:hidden">{t("comicsReader.swipeHint")}</p>
          </div>

          <button
            onClick={goNext}
            disabled={page + pagesPerView - 1 >= totalPanels}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#F39B9B] text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all min-h-[40px]"
          >
            {t("comicsReader.next")} <ChevronRight size={14} />
          </button>
        </div>
        {chapterCompleted && (
          <p className="text-center mt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-black">
              <CheckCircle2 size={11} /> {t("comics.chapterCompleted")}
            </span>
          </p>
        )}
      </div>

      {/* ─── STORY SECTIONS ─── */}
      {chapterData.introduction && (
        <StorySection icon={BookOpen} heading={t("comicsReader.introductionHeading")} dir={isRTL ? "rtl" : undefined}>
          <p style={{ fontSize: TEXT_SIZE_PX[textSize] }} className="text-[#A09DB1] leading-relaxed whitespace-pre-line">
            {chapterData.introduction}
          </p>
        </StorySection>
      )}

      {chapterData.keyVerse && (
        <StorySection icon={BookMarked} heading={t("comicsReader.keyVerseHeading")} dir={isRTL ? "rtl" : undefined}>
          <blockquote className="border-l-2 border-[#F59E0B]/60 pl-3 py-0.5">
            <p className="text-[#FDE68A] font-semibold leading-relaxed" style={{ fontSize: TEXT_SIZE_PX[textSize] }} dir={isRTL ? "rtl" : undefined}>
              {keyVerse?.text ? `“${keyVerse.text}”` : ""}
            </p>
            <footer className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-black text-[#F59E0B]">
                {getBook(chapterData.keyVerse.book)?.name || chapterData.keyVerse.book} {chapterData.keyVerse.chapter}:{chapterData.keyVerse.start}
                {chapterData.keyVerse.end !== chapterData.keyVerse.start ? `-${chapterData.keyVerse.end}` : ""}
              </span>
              {keyVerse?.abbr && <span className="text-[9px] font-bold text-[#64748B] uppercase">{keyVerse.abbr}</span>}
              {keyVerse?.attribution && <span className="text-[9px] text-[#475569]">{keyVerse.attribution}</span>}
            </footer>
          </blockquote>
          <button
            onClick={() => onReadChapter(chapterData.keyVerse!.book, chapterData.keyVerse!.chapter)}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] text-[11px] font-bold hover:bg-[#F59E0B]/20 transition-all"
          >
            <BookOpen size={12} /> {t("comicsReader.readInBible")}
          </button>
        </StorySection>
      )}

      {chapterData.lesson && (
        <StorySection icon={CheckCircle2} heading={t("comicsReader.lessonHeading")} dir={isRTL ? "rtl" : undefined}>
          <p style={{ fontSize: TEXT_SIZE_PX[textSize] }} className="text-[#A09DB1] leading-relaxed whitespace-pre-line">
            {chapterData.lesson}
          </p>
        </StorySection>
      )}

      {chapterData.prayer && (
        <StorySection icon={Heart} heading={t("comicsReader.prayerHeading")} dir={isRTL ? "rtl" : undefined}>
          <p style={{ fontSize: TEXT_SIZE_PX[textSize] }} className="text-[#A09DB1] leading-relaxed whitespace-pre-line italic">
            {chapterData.prayer}
          </p>
          <button
            onClick={() => onPray(prayerPrompt)}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-[11px] font-bold hover:bg-[#7C3AED]/25 transition-all"
          >
            <Heart size={12} /> {t("comicsReader.prayThis")}
          </button>
        </StorySection>
      )}

      {/* ─── BOTTOM ACTION BAR (kept from the original reader) ─── */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 mt-5">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <ActionButton icon={BookOpen} label={t("bible.read")} sublabel={t("comics.readSub")} onClick={() => onReadChapter(bookId, chapter)} />
          <ActionButton icon={isSpeaking ? X : Headphones} label={isSpeaking ? t("bible.stop") : t("bible.listen")} sublabel={t("comics.audioNarration")} onClick={handleListen} />
          <ChapterVideoAction bookId={bookId} chapter={chapter} />
          <ActionButton icon={Brain} label={t("bible.quiz")} sublabel={t("comics.quizSub")} onClick={startQuiz} />
          <ActionButton icon={Zap} label={t("bible.earnFp")} sublabel={t("comics.earnFpSub")} onClick={() => toast(t("comics.earnFpToast"))} dimmed />
          <ActionButton icon={Heart} label={t("bible.pray")} sublabel={t("comics.praySub")} onClick={() => onPray(prayerPrompt)} />
          <ActionButton icon={MessageCircle} label={t("bible.discuss")} sublabel={t("comics.discussSub")} onClick={() => onDiscuss(t("comics.discussPrompt", { book: bookName, chapter }))} dimmed />
        </div>
      </div>

      {/* ─── RELATED BIBLE STORIES (same book) ─── */}
      <RelatedStories bookId={bookId} currentChapter={chapter} onOpen={onNavigateChapter} />

      {/* ─── CHAPTER NAVIGATION ─── */}
      <ChapterNavigation bookId={bookId} chapter={chapter} onNavigate={onNavigateChapter} />

      {/* ─── SHARE / DOWNLOAD ─── */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={openChapterShare}
          className="flex-1 py-2.5 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#7C3AED]/25 transition-all"
        >
          <Share2 size={14} /> {t("comics.shareChapter")}
        </button>
      </div>

      {/* ─── UNIVERSAL SHARE SHEET ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />

      {/* ─── QUIZ MODAL ─── */}
      <AnimatePresence>
        {showQuiz && (
          <ComicQuizModal
            chapterId={chapterData.id}
            questions={quizQuestions}
            loading={quizLoading}
            lang={contentLang}
            onClose={() => {
              setShowQuiz(false);
              setQuizQuestions([]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Reader page (one artwork + its localized text) ──────────────────────────

function ReaderPage({
  panel,
  pageNumber,
  bookName,
  chapterNum,
  textSizePx,
  isRTL,
  onShare,
  lang,
}: {
  panel: ComicPanel;
  pageNumber: number;
  bookName: string;
  chapterNum: number;
  textSizePx: string;
  isRTL: boolean;
  onShare?: (panel: ComicPanel, verseRef: string) => void;
  lang: string;
}) {
  const t = useTranslation();
  const narration = (panel.narration || "").trim();
  const [expanded, setExpanded] = useState(false);

  // Reset expansion when the narration (language) changes.
  useEffect(() => {
    setExpanded(false);
  }, [narration, lang]);

  const verseRef =
    panel.verseStart === panel.verseEnd
      ? `${bookName} ${chapterNum}:${panel.verseStart}`
      : `${bookName} ${chapterNum}:${panel.verseStart}-${panel.verseEnd}`;

  return (
    <div className="flex-1 min-w-0 flex flex-col lg:border-r lg:border-white/[0.06] last:border-r-0">
      {/* Artwork — original aspect ratio preserved, never stretched or cropped */}
      <div className="relative bg-[#0f0e18] flex items-center justify-center min-h-[240px]">
        { }
        <img
          src={panel.artworkUrl}
          alt={panel.altText || panel.title || t("comics.panelAlt", { n: pageNumber, book: bookName, ch: chapterNum })}
          className="w-full h-auto max-h-[68vh] object-contain"
          loading={pageNumber <= 2 ? "eager" : "lazy"}
          decoding="async"
        />

        {/* Page number badge */}
        <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-[#F39B9B] text-slate-950 text-xs font-black flex items-center justify-center shadow-lg">
          {pageNumber}
        </div>

        {/* Verse reference chip */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold">
          {verseRef}
        </div>

        {/* Share this page */}
        {onShare && (
          <button
            type="button"
            onClick={() => onShare(panel, verseRef)}
            aria-label={t("comics.sharePanelAria", { n: pageNumber })}
            title={t("comics.sharePanelTitle")}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/85 hover:text-white hover:bg-black/80 border border-white/10 transition-all"
          >
            <Share2 size={13} />
          </button>
        )}
      </div>

      {/* Localized text: title, dialogue captions, narration */}
      {(panel.title || narration || panel.captions.length > 0) && (
        <div className="p-3.5" dir={isRTL ? "rtl" : undefined}>
          {panel.title && (
            <p className="text-xs font-black text-[#FDE68A] leading-snug mb-1.5" style={{ fontSize: textSizePx }}>
              {panel.title}
            </p>
          )}
          {panel.captions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {panel.captions.map((c, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[10px] font-semibold text-[#C9C5DB]">
                  {c}
                </span>
              ))}
            </div>
          )}
          {narration && (
            <p
              className={`text-[#A09DB1] leading-relaxed ${expanded ? "" : "line-clamp-4"}`}
              style={{ fontSize: textSizePx }}
            >
              {narration}
            </p>
          )}
          {narration && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/25 text-[#A78BFA] text-[11px] font-bold hover:bg-[#7C3AED]/25 hover:text-white transition-all"
            >
              {expanded ? t("comics.showLess") : t("comics.readFullStory")}
              {expanded ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Story section wrapper ───────────────────────────────────────────────────

function StorySection({
  icon: Icon,
  heading,
  children,
  dir,
}: {
  icon: typeof BookOpen;
  heading: string;
  children: React.ReactNode;
  dir?: "rtl";
}) {
  return (
    <section className="mt-4 bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4" dir={dir}>
      <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#A78BFA] mb-2">
        <Icon size={13} className="text-[#F39B9B]" /> {heading}
      </h2>
      {children}
    </section>
  );
}

// ─── Related stories (same book) ─────────────────────────────────────────────

function RelatedStories({
  bookId,
  currentChapter,
  onOpen,
}: {
  bookId: string;
  currentChapter: number;
  onOpen: (bookId: string, chapter: number) => void;
}) {
  const t = useTranslation();
  const [related, setRelated] = useState<Array<{ comicId: string; bookId: string; chapter: number; title: string; coverArtUrl: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comic/list")
      .then((r) => (r.ok ? r.json() : { chapters: [] }))
      .then((d) => {
        if (cancelled) return;
        const list = (d.chapters || []).filter((c: any) => c.bookId === bookId && c.chapter !== currentChapter);
        setRelated(list.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bookId, currentChapter]);

  if (related.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2">
        {t("comicsReader.relatedHeading")}
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {related.map((r) => (
          <button
            key={r.comicId}
            onClick={() => onOpen(r.bookId, r.chapter)}
            className="shrink-0 w-36 text-left rounded-2xl bg-[#1C1929] border border-white/[0.06] hover:border-white/[0.18] overflow-hidden transition-all group"
          >
            <div className="relative w-full aspect-[16/9] bg-[#0f0e18]">
              {r.coverArtUrl ? (
                 
                <img src={r.coverArtUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" loading="lazy" decoding="async" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen size={16} className="text-[#475569]" />
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-[11px] font-bold text-white line-clamp-2 leading-snug">{r.title}</p>
              <p className="text-[9px] font-bold text-[#64748B] mt-0.5">
                {getBook(r.bookId)?.name || r.bookId} {r.chapter}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Action Button ──────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  sublabel,
  onClick,
  dimmed = false,
}: {
  icon: typeof BookOpen;
  label: string;
  sublabel: string;
  onClick: () => void;
  dimmed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
        dimmed
          ? "bg-white/[0.02] border-white/[0.04] text-[#475569] cursor-default"
          : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
      }`}
    >
      <Icon size={18} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      <span className="text-[8px] text-[#64748B] hidden lg:block">{sublabel}</span>
    </button>
  );
}

// ─── Chapter Video Action (kept from the original reader) ────────────────────

function ChapterVideoAction({ bookId, chapter }: { bookId: string; chapter: number }) {
  const t = useTranslation();
  const [videos, setVideos] = useState<Array<{ id: string; slug: string; title: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    setVideos([]);
    fetch(`/api/videos?book=${encodeURIComponent(bookId)}&chapter=${chapter}&take=2`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d) => {
        if (!cancelled) setVideos(d.videos || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [bookId, chapter]);

  if (videos.length === 0) return null;

  function open() {
    if (videos.length === 1) {
      window.location.href = `/videos/${videos[0].slug}`;
    } else {
      window.location.href = `/videos?book=${encodeURIComponent(bookId)}&chapter=${chapter}`;
    }
  }

  return (
    <ActionButton
      icon={Video}
      label={t("bible.watch")}
      sublabel={videos.length === 1 ? t("comics.watchOne") : t("comics.watchMany")}
      onClick={open}
    />
  );
}

// ─── Chapter Navigation (kept from the original reader) ──────────────────────

function ChapterNavigation({
  bookId,
  chapter,
  onNavigate,
}: {
  bookId: string;
  chapter: number;
  onNavigate: (bookId: string, chapter: number) => void;
}) {
  const t = useTranslation();
  const [availableChapters, setAvailableChapters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/comic/list")
      .then((r) => r.json())
      .then((data) => {
        const set = new Set<string>();
        (data.chapters || []).forEach((ch: any) => {
          set.add(`${ch.bookId}-${ch.chapter}`);
        });
        setAvailableChapters(set);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getAdjacentChapter = (direction: "prev" | "next") => {
    const book = BIBLE_BOOKS.find((b) => b.id === bookId);
    if (!book) return null;

    let nextChapter: number;
    let nextBookId: string = bookId;

    if (direction === "next") {
      if (chapter < book.chapters) {
        nextChapter = chapter + 1;
      } else {
        const idx = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
        if (idx < BIBLE_BOOKS.length - 1) {
          nextBookId = BIBLE_BOOKS[idx + 1].id;
          nextChapter = 1;
        } else {
          return null;
        }
      }
    } else {
      if (chapter > 1) {
        nextChapter = chapter - 1;
      } else {
        const idx = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
        if (idx > 0) {
          nextBookId = BIBLE_BOOKS[idx - 1].id;
          nextChapter = BIBLE_BOOKS[idx - 1].chapters;
        } else {
          return null;
        }
      }
    }

    return { bookId: nextBookId, chapter: nextChapter };
  };

  const prevChapter = getAdjacentChapter("prev");
  const nextChapter = getAdjacentChapter("next");

  const hasPrevComic = prevChapter ? availableChapters.has(`${prevChapter.bookId}-${prevChapter.chapter}`) : false;
  const hasNextComic = nextChapter ? availableChapters.has(`${nextChapter.bookId}-${nextChapter.chapter}`) : false;

  if (loading) return null;

  const formatLabel = (bid: string, ch: number) => {
    const book = BIBLE_BOOKS.find((b) => b.id === bid);
    return `${book?.name || bid} ${ch}`;
  };

  return (
    <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-white/[0.04]">
      {prevChapter ? (
        <button
          onClick={() => {
            if (hasPrevComic) {
              onNavigate(prevChapter.bookId, prevChapter.chapter);
            } else {
              toast(t("comics.comingSoonToast"), {
                description: t("comics.comingSoonDesc", { ref: formatLabel(prevChapter.bookId, prevChapter.chapter) }),
              });
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            hasPrevComic
              ? "bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white"
              : "bg-white/[0.02] border border-white/[0.04] text-[#475569] cursor-not-allowed"
          }`}
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">{formatLabel(prevChapter.bookId, prevChapter.chapter)}</span>
          <span className="sm:hidden">{t("bible.prev")}</span>
          {!hasPrevComic && <span className="text-[8px] text-[#F59E0B] ml-1">{t("comics.soonBadge")}</span>}
        </button>
      ) : (
        <div />
      )}

      {nextChapter ? (
        <button
          onClick={() => {
            if (hasNextComic) {
              onNavigate(nextChapter.bookId, nextChapter.chapter);
            } else {
              toast(t("comics.comingSoonToast"), {
                description: t("comics.comingSoonDesc", { ref: formatLabel(nextChapter.bookId, nextChapter.chapter) }),
              });
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            hasNextComic
              ? "bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white"
              : "bg-white/[0.02] border border-white/[0.04] text-[#475569] cursor-not-allowed"
          }`}
        >
          {!hasNextComic && <span className="text-[8px] text-[#F59E0B] mr-1">{t("comics.soonBadge")}</span>}
          <span className="hidden sm:inline">{formatLabel(nextChapter.bookId, nextChapter.chapter)}</span>
          <span className="sm:hidden">{t("common.next")}</span>
          <ChevronRight size={14} />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

// ─── Comic Quiz Modal (kept from the original reader) ────────────────────────

function ComicQuizModal({
  chapterId,
  questions,
  loading,
  lang,
  onClose,
}: {
  chapterId: string;
  questions: any[];
  loading: boolean;
  lang: string;
  onClose: () => void;
}) {
  const { isAuthenticated } = useSupabaseUser();
  const t = useTranslation();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleAnswer = (questionId: string, selectedAnswer: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selectedAnswer }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const answerArray = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
        questionId,
        selectedAnswer,
      }));
      const res = await fetch(`/api/comic/quiz/${chapterId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "EARN_POINTS", answers: answerArray }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data);
    } catch (e: any) {
      toast.error(t("comics.quizSubmitFailed"), { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[70] p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <Loader2 size={32} className="text-[#F39B9B] animate-spin" />
      </motion.div>
    );
  }

  if (questions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[70] p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-[#1C1929] border border-white/[0.08] rounded-2xl p-6 max-w-sm text-center">
          <Brain size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">{t("comics.quizEmpty")}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-white/[0.04] text-xs font-bold text-[#94A3B8]">
            {t("common.close")}
          </button>
        </div>
      </motion.div>
    );
  }

  // Results screen
  if (results) {
    const correctCount = results.correctCount || 0;
    const totalQ = results.totalQuestions || questions.length;
    const pointsEarned = results.totalPointsEarned || 0;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[70] p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="bg-[#1C1929] border border-[#F59E0B]/20 rounded-2xl p-6 max-w-md w-full"
        >
          <h2 className="text-xl font-extrabold text-white mb-2">{t("triviaView.results.title")}</h2>
          <p className="text-sm text-[#A09DB1] mb-4">
            {t("triviaView.results.correct", { count: correctCount, total: totalQ })}
            {pointsEarned > 0 && <span className="text-[#F59E0B] font-bold"> {t("comics.fpEarnedSuffix", { n: pointsEarned })}</span>}
          </p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {results.questionResults?.map((qr: any, i: number) => (
              <div
                key={i}
                className={`p-2 rounded-lg border text-xs ${
                  qr.correct ? "bg-[#22C55E]/10 border-[#22C55E]/20" : "bg-[#EF4444]/10 border-[#EF4444]/20"
                }`}
              >
                <p className="font-bold text-white">{qr.questionId}</p>
                <p className="text-[#94A3B8]">{qr.correct ? t("comics.answerCorrect") : t("comics.answerIncorrect")}</p>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl bg-[#F59E0B] text-slate-950 text-sm font-bold">
            {t("common.done")}
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // Quiz question screen
  const q = questions[currentQ];
  const isAnswered = answers[q.id] !== undefined;

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
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-md max-h-[85vh] overflow-y-auto p-5"
      >
        <div className="flex justify-between items-center mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">
            {t("comics.quizProgress", { n: currentQ + 1, t: questions.length })}
          </p>
          <button onClick={onClose}>
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        <p className="text-sm font-bold text-white mb-3">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt: string, idx: number) => (
            <button
              key={idx}
              onClick={() => handleAnswer(q.id, idx)}
              className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                answers[q.id] === idx
                  ? "bg-[#7C3AED]/15 border-[#7C3AED]/40 text-white"
                  : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          {currentQ > 0 && (
            <button
              onClick={() => setCurrentQ(currentQ - 1)}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8]"
            >
              {t("common.back")}
            </button>
          )}
          {currentQ < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(currentQ + 1)}
              disabled={!isAnswered}
              className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white text-sm font-bold disabled:opacity-30"
            >
              {t("common.next")}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(answers).length < questions.length}
              className="flex-1 py-2.5 rounded-xl bg-[#F59E0B] text-slate-950 text-sm font-bold disabled:opacity-30"
            >
              {submitting ? t("comics.submitting") : t("comics.submitQuiz")}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
