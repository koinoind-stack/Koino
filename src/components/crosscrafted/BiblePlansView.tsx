"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Loader2,
  Trophy,
  Sparkles,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  READING_PLANS,
  getBook,
  fetchChapter,
  getAllPlanProgress,
  startPlan,
  togglePlanDay,
  type ReadingPlan,
  type PlanProgress,
  type Translation,
} from "@/lib/bible-data";

type Props = {
  translation: Translation;
  onOpenChapter: (bookId: string, chapter: number) => void;
};

export default function BiblePlansView({ translation, onOpenChapter }: Props) {
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, PlanProgress>>({});
  const [activeDay, setActiveDay] = useState<{ planId: string; day: number } | null>(null);
  const [dayReadings, setDayReadings] = useState<{ bookId: string; chapter: number; text: string }[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  useEffect(() => {
    setProgressMap(getAllPlanProgress());
  }, []);

  const refreshProgress = () => {
    setProgressMap(getAllPlanProgress());
  };

  const handleStartPlan = (plan: ReadingPlan) => {
    startPlan(plan.id);
    refreshProgress();
    toast.success(`Started "${plan.title}"!`, {
      description: `Day 1 of ${plan.duration} — let's begin.`,
    });
    setOpenPlanId(plan.id);
    setActiveDay({ planId: plan.id, day: 1 });
    loadDayReadings(plan.days[0]?.readings || []);
  };

  const handleToggleDay = (planId: string, day: number) => {
    togglePlanDay(planId, day);
    refreshProgress();
    const progress = progressMap[planId];
    const wasComplete = progress?.completedDays.includes(day);
    toast(
      wasComplete ? "Marked as not done" : "Day completed!",
      {
        description: wasComplete ? undefined : "Keep up the rhythm — God honors your faithfulness.",
      }
    );
  };

  const loadDayReadings = async (readings: { bookId: string; chapter: number }[]) => {
    setLoadingDay(true);
    try {
      const results = await Promise.all(
        readings.map(async (r) => {
          try {
            const data = await fetchChapter(r.bookId, r.chapter, translation);
            const text = data.verses.map((v) => `${v.verse} ${v.text.trim()}`).join(" ");
            return { ...r, text };
          } catch {
            return { ...r, text: "Failed to load." };
          }
        })
      );
      setDayReadings(results);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleOpenReading = (bookId: string, chapter: number) => {
    onOpenChapter(bookId, chapter);
  };

  const openPlan = READING_PLANS.find((p) => p.id === openPlanId);

  // ─── DAY DETAIL VIEW ────────────────────────────────────────────────────
  if (openPlan && activeDay) {
    const day = openPlan.days.find((d) => d.day === activeDay.day);
    const progress = progressMap[openPlan.id];
    const isComplete = progress?.completedDays.includes(activeDay.day) || false;
    return (
      <div className="max-w-[680px] mx-auto px-4 py-5">
        <button
          onClick={() => setActiveDay(null)}
          className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors mb-3"
        >
          <ChevronLeft size={14} /> Back to {openPlan.title}
        </button>

        <div
          className="rounded-2xl p-4 mb-4 border"
          style={{
            background: `linear-gradient(135deg, ${openPlan.color}15, transparent)`,
            borderColor: `${openPlan.color}30`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: openPlan.color }}>
              Day {activeDay.day} of {openPlan.duration}
            </span>
            <button
              onClick={() => handleToggleDay(openPlan.id, activeDay.day)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isComplete
                  ? "bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]"
                  : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
              }`}
            >
              <Check size={12} />
              {isComplete ? "Completed" : "Mark as Done"}
            </button>
          </div>
          <h2 className="text-lg font-extrabold text-white mb-1">
            {day ? `${day.readings.length} chapter${day.readings.length > 1 ? "s" : ""} to read` : "No readings"}
          </h2>
          <p className="text-xs text-[#94A3B8]">{openPlan.title}</p>
        </div>

        {loadingDay && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 size={28} className="animate-spin text-[#7C3AED]" />
            <p className="text-xs text-[#94A3B8]">Loading today's readings...</p>
          </div>
        )}

        {!loadingDay && day && dayReadings.length > 0 && (
          <div className="space-y-3">
            {day.readings.map((r, i) => {
              const book = getBook(r.bookId);
              const text = dayReadings[i]?.text || "";
              return (
                <div key={i} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-white/[0.04]">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {book?.name} {r.chapter}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">
                        {book?.testament === "OT" ? "Old Testament" : "New Testament"} · {book?.category}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenReading(r.bookId, r.chapter)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-[11px] font-bold hover:bg-[#7C3AED]/25 transition-all"
                    >
                      Open <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="p-3 max-h-48 overflow-y-auto">
                    <p className="text-[12px] text-[#A09DB1] leading-relaxed line-clamp-6">{text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Prev / Next Day */}
        <div className="flex items-center justify-between mt-4 gap-2">
          <button
            onClick={() => {
              const prevDay = activeDay.day - 1;
              if (prevDay >= 1) {
                setActiveDay({ planId: openPlan.id, day: prevDay });
                loadDayReadings(openPlan.days[prevDay - 1]?.readings || []);
              }
            }}
            disabled={activeDay.day <= 1}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev Day
          </button>
          <span className="text-xs font-bold text-white">
            {activeDay.day} / {openPlan.duration}
          </span>
          <button
            onClick={() => {
              const nextDay = activeDay.day + 1;
              if (nextDay <= openPlan.duration) {
                setActiveDay({ planId: openPlan.id, day: nextDay });
                loadDayReadings(openPlan.days[nextDay - 1]?.readings || []);
              }
            }}
            disabled={activeDay.day >= openPlan.duration}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition-all disabled:opacity-40"
          >
            Next Day <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ─── PLAN DETAIL VIEW (day list) ──────────────────────────────────────
  if (openPlan) {
    const progress = progressMap[openPlan.id];
    const completed = progress?.completedDays.length || 0;
    const pct = Math.round((completed / openPlan.duration) * 100);

    return (
      <div className="max-w-[680px] mx-auto px-4 py-5">
        <button
          onClick={() => setOpenPlanId(null)}
          className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors mb-3"
        >
          <ChevronLeft size={14} /> All Plans
        </button>

        <div
          className="rounded-2xl p-5 mb-4 border"
          style={{
            background: `linear-gradient(135deg, ${openPlan.color}15, transparent)`,
            borderColor: `${openPlan.color}30`,
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: openPlan.color }}>
            {openPlan.category}
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-1">{openPlan.title}</h2>
          <p className="text-sm text-[#A09DB1] mt-2 leading-relaxed">{openPlan.description}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
              <Clock size={12} /> {openPlan.duration} days
            </span>
            <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
              <Calendar size={12} /> {openPlan.days.length} readings
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-white">
              Your Progress
            </p>
            <p className="text-xs text-[#94A3B8]">
              {completed} / {openPlan.duration} days ({pct}%)
            </p>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: openPlan.color }}
              animate={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && (
            <div className="mt-3 flex items-center gap-2 text-[#F59E0B]">
              <Trophy size={14} />
              <p className="text-xs font-bold">Plan complete! Praise God. 🙌</p>
            </div>
          )}
        </div>

        {/* Day list */}
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Daily Readings</p>
        <div className="space-y-2">
          {openPlan.days.map((day) => {
            const isComplete = progress?.completedDays.includes(day.day) || false;
            const isActive = day.day === (progress?.lastReadDay || 1);
            const readingLabels = day.readings
              .map((r) => {
                const book = getBook(r.bookId);
                return book ? `${book.name} ${r.chapter}` : "";
              })
              .join(" · ");
            return (
              <button
                key={day.day}
                onClick={() => {
                  setActiveDay({ planId: openPlan.id, day: day.day });
                  loadDayReadings(day.readings);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                  isComplete
                    ? "bg-[#22C55E]/8 border-[#22C55E]/30"
                    : isActive
                    ? "bg-[#7C3AED]/15 border-[#7C3AED]/30"
                    : "bg-[#1C1929] border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${
                    isComplete
                      ? "bg-[#22C55E] text-slate-950"
                      : "bg-white/[0.06] text-white"
                  }`}
                >
                  {isComplete ? <Check size={16} /> : day.day}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Day {day.day}</p>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {readingLabels || "No readings assigned"}
                  </p>
                </div>
                <ChevronRight size={14} className="text-[#94A3B8] shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── PLANS LIST VIEW ───────────────────────────────────────────────────
  return (
    <div className="max-w-[680px] mx-auto px-4 py-5">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Bible Reading Plans</h1>
        <p className="text-xs text-[#94A3B8] mt-0.5">Build a daily rhythm in God's Word</p>
      </div>

      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-[#A78BFA]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">Why Read Daily?</p>
        </div>
        <p className="text-sm text-white italic leading-relaxed mb-2">
          "Your word is a lamp to my feet and a light to my path."
        </p>
        <p className="text-xs text-[#94A3B8]">— Psalm 119:105</p>
      </div>

      <div className="space-y-3">
        {READING_PLANS.map((plan, i) => {
          const progress = progressMap[plan.id];
          const completed = progress?.completedDays.length || 0;
          const pct = Math.round((completed / plan.duration) * 100);
          const started = !!progress;
          return (
            <motion.button
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => {
                if (!started) {
                  handleStartPlan(plan);
                } else {
                  setOpenPlanId(plan.id);
                }
              }}
              className="w-full text-left bg-[#1C1929] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-4 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
                  style={{ backgroundColor: `${plan.color}15`, borderColor: `${plan.color}40` }}
                >
                  <Calendar size={20} style={{ color: plan.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${plan.color}20`, color: plan.color }}
                    >
                      {plan.category}
                    </span>
                    {started && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E]">
                        {pct === 100 ? "Done" : "In Progress"}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:opacity-90">{plan.title}</h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-2">{plan.description}</p>

                  {started && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-[#94A3B8]">{completed} / {plan.duration} days</span>
                        <span className="font-bold" style={{ color: plan.color }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: plan.color }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="text-[#94A3B8] shrink-0 mt-1" />
              </div>

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                <span className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                  <Clock size={10} /> {plan.duration} days
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                  <Calendar size={10} /> {plan.days.length} readings
                </span>
                <span className="text-[10px] font-bold ml-auto" style={{ color: plan.color }}>
                  {started ? "Continue →" : "Start →"}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
