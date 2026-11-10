"use client";

// ─── ReactionBar — persisted reactions for articles & questions (PART 2) ────
//
// Replaces the old client-only fake "like". Two reaction kinds (AMEN /
// INSIGHTFUL), DB-enforced one-per-user-per-kind, counts loaded from
// /api/apologetics/engagement. Anonymous visitors get a sign-in nudge
// instead of a dead button.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";

// Module-scope on purpose — labels are i18n KEYS resolved with t() inside
// the component (never call t() at module scope).
export const REACTION_KINDS = [
  { kind: "AMEN", emoji: "🙏", labelKey: "reaction.amen" },
  { kind: "INSIGHTFUL", emoji: "💡", labelKey: "reaction.insightful" },
] as const;

export type EngagementCounts = { AMEN: number; INSIGHTFUL: number; comments: number };

export default function ReactionBar({
  targetType,
  targetId,
  counts,
  myReactions,
  isAuthenticated,
  onChange,
  compact,
}: {
  targetType: "article" | "question";
  targetId: string;
  counts: EngagementCounts;
  myReactions: string[]; // kinds the current user has reacted with
  isAuthenticated: boolean;
  onChange: (targetType: string, targetId: string, kind: string, reacted: boolean, count: number) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const t = useTranslation();

  const toggle = async (kind: string) => {
    if (!isAuthenticated) {
      toast.error(t("reaction.signInRequired"), {
        description: t("reaction.signInDesc"),
      });
      return;
    }
    const reacted = myReactions.includes(kind);
    setBusy(kind);
    try {
      const res = await fetch("/api/apologetics/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, kind, react: !reacted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("reaction.error"));
      onChange(targetType, targetId, kind, data.reacted, data.count);
    } catch (e: any) {
      toast.error(e?.message || t("reaction.error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {REACTION_KINDS.map(({ kind, emoji, labelKey }) => {
        const mine = myReactions.includes(kind);
        return (
          <button
            key={kind}
            onClick={() => toggle(kind)}
            disabled={busy === kind}
            title={t(labelKey)}
            className={`flex items-center gap-1 rounded-lg font-bold transition-all disabled:opacity-50 ${
              compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
            } ${
              mine
                ? "bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#93C5FD]"
                : "bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-white hover:border-white/[0.2]"
            }`}
          >
            {busy === kind ? (
              <Loader2 size={compact ? 10 : 12} className="animate-spin" />
            ) : (
              <span>{emoji}</span>
            )}
            <span className="tabular-nums">{counts[kind] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
