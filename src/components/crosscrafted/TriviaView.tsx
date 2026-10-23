"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  Check,
  X,
  Flame,
  Trophy,
  Play,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Clock,
  Target,
  Crown,
  Share2,
  BookOpen,
  Cross,
  Scroll,
  Shield,
  UserPlus,
  Users,
  Gift,
  Calendar,
  Zap,
  BookMarked,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Tag,
  Palette,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  QUIZ_LEVELS,
  QUIZ_CATEGORIES,
  type TriviaQuestion,
} from "@/lib/crosscrafted-data";
import StreakBadge from "@/components/crosscrafted/StreakBadge";
import GamificationPanel from "@/components/crosscrafted/GamificationPanel";
import LevelUpAnimation from "@/components/crosscrafted/LevelUpAnimation";
import CompetitionQuizView, { CompetitionResultView } from "@/components/crosscrafted/CompetitionQuizView";
import CompetitionLeaderboard from "@/components/crosscrafted/CompetitionLeaderboard";
import { useTriviaApi } from "@/lib/trivia-api";

const TIMER_SECONDS: Record<string, number> = {
  beginners: 30,
  intermediate: 20,
  skilled: 15,
  expert: 10,
};

type QuizMode = "EARN_POINTS" | "PRACTICE";
type GameState = "setup" | "playing" | "result";

type ServerQuestion = {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
  category: string;
  basePoints: number;
  scriptureReference: string | null;
};

type SubmitResult = {
  mode: string;
  totalPointsEarned: number;
  correctCount: number;
  totalQuestions: number;
  newTotalPoints: number;
  bestStreak?: number;
  questionResults: {
    questionId: string;
    correct: boolean;
    pointsAwarded: number;
    alreadyScored: boolean;
    streakBonus: number;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    scriptureReference: string | null;
  }[];
};

