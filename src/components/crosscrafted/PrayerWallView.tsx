"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Plus,
  HeartHandshake,
  X,
  Globe,
  BookOpen,
  Lock,
  Sparkles,
  Share2,
  Flag,
  Trash2,
  RefreshCw,
  CheckCircle2,
  ArrowUpDown,
  CornerDownRight,
} from "lucide-react";
import { toast } from "sonner";
import { PRAYER_CATEGORIES, DAILY_VERSES } from "@/lib/crosscrafted-data";
import { bibleRefFromDisplay, bibleRefHref } from "@/lib/bible-ref";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import StreakBadge from "@/components/crosscrafted/StreakBadge";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";

// ─── Server types (mirrors /api/prayers responses) ──────────────────────────
type PrayerItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  isAnonymous: boolean;
  answered: boolean;
  testimony: string | null;
  answeredAt: string | null;
  createdAt: string;
  prayCount: number;
  commentCount: number;
  author: { name: string; username: string | null } | null; // null = anonymous
  isMine: boolean;
  canModerate: boolean;
  myPrayed: boolean;
};
type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: { name: string };
  isMine: boolean;
  canModerate: boolean;
};

// Deterministic Verse of the Day: same verse for the whole calendar day
// (UTC day number — identical for every visitor, stable across refreshes).
const verseOfToday = DAILY_VERSES[Math.floor(Date.now() / 86_400_000) % DAILY_VERSES.length];
const verseHref = (() => {
  const parsed = bibleRefFromDisplay(verseOfToday.reference);
  return parsed ? bibleRefHref(parsed) : null;
})();

