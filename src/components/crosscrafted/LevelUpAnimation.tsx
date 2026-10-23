"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Share2 } from "lucide-react";
import { toast } from "sonner";

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
 * Shows a full-screen celebration animation when user crosses a tier threshold.
 * Detects tier changes by comparing previous and current points.
 */
export default function LevelUpAnimation({ totalPoints }: { totalPoints: number }) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [newTier, setNewTier] = useState<Tier | null>(null);
  const prevTierIdx = useRef<number>(-1);
  const initialized = useRef(false);

  useEffect(() => {
    const currentTierIdx = getTierIndex(totalPoints);

    if (!initialized.current) {
      // First render — just set the initial tier, don't celebrate
      prevTierIdx.current = currentTierIdx;
      initialized.current = true;
      return;
    }

    if (currentTierIdx > prevTierIdx.current) {
      // Tier increased!
      const tier = TIERS[currentTierIdx];
      setNewTier(tier);
      setShowCelebration(true);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        setShowCelebration(false);
      }, 5000);

      // Show toast
      toast.success(`${tier.icon} Level Up! You're now a ${tier.title}!`, {
        duration: 5000,
      });
    }

    prevTierIdx.current = currentTierIdx;
  }, [totalPoints]);

  const shareLevelUp = () => {
    if (!newTier) return;
    const text = `🎉 I just reached ${newTier.title} ${newTier.icon} on Koino! Play Bible Trivia and level up too!`;
    if (navigator.share) {
      navigator.share({ title: "Koino Level Up!", text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied! Share with friends!");
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
                  Level Up!
                </p>
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-1">
                {newTier.title}
              </h2>
              <p className="text-xs text-[#A09DB1] mb-4">
                You've reached {totalPoints.toLocaleString()} Faith Points!
              </p>

              <div className="bg-white/[0.04] rounded-xl p-3 mb-4">
                <p className="text-[11px] text-[#94A3B8]">
                  {newTier.minPoints >= 10000
                    ? "🏆 You've mastered the Bible! Incredible!"
                    : newTier.minPoints >= 5000
                    ? "⚔️ You're a Word Warrior! Keep going!"
                    : newTier.minPoints >= 3000
                    ? "🏆 Theology Scholar! You're on fire!"
                    : newTier.minPoints >= 1500
                    ? "🎓 Bible Teacher! Impressive!"
                    : newTier.minPoints >= 500
                    ? "✝️ Spiritual Disciple! Growing strong!"
                    : newTier.minPoints >= 100
                    ? "📖 Bible Student! Keep studying!"
                    : "🌱 Welcome to Koino!"}
                </p>
              </div>

              <button
                onClick={shareLevelUp}
                className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <Share2 size={14} /> Share Achievement
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
