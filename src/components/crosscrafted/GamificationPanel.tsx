"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Gift,
  Award,
  Sparkles,
  Loader2,
  Check,
  X,
  ArrowRight,
  RefreshCw,
  Trophy,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

type DailyChallenge = {
  id: string;
  date: string;
  multiplier: number;
  question: {
    id: string;
    question: string;
    options: string[];
    difficulty: string;
    category: string;
    basePoints: number;
    scriptureReference: string | null;
  };
  userAttempt: { isCorrect: boolean; pointsAwarded: number; selectedAnswer: number } | null;
};

type SpinReward = {
  type: string;
  value: number;
  label: string;
  icon: string;
  rarity: string;
  color: string;
};

type Badge = {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

export default function GamificationPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [activeTab, setActiveTab] = useState<"daily" | "spin" | "badges">("daily");
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [challengeResult, setChallengeResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Spin state
  const [canSpin, setCanSpin] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinReward | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinHistory, setSpinHistory] = useState<any[]>([]);
  const [rewards, setRewards] = useState<SpinReward[]>([]);

  // Badge state
  const [badges, setBadges] = useState<Badge[]>([]);

  // Fetch daily challenge
  const fetchChallenge = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification/daily-challenge");
      if (res.status === 401) return;
      const data = await res.json();
      setChallenge(data.challenge || null);
    } catch {}
    setLoading(false);
  }, []);

  // Fetch spin data
  const fetchSpin = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification/daily-spin");
      if (res.status === 401) return;
      const data = await res.json();
      setCanSpin(data.canSpin);
      setSpinResult(data.todayResult?.reward || null);
      setSpinHistory(data.history || []);
      setRewards(data.rewards || []);
    } catch {}
  }, []);

  // Fetch badges
  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification/badges");
      if (res.status === 401) return;
      const data = await res.json();
      setBadges(data.badges || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchChallenge();
      fetchSpin();
      fetchBadges();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchChallenge, fetchSpin, fetchBadges]);

  // Submit daily challenge
  const submitChallenge = async () => {
    if (selectedAnswer === null || !challenge) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/gamification/daily-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedAnswer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChallengeResult(data);
      if (data.isCorrect) {
        toast.success(`🎉 Daily Challenge! +${data.pointsAwarded} FP (2x bonus!)`);
      } else {
        toast("Wrong answer — but come back tomorrow for another chance!");
      }

      // Check for new badges
      const badgeRes = await fetch("/api/gamification/badges", { method: "POST" });
      const badgeData = await badgeRes.json();
      if (badgeData.newlyAwarded?.length > 0) {
        badgeData.newlyAwarded.forEach((b: any) => {
          toast.success(`${b.icon} Badge Unlocked: ${b.name}!`, { description: b.description });
        });
        fetchBadges();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Spin the wheel
  const doSpin = async () => {
    setSpinning(true);
    try {
      const res = await fetch("/api/gamification/daily-spin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Animate the spin, then show result after 2s
      setTimeout(() => {
        setSpinResult(data.reward);
        setCanSpin(false);
        setSpinning(false);

        if (data.reward.type.startsWith("fp_")) {
          toast.success(`🎰 ${data.reward.icon} You won ${data.reward.label}!`, {
            description: `New total: ${data.newTotalPoints} FP`,
          });
        } else {
          toast.success(`🎰 ${data.reward.icon} You won ${data.reward.label}!`);
        }

        // Check badges
        fetch("/api/gamification/badges", { method: "POST" })
          .then((r) => r.json())
          .then((bd) => {
            if (bd.newlyAwarded?.length > 0) {
              bd.newlyAwarded.forEach((b: any) => {
                toast.success(`${b.icon} Badge Unlocked: ${b.name}!`);
              });
              fetchBadges();
            }
          });
      }, 2000);
    } catch (e: any) {
      toast.error(e.message);
      setSpinning(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-6 text-center">
        <Sparkles size={28} className="mx-auto text-[#A78BFA] mb-2" />
        <p className="text-sm font-bold text-white">Sign in for Daily Rewards</p>
        <p className="text-[11px] text-[#94A3B8] mt-1">
          Daily Challenge, Treasure Chest, and Badges await!
        </p>
        <a href="/auth/signin" className="inline-block mt-3 px-5 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold">
          Sign In
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="text-[#7C3AED] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "daily" ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <Calendar size={12} /> Daily
        </button>
        <button
          onClick={() => setActiveTab("spin")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "spin" ? "bg-[#F59E0B] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <Gift size={12} /> Spin
        </button>
        <button
          onClick={() => setActiveTab("badges")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "badges" ? "bg-[#22C55E] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <Award size={12} /> Badges
        </button>
      </div>

      {/* Daily Challenge */}
      {activeTab === "daily" && challenge && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#A78BFA]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">
                Daily Challenge
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold">
              2x FP!
            </span>
          </div>

          {challenge.userAttempt ? (
            // Already answered
            <div className="text-center py-4">
              {challenge.userAttempt.isCorrect ? (
                <>
                  <p className="text-2xl mb-1">🎉</p>
                  <p className="text-sm font-bold text-[#22C55E]">
                    Correct! +{challenge.userAttempt.pointsAwarded} FP earned!
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl mb-1">💪</p>
                  <p className="text-sm font-bold text-[#94A3B8]">Not quite! Come back tomorrow.</p>
                </>
              )}
              <p className="text-[10px] text-[#64748B] mt-2">
                Next challenge in {hoursUntilTomorrow()}h
              </p>
            </div>
          ) : challengeResult ? (
            // Just answered
            <div className="text-center py-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-4xl mb-2"
              >
                {challengeResult.isCorrect ? "🎉" : "💪"}
              </motion.div>
              <p className={`text-sm font-bold ${challengeResult.isCorrect ? "text-[#22C55E]" : "text-[#94A3B8]"}`}>
                {challengeResult.isCorrect
                  ? `Correct! +${challengeResult.pointsAwarded} FP!`
                  : "Wrong answer!"}
              </p>
              <div className="bg-white/[0.04] rounded-xl p-3 mt-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Answer: {String.fromCharCode(65 + challengeResult.correctAnswer)}
                </p>
                <p className="text-[11px] text-[#A09DB1]">{challengeResult.explanation}</p>
                {challengeResult.scriptureReference && (
                  <p className="text-[10px] text-[#64748B] mt-1">📖 {challengeResult.scriptureReference}</p>
                )}
              </div>
            </div>
          ) : (
            // Show question
            <>
              <p className="text-sm font-bold text-white mb-3">{challenge.question.question}</p>
              <div className="space-y-2 mb-3">
                {challenge.question.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedAnswer(idx)}
                    disabled={submitting}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                      selectedAnswer === idx
                        ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                        : "bg-white/[0.03] border-white/[0.06] text-[#A09DB1] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                        selectedAnswer === idx ? "bg-white/30 text-white" : "bg-white/[0.06] text-[#94A3B8]"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt}
                    </span>
                  </button>
                ))}
              </div>
              {selectedAnswer !== null && (
                <button
                  onClick={submitChallenge}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Answer"}
                  <ArrowRight size={14} />
                </button>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Daily Spin */}
      {activeTab === "spin" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#F59E0B]/20 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Gift size={16} className="text-[#F59E0B]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">
              Daily Treasure Chest
            </p>
          </div>

          {spinResult ? (
            // Already spun today
            <div className="text-center py-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="text-5xl mb-2"
              >
                {spinResult.icon}
              </motion.div>
              <p className="text-sm font-bold" style={{ color: spinResult.color }}>
                {spinResult.label}
              </p>
              <p className="text-[10px] text-[#64748B] mt-2">
                Come back tomorrow for another spin!
              </p>
            </div>
          ) : (
            // Can spin
            <div className="text-center py-4">
              <motion.div
                animate={spinning ? { rotate: 360 } : {}}
                transition={spinning ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
                className="text-6xl mb-3 inline-block"
              >
                🎰
              </motion.div>
              <p className="text-sm font-bold text-white mb-3">
                {spinning ? "Spinning..." : "Spin the wheel for a free reward!"}
              </p>
              <button
                onClick={doSpin}
                disabled={spinning}
                className="px-6 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#E59E0B] text-slate-950 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {spinning ? "Spinning..." : "Spin Now!"}
              </button>
            </div>
          )}

          {/* Rewards table */}
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
              Possible Rewards
            </p>
            <div className="grid grid-cols-4 gap-1">
              {rewards.map((r) => (
                <div
                  key={r.type}
                  className="text-center p-1.5 rounded-lg border"
                  style={{ borderColor: `${r.color}30`, backgroundColor: `${r.color}08` }}
                >
                  <p className="text-lg">{r.icon}</p>
                  <p className="text-[8px] font-bold" style={{ color: r.color }}>
                    {r.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Badges */}
      {activeTab === "badges" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#22C55E]/20 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-[#22C55E]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">
                Achievements
              </p>
            </div>
            <span className="text-[10px] text-[#94A3B8]">
              {badges.filter((b) => b.unlocked).length}/{badges.length} unlocked
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`text-center p-2 rounded-xl border transition-all ${
                  badge.unlocked
                    ? "bg-[#22C55E]/8 border-[#22C55E]/25 cursor-pointer"
                    : "bg-white/[0.02] border-white/[0.04] opacity-40"
                }`}
                title={badge.description}
              >
                <p className={`text-2xl mb-1 ${badge.unlocked ? "" : "grayscale"}`}>
                  {badge.unlocked ? badge.icon : "🔒"}
                </p>
                <p className={`text-[9px] font-bold leading-tight ${
                  badge.unlocked ? "text-white" : "text-[#64748B]"
                }`}>
                  {badge.name}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              fetchBadges();
              toast("Refreshing badges...");
            }}
            className="w-full mt-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={11} /> Check for New Badges
          </button>
        </motion.div>
      )}
    </div>
  );
}

function hoursUntilTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60));
}
