"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Trophy, Loader2 } from "lucide-react";

type Props = {
  competitionId: string;
  onClose: () => void;
};

export default function CompetitionLeaderboard({ competitionId, onClose }: Props) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<any>(null);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trivia/competitions/${competitionId}/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data.leaderboard || []);
        setMyRank(data.myRank);
        setTotalParticipants(data.totalParticipants || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="text-[#F39B9B] animate-spin" />
      </div>
    );
  }

  const medal = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#F59E0B]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">Competition Leaderboard</p>
            <p className="text-[9px] text-[#64748B]">{totalParticipants} participants</p>
          </div>
        </div>
        <button onClick={onClose} className="text-[#64748B] hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* My rank (if logged in + has attempts) */}
      {myRank && (
        <div className="bg-gradient-to-r from-[#7C3AED]/15 to-[#F39B9B]/15 border border-[#7C3AED]/30 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#A78BFA]">Your Rank</p>
              <p className="text-lg font-black text-white">#{myRank.rank}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-white">{myRank.score} pts</p>
              <p className="text-[10px] text-[#94A3B8]">{myRank.correctCount} correct · {Math.round(myRank.accuracy * 100)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard list */}
      <div className="space-y-1.5">
        {leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <Trophy size={28} className="mx-auto text-[#475569] mb-2" />
            <p className="text-xs text-[#94A3B8]">No participants yet.</p>
            <p className="text-[10px] text-[#64748B] mt-1">Be the first to play!</p>
          </div>
        ) : (
          leaderboard.map((entry, i) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                entry.isCurrentUser
                  ? "bg-[#7C3AED]/10 border-[#7C3AED]/30"
                  : "bg-[#1C1929] border-white/[0.06]"
              }`}
            >
              {/* Rank */}
              <div className="w-8 text-center shrink-0">
                {medal(entry.rank) ? (
                  <span className="text-lg">{medal(entry.rank)}</span>
                ) : (
                  <span className="text-xs font-bold text-[#64748B]">{entry.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#F39B9B] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                {entry.image ? (
                  <img src={entry.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  (entry.username || "A").charAt(0).toUpperCase()
                )}
              </div>

              {/* Name + score */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${entry.isCurrentUser ? "text-[#A78BFA]" : "text-white"}`}>
                  {entry.isCurrentUser ? "You" : entry.username}
                </p>
                <p className="text-[10px] text-[#94A3B8]">
                  {entry.correctCount}/{entry.totalQuestions} correct · {Math.round(entry.accuracy * 100)}%
                </p>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-white">{entry.score}</p>
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider">pts</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-[#64748B] text-center pt-2">
        Leaderboard ranks by competition score (not lifetime Faith Points).
        Tie-break: score → correct → accuracy → time.
      </p>
    </div>
  );
}
