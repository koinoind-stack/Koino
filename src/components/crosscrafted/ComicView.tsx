"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Brain,
  Heart,
  MessageCircle,
  Loader2,
  X,
  AlertCircle,
  Headphones,
  Video,
  Zap,
  Share2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────

type ComicPanel = {
  panelId: string;
  sortOrder: number;
  artworkUrl: string;
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

type ComicChapter = {
  id: string;
  comicId: string;
  bookId: string;
  chapter: number;
  title: string;
  coverArtUrl: string | null;
  sortOrder: number;
  panels: ComicPanel[];
  titleIsFallback: boolean;
};

// ─── Component ─────────────────────────────────────────────────────────────

type Props = {
  bookId: string;
  chapter: number;
  onNavigateChapter: (bookId: string, chapter: number) => void;
  onReadChapter: (bookId: string, chapter: number) => void;
  onPray: (prayerPrompt: string) => void;
  onDiscuss: (topic: string) => void;
};

export default function ComicView({ bookId, chapter, onNavigateChapter, onReadChapter, onPray, onDiscuss }: Props) {
  const { lang } = useLanguage();
  const { isAuthenticated } = useSupabaseUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterData, setChapterData] = useState<ComicChapter | null>(null);

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);

  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Load comic chapter
  const loadComic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comic/${bookId}/${chapter}?lang=${lang}`);
      const text = await res.text();
      if (!text) {
        throw new Error("Empty response from server");
      }
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || "Failed to load comic");
      setChapterData(data.chapter);
    } catch (e: any) {
      setError(e.message || "Failed to load comic");
    } finally {
      setLoading(false);
    }
  }, [bookId, chapter, lang]);

  useEffect(() => {
    loadComic();
  }, [loadComic]);

  // ─── Listen (TTS) ─────────────────────────────────────────────────────────

  const handleListen = () => {
    if (!chapterData) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Combine all panel narrations into one speech
    const fullNarration = chapterData.panels
      .map((p, i) => `Panel ${i + 1}. ${p.title}. ${p.narration || ""}`)
      .join(" ");

    const utterance = new SpeechSynthesisUtterance(fullNarration);
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    toast("Audio narration", {
      description: "Using browser voice synthesis. Professional audio coming soon.",
    });
  };

  // ─── Share ────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!chapterData) return;
    const shareUrl = `${window.location.origin}/?comic=${chapterData.bookId}/${chapterData.chapter}`;
    const shareText = `${chapterData.title} — Koino Bible Comics\n\nRead the story. See the bigger picture. Grow in your faith.\n\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Koino Bible Comics — ${chapterData.title}`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Link copied!", { description: chapterData.title });
    }
  };

  // ─── Quiz ────────────────────────────────────────────────────────────────

  const startQuiz = async () => {
    if (!chapterData) return;
    if (!isAuthenticated) {
      toast.error("Sign in required to take quizzes");
      return;
    }
    setShowQuiz(true);
    setQuizLoading(true);
    try {
      const res = await fetch(
        `/api/comic/quiz/${chapterData.id}?lang=${lang}&mode=EARN_POINTS`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuizQuestions(data.questions || []);
    } catch (e: any) {
      toast.error("Failed to load quiz", { description: e.message });
    } finally {
      setQuizLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
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
        <p className="text-sm text-[#94A3B8]">{error || "Comic not found"}</p>
        <button onClick={loadComic} className="mt-4 px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold">
          Retry
        </button>
      </div>
    );
  }

  const bookName = bookId.charAt(0).toUpperCase() + bookId.slice(1);
  const panels = chapterData.panels;

  // Get prayer prompt from first panel's captions
  const prayerPrompt = panels[0]?.captions?.[0] ||
    `Lord, thank You for the story of ${chapterData.title}. Help me grow in faith through Your Word.`;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-5 pb-28 md:pb-5">
      {/* ─── HEADER ─── */}
      <div className="text-center mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F39B9B] mb-2">
          BIBLE COMICS
        </p>
        <h1 className="text-3xl font-black text-white mb-1">
          {bookName} {chapter}
        </h1>
        <p className="text-lg text-[#A09DB1] font-semibold mb-2">
          {chapterData.title}
        </p>
        <p className="text-xs text-[#64748B]">
          Read the story • See the bigger picture • Grow in your faith
        </p>
      </div>

      {/* ─── COMIC PANEL GRID (3×2 on desktop, stacked on mobile) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {panels.map((panel, idx) => (
          <ComicPanelCard
            key={panel.panelId}
            panel={panel}
            index={idx + 1}
            bookName={bookName}
            chapterNum={chapter}
            onReadVerse={onReadChapter}
            bookId={bookId}
            chapter={chapter}
          />
        ))}
      </div>

      {/* ─── BOTTOM ACTION BAR ─── */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <ActionButton icon={BookOpen} label="Read" sublabel="The full comic story" onClick={() => onReadChapter(bookId, chapter)} />
          <ActionButton icon={isSpeaking ? X : Headphones} label={isSpeaking ? "Stop" : "Listen"} sublabel="Audio narration" onClick={handleListen} />
          <ActionButton icon={Video} label="Watch" sublabel="Animated version" onClick={() => toast("Coming Soon", { description: "Animated version is being prepared." })} dimmed />
          <ActionButton icon={Brain} label="Quiz" sublabel="Test your knowledge" onClick={startQuiz} />
          <ActionButton icon={Zap} label="Earn FP" sublabel="Get Faith Points" onClick={() => toast("Take the quiz to earn FP!")} dimmed />
          <ActionButton icon={Heart} label="Pray" sublabel="Daily prayer" onClick={() => onPray(prayerPrompt)} />
          <ActionButton icon={MessageCircle} label="Discuss" sublabel="Join the community" onClick={() => onDiscuss(`What stands out to you in ${bookName} ${chapter}?`)} dimmed />
        </div>
      </div>

      {/* ─── CHAPTER NAVIGATION ─── */}
      <ChapterNavigation bookId={bookId} chapter={chapter} onNavigate={onNavigateChapter} />

      {/* ─── SHARE / DOWNLOAD ─── */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleShare}
          className="flex-1 py-2.5 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#7C3AED]/25 transition-all"
        >
          <Share2 size={14} /> Share Chapter
        </button>
      </div>

      {/* ─── QUIZ MODAL ─── */}
      <AnimatePresence>
        {showQuiz && (
          <ComicQuizModal
            chapterId={chapterData.id}
            questions={quizQuestions}
            loading={quizLoading}
            lang={lang}
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

// ─── Comic Panel Card ───────────────────────────────────────────────────────

function ComicPanelCard({
  panel,
  index,
  bookName,
  chapterNum,
  onReadVerse,
  bookId,
  chapter,
}: {
  panel: ComicPanel;
  index: number;
  bookName: string;
  chapterNum: number;
  onReadVerse: (bookId: string, chapter: number) => void;
  bookId: string;
  chapter: number;
}) {
  const verseRef = `${bookName} ${chapterNum}:${panel.verseStart}-${panel.verseEnd}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col"
    >
      {/* ─── ARTWORK with overlays ─── */}
      <div className="relative w-full aspect-[16/9] bg-[#0f0f1a] overflow-hidden">
        <img
          src={panel.artworkUrl}
          alt={panel.title || `Panel ${index}`}
          className="w-full h-full object-cover"
        />

        {/* Top gradient (for overlay legibility) */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Bottom gradient (for verse reference legibility) */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Panel number + title OVERLAID on top of artwork (top-left) */}
        <div className="absolute top-3 left-3 right-3 flex items-start gap-2">
          <span
            className="shrink-0 w-7 h-7 rounded-full bg-[#F39B9B] text-slate-950 text-xs font-black flex items-center justify-center shadow-lg"
            aria-label={`Panel ${index}`}
          >
            {index}
          </span>
          <h3 className="text-sm font-bold text-white leading-tight drop-shadow-md line-clamp-2">
            {panel.title}
          </h3>
        </div>

        {/* Verse reference OVERLAID near bottom-right of artwork */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold">
          {verseRef}
        </div>
      </div>

      {/* ─── Narration below artwork ─── */}
      <div className="p-3 flex-1">
        <p className="text-[12px] text-[#A09DB1] leading-relaxed line-clamp-3">
          {panel.narration}
        </p>
      </div>
    </motion.div>
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

// ─── Chapter Navigation ──────────────────────────────────────────────────────

function ChapterNavigation({
  bookId,
  chapter,
  onNavigate,
}: {
  bookId: string;
  chapter: number;
  onNavigate: (bookId: string, chapter: number) => void;
}) {
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
    const books = require("@/lib/bible-data").BIBLE_BOOKS as typeof import("@/lib/bible-data").BIBLE_BOOKS;
    const book = books.find((b) => b.id === bookId);
    if (!book) return null;

    let nextChapter: number;
    let nextBookId: string = bookId;

    if (direction === "next") {
      if (chapter < book.chapters) {
        nextChapter = chapter + 1;
      } else {
        const idx = books.findIndex((b) => b.id === bookId);
        if (idx < books.length - 1) {
          nextBookId = books[idx + 1].id;
          nextChapter = 1;
        } else {
          return null;
        }
      }
    } else {
      if (chapter > 1) {
        nextChapter = chapter - 1;
      } else {
        const idx = books.findIndex((b) => b.id === bookId);
        if (idx > 0) {
          nextBookId = books[idx - 1].id;
          nextChapter = books[idx - 1].chapters;
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
    const books = require("@/lib/bible-data").BIBLE_BOOKS as typeof import("@/lib/bible-data").BIBLE_BOOKS;
    const book = books.find((b) => b.id === bid);
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
              toast("Coming Soon", {
                description: `${formatLabel(prevChapter.bookId, prevChapter.chapter)} comic is being prepared.`,
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
          <span className="sm:hidden">Prev</span>
          {!hasPrevComic && <span className="text-[8px] text-[#F59E0B] ml-1">Soon</span>}
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
              toast("Coming Soon", {
                description: `${formatLabel(nextChapter.bookId, nextChapter.chapter)} comic is being prepared.`,
              });
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            hasNextComic
              ? "bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white"
              : "bg-white/[0.02] border border-white/[0.04] text-[#475569] cursor-not-allowed"
          }`}
        >
          {!hasNextComic && <span className="text-[8px] text-[#F59E0B] mr-1">Soon</span>}
          <span className="hidden sm:inline">{formatLabel(nextChapter.bookId, nextChapter.chapter)}</span>
          <span className="sm:hidden">Next</span>
          <ChevronRight size={14} />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

// ─── Comic Quiz Modal ─────────────────────────────────────────────────────────

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
      toast.error("Failed to submit quiz", { description: e.message });
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
          <p className="text-sm text-[#94A3B8]">No quiz questions available for this chapter yet.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-white/[0.04] text-xs font-bold text-[#94A3B8]">
            Close
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
          <h2 className="text-xl font-extrabold text-white mb-2">Quiz Complete!</h2>
          <p className="text-sm text-[#A09DB1] mb-4">
            Correct: {correctCount}/{totalQ}
            {pointsEarned > 0 && <span className="text-[#F59E0B] font-bold"> · {pointsEarned} FP earned!</span>}
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
                <p className="text-[#94A3B8]">{qr.correct ? "✓ Correct" : "✗ Incorrect"}</p>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl bg-[#F59E0B] text-slate-950 text-sm font-bold">
            Done
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
            Comic Quiz · {currentQ + 1}/{questions.length}
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
              Back
            </button>
          )}
          {currentQ < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(currentQ + 1)}
              disabled={!isAnswered}
              className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white text-sm font-bold disabled:opacity-30"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(answers).length < questions.length}
              className="flex-1 py-2.5 rounded-xl bg-[#F59E0B] text-slate-950 text-sm font-bold disabled:opacity-30"
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