export default function TriviaView() {
  const { user, isAuthenticated, points: userPoints } = useSupabaseUser();
  const t = useTranslation();
  const api = useTriviaApi();

  const [selectedLevel, setSelectedLevel] = useState<(typeof QUIZ_LEVELS)[number] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<(typeof QUIZ_CATEGORIES)[number] | null>(null);
  const [quizMode, setQuizMode] = useState<number>(10);

  // Map quiz level IDs to translation keys (the source data has English labels)
  const levelLabel = (id: string) => {
    switch (id) {
      case "beginners": return t("triviaView.setup.level.beginner");
      case "intermediate": return t("triviaView.setup.level.intermediate");
      case "skilled": return t("triviaView.setup.level.skilled");
      case "expert": return t("triviaView.setup.level.expert");
      default: return id;
    }
  };
  const categoryLabel = (id: string) => {
    switch (id) {
      case "full_bible": return t("triviaView.setup.cat.full");
      case "new_testament": return t("triviaView.setup.cat.nt");
      case "old_testament": return t("triviaView.setup.cat.ot");
      case "apologetics": return t("triviaView.setup.cat.apologetics");
      default: return id;
    }
  };
  const [gameMode, setGameMode] = useState<QuizMode>("EARN_POINTS");
  const [gameState, setGameState] = useState<GameState>("setup");
  const [questions, setQuestions] = useState<ServerQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [activeTab, setActiveTab] = useState<"play" | "compete" | "rewards" | "leaderboard" | "stats">("play");
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizSession, setQuizSession] = useState<{ difficulty: string; category: string; mode: QuizMode } | null>(null);
  const [answers, setAnswers] = useState<{ questionId: string; selectedAnswer: number }[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Timer effect
  useEffect(() => {
    if (gameState !== "playing" || showExplanation) return;
    if (timeLeft <= 0) {
      handleTimeUp();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, showExplanation, currentQ]);

  const handleTimeUp = useCallback(() => {
    if (selectedAnswer !== null) return;
    setShowExplanation(true);
    setTimeout(() => advanceQuestion(), 2500);
  }, [selectedAnswer]);

  const startQuiz = async () => {
    if (!selectedLevel || !selectedCategory) {
      toast.error("Please select a level and category");
      return;
    }

    // EARN_POINTS mode requires auth
    if (gameMode === "EARN_POINTS" && !isAuthenticated) {
      toast.error("Sign in required to earn Faith Points", {
        description: "Switch to Practice Mode or sign in to start earning.",
      });
      return;
    }

    try {
      const result = await api.startQuiz({
        difficulty: selectedLevel.id,
        category: selectedCategory.id,
        count: quizMode,
        mode: gameMode,
      });

      if (!result.questions || result.questions.length === 0) {
        toast.error("No questions available for this combination", {
          description: "Try another level or category.",
        });
        return;
      }

      setQuestions(result.questions);
      setNewCount(result.newCount || 0);
      setTotalCount(result.totalCount || 0);
      setCurrentQ(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setAnswers([]);
      setSubmitResult(null);
      setGameState("playing");
      setTimeLeft(TIMER_SECONDS[selectedLevel.id]);

      setQuizSession({
        difficulty: selectedLevel.id,
        category: selectedCategory.id,
        mode: gameMode,
      });

      if (gameMode === "EARN_POINTS" && result.newCount < result.questions.length) {
        toast(`Only ${result.newCount} new questions available`, {
          description: `You'll earn points for ${result.newCount} new questions. The rest are already mastered.`,
        });
      }
    } catch (e: any) {
      toast.error("Failed to start quiz", { description: e.message });
    }
  };

  const handleAnswer = (answerIdx: number) => {
    if (showExplanation) return; // Can't change after confirming
    setSelectedAnswer(answerIdx);
    setShowExplanation(true);

    const q = questions[currentQ];
    // Update or add the answer for this question
    setAnswers((prev) => {
      const existingIdx = prev.findIndex((a) => a.questionId === q.id);
      if (existingIdx >= 0) {
        // Update existing answer
        const updated = [...prev];
        updated[existingIdx] = { questionId: q.id, selectedAnswer: answerIdx };
        return updated;
      }
      // Add new answer
      return [...prev, { questionId: q.id, selectedAnswer: answerIdx }];
    });
  };

  // Let user change their answer before seeing the explanation
  const changeAnswer = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    // Remove the answer for this question so it can be re-added
    const q = questions[currentQ];
    setAnswers((prev) => prev.filter((a) => a.questionId !== q.id));
  };

  const advanceQuestion = () => {
    if (currentQ + 1 >= questions.length) {
      finishQuiz();
    } else {
      setCurrentQ((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      if (selectedLevel) setTimeLeft(TIMER_SECONDS[selectedLevel.id]);
    }
  };

  const finishQuiz = async () => {
    if (!quizSession) return;
    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true); // Lock — prevent duplicate submits

    try {
      const result = await api.submitQuiz({
        difficulty: quizSession.difficulty,
        category: quizSession.category,
        mode: quizSession.mode,
        answers,
      });

      // IMMEDIATELY show the result — don't wait for streaks/toasts
      setSubmitResult(result);
      setGameState("result");

      // Secondary operations (non-blocking — don't await)
      if (result.mode === "EARN_POINTS") {
        // Record localStorage streak (fire-and-forget)
        try {
          const streaksRaw = localStorage.getItem("crosscrafted_streaks") || "{}";
          const before = JSON.parse(streaksRaw);
          const prevDate = before?.trivia_play?.lastActiveDate;
          const today = new Date().toISOString().split("T")[0];
          if (prevDate !== today) {
            import("@/lib/streaks").then(({ recordStreak }) => {
              const info = recordStreak("trivia_play");
              if (info.currentStreak === 1) {
                toast("🔥 Trivia streak started!", { description: "Play daily to keep it alive." });
              } else if ([3, 7, 14, 30, 60, 90].includes(info.currentStreak)) {
                toast.success(`🔥 ${info.currentStreak}-day trivia streak!`);
              }
            });
          }
        } catch {}

        // Show FP toast (non-blocking)
        if (result.totalPointsEarned > 0) {
          toast.success(`+${result.totalPointsEarned} Faith Points earned!`, {
            description: `Your verified balance: ${result.newTotalPoints} FP`,
          });
        } else {
          toast("0 Faith Points earned", {
            description: "You've already mastered all these questions. Try Practice Mode or a different category.",
          });
        }
      }
    } catch (e: any) {
      toast.error("Failed to submit quiz", { description: e.message });
      setGameState("setup");
    } finally {
      setIsSubmitting(false); // Always release the lock
    }
  };

  const shareResults = async () => {
    if (!submitResult) return;
    const text = `${t("triviaView.title")} ${gameMode === "EARN_POINTS" ? `(${t("triviaView.setup.mode.earn")})` : `(${t("triviaView.setup.mode.practice")})`}!\n\n${t("triviaView.results.correct", { count: submitResult.correctCount, total: submitResult.totalQuestions })}\n${gameMode === "EARN_POINTS" ? `${t("triviaView.results.pointsEarned", { points: submitResult.totalPointsEarned })}\n` : ""}Level: ${selectedLevel ? levelLabel(selectedLevel.id) : ""} | ${t("triviaView.setup.category")}: ${selectedCategory ? categoryLabel(selectedCategory.id) : ""}\n\n${t("triviaView.results.shareText", { correct: submitResult.correctCount, total: submitResult.totalQuestions })}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Koino Bible Trivia", text });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard!");
  };

  const inviteFriend = async () => {
    const text = `Hey! Come play Bible Trivia with me on Koino. ${gameMode === "EARN_POINTS" ? "Earn Faith Points for new questions you answer correctly!" : ""}`;
    const url = `${window.location.origin}/`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Koino", text, url });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(`${text}\n\n${url}`);
    toast.success("Invite link copied!");
  };

  const resetGame = () => {
    setGameState("setup");
    setSelectedLevel(null);
    setSelectedCategory(null);
    setQuestions([]);
    setAnswers([]);
    setSubmitResult(null);
    setQuizSession(null);
  };

  const currentQuestion = questions[currentQ];

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t("triviaView.title")}</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            {isAuthenticated
              ? t("triviaView.verified", { points: userPoints || 0 })
              : t("triviaView.signInPrompt")}
          </p>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/25">
            <Trophy size={14} className="text-[#F59E0B]" />
            <span className="text-xs font-bold text-[#F59E0B]">{t("common.faithPoints", { count: (userPoints || 0).toLocaleString() })}</span>
          </div>
        )}
      </div>

      {/* Auth banner */}
      {!isAuthenticated && (
        <div className="bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3 mb-4 flex items-center gap-3">
          <LogIn size={18} className="text-[#38BDF8] shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-white">{t("triviaView.signInPrompt")}</p>
            <p className="text-[10px] text-[#A09DB1]">Practice Mode is available without signing in.</p>
          </div>
          <a
            href="/auth/signin"
            className="px-3 py-1.5 rounded-lg bg-[#38BDF8] text-slate-950 text-xs font-bold hover:bg-[#0EA5E9] transition-all"
          >
            Sign In
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl mb-5 overflow-x-auto">
        {([
          { id: "play", label: t("triviaView.tab.play") },
          { id: "compete", label: t("triviaView.tab.compete") },
          { id: "rewards", label: t("triviaView.tab.rewards") },
          { id: "leaderboard", label: t("triviaView.tab.leaderboard") },
          { id: "stats", label: t("triviaView.tab.stats") },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/25"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "play" && (
          <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LevelUpAnimation totalPoints={userPoints || 0} />
            {gameState === "setup" && (
              <div className="space-y-5">
                <StreakBadge activity="trivia_play" />

                {/* Daily Challenge + Spin + Badges */}
                <GamificationPanel isAuthenticated={isAuthenticated} />

                {/* Mode toggle */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Quiz Mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGameMode("EARN_POINTS")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        gameMode === "EARN_POINTS"
                          ? "bg-[#7C3AED]/15 border-[#7C3AED]/50"
                          : "bg-white/[0.03] border-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy size={14} className={gameMode === "EARN_POINTS" ? "text-[#A78BFA]" : "text-[#94A3B8]"} />
                        <p className="text-sm font-bold text-white">🎯 Earn Points</p>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                        New questions award Faith Points. Already-mastered questions give 0 FP.
                      </p>
                      {!isAuthenticated && (
                        <p className="text-[9px] text-[#F59E0B] mt-1">⚠ Sign in required</p>
                      )}
                    </button>
                    <button
                      onClick={() => setGameMode("PRACTICE")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        gameMode === "PRACTICE"
                          ? "bg-[#38BDF8]/15 border-[#38BDF8]/50"
                          : "bg-white/[0.03] border-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen size={14} className={gameMode === "PRACTICE" ? "text-[#38BDF8]" : "text-[#94A3B8]"} />
                        <p className="text-sm font-bold text-white">📖 Practice</p>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                        Unlimited replays. No points earned. Learn freely.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Level Selection */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">{t("triviaView.setup.difficulty")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUIZ_LEVELS.map((lvl) => {
                      const selected = selectedLevel?.id === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          onClick={() => setSelectedLevel(lvl)}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            selected ? "border-transparent text-white" : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"
                          }`}
                          style={selected ? { background: `${lvl.color}20`, borderColor: `${lvl.color}80` } : {}}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-2xl">{lvl.icon}</span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${lvl.color}25`, color: lvl.color }}
                            >
                              {lvl.points} FP
                            </span>
                          </div>
                          <p className="text-sm font-bold text-white">{levelLabel(lvl.id)}</p>
                          <p className="text-[10px] text-[#94A3B8]">{lvl.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Selection */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">{t("triviaView.setup.category")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUIZ_CATEGORIES.map((cat) => {
                      const selected = selectedCategory?.id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat)}
                          className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                            selected ? "border-transparent text-white" : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"
                          }`}
                          style={selected ? { background: `${cat.color}20`, borderColor: `${cat.color}80` } : {}}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                          >
                            {cat.icon === "BookOpen" && <BookOpen size={16} />}
                            {cat.icon === "Cross" && <Cross size={16} />}
                            {cat.icon === "Scroll" && <Scroll size={16} />}
                            {cat.icon === "Shield" && <Shield size={16} />}
                          </div>
                          <p className="text-sm font-bold text-white">{categoryLabel(cat.id)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quiz Length */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Quiz Length</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 15].map((n) => (
                      <button
                        key={n}
                        onClick={() => setQuizMode(n)}
                        className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                          quizMode === n
                            ? "bg-[#7C3AED] text-white"
                            : "bg-white/[0.03] border border-white/[0.06] text-[#94A3B8] hover:text-white"
                        }`}
                      >
                        {n} Qs
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startQuiz}
                  disabled={api.loading || (gameMode === "EARN_POINTS" && !isAuthenticated)}
                  className="w-full py-3.5 rounded-2xl text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white hover:-translate-y-px"
                  style={{
                    background: gameMode === "EARN_POINTS"
                      ? "linear-gradient(135deg, #7C3AED, #EC4899)"
                      : "linear-gradient(135deg, #38BDF8, #A855F7)",
                    boxShadow: gameMode === "EARN_POINTS"
                      ? "0 4px 16px rgba(124,58,237,0.3)"
                      : "0 4px 16px rgba(56,189,248,0.3)",
                  }}
                >
                  {api.loading ? (
                    "Loading..."
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      {gameMode === "EARN_POINTS" ? "Start Earning Points" : "Start Practice"}
                    </>
                  )}
                </button>
              </div>
            )}

            {gameState === "playing" && currentQuestion && (
              <div className="space-y-4">
                {/* Progress */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    Question {currentQ + 1} / {questions.length}
                  </span>
                  {gameMode === "EARN_POINTS" && newCount > 0 && (
                    <span className="text-[#22C55E] font-bold text-[10px]">
                      {newCount} new · {totalCount - newCount} mastered
                    </span>
                  )}
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: gameMode === "EARN_POINTS" ? "linear-gradient(90deg, #7C3AED, #EC4899)" : "linear-gradient(90deg, #38BDF8, #A855F7)" }}
                    animate={{ width: `${((currentQ + (showExplanation ? 1 : 0)) / questions.length) * 100}%` }}
                  />
                </div>

                {/* Timer */}
                <div className="flex items-center gap-2">
                  <Clock size={14} className={timeLeft <= 5 ? "text-[#EF4444]" : "text-[#A855F7]"} />
                  <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${timeLeft <= 5 ? "bg-[#EF4444]" : "bg-[#A855F7]"}`}
                      animate={{ width: `${(timeLeft / (selectedLevel ? TIMER_SECONDS[selectedLevel.id] : 30)) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                    {timeLeft}s
                  </span>
                </div>

                {/* Mode badge */}
                {gameMode === "PRACTICE" && (
                  <div className="bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl px-3 py-1.5">
                    <p className="text-[10px] font-bold text-[#38BDF8] uppercase tracking-wider">📖 Practice Mode — 0 FP</p>
                  </div>
                )}

                {/* Question */}
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        backgroundColor: `${selectedLevel?.color}25`,
                        color: selectedLevel?.color,
                      }}
                    >
                      {selectedLevel ? `${levelLabel(selectedLevel.id)} · ${selectedLevel.points} FP` : ""}
                    </span>
                  </div>
                  <p className="text-base font-bold text-white leading-relaxed mb-4">
                    {currentQuestion.question}
                  </p>

                  <div className="space-y-2">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = idx === selectedAnswer;
                      let cls = "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 ";

                      if (selectedAnswer === null) {
                        // Not answered yet — normal state
                        cls += "bg-white/[0.03] border-white/[0.06] text-[#A09DB1] hover:bg-white/[0.06] hover:text-white";
                      } else if (isSelected) {
                        // Selected answer — strong highlight
                        cls += "bg-[#7C3AED] border-[#7C3AED] text-white";
                      } else {
                        // Not selected after answering — dim
                        cls += "bg-white/[0.02] border-white/[0.04] text-[#64748B] opacity-50";
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(idx)}
                          disabled={showExplanation}
                          className={cls}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                isSelected
                                  ? "bg-white/30 text-white"
                                  : "bg-white/[0.06] text-[#94A3B8]"
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            {opt}
                            {isSelected && (
                              <Check size={14} className="ml-auto text-white" />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Change answer button — lets user pick a different answer before confirming */}
                  {selectedAnswer !== null && !showExplanation && (
                    <button
                      onClick={changeAnswer}
                      className="mt-2 text-[11px] text-[#94A3B8] hover:text-white transition-colors"
                    >
                      ← Change answer
                    </button>
                  )}

                  <AnimatePresence>
                    {showExplanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 overflow-hidden"
                      >
                        {/* Points indicator */}
                        {gameMode === "EARN_POINTS" && (
                          <div className="bg-[#7C3AED]/8 border border-[#7C3AED]/20 rounded-xl p-3 mb-2">
                            <p className="text-[10px] text-[#A09DB1]">
                              Points will be calculated server-side after quiz submission.
                            </p>
                          </div>
                        )}
                        <div className="bg-[#7C3AED]/8 border border-[#7C3AED]/20 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles size={12} className="text-[#A78BFA]" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">
                              {gameMode === "EARN_POINTS" ? "Answer Locked" : "Answer Selected"}
                            </p>
                          </div>
                          <p className="text-xs text-[#A09DB1] leading-relaxed">
                            {gameMode === "EARN_POINTS"
                              ? "Your answer is locked. The correct answer and explanation will be revealed after you submit the quiz."
                              : "Your answer is selected. Click Next to continue."}
                          </p>
                          {currentQuestion.scriptureReference && (
                            <p className="text-[10px] text-[#64748B] mt-1">
                              Related Scripture: {currentQuestion.scriptureReference}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={advanceQuestion}
                          className="w-full mt-3 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                          {currentQ + 1 >= questions.length ? t("triviaView.playing.submit") : t("triviaView.playing.next")}
                          <ArrowRight size={14} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}

            {gameState === "result" && submitResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-5 py-6"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/20 border border-[#F59E0B]/30 mb-2">
                  {gameMode === "EARN_POINTS" ? (
                    <Trophy size={36} className="text-[#F59E0B]" />
                  ) : (
                    <BookOpen size={36} className="text-[#38BDF8]" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white mb-1">
                    {gameMode === "EARN_POINTS" ? t("triviaView.results.title") : t("triviaView.results.title")}
                  </h2>
                  <p className="text-sm text-[#94A3B8]">
                    {gameMode === "EARN_POINTS"
                      ? submitResult.totalPointsEarned > 0
                        ? `You earned ${submitResult.totalPointsEarned} Faith Points!`
                        : "No new points — you've already mastered these questions."
                      : "Great practice session!"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                  {gameMode === "EARN_POINTS" && (
                    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
                      <p className="text-2xl font-extrabold text-[#F59E0B]">
                        +{submitResult.totalPointsEarned}
                      </p>
                      <p className="text-[9px] uppercase tracking-wider text-[#94A3B8] mt-1">FP Earned</p>
                    </div>
                  )}
                  <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
                    <p className="text-2xl font-extrabold text-[#22C55E]">
                      {submitResult.correctCount}/{submitResult.totalQuestions}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-[#94A3B8] mt-1">Correct</p>
                  </div>
                  {gameMode === "EARN_POINTS" && (
                    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
                      <p className="text-2xl font-extrabold text-[#38BDF8]">
                        {submitResult.newTotalPoints}
                      </p>
                      <p className="text-[9px] uppercase tracking-wider text-[#94A3B8] mt-1">Total FP</p>
                    </div>
                  )}
                </div>

                {/* Question results breakdown */}
                <div className="max-w-sm mx-auto text-left space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2 text-center">
                    Question Breakdown
                  </p>
                  {submitResult.questionResults.map((qr, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                        qr.pointsAwarded > 0
                          ? "bg-[#22C55E]/8 border-[#22C55E]/25"
                          : qr.correct
                          ? "bg-white/[0.03] border-white/[0.06]"
                          : "bg-[#EF4444]/8 border-[#EF4444]/25"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        qr.pointsAwarded > 0 ? "bg-[#22C55E]" : qr.correct ? "bg-[#94A3B8]" : "bg-[#EF4444]"
                      }`}>
                        {qr.correct ? <Check size={14} className="text-white" /> : <X size={14} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white line-clamp-1">{qr.question}</p>
                        {qr.pointsAwarded > 0 ? (
                          <p className="text-[10px] text-[#22C55E] font-bold">+{qr.pointsAwarded} FP earned</p>
                        ) : qr.alreadyScored ? (
                          <p className="text-[10px] text-[#94A3B8]">✅ Already mastered (0 FP)</p>
                        ) : (
                          <p className="text-[10px] text-[#EF4444]">Incorrect (0 FP)</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 max-w-sm mx-auto">
                  <button
                    onClick={shareResults}
                    className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={14} /> Share
                  </button>
                  <button
                    onClick={resetGame}
                    className="flex-1 py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={14} /> {t("triviaView.results.playAgain")}
                  </button>
                </div>

                {gameMode === "EARN_POINTS" && (
                  <div className="max-w-sm mx-auto w-full space-y-2 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] text-center">
                      Challenge your friends
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={inviteFriend}
                        className="flex-1 py-2.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/25 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                      >
                        <UserPlus size={13} /> Invite Friend
                      </button>
                      <button
                        onClick={inviteFriend}
                        className="flex-1 py-2.5 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 text-[#38BDF8] hover:bg-[#38BDF8]/25 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                      >
                        <Users size={13} /> Invite Group
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === "leaderboard" && <LeaderboardTab />}
        {activeTab === "stats" && <StatsTab isAuthenticated={isAuthenticated} />}
        {activeTab === "rewards" && <RewardsTab isAuthenticated={isAuthenticated} userPoints={userPoints || 0} />}
        {activeTab === "compete" && <CompeteView />}
      </AnimatePresence>
    </div>
  );
}

// ─── LEADERBOARD TAB ──────────────────────────────────────────────────────────

function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trivia/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#A855F7] animate-spin" />
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy size={32} className="mx-auto text-[#475569] mb-2" />
        <p className="text-sm text-[#94A3B8]">No players on the leaderboard yet.</p>
        <p className="text-[10px] text-[#64748B] mt-1">Be the first to earn Faith Points!</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <p className="text-xs text-[#94A3B8] mb-3">
        Real leaderboard — ranked by verified lifetime Faith Points from the server.
      </p>
      {leaderboard.map((u) => (
        <div
          key={u.rank}
          className={`flex items-center gap-3 p-3 rounded-2xl border ${
            u.rank <= 3
              ? "bg-[#F59E0B]/8 border-[#F59E0B]/25"
              : "bg-white/[0.03] border-white/[0.06]"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${
              u.rank === 1 ? "bg-[#F59E0B] text-slate-950"
              : u.rank === 2 ? "bg-[#94A3B8] text-slate-950"
              : u.rank === 3 ? "bg-[#F97316] text-slate-950"
              : "bg-white/[0.06] text-white"
            }`}
          >
            {u.rank <= 3 ? <Crown size={18} /> : u.rank}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">{u.name}</p>
            <p className="text-[11px] text-[#94A3B8]">{u.tierIcon} {u.tier}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-[#F59E0B] tabular-nums">{u.points.toLocaleString()}</p>
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">FP</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────

function StatsTab({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetch("/api/trivia/stats")
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <Lock size={32} className="mx-auto text-[#475569] mb-3" />
        <p className="text-sm text-[#94A3B8] mb-3">Sign in to view your verified stats</p>
        <a
          href="/auth/signin"
          className="inline-block px-6 py-2.5 rounded-xl bg-[#7C3AED] text-white text-sm font-bold"
        >
          Sign In
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#A855F7] animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Migration notice */}
      <div className="bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-[#38BDF8] shrink-0" />
          <p className="text-[11px] text-[#A09DB1]">
            Faith Points are now tracked securely. Your verified balance is shown above.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center text-2xl">
            {stats.tier?.icon}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Your Tier</p>
            <p className="text-lg font-extrabold text-white">{stats.tier?.title}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.04] rounded-xl p-3 text-center">
            <p className="text-xl font-extrabold text-[#F59E0B]">{stats.totalPoints}</p>
            <p className="text-[9px] uppercase tracking-wider text-[#94A3B8] mt-1">Total FP</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 text-center">
            <p className="text-xl font-extrabold text-[#38BDF8]">{stats.gamesPlayed}</p>
            <p className="text-[9px] uppercase tracking-wider text-[#94A3B8] mt-1">Quizzes</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 text-center">
            <p className="text-xl font-extrabold text-[#EF4444]">{stats.bestStreak}</p>
            <p className="text-[9px] uppercase tracking-wider text-[#94A3B8] mt-1">Best Streak</p>
          </div>
        </div>
      </div>

      {/* Questions mastered */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-white">Questions Mastered</p>
          <span className="text-xs font-bold text-[#22C55E]">
            {stats.questionsScored} / {stats.totalQuestions}
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#22C55E] to-[#3B82F6]"
            style={{ width: `${stats.totalQuestions > 0 ? (stats.questionsScored / stats.totalQuestions) * 100 : 0}%` }}
          />
        </div>
        <p className="text-[10px] text-[#94A3B8] mt-2">
          {stats.totalQuestions - stats.questionsScored} questions remaining to earn points from.
        </p>
      </div>
    </motion.div>
  );
}

// ─── REWARDS TAB ──────────────────────────────────────────────────────────────

function RewardsTab({ isAuthenticated, userPoints }: { isAuthenticated: boolean; userPoints: number }) {
  const t = useTranslation();
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [pickerGift, setPickerGift] = useState<any | null>(null);
  const [pickerSelections, setPickerSelections] = useState<Record<string, string>>({});

  const loadGifts = useCallback(() => {
    fetch("/api/trivia/gifts")
      .then((r) => r.json())
      .then((data) => {
        setGifts(data.gifts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadGifts();
  }, [loadGifts]);

  const sendClaim = async (giftId: string, title: string, selectedVariations: { name: string; value: string }[]) => {
    setClaiming(giftId);
    try {
      const res = await fetch("/api/trivia/claim-gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId, selectedVariations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const variationSummary =
        selectedVariations.length > 0
          ? ` · ${selectedVariations.map((v) => `${v.name}: ${v.value}`).join(", ")}`
          : "";
      toast.success(`Claimed: ${title}!`, {
        description: `Admin will contact you via WhatsApp.${variationSummary} Points spent: ${data.pointsSpent} FP.`,
      });
      loadGifts();
    } catch (e: any) {
      toast.error("Failed to claim gift", { description: e.message });
    } finally {
      setClaiming(null);
    }
  };

  const handleClaim = (gift: any) => {
    if (!isAuthenticated) {
      toast.error("Sign in required to claim gifts");
      return;
    }
    const variations = Array.isArray(gift.variations) ? gift.variations : [];
    if (variations.length > 0) {
      const initial: Record<string, string> = {};
      variations.forEach((v: any) => {
        if (v.options && v.options.length > 0) initial[v.name] = v.options[0];
      });
      setPickerSelections(initial);
      setPickerGift(gift);
      return;
    }
    sendClaim(gift.id, gift.title, []);
  };

  const confirmPickerClaim = () => {
    if (!pickerGift) return;
    const selections = Object.entries(pickerSelections).map(([name, value]) => ({ name, value }));
    sendClaim(pickerGift.id, pickerGift.title, selections);
    setPickerGift(null);
    setPickerSelections({});
  };

  const closePicker = () => {
    setPickerGift(null);
    setPickerSelections({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F59E0B] animate-spin" />
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    platinum: "#E5E4E2",
  };

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#F59E0B]/20 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift size={16} className="text-[#F59E0B]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">{t('rewards.header')}</p>
            </div>
            <p className="text-2xl font-extrabold text-white">
              {isAuthenticated ? userPoints.toLocaleString() : "—"} FP
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {isAuthenticated ? t('rewards.available') : t('rewards.signInPrompt')}
            </p>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3 text-center">
          <p className="text-xs text-[#A09DB1]">
            Sign in to redeem gifts. Your claims persist across devices.
          </p>
          <a
            href="/auth/signin"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-[#38BDF8] text-slate-950 text-xs font-bold"
          >
            {t('rewards.signInButton')}
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {gifts.map((gift, i) => {
          const canClaim = isAuthenticated && userPoints >= gift.pointsRequired && !gift.claimed && gift.stock > 0;
          const isClaimed = gift.claimed;
          const hasVariations = Array.isArray(gift.variations) && gift.variations.length > 0;
          return (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden"
            >
              <div className="relative aspect-square bg-[#0f0f1a]">
                <img src={gift.imageUrl} alt={gift.title} className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-transparent to-transparent" />
                <span
                  className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${tierColors[gift.tier]}E6`, color: "#0A0A0A" }}
                >
                  {gift.tier}
                </span>
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold">
                  {gift.stock} left
                </span>
                {hasVariations && (
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-[#F59E0B]/90 text-slate-950 text-[8px] font-bold uppercase tracking-wider">
                    {gift.variations.length} option{gift.variations.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-xs font-bold text-white leading-tight mb-1 line-clamp-1">{gift.title}</h3>
                <p className="text-[10px] text-[#94A3B8] line-clamp-2 mb-2">{gift.description}</p>

                {hasVariations && (
                  <div className="flex flex-wrap gap-0.5 mb-2">
                    {gift.variations.map((v: any, vIdx: number) => (
                      <span
                        key={vIdx}
                        className="px-1 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] font-bold uppercase tracking-wide"
                        title={`${v.name}: ${(v.options || []).join(", ")}`}
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 mb-2">
                  <Zap size={10} className="text-[#F59E0B]" />
                  <span className="text-[11px] font-bold text-[#F59E0B]">{gift.pointsRequired.toLocaleString()} FP</span>
                </div>
                {isClaimed ? (
                  <div className="w-full py-2 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                    <CheckCircle2 size={11} /> Claimed
                  </div>
                ) : (
                  <button
                    onClick={() => handleClaim(gift)}
                    disabled={!canClaim || claiming === gift.id}
                    className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      claiming === gift.id
                        ? "bg-white/[0.04] text-[#94A3B8]"
                        : canClaim
                        ? "bg-[#F59E0B] text-slate-950 hover:bg-[#E59E0B]"
                        : "bg-white/[0.04] text-[#475569] cursor-not-allowed"
                    }`}
                  >
                    {claiming === gift.id ? t('rewards.button.claiming') :
                      isClaimed ? t('rewards.button.claimed') :
                      canClaim ? (hasVariations ? t('rewards.button.pickAndRedeem') : t('rewards.button.redeem')) :
                      !isAuthenticated ? t('rewards.button.signIn') :
                      gift.stock <= 0 ? t('rewards.button.outOfStock') :
                      t('rewards.button.moreFP', { points: gift.pointsRequired - userPoints })}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {pickerGift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-6"
            onClick={(e) => e.target === e.currentTarget && closePicker()}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border border-[#F59E0B]/20 rounded-t-[28px] md:rounded-[24px] w-full max-w-md max-h-[88vh] overflow-y-auto"
            >
              <div className="relative h-32">
                <img
                  src={pickerGift.imageUrl}
                  alt={pickerGift.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-[#1C1929]/40 to-transparent" />
                <button
                  onClick={closePicker}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={16} />
                </button>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B] mb-0.5">
                    {pickerGift.tier} · {pickerGift.pointsRequired.toLocaleString()} FP
                  </p>
                  <h3 className="text-base font-extrabold text-white leading-tight line-clamp-1">
                    {pickerGift.title}
                  </h3>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <p className="text-[11px] text-[#A09DB1] leading-relaxed">{pickerGift.description}</p>

                <div className="space-y-3">
                  {pickerGift.variations.map((variation: any, vIdx: number) => (
                    <div key={vIdx}>
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        <Tag size={10} /> {variation.name}
                        {pickerSelections[variation.name] && (
                          <span className="text-[#F59E0B] normal-case tracking-normal ml-1">
                            · {pickerSelections[variation.name]}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {variation.options.map((opt: string) => {
                          const isSelected = pickerSelections[variation.name] === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() =>
                                setPickerSelections((prev) => ({ ...prev, [variation.name]: opt }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                  ? "bg-[#F59E0B] text-slate-950 border-[#F59E0B]"
                                  : "bg-white/[0.04] text-[#94A3B8] border-white/[0.08] hover:text-white hover:border-white/[0.2]"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {Array.isArray(pickerGift.attributes) && pickerGift.attributes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      <Palette size={10} /> {t('rewards.specifications')}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {pickerGift.attributes.map((attr: any, aIdx: number) => (
                        <div
                          key={aIdx}
                          className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5"
                        >
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
                            {attr.label}
                          </p>
                          <p className="text-[11px] font-semibold text-white mt-0.5">{attr.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-1">
                  <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-2.5 mb-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#F59E0B] mb-0.5">
                      {t('rewards.orderSummary')}
                    </p>
                    <p className="text-[11px] text-white">
                      {pickerGift.title}
                      {Object.entries(pickerSelections).length > 0 && (
                        <span className="text-[#94A3B8]">
                          {" · "}
                          {Object.entries(pickerSelections)
                            .map(([n, v]) => `${n}: ${v}`)
                            .join(" · ")}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">
                      {t('rewards.orderSummary.disclaimer', { points: pickerGift.pointsRequired.toLocaleString() })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={closePicker}
                      disabled={claiming === pickerGift.id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                    >
                      {t('rewards.cancel')}
                    </button>
                    <button
                      onClick={confirmPickerClaim}
                      disabled={claiming === pickerGift.id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#F59E0B] hover:bg-[#E59E0B] transition-all disabled:opacity-50"
                    >
                      {claiming === pickerGift.id ? t('rewards.button.claiming') : t('rewards.redeemButton', { points: pickerGift.pointsRequired.toLocaleString() })}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── COMPETE TAB ──────────────────────────────────────────────────────────
// Fetches real competitions from /api/trivia/competitions and displays
// LIVE / UPCOMING / ENDED sections with prize info + user rank.

function CompeteView() {
  const { isAuthenticated } = useSupabaseUser();
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompetition, setActiveCompetition] = useState<{ id: string; title: string } | null>(null);
  const [quizResult, setQuizResult] = useState<{ result: any; title: string } | null>(null);
  const [leaderboardCompetition, setLeaderboardCompetition] = useState<string | null>(null);

  const loadCompetitions = useCallback(() => {
    fetch("/api/trivia/competitions")
      .then((r) => r.json())
      .then((data) => { setCompetitions(data.competitions || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCompetitions(); }, [loadCompetitions]);

  // ─── QUIZ VIEW (full screen) ───
  if (activeCompetition) {
    return (
      <CompetitionQuizView
        competitionId={activeCompetition.id}
        competitionTitle={activeCompetition.title}
        onClose={() => { setActiveCompetition(null); loadCompetitions(); }}
        onComplete={(result) => {
          setQuizResult({ result, title: activeCompetition.title });
          setActiveCompetition(null);
        }}
      />
    );
  }

  // ─── RESULT VIEW (full screen) ───
  if (quizResult) {
    return (
      <CompetitionResultView
        result={quizResult.result}
        competitionTitle={quizResult.title}
        onBackToCompete={() => { setQuizResult(null); loadCompetitions(); }}
        onViewLeaderboard={() => {
          // Find the competition ID from the result
          const comp = competitions.find((c) => c.title === quizResult.title);
          setLeaderboardCompetition(comp?.id || null);
          setQuizResult(null);
        }}
      />
    );
  }

  // ─── LEADERBOARD VIEW ───
  if (leaderboardCompetition) {
    return (
      <CompetitionLeaderboard
        competitionId={leaderboardCompetition}
        onClose={() => { setLeaderboardCompetition(null); loadCompetitions(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="text-[#F39B9B] animate-spin" />
      </div>
    );
  }

  const live = competitions.filter((c) => c.status === "live");
  const upcoming = competitions.filter((c) => c.status === "scheduled");
  const ended = competitions.filter((c) => c.status === "ended");

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Ended";
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const renderCompetitionCard = (c: any) => (
    <div
      key={c.id}
      className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden"
    >
      {/* Prize image (if available) */}
      {c.prize?.imageUrl && (
        <div className="relative h-32 bg-[#0f0f1a]">
          <img src={c.prize.imageUrl} alt={c.prize.name} className="w-full h-full object-contain" />
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#F59E0B] text-slate-950 text-[9px] font-bold uppercase tracking-wider">
            🏆 Prize
          </div>
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#F59B9B]">{c.type}</p>
            <h3 className="text-sm font-bold text-white leading-tight">{c.title}</h3>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0 ${
              c.status === "live"
                ? "bg-[#22C55E]/15 text-[#22C55E]"
                : c.status === "ended"
                ? "bg-white/[0.06] text-[#64748B]"
                : "bg-[#38BDF8]/15 text-[#38BDF8]"
            }`}
          >
            {c.status}
          </span>
        </div>

        {c.prize && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-[#F59E0B]">🏆</span>
            <span className="font-bold text-white">{c.prize.name}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-[10px] text-[#94A3B8]">
          <span className="flex items-center gap-0.5"><Clock size={9} /> {c.questionCount} Q</span>
          <span>·</span>
          <span className="capitalize">{c.difficulty}</span>
          <span>·</span>
          <span className="capitalize">{c.category.replace("_", " ")}</span>
          <span>·</span>
          <span>{c.participantCount} players</span>
        </div>

        {c.status === "live" && (
          <p className="text-[10px] text-[#F59E0B] font-bold">
            ⏱ Ends in {formatTimeRemaining(c.timeRemaining)}
          </p>
        )}

        {/* User's rank if authenticated + has attempts */}
        {isAuthenticated && c.userBestScore !== null && (
          <div className="flex items-center gap-2 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-lg px-2 py-1">
            <span className="text-[10px] font-bold text-[#A78BFA]">Your rank: #{c.userRank}</span>
            <span className="text-[10px] text-[#94A3B8]">·</span>
            <span className="text-[10px] text-[#94A3B8]">{c.userBestScore} pts</span>
            <span className="text-[10px] text-[#64748B] ml-auto">
              {c.userAttemptsRemaining} attempt{c.userAttemptsRemaining === 1 ? "" : "s"} left
            </span>
          </div>
        )}

        {c.status === "live" && isAuthenticated && c.userAttemptsRemaining > 0 && (
          <button
            onClick={() => setActiveCompetition({ id: c.id, title: c.title })}
            className="w-full py-2 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all"
          >
            {c.userAttemptsUsed > 0 ? "Play Again" : "Enter Challenge"}
          </button>
        )}
        {c.status === "live" && isAuthenticated && c.userAttemptsRemaining === 0 && (
          <button
            onClick={() => setLeaderboardCompetition(c.id)}
            className="w-full py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
          >
            View Leaderboard
          </button>
        )}
        {c.status === "ended" && (
          <button
            onClick={() => setLeaderboardCompetition(c.id)}
            className="w-full py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
          >
            View Results
          </button>
        )}
        {c.status === "live" && !isAuthenticated && (
          <p className="text-[10px] text-[#64748B] text-center">Sign in to participate</p>
        )}
        {c.status === "scheduled" && (
          <p className="text-[10px] text-[#38BDF8] font-bold">
            📅 Starts {new Date(c.startAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* LIVE */}
      {live.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E] mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" /> Live Now
          </p>
          <div className="space-y-3">{live.map(renderCompetitionCard)}</div>
        </div>
      )}

      {/* UPCOMING */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] mb-2">📅 Upcoming</p>
          <div className="space-y-3">{upcoming.map(renderCompetitionCard)}</div>
        </div>
      )}

      {/* ENDED */}
      {ended.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-2">🏁 Ended</p>
          <div className="space-y-3">{ended.map(renderCompetitionCard)}</div>
        </div>
      )}

      {/* Empty state */}
      {competitions.length === 0 && (
        <div className="text-center py-12">
          <Trophy size={32} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#94A3B8]">No competitions yet.</p>
          <p className="text-[11px] text-[#64748B] mt-1">
            Koino Bible Challenges are coming soon. Keep practicing and earning Faith Points!
          </p>
        </div>
      )}
    </div>
  );
}