export default function PrayerWallView() {
  const t = useTranslation();

  // ─── Wall state ───
  const [prayers, setPrayers] = useState<PrayerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [answeredOnly, setAnsweredOnly] = useState(false);
  const [sort, setSort] = useState<"recent" | "most_prayed">("recent");
  const [busyPrayer, setBusyPrayer] = useState<string | null>(null);

  // ─── Create modal ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("Healing");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Comments (per prayer) ───
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentLists, setCommentLists] = useState<Record<string, CommentItem[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());

  // ─── Answered / testimony modal ───
  const [testimonyFor, setTestimonyFor] = useState<PrayerItem | null>(null);
  const [testimonyText, setTestimonyText] = useState("");

  // ─── Share (existing ShareSheet — own requests only) ───
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);

  // ─── Deep link: /?view=prayer-wall&prayer=<id> opens that discussion ───
  const deepLinkConsumed = useRef(false);

  const loadPrayers = useCallback(
    async (opts?: { keepQuiet?: boolean }) => {
      if (!opts?.keepQuiet) setLoading(true);
      setLoadError(false);
      try {
        const sp = new URLSearchParams();
        if (answeredOnly) sp.set("answered", "true");
        sp.set("sort", sort);
        const res = await fetch(`/api/prayers?${sp.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPrayers(data.prayers || []);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [answeredOnly, sort]
  );

  useEffect(() => {
    loadPrayers();
  }, [loadPrayers]);

  // Open the deep-linked prayer's comments once the list arrives.
  useEffect(() => {
    if (deepLinkConsumed.current || loading || !prayers.length) return;
    const pid = new URLSearchParams(window.location.search).get("prayer");
    deepLinkConsumed.current = true;
    if (pid) {
      if (prayers.some((p) => p.id === pid)) {
        toggleComments(pid);
        document.getElementById(`prayer-${pid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, [loading, prayers]);

  const filtered = useMemo(() => {
    return prayers.filter((p) => {
      if (activeCategory !== "All" && p.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.content.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [prayers, activeCategory, searchQuery]);

  // ─── "I Prayed" — optimistic toggle with rollback; server dedupes. ───
  const togglePray = async (prayer: PrayerItem) => {
    if (busyPrayer === prayer.id) return; // double-click guard
    setBusyPrayer(prayer.id);
    const wasPrayed = prayer.myPrayed;
    setPrayers((ps) =>
      ps.map((p) =>
        p.id === prayer.id
          ? { ...p, myPrayed: !wasPrayed, prayCount: p.prayCount + (wasPrayed ? -1 : 1) }
          : p
      )
    );
    try {
      const res = await fetch(`/api/prayers/${prayer.id}/pray`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Reconcile with the server truth (count + prayed state).
      setPrayers((ps) =>
        ps.map((p) => (p.id === prayer.id ? { ...p, myPrayed: data.prayed, prayCount: data.count } : p))
      );
      if (data.prayed && !wasPrayed) {
        toast.success("Praying with you!", { description: "God hears every prayer." });
      }
    } catch {
      // Roll back on failure.
      setPrayers((ps) =>
        ps.map((p) =>
          p.id === prayer.id
            ? { ...p, myPrayed: wasPrayed, prayCount: p.prayCount + (wasPrayed ? 1 : -1) }
            : p
        )
      );
      toast.error("Couldn't record that — please try again.");
    } finally {
      setBusyPrayer(null);
    }
  };

  // ─── Comments ───
  const toggleComments = async (id: string) => {
    const isOpen = expandedComments.has(id);
    const next = new Set(expandedComments);
    if (isOpen) next.delete(id);
    else next.add(id);
    setExpandedComments(next);
    if (!isOpen && !commentLists[id]) {
      setLoadingComments((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/prayers/${id}/comments`, { cache: "no-store" });
        const data = await res.json();
        setCommentLists((prev) => ({ ...prev, [id]: data.comments || [] }));
      } catch {
        toast.error("Couldn't load comments.");
      } finally {
        setLoadingComments((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    }
  };

  const submitComment = async (prayerId: string) => {
    const text = (commentInputs[prayerId] || "").trim();
    if (!text) return;
    const parentId = replyTo[prayerId] || null;
    setCommentInputs((prev) => ({ ...prev, [prayerId]: "" }));
    try {
      const res = await fetch(`/api/prayers/${prayerId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, parentId }),
      });
      if (res.status === 429) {
        toast.error("You're commenting quickly — wait a moment.");
        setCommentInputs((prev) => ({ ...prev, [prayerId]: text }));
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCommentLists((prev) => ({ ...prev, [prayerId]: [...(prev[prayerId] || []), data.comment] }));
      setReplyTo((prev) => ({ ...prev, [prayerId]: null }));
      setPrayers((ps) =>
        ps.map((p) => (p.id === prayerId ? { ...p, commentCount: p.commentCount + 1 } : p))
      );
      toast.success("Comment added!");
    } catch {
      setCommentInputs((prev) => ({ ...prev, [prayerId]: text }));
      toast.error("Couldn't post the comment.");
    }
  };

  const reportComment = async (prayerId: string, c: CommentItem) => {
    try {
      const res = await fetch(`/api/prayers/${prayerId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "prayer_comment", targetId: c.id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Reported — our team will review it.");
    } catch {
      toast.error("Couldn't submit the report.");
    }
  };

  const reportPrayer = async (p: PrayerItem) => {
    try {
      const res = await fetch(`/api/prayers/${p.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "prayer" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Reported — our team will review it.");
    } catch {
      toast.error("Couldn't submit the report.");
    }
  };

  const deletePrayer = async (p: PrayerItem) => {
    if (!confirm("Delete this prayer request? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/prayers/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPrayers((ps) => ps.filter((x) => x.id !== p.id));
      toast.success("Request deleted.");
    } catch {
      toast.error("Couldn't delete the request.");
    }
  };

  const markAnswered = async (withTestimony: boolean) => {
    if (!testimonyFor) return;
    const p = testimonyFor;
    try {
      const res = await fetch(`/api/prayers/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answered: true,
          testimony: withTestimony ? testimonyText.trim() || null : null,
        }),
      });
      if (!res.ok) throw new Error();
      setPrayers((ps) =>
        ps.map((x) =>
          x.id === p.id
            ? { ...x, answered: true, testimony: withTestimony ? testimonyText.trim() || null : null, answeredAt: new Date().toISOString() }
            : x
        )
      );
      toast.success("Praise God! Marked as answered.");
      setTestimonyFor(null);
      setTestimonyText("");
    } catch {
      toast.error("Couldn't update — please try again.");
    }
  };

  const handleCreatePrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Please enter both a title and description");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/prayers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          category: newCategory,
          isAnonymous,
        }),
      });
      if (res.status === 429) {
        toast.error("You're sharing quickly — please wait a little.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPrayers((prev) => [data.prayer, ...prev]);
      setNewTitle("");
      setNewContent("");
      setNewCategory("Healing");
      setIsAnonymous(false);
      setShowCreateModal(false);
      toast.success("Prayer request shared!", {
        description: "The community can pray with you now.",
      });
      // Streak reflects GENUINE activity: only after the server persisted it.
      try {
        const streaksRaw = localStorage.getItem("crosscrafted_streaks") || "{}";
        const before = JSON.parse(streaksRaw);
        const prevDate = before?.prayer_share?.lastActiveDate;
        const today = new Date().toISOString().split("T")[0];
        if (prevDate !== today) {
          const { recordStreak } = await import("@/lib/streaks");
          const info = recordStreak("prayer_share");
          if (info.currentStreak === 1) {
            toast("🔥 Prayer streak started!", { description: "Share a prayer daily to keep it alive." });
          } else if ([3, 7, 14, 30, 60, 90].includes(info.currentStreak)) {
            toast.success(`🔥 ${info.currentStreak}-day prayer streak!`);
          }
        }
      } catch {
        // streak is best-effort
      }
    } catch (err) {
      toast.error(
        err instanceof Error && err.message !== "Failed to fetch" && !err.message.startsWith("HTTP")
          ? err.message
          : "Couldn't share the request — please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "today";
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) return `${Math.max(1, Math.floor(diff / (1000 * 60)))}m ago`;
      return `${hours}h ago`;
    }
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const openPrayerShare = (prayer: PrayerItem) => {
    setShareReq({
      heading: "Share your prayer",
      shareText: `${prayer.title}\n\n${prayer.content}`,
      shareUrl: undefined,
      cardUrl: `/api/share-card?type=prayer&title=${encodeURIComponent(prayer.title.slice(0, 120))}&body=${encodeURIComponent(prayer.content.slice(0, 500))}&category=${encodeURIComponent(prayer.category.slice(0, 40))}`,
      formats: ["square", "story"],
      fileName: `koino-prayer-${prayer.id}.png`,
    });
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t("prayer.title")}</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">{t("prayer.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:-translate-y-px"
          style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
        >
          <Plus size={14} /> Share
        </button>
      </div>

      <StreakBadge activity="prayer_share" />

      {/* Daily Verse — deterministic per calendar day, links into the reader */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#F59E0B]/20 rounded-2xl p-4 mb-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center">
            <BookOpen size={14} className="text-[#F59E0B]" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">Verse of the Day</p>
        </div>
        <p className="text-sm text-white italic leading-relaxed mb-2">&quot;{verseOfToday.verse}&quot;</p>
        <p className="text-xs font-bold text-[#F59E0B] mb-2">— {verseOfToday.reference}</p>
        <p className="text-xs text-[#A09DB1] leading-relaxed mb-2">{verseOfToday.reflection}</p>
        {verseHref && (
          <a
            href={verseHref}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F59E0B] hover:text-white transition-colors"
          >
            <BookOpen size={12} /> Read in the Bible
          </a>
        )}
      </motion.div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search prayer requests..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="neo-input text-sm mb-3"
      />

      {/* Categories + Answered filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-2">
        {PRAYER_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-[#F59E0B] text-slate-950"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setAnsweredOnly(!answeredOnly)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            answeredOnly
              ? "bg-[#34D399] text-slate-950"
              : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
          }`}
        >
          <CheckCircle2 size={12} /> Answered
        </button>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <ArrowUpDown size={12} className="text-[#64748B]" />
        {(["recent", "most_prayed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              sort === s ? "bg-white/[0.08] text-white" : "text-[#64748B] hover:text-white"
            }`}
          >
            {s === "recent" ? "Recent" : "Most Prayed For"}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-28 bg-white/[0.06] rounded" />
                  <div className="h-2 w-16 bg-white/[0.04] rounded" />
                </div>
              </div>
              <div className="h-3 w-3/4 bg-white/[0.06] rounded mb-2" />
              <div className="h-3 w-1/2 bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && loadError && (
        <div className="text-center py-16">
          <HeartHandshake size={40} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#94A3B8] mb-3">Couldn&apos;t load the prayer wall.</p>
          <button
            onClick={() => loadPrayers()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !loadError && filtered.length === 0 && (
        <div className="text-center py-16">
          <HeartHandshake size={40} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#475569] mb-3">
            {answeredOnly
              ? "No answered prayers here yet — breakthrough is coming."
              : "No prayer requests in this category yet."}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
          >
            Share the First Request
          </button>
        </div>
      )}

      {/* Prayer Cards */}
      {!loading && !loadError && (
        <div className="space-y-3">
          {filtered.map((prayer, i) => {
            const hasPrayed = prayer.myPrayed;
            const showComments = expandedComments.has(prayer.id);
            const comments = commentLists[prayer.id] || [];
            const roots = comments.filter((c) => !c.parentId);
            const repliesByParent = comments.reduce<Record<string, CommentItem[]>>((acc, c) => {
              if (c.parentId) (acc[c.parentId] ||= []).push(c);
              return acc;
            }, {});
            return (
              <motion.div
                key={prayer.id}
                id={`prayer-${prayer.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className={`bg-[#1C1929] border rounded-2xl p-4 ${
                  prayer.answered ? "border-[#34D399]/30" : "border-white/[0.06]"
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-950 text-sm shrink-0 ${prayer.answered ? "bg-gradient-to-br from-[#34D399] to-[#10B981]" : "bg-gradient-to-br from-[#F59E0B] to-[#EF4444]"}`}>
                    {prayer.isAnonymous ? <Lock size={16} /> : (prayer.author?.name || "M").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {prayer.isAnonymous ? "Anonymous" : prayer.author?.name || "Member"}
                      {prayer.isMine && <span className="text-[#64748B] font-normal"> · you</span>}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">{formatAgo(prayer.createdAt)}</p>
                  </div>
                  {prayer.answered && (
                    <span className="px-2 py-0.5 rounded-full bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] text-[10px] font-bold uppercase tracking-wider">
                      Answered
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] text-[10px] font-bold uppercase tracking-wider">
                    {prayer.category}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1.5">{prayer.title}</h3>
                <p className="text-[13px] text-[#A09DB1] leading-relaxed mb-3">{prayer.content}</p>

                {prayer.answered && prayer.testimony && (
                  <div className="bg-[#34D399]/8 border border-[#34D399]/20 rounded-xl p-3 mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#34D399] mb-1">Praise Report</p>
                    <p className="text-[12px] text-[#A09DB1] leading-relaxed">{prayer.testimony}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04] flex-wrap">
                  <button
                    onClick={() => togglePray(prayer)}
                    disabled={busyPrayer === prayer.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${
                      hasPrayed
                        ? "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30"
                        : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                    }`}
                  >
                    <Heart size={14} fill={hasPrayed ? "currentColor" : "none"} />
                    {prayer.prayCount} Praying
                  </button>
                  <button
                    onClick={() => toggleComments(prayer.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] transition-all"
                  >
                    <MessageCircle size={14} />
                    {prayer.commentCount}
                  </button>
                  {prayer.isMine && !prayer.answered && (
                    <button
                      onClick={() => { setTestimonyFor(prayer); setTestimonyText(""); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#34D399]/10 text-[#34D399] hover:text-white border border-[#34D399]/25 transition-all"
                      title="God answered — share the praise report"
                    >
                      <CheckCircle2 size={14} /> Answered
                    </button>
                  )}
                  {prayer.isMine && (
                    <button
                      onClick={() => openPrayerShare(prayer)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F59E0B]/10 text-[#F59E0B] hover:text-white border border-[#F59E0B]/25 transition-all"
                      title="Share your prayer (text + branded image — no public link)"
                    >
                      <Share2 size={14} /> Share
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {!prayer.isMine && (
                      <button
                        onClick={() => reportPrayer(prayer)}
                        className="p-1.5 rounded-lg text-[#475569] hover:text-[#EF4444] transition-colors"
                        title="Report this request"
                      >
                        <Flag size={13} />
                      </button>
                    )}
                    {(prayer.isMine || prayer.canModerate) && (
                      <button
                        onClick={() => deletePrayer(prayer)}
                        className="p-1.5 rounded-lg text-[#475569] hover:text-[#EF4444] transition-colors"
                        title={prayer.isMine ? "Delete your request" : "Remove (moderator)"}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {showComments && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-white/[0.06] space-y-2 overflow-hidden"
                    >
                      {loadingComments.has(prayer.id) && (
                        <p className="text-[11px] text-[#64748B] py-2">Loading…</p>
                      )}
                      {!loadingComments.has(prayer.id) && roots.length === 0 && (
                        <p className="text-[11px] text-[#64748B] py-2">
                          No comments yet — be the first to pray with them.
                        </p>
                      )}
                      {roots.map((c) => (
                        <div key={c.id}>
                          <div className="flex gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {c.author.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-white">
                                {c.author.name}
                                {c.isMine && <span className="text-[#64748B] font-normal"> · you</span>}
                                <span className="text-[#64748B] font-normal"> · {formatAgo(c.createdAt)}</span>
                              </p>
                              <p className="text-[12px] text-[#A09DB1]">{c.body}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <button
                                  onClick={() => setReplyTo((prev) => ({ ...prev, [prayer.id]: c.id }))}
                                  className="text-[10px] font-bold text-[#64748B] hover:text-[#F59E0B] flex items-center gap-1"
                                >
                                  <CornerDownRight size={10} /> Reply
                                </button>
                                {c.isMine && (
                                  <button
                                    onClick={async () => {
                                      if (!confirm("Delete your comment?")) return;
                                      const res = await fetch(`/api/prayers/${prayer.id}/comments?commentId=${c.id}`, { method: "DELETE" });
                                      if (res.ok) {
                                        const removed = 1 + (repliesByParent[c.id]?.length || 0);
                                        setCommentLists((prev) => ({
                                          ...prev,
                                          [prayer.id]: (prev[prayer.id] || []).filter((x) => x.id !== c.id && x.parentId !== c.id),
                                        }));
                                        setPrayers((ps) => ps.map((p) => p.id === prayer.id ? { ...p, commentCount: Math.max(0, p.commentCount - removed) } : p));
                                      }
                                    }}
                                    className="text-[10px] font-bold text-[#64748B] hover:text-[#EF4444]"
                                  >
                                    Delete
                                  </button>
                                )}
                                {!c.isMine && (
                                  <button
                                    onClick={() => reportComment(prayer.id, c)}
                                    className="text-[10px] font-bold text-[#64748B] hover:text-[#EF4444]"
                                  >
                                    Report
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          {(repliesByParent[c.id] || []).map((r) => (
                            <div key={r.id} className="flex gap-2 ml-9 mt-1.5">
                              <div className="w-6 h-6 rounded-md bg-white/[0.05] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                {r.author.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-white">
                                  {r.author.name}
                                  {r.isMine && <span className="text-[#64748B] font-normal"> · you</span>}
                                  <span className="text-[#64748B] font-normal"> · {formatAgo(r.createdAt)}</span>
                                </p>
                                <p className="text-[11px] text-[#A09DB1]">{r.body}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        {replyTo[prayer.id] && (
                          <button
                            onClick={() => setReplyTo((prev) => ({ ...prev, [prayer.id]: null }))}
                            className="px-2 rounded-xl bg-white/[0.04] text-[10px] font-bold text-[#94A3B8] hover:text-white"
                            title="Cancel reply"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <input
                          type="text"
                          placeholder={replyTo[prayer.id] ? "Write a reply..." : "Add a prayer or encouragement..."}
                          value={commentInputs[prayer.id] || ""}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [prayer.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") submitComment(prayer.id); }}
                          className="neo-input text-xs flex-1"
                        />
                        <button
                          onClick={() => submitComment(prayer.id)}
                          className="px-3 rounded-xl bg-[#F59E0B] text-slate-950 text-xs font-bold hover:bg-[#E59E0B]"
                        >
                          Send
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60]"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#F59E0B] to-[#EF4444] bg-clip-text text-transparent">
                  Share a Prayer Request
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#64748B] hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreatePrayer} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="neo-input text-sm"
                    placeholder="Brief title for your request"
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRAYER_CATEGORIES.filter((c) => c !== "All").map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          newCategory === cat
                            ? "bg-[#F59E0B] text-slate-950"
                            : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Request Details
                  </label>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="neo-input h-28 resize-none text-sm"
                    placeholder="Share what's on your heart..."
                    maxLength={2000}
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    isAnonymous
                      ? "bg-[#F59E0B]/10 border-[#F59E0B]/30"
                      : "bg-white/[0.04] border-white/[0.06]"
                  }`}
                >
                  <Globe size={16} className={isAnonymous ? "text-[#F59E0B]" : "text-[#94A3B8]"} />
                  <div className="text-left flex-1">
                    <p className="text-xs font-bold text-white">Share anonymously</p>
                    <p className="text-[10px] text-[#94A3B8]">
                      Your name will be hidden from the post
                    </p>
                  </div>
                  <div className={`w-9 h-5 rounded-full p-0.5 transition-all ${isAnonymous ? "bg-[#F59E0B]" : "bg-white/[0.08]"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-all ${isAnonymous ? "translate-x-4" : ""}`} />
                  </div>
                </button>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#F59E0B] hover:bg-[#E59E0B] transition-all hover:-translate-y-px flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <Sparkles size={14} /> {submitting ? "Sharing..." : "Share"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answered / testimony modal */}
      <AnimatePresence>
        {testimonyFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60]"
            onClick={(e) => e.target === e.currentTarget && setTestimonyFor(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg p-5"
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#34D399] to-[#10B981] bg-clip-text text-transparent">
                  Answered Prayer 🙏
                </h2>
                <button onClick={() => setTestimonyFor(null)} className="text-[#64748B] hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-[#A09DB1] leading-relaxed mb-3">
                Praise God! Mark &quot;{testimonyFor.title}&quot; as answered. You can optionally share a
                short testimony to encourage others — it will appear on your request.
              </p>
              <textarea
                value={testimonyText}
                onChange={(e) => setTestimonyText(e.target.value)}
                className="neo-input h-24 resize-none text-sm mb-3"
                placeholder="How did God answer? (optional)"
                maxLength={1000}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => markAnswered(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                >
                  Mark answered
                </button>
                <button
                  onClick={() => markAnswered(true)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#34D399] hover:bg-[#2DD4A8]"
                >
                  Share testimony
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── UNIVERSAL SHARE SHEET ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />
    </div>
  );
}
