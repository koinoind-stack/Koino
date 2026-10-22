"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  PRAYERS,
  PRAYER_CATEGORIES,
  DAILY_VERSES,
  type PrayerPost,
} from "@/lib/crosscrafted-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import LordsbookCommunityCard from "@/components/crosscrafted/LordsbookCommunityCard";
import StreakBadge from "@/components/crosscrafted/StreakBadge";

export default function PrayerWallView() {
  const t = useTranslation();
  const [prayers, setPrayers] = useState<PrayerPost[]>(PRAYERS);
  const [prayedSet, setPrayedSet] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("Healing");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentLists, setCommentLists] = useState<Record<string, { author: string; text: string; ago: string }[]>>(
    {
      p1: [
        { author: "Pastor Sam", text: "Praying for complete healing in Jesus' name! Jehovah Rapha is able.", ago: "1d" },
        { author: "Anonymous", text: "Standing with you sister. Trusting God for the chemo.", ago: "12h" },
      ],
      p2: [
        { author: "Rebecca T.", text: "Praying for peace and God's perfect will to be done!", ago: "6h" },
      ],
    }
  );
  const [dailyVerse] = useState(() => DAILY_VERSES[Math.floor(Math.random() * DAILY_VERSES.length)]);

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

  const togglePray = (id: string) => {
    setPrayedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPrayers((ps) => ps.map((p) => (p.id === id ? { ...p, pray_count: p.pray_count - 1 } : p)));
      } else {
        next.add(id);
        setPrayers((ps) => ps.map((p) => (p.id === id ? { ...p, pray_count: p.pray_count + 1 } : p)));
        toast.success("Praying with you!", { description: "+1 faith point. God hears every prayer." });
      }
      return next;
    });
  };

  const toggleComments = (id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitComment = (prayerId: string) => {
    const text = (commentInputs[prayerId] || "").trim();
    if (!text) return;
    setCommentLists((prev) => ({
      ...prev,
      [prayerId]: [
        ...(prev[prayerId] || []),
        { author: "You", text, ago: "now" },
      ],
    }));
    setCommentInputs((prev) => ({ ...prev, [prayerId]: "" }));
    setPrayers((ps) => ps.map((p) => (p.id === prayerId ? { ...p, comment_count: p.comment_count + 1 } : p)));
    toast.success("Comment added!");
  };

  const handleCreatePrayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Please enter both a title and description");
      return;
    }
    const newPrayer: PrayerPost = {
      id: `p${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      author: isAnonymous ? "Anonymous" : "You",
      is_anonymous: isAnonymous,
      pray_count: 0,
      comment_count: 0,
      created_at: new Date().toISOString(),
    };
    setPrayers([newPrayer, ...prayers]);
    setNewTitle("");
    setNewContent("");
    setNewCategory("Healing");
    setIsAnonymous(false);
    setShowCreateModal(false);
    toast.success("Prayer request shared!", { description: "+10 Faith Points. The community is praying with you." });

    // Record prayer sharing streak — once per day
    try {
      const streaksRaw = localStorage.getItem("crosscrafted_streaks") || "{}";
      const before = JSON.parse(streaksRaw);
      const prevDate = before?.prayer_share?.lastActiveDate;
      const today = new Date().toISOString().split("T")[0];
      if (prevDate !== today) {
        import("@/lib/streaks").then(({ recordStreak }) => {
          const info = recordStreak("prayer_share");
          if (info.currentStreak === 1) {
            toast("🔥 Prayer streak started!", { description: "Share a prayer daily to keep it alive." });
          } else if ([3, 7, 14, 30, 60, 90].includes(info.currentStreak)) {
            toast.success(`🔥 ${info.currentStreak}-day prayer streak!`, {
              description: "Thank you for sharing your heart with the community daily.",
            });
          }
        });
      }
    } catch {
      // ignore
    }
  };

  const formatAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) {
      const absDays = Math.abs(days);
      if (absDays === 0) return "today";
      if (absDays === 1) return "1 day ago";
      return `${absDays} days ago`;
    }
    if (days === 0) return "today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
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

      {/* Prayer streak */}
      <StreakBadge activity="prayer_share" />

      {/* Daily Verse */}
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
        <p className="text-sm text-white italic leading-relaxed mb-2">"{dailyVerse.verse}"</p>
        <p className="text-xs font-bold text-[#F59E0B] mb-2">— {dailyVerse.reference}</p>
        <p className="text-xs text-[#A09DB1] leading-relaxed">{dailyVerse.reflection}</p>
      </motion.div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search prayer requests..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="neo-input text-sm mb-3"
      />

      {/* Categories */}
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
      </div>

      {/* Prayer Cards */}
      <div className="space-y-3">
        {filtered.map((prayer, i) => {
          const hasPrayed = prayedSet.has(prayer.id);
          const showComments = expandedComments.has(prayer.id);
          const comments = commentLists[prayer.id] || [];
          return (
            <motion.div
              key={prayer.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center font-bold text-slate-950 text-sm shrink-0">
                  {prayer.is_anonymous ? <Lock size={16} /> : prayer.author.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{prayer.author}</p>
                  <p className="text-[10px] text-[#94A3B8]">{formatAgo(prayer.created_at)}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] text-[10px] font-bold uppercase tracking-wider">
                  {prayer.category}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mb-1.5">{prayer.title}</h3>
              <p className="text-[13px] text-[#A09DB1] leading-relaxed mb-3">{prayer.content}</p>

              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                <button
                  onClick={() => togglePray(prayer.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    hasPrayed
                      ? "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30"
                      : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                  }`}
                >
                  <Heart size={14} fill={hasPrayed ? "currentColor" : "none"} />
                  {prayer.pray_count} Praying
                </button>
                <button
                  onClick={() => toggleComments(prayer.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] transition-all"
                >
                  <MessageCircle size={14} />
                  {prayer.comment_count}
                </button>
              </div>

              <AnimatePresence>
                {showComments && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-white/[0.06] space-y-2 overflow-hidden"
                  >
                    {comments.map((c, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {c.author === "You" ? "Y" : c.author.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-white">
                            {c.author} <span className="text-[#64748B] font-normal">· {c.ago}</span>
                          </p>
                          <p className="text-[12px] text-[#A09DB1]">{c.text}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Add a prayer or encouragement..."
                        value={commentInputs[prayer.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [prayer.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitComment(prayer.id);
                        }}
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

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <HeartHandshake size={40} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#475569] mb-3">No prayer requests in this category yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
          >
            Share the First Request
          </button>
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
                  <div
                    className={`w-9 h-5 rounded-full p-0.5 transition-all ${
                      isAnonymous ? "bg-[#F59E0B]" : "bg-white/[0.08]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-all ${
                        isAnonymous ? "translate-x-4" : ""
                      }`}
                    />
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
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#F59E0B] hover:bg-[#E59E0B] transition-all hover:-translate-y-px flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={14} /> Share
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lordsbook CTA */}
      <div className="mt-4">
        <LordsbookCommunityCard
          title="Connect with Global Christians"
          description="Connect with Global Christians who believe in the power of prayer on Lordsbook."
          buttonText="Join the Global Christian Community"
          context="prayer"
          variant="compact"
        />
      </div>
    </div>
  );
}
