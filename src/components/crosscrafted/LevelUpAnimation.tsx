"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Tier = {
  minPoints: number;
  title: string;
  icon: string;
};

const TIERS: Tier[] = [
  { minPoints: 0, title: "Faith Seeker", icon: "🌱" },
  { minPoints: 100, title: "Bible Student", icon: "📖" },
  { minPoints: 500, title: "Spiritual Disciple", icon: "✝️" },
  { minPoints: 1500, title: "Bible Teacher", icon: "🎓" },
  { minPoints: 3000, title: "Theology Scholar", icon: "🏆" },
  { minPoints: 5000, title: "Word Warrior", icon: "⚔️" },
  { minPoints: 10000, title: "Bible Master", icon: "👑" },
];

// i18n: tier titles above are English source data — resolved to keys at render.
const TIER_KEYS: Record<number, string> = {
  0: "levelup.tier.faithSeeker",
  100: "levelup.tier.bibleStudent",
  500: "levelup.tier.spiritualDisciple",
  1500: "levelup.tier.bibleTeacher",
  3000: "levelup.tier.theologyScholar",
  5000: "levelup.tier.wordWarrior",
  10000: "levelup.tier.bibleMaster",
};

function getTier(points: number): Tier {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

function getTierIndex(points: number): number {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].minPoints) idx = i;
  }
  return idx;
}

/**
 * Last tier this browser has celebrated, persisted in localStorage. Together
 * with the `ready` gate below it guarantees a tier celebration fires at most
 * once per tier per device — never again on a plain refresh.
 */
const SEEN_TIER_KEY = "koino:levelup-seen-tier";

function getSeenTier(): number {
  if (typeof window === "undefined") return -1;
  try {
    const raw = window.localStorage.getItem(SEEN_TIER_KEY);
    if (raw === null) return -1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : -1;
  } catch {
    return -1; // storage disabled / private mode — in-session guard still works
  }
}

function setSeenTier(idx: number): void {
  try {
    window.localStorage.setItem(SEEN_TIER_KEY, String(idx));
  } catch {
    // storage unavailable — the ready-gate alone still prevents reload replays
  }
}

type LevelUpAnimationProps = {
  totalPoints: number;
  /** True once the user's real FP total has loaded (profile fetch done).
   *  While false, points is the loading placeholder (0) — arming the detector
   *  then would treat the 0 → real-total transition as a fresh level-up and
   *  replay the celebration on every page load. */
  ready?: boolean;
};

/**
 * Shows a full-screen celebration animation when user crosses a tier threshold.
 * Detects tier changes by comparing previous and current points — but only
 * AFTER the real total has loaded and only for tiers this browser has not
 * celebrated yet (persisted), so refreshing never replays the popup.
 */
export default function LevelUpAnimation({ totalPoints, ready = true }: LevelUpAnimationProps) {
  const t = useTranslation();
  const tierTitle = (tier: Tier) => t(TIER_KEYS[tier.minPoints] ?? tier.title);
  const [showCelebration, setShowCelebration] = useState(false);
  const [newTier, setNewTier] = useState<Tier | null>(null);
  const prevTierIdx = useRef<number>(-1);
  const armed = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    const currentTierIdx = getTierIndex(totalPoints);

    if (!armed.current) {
      // Wait for the real FP total before setting the baseline. The hook
      // mounts with the loading placeholder (0); comparing that against the
      // fetched total is what faked a level-up on every refresh.
      if (!ready) return;
      armed.current = true;
      prevTierIdx.current = Math.max(currentTierIdx, getSeenTier());
      return;
    }

    if (currentTierIdx > prevTierIdx.current) {
      // Tier increased — and never celebrated on this device before!
      const tier = TIERS[currentTierIdx];
      setNewTier(tier);
      setShowCelebration(true);
      setSeenTier(currentTierIdx);

      // Auto-hide after 5 seconds
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setShowCelebration(false);
      }, 5000);

      // Show toast
      toast.success(t("levelup.toast", { icon: tier.icon, title: tierTitle(tier) }), {
        duration: 5000,
      });
    }

    prevTierIdx.current = currentTierIdx;
  }, [totalPoints, ready, t]);

  const shareLevelUp = () => {
    if (!newTier) return;
    const text = t("levelup.shareText", { title: tierTitle(newTier), icon: newTier.icon });
    if (navigator.share) {
      navigator.share({ title: t("levelup.shareTitle"), text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success(t("levelup.copied"));
    }
  };

  return (
    <AnimatePresence>
      {showCelebration && newTier && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={() => setShowCelebration(false)}
        >
          {/* Confetti effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10px`,
                  backgroundColor: [
                    "#F39B9B", "#7C3AED", "#38BDF8", "#22C55E",
                    "#F59E0B", "#EC4899", "#A855F7", "#22D36A",
                  ][i % 8],
                }}
                initial={{ y: -20, rotate: 0, opacity: 1 }}
                animate={{
                  y: window.innerHeight + 50,
                  rotate: Math.random() * 720,
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: "easeIn",
                }}
              />
            ))}
          </div>

          {/* Main celebration card */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
            className="relative bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/30 rounded-3xl p-8 max-w-sm mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowCelebration(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/60 hover:text-white"
            >
              <X size={16} />
            </button>

            {/* Tier icon with glow */}
            <motion.div
              animate={{
                scale: [1, 1.15, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-6xl mb-3"
            >
              {newTier.icon}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Sparkles size={14} className="text-[#A78BFA]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">
                  {t("levelup.title")}
                </p>
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-1">
                {tierTitle(newTier)}
              </h2>
              <p className="text-xs text-[#A09DB1] mb-4">
                {t("levelup.reached", { n: totalPoints.toLocaleString() })}
              </p>

              <div className="bg-white/[0.04] rounded-xl p-3 mb-4">
                <p className="text-[11px] text-[#94A3B8]">
                  {newTier.minPoints >= 10000
                    ? t("levelup.msg.master")
                    : newTier.minPoints >= 5000
                    ? t("levelup.msg.warrior")
                    : newTier.minPoints >= 3000
                    ? t("levelup.msg.scholar")
                    : newTier.minPoints >= 1500
                    ? t("levelup.msg.teacher")
                    : newTier.minPoints >= 500
                    ? t("levelup.msg.disciple")
                    : newTier.minPoints >= 100
                    ? t("levelup.msg.student")
                    : t("levelup.msg.welcome")}
                </p>
              </div>

              <button
                onClick={shareLevelUp}
                className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <Share2 size={14} /> {t("levelup.shareCta")}
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
