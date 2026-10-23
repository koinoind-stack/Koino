"use client";

import { motion } from "framer-motion";
import { Flame, TrendingUp } from "lucide-react";
import { getStreakInfo, STREAK_LABELS, type StreakActivity } from "@/lib/streaks";

type Props = {
  activity: StreakActivity;
  compact?: boolean;
};

/**
 * Streak badge — shows current streak with flame icon, best streak,
 * and progress to next milestone. Reads from localStorage on render.
 */
export default function StreakBadge({ activity, compact = false }: Props) {
  const info = getStreakInfo(activity);
  const labels = STREAK_LABELS[activity];

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
          info.currentStreak > 0
            ? "bg-[#EF4444]/10 border-[#EF4444]/25"
            : "bg-white/[0.04] border-white/[0.06]"
        }`}
      >
        <Flame
          size={12}
          className={info.currentStreak > 0 ? "text-[#EF4444]" : "text-[#64748B]"}
          fill={info.currentStreak > 0 ? "currentColor" : "none"}
        />
        <span
          className={`text-[11px] font-bold tabular-nums ${
            info.currentStreak > 0 ? "text-[#EF4444]" : "text-[#64748B]"
          }`}
        >
          {info.currentStreak} {info.currentStreak === 1 ? labels.singular : labels.plural}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#EF4444]/20 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        {/* Flame icon with pulse animation if streak is active */}
        <div className="relative shrink-0">
          <motion.div
            animate={
              info.currentStreak > 0
                ? { scale: [1, 1.1, 1] }
                : {}
            }
            transition={{ duration: 1.5, repeat: info.currentStreak > 0 ? Infinity : 0 }}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
              info.currentStreak > 0
                ? "bg-[#EF4444]/15 border-[#EF4444]/30"
                : "bg-white/[0.04] border-white/[0.06]"
            }`}
          >
            <Flame
              size={22}
              className={info.currentStreak > 0 ? "text-[#EF4444]" : "text-[#64748B]"}
              fill={info.currentStreak > 0 ? "currentColor" : "none"}
            />
          </motion.div>
          {info.currentStreak >= 7 && (
            <span className="absolute -top-1 -right-1 text-xs">🔥</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-white tabular-nums">
              {info.currentStreak}
            </p>
            <p className="text-xs text-[#94A3B8]">
              {info.currentStreak === 1 ? labels.singular : labels.plural} streak
            </p>
          </div>

          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
              <TrendingUp size={10} /> Best: {info.bestStreak}
            </span>
            <span className="text-[10px] text-[#64748B]">·</span>
            <span className="text-[10px] text-[#94A3B8]">
              {info.isActiveToday ? "✓ Done today" : "Not done today"}
            </span>
          </div>

          {/* Progress to next milestone */}
          {info.currentStreak > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[9px] mb-0.5">
                <span className="text-[#94A3B8]">Next: {info.nextMilestone} days</span>
                <span className="font-bold text-[#EF4444]">{info.milestoneProgress}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444]"
                  initial={{ width: 0 }}
                  animate={{ width: `${info.milestoneProgress}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          )}

          {info.currentStreak === 0 && (
            <p className="text-[10px] text-[#64748B] mt-1">
              Start {labels.verb} today to begin a streak!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
