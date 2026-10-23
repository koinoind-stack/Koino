"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trophy,
  Check,
  Target,
  Clock,
  ArrowRight,
  Award,
  TrendingUp,
} from "lucide-react";

type Question = {
  index: number;
  questionId: string;
  question: string;
  options: string[];
  category: string;
  difficulty: string;
};

type Props = {
  competitionId: string;
  competitionTitle: string;
  onClose: () => void;
  onComplete: (result: CompetitionResult) => void;
};

type CompetitionResult = {
  score: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  rank: number;
  fpAwarded: number;
};

export default function CompetitionQuizView({ competitionId, competitionTitle, onClose, onComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Start the attempt on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/trivia/competitions/${competitionId}/start`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start");
        setAttemptId(data.attemptId);
        setQuestions(data.questions);
        setStartTime(data.startedAt);
      } catch (e: any) {
        setError(e.message || "Failed to start quiz");
        toast.error(e.message || "Failed to start quiz");
      } finally {
        setLoading(false);
      }
    })();
  }, [competitionId]);

  const submit = useCallback(async () => {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const answerArray = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
        questionId,
        selectedAnswer,
      }));
      const res = await fetch(`/api/trivia/competitions/${competitionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers: answerArray, startTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onComplete({
        score: data.score,
        correctCount: data.correctCount,
        totalQuestions: data.totalQuestions,
        accuracy: data.accuracy,
        rank: data.rank,
        fpAwarded: data.fpAwarded,
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
      setSubmitting(false);
    }
  }, [attemptId, answers, competitionId, startTime, onComplete]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#12101A] z-[80] flex items-center justify-center">
        <Loader2 size={28} className="text-[#F39B9B] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#12101A] z-[80] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <X size={32} className="mx-auto text-[#EF4444] mb-3" />
          <p className="text-sm text-[#94A3B8] mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-[#F39B9B] text-slate-950 text-xs font-bold">
            Back to Compete
          </button>
        </div>
      </div>
    );
  }

  const current = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const progress = ((currentIdx + 1) / questions.length) * 100;
  const allAnswered = questions.every((q) => answers[q.questionId] !== undefined);

  return (
    <div className="fixed inset-0 bg-[#12101A] z-[80] overflow-y-auto">
      <div className="max-w-md mx-auto px-4 py-5 min-h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F39B9B]">
              {competitionTitle}
            </p>
            <p className="text-[10px] text-[#64748B] mt-0.5">
              Question {currentIdx + 1} of {questions.length}
            </p>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/[0.06] rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#F39B9B] to-[#7C3AED]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Question */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.questionId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-md bg-[#7C3AED]/15 text-[#A78BFA] text-[9px] font-bold uppercase tracking-wider">
                  {current.category.replace("_", " ")}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[#94A3B8] text-[9px] font-bold uppercase tracking-wider">
                  {current.difficulty}
                </span>
              </div>
              <h2 className="text-base font-bold text-white leading-relaxed mb-5">
                {current.question}
              </h2>

              {/* Options */}
              <div className="space-y-2">
                {current.options.map((opt, idx) => {
                  const isSelected = answers[current.questionId] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setAnswers({ ...answers, [current.questionId]: idx })}
                      className={`w-full text-left p-3.5 rounded-xl border text-sm font-semibold transition-all ${
                        isSelected
                          ? "bg-[#7C3AED]/15 border-[#7C3AED]/40 text-white"
                          : "bg-white/[0.04] border-white/[0.06] text-[#A09DB1] hover:text-white hover:border-white/[0.15]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isSelected ? "bg-[#7C3AED] text-white" : "bg-white/[0.06] text-[#94A3B8]"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isSelected && <Check size={16} className="text-[#7C3AED]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 mt-6 pb-4">
          {currentIdx > 0 && (
            <button
              onClick={() => setCurrentIdx(currentIdx - 1)}
              className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white font-bold transition-all"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {!isLast ? (
            <button
              onClick={() => setCurrentIdx(currentIdx + 1)}
              disabled={answers[current.questionId] === undefined}
              className="flex-1 py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!allAnswered || submitting}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Submit Quiz <Check size={16} /></>}
            </button>
          )}
        </div>

        {/* Answered indicator */}
        <p className="text-[10px] text-[#64748B] text-center">
          {Object.keys(answers).length} / {questions.length} answered
        </p>
      </div>
    </div>
  );
}

// ─── RESULT SCREEN ──────────────────────────────────────────────────────────

export function CompetitionResultView({
  result,
  competitionTitle,
  onBackToCompete,
  onViewLeaderboard,
}: {
  result: CompetitionResult;
  competitionTitle: string;
  onBackToCompete: () => void;
  onViewLeaderboard: () => void;
}) {
  const accuracyPct = Math.round(result.accuracy * 100);

  return (
    <div className="fixed inset-0 bg-[#12101A] z-[80] overflow-y-auto">
      <div className="max-w-md mx-auto px-4 py-8 min-h-full flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          {/* Trophy */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#F59E0B] to-[#7C3AED] flex items-center justify-center">
            <Trophy size={36} className="text-white" />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F39B9B] mb-1">
            {competitionTitle}
          </p>
          <h1 className="text-2xl font-black text-white mb-1">Challenge Complete! 🎉</h1>
          <p className="text-xs text-[#94A3B8] mb-6">Here's how you did</p>

          {/* Score */}
          <div className="bg-[#1C1929] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Your Competition Score</p>
            <p className="text-4xl font-black text-white">{result.score}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
              <Check size={14} className="mx-auto text-[#22C55E] mb-1" />
              <p className="text-lg font-black text-white">{result.correctCount}/{result.totalQuestions}</p>
              <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Correct</p>
            </div>
            <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
              <Target size={14} className="mx-auto text-[#38BDF8] mb-1" />
              <p className="text-lg font-black text-white">{accuracyPct}%</p>
              <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Accuracy</p>
            </div>
            <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
              <TrendingUp size={14} className="mx-auto text-[#A78BFA] mb-1" />
              <p className="text-lg font-black text-white">#{result.rank}</p>
              <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Rank</p>
            </div>
            <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
              <Award size={14} className="mx-auto text-[#F59E0B] mb-1" />
              <p className="text-lg font-black text-white">+{result.fpAwarded}</p>
              <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">FP Earned</p>
            </div>
          </div>

          {result.fpAwarded > 0 && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl p-3 mb-4">
              <p className="text-[11px] text-[#F59E0B] font-bold">
                ✨ +{result.fpAwarded} Faith Points added to your lifetime balance
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-2">
            <button
              onClick={onViewLeaderboard}
              className="w-full py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px flex items-center justify-center gap-2"
            >
              <TrendingUp size={16} /> View Leaderboard
            </button>
            <button
              onClick={onBackToCompete}
              className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white font-bold text-xs transition-all"
            >
              Back to Compete
            </button>
          </div>

          <p className="text-[10px] text-[#64748B] mt-4">
            Competition Score is separate from your lifetime Faith Points. Winners are determined server-side when the competition ends.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
