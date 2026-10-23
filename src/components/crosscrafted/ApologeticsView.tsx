"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  X,
  Search,
  Eye,
  Plus,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  APOLOGETICS_TOPICS,
  CHURCH_GRADIENTS,
  type ApologeticsPost,
  type ApologeticsQuestion,
  type ApologeticsAnswer,
} from "@/lib/crosscrafted-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/use-user";

// ─── Helper: map admin category label → APOLOGETICS_TOPICS id ──────────────
// The admin editor uses category labels like "God & Existence", "Jesus Christ",
// "Resurrection", "Bible", "Science & Faith", etc. The SPA's topic filter uses
// IDs like "gods_existence", "resurrection", "bible_reliability".
// This helper maps the label to the closest topic ID so the filter works.
// If no match, returns "" (shows under "All Topics").
function mapCategoryToTopicId(category: string | null | undefined): string {
  if (!category) return "";
  const c = category.toLowerCase().trim();
  if (c.includes("god") && c.includes("exist")) return "gods_existence";
  if (c.includes("evil") || c.includes("suffer")) return "problem_of_evil";
  if (c.includes("resurrection") || c.includes("jesus")) return "resurrection";
  if (c.includes("bible")) return "bible_reliability";
  if (c.includes("science")) return "science_faith";
  if (c.includes("world") || c.includes("religion")) return "world_religions";
  return ""; // no topic match — shows under "All Topics"
}

export default function ApologeticsView() {
  const t = useTranslation();
  const { isAuthenticated } = useSupabaseUser();
  const [activeTab, setActiveTab] = useState<"articles" | "qa">("articles");
  // ─── PUBLISHED ARTICLES (loaded from real DB via /api/articles) ───
  // The APOLOGETICS_POSTS mock array is NO LONGER used — all articles come
  // from the database. status=published + contentType=APOLOGETICS only
  // (server-enforced). Admin-created articles appear here after publishing.
  const [posts, setPosts] = useState<ApologeticsPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  // ─── Q&A (loaded from real DB via /api/questions — answered only) ───
  // Public API returns ONLY status=answered questions. New user submissions
  // start as status=new and are hidden until an admin answers them
  // (server-enforced). The `dbQuestions` snapshot is used for the tab badge
  // count so it doesn't flicker while client-side filtering.
  const [dbQuestions, setDbQuestions] = useState<ApologeticsQuestion[]>([]);
  const [questions, setQuestions] = useState<ApologeticsQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [openPost, setOpenPost] = useState<ApologeticsPost | null>(null);
  const [openQuestion, setOpenQuestion] = useState<ApologeticsQuestion | null>(null);
  const [showAskModal, setShowAskModal] = useState(false);
  const [askForm, setAskForm] = useState({ title: "", body: "", topic: "", author: "" });

  // ─── Fetch published apologetics articles from the database ───
  // Public API returns ONLY status=published + contentType=APOLOGETICS
  // (server-enforced). Maps DB fields to the ApologeticsPost shape.
  const loadPosts = async () => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const res = await fetch("/api/articles?type=APOLOGETICS", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load articles");
      const articles = data.articles || [];
      // Map DB article → ApologeticsPost shape
      const mapped: ApologeticsPost[] = articles.map((a: any) => ({
        id: a.id,
        title: a.title,
        body: a.excerpt || a.shortAnswer || "", // use excerpt as the preview body
        author: a.authorName || "Koino",
        topic: mapCategoryToTopicId(a.category), // map category label → topic id
        date: a.publishedAt || a.createdAt,
        likes: a.viewCount || 0, // use viewCount as a proxy for engagement
        comments: 0,
        cover_gradient: 0,
        cover_image: a.coverImageUrl || undefined,
        slug: a.slug, // for linking to /apologetics/[slug]
        featured: a.featured,
      }));
      setPosts(mapped);
    } catch (e: any) {
      setPostsError(e.message || "Failed to load articles");
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  // ─── Fetch answered questions from the database ───
  // Public API returns ONLY status=answered questions. Maps DB fields to the
  // ApologeticsQuestion shape. The admin's answer (stored in adminNotes) is
  // rendered as a single accepted answer authored by "Koino".
  const loadQuestions = async () => {
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const res = await fetch("/api/questions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load questions");
      const mapped: ApologeticsQuestion[] = (data.questions || []).map((q: any) => {
        const fullQuestion: string = q.question || "";
        const firstLine = fullQuestion.split("\n")[0]?.trim() || "";
        const title = (firstLine.slice(0, 100) || fullQuestion.slice(0, 100)) || "Untitled question";
        const dateStr = (q.createdAt || "").split("T")[0] || new Date().toISOString().split("T")[0];
        const answers: ApologeticsAnswer[] = q.answer
          ? [{
              id: `${q.id}-a1`,
              author: "Koino",
              authorRole: "Admin" as const,
              body: q.answer,
              date: dateStr,
              is_accepted: true,
              likes: 0,
            }]
          : [];
        return {
          id: q.id,
          title,
          body: fullQuestion,
          author: q.askerName || "Anonymous",
          topic: q.category || "",
          date: dateStr,
          likes: 0,
          answers,
          status: q.status === "answered" ? "answered" : "open",
        };
      });
      setDbQuestions(mapped);
      setQuestions(mapped);
    } catch (e: any) {
      setQuestionsError(e.message || "Failed to load questions");
      setQuestions([]);
      setDbQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (filterTopic && p.topic !== filterTopic) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [posts, filterTopic, search]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterTopic && q.topic !== filterTopic) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!q.title.toLowerCase().includes(s) && !q.body.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [questions, filterTopic, search]);

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        toast.success("Liked!", { description: "Thanks for engaging with this content." });
      }
      return next;
    });
  };

  const sharePost = (p: ApologeticsPost) => {
    navigator.clipboard.writeText(`"${p.title}" by ${p.author} on CrossCrafted Apologetics`);
    toast.success("Post link copied!");
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askForm.title.trim() || !askForm.body.trim()) {
      toast.error("Please enter both a title and question details");
      return;
    }
    // The DB stores a single `question` field — combine title + body so the
    // admin sees both the headline and the context when answering.
    const questionText = `${askForm.title.trim()}\n\n${askForm.body.trim()}`;
    setSubmittingQuestion(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionText,
          askerName: askForm.author.trim() || undefined,
          category: askForm.topic || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to submit question (HTTP ${res.status})`);
      }
      toast.success("Question submitted successfully", {
        description: "It will appear once answered by our team.",
      });
      setAskForm({ title: "", body: "", topic: "", author: "" });
      setShowAskModal(false);
      // Refresh — the new question won't appear in the public list (status=new)
      // but this keeps the list + count in sync.
      loadQuestions();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit question");
      // Keep modal open + preserve form content so the user can retry.
    } finally {
      setSubmittingQuestion(false);
    }
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t("apologetics.title")}</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">{t("apologetics.subtitle")}</p>
        </div>
        {activeTab === "qa" && (
          <button
            onClick={() => setShowAskModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, #38BDF8, #A855F7)" }}
          >
            <Plus size={14} /> Ask Question
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl mb-4">
        <button
          onClick={() => setActiveTab("articles")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "articles" ? "bg-[#38BDF8] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <BookOpen size={12} /> Articles
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "qa" ? "bg-[#38BDF8] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <HelpCircle size={12} /> Q&amp;A
          <span className="px-1.5 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] text-[9px] font-bold tabular-nums">
            {questionsLoading ? "…" : dbQuestions.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={`Search ${activeTab === "articles" ? "articles" : "questions"}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="neo-input text-sm mb-3"
      />

      {/* Topic Pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-2">
        <button
          onClick={() => setFilterTopic("")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            !filterTopic
              ? "bg-white text-slate-950"
              : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
          }`}
        >
          All Topics
        </button>
        {APOLOGETICS_TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterTopic(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterTopic === t.id ? "text-slate-950" : "text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
            style={filterTopic === t.id ? { background: t.color } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "articles" ? (
          <motion.div key="articles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Loading state */}
            {postsLoading && (
              <div className="text-center py-12">
                <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin mb-3" />
                <p className="text-xs text-[#94A3B8]">Loading articles…</p>
              </div>
            )}

            {/* Error state */}
            {!postsLoading && postsError && (
              <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-2xl p-5 text-center">
                <p className="text-sm font-bold text-[#EF4444] mb-1">Failed to load articles</p>
                <p className="text-xs text-[#A09DB1] mb-3">{postsError}</p>
                <button
                  onClick={loadPosts}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty state — no published articles yet */}
            {!postsLoading && !postsError && posts.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 mb-3">
                  <BookOpen size={24} className="text-[#A78BFA]" />
                </div>
                <p className="text-sm font-bold text-white mb-1">No articles published yet</p>
                <p className="text-xs text-[#A09DB1] max-w-sm mx-auto">
                  Apologetics articles will appear here once they are published by the Koino team.
                </p>
              </div>
            )}

            {/* Articles list (only when not loading/error/empty) */}
            {!postsLoading && !postsError && posts.length > 0 && (
              <>
            {/* Featured Post */}
            {filtered[0] && !filterTopic && !search && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  // If the post has a slug (DB-backed), navigate to the public
                  // article page. Otherwise (legacy mock), open the modal.
                  if (filtered[0].slug) {
                    window.location.href = `/apologetics/${filtered[0].slug}`;
                  } else {
                    setOpenPost(filtered[0]);
                  }
                }}
                className="relative rounded-2xl overflow-hidden cursor-pointer mb-4 border border-white/[0.06]"
              >
                <div className="relative h-44" style={{ background: CHURCH_GRADIENTS[filtered[0].cover_gradient] }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-[#1C1929]/40 to-transparent" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#22C55E]/15 backdrop-blur-sm border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">
                    Featured
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h2 className="text-lg font-extrabold text-white mb-1 leading-tight">{filtered[0].title}</h2>
                  <p className="text-xs text-white/70 line-clamp-2 mb-2">{filtered[0].body}</p>
                  <div className="flex items-center gap-3 text-[10px] text-white/60">
                    <span className="font-bold text-white/80">{filtered[0].author}</span>
                    <span>·</span>
                    <span>{new Date(filtered[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Heart size={9} /> {filtered[0].likes}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Post List */}
            <div className="space-y-3">
              {(filterTopic || search ? filtered : filtered.slice(1)).map((post, i) => {
                const topic = APOLOGETICS_TOPICS.find((t) => t.id === post.topic);
                const hasLiked = liked.has(post.id);
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      // If the post has a slug (DB-backed), navigate to the
                      // public article page. Otherwise (legacy mock), open modal.
                      if (post.slug) {
                        window.location.href = `/apologetics/${post.slug}`;
                      } else {
                        setOpenPost(post);
                      }
                    }}
                    className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 cursor-pointer hover:border-white/[0.12] transition-all"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div
                        className="w-1.5 h-12 rounded-full shrink-0 mt-1"
                        style={{ background: topic?.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block mb-1.5"
                          style={{ backgroundColor: `${topic?.color}20`, color: topic?.color }}
                        >
                          {topic?.label}
                        </span>
                        <h3 className="text-base font-bold text-white leading-tight">{post.title}</h3>
                      </div>
                    </div>
                    <p className="text-[13px] text-[#A09DB1] leading-relaxed line-clamp-3 mb-3">{post.body}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#38BDF8] to-[#A855F7] flex items-center justify-center text-[10px] font-bold text-white">
                          {post.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-white">{post.author}</p>
                          <p className="text-[9px] text-[#94A3B8]">
                            {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[#94A3B8]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(post.id);
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            hasLiked ? "bg-[#EC4899]/15 text-[#EC4899]" : "hover:text-white"
                          }`}
                        >
                          <Heart size={12} fill={hasLiked ? "currentColor" : "none"} />
                          {post.likes + (hasLiked ? 1 : 0)}
                        </button>
                        <span className="flex items-center gap-1 text-[10px]">
                          <MessageCircle size={12} /> {post.comments}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Search size={32} className="mx-auto text-[#475569] mb-2" />
                <p className="text-sm text-[#475569]">No articles found.</p>
              </div>
            )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Q&A Banner */}
            <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#38BDF8]/20 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center shrink-0">
                  <HelpCircle size={18} className="text-[#38BDF8]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white mb-1">Have a question about faith?</p>
                  <p className="text-[11px] text-[#A09DB1] leading-relaxed">
                    Ask anything — our team reviews every question and posts a thoughtful,
                    biblically-grounded answer. Answered questions appear below.
                  </p>
                </div>
              </div>
            </div>

            {/* Loading state */}
            {questionsLoading && (
              <div className="text-center py-12">
                <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#38BDF8] animate-spin mb-3" />
                <p className="text-xs text-[#94A3B8]">Loading questions…</p>
              </div>
            )}

            {/* Error state */}
            {!questionsLoading && questionsError && (
              <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-2xl p-5 text-center">
                <p className="text-sm font-bold text-[#EF4444] mb-1">Failed to load questions</p>
                <p className="text-xs text-[#A09DB1] mb-3">{questionsError}</p>
                <button
                  onClick={loadQuestions}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty state — no answered questions yet */}
            {!questionsLoading && !questionsError && questions.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/25 mb-3">
                  <HelpCircle size={24} className="text-[#38BDF8]" />
                </div>
                <p className="text-sm font-bold text-white mb-1">No questions yet</p>
                <p className="text-xs text-[#A09DB1] max-w-sm mx-auto mb-4">
                  Be the first to ask! Your question will be reviewed and answered by our team.
                </p>
                {isAuthenticated ? (
                  <button
                    onClick={() => setShowAskModal(true)}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #38BDF8, #A855F7)" }}
                  >
                    <Plus size={14} /> Ask a Question
                  </button>
                ) : (
                  <a
                    href="/login"
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #38BDF8, #A855F7)" }}
                  >
                    Sign in to ask
                  </a>
                )}
              </div>
            )}

            {/* Questions List (only when loaded + has items) */}
            {!questionsLoading && !questionsError && questions.length > 0 && (
              <div className="space-y-3">
                {filteredQuestions.map((q, i) => {
                const topic = APOLOGETICS_TOPICS.find((t) => t.id === q.topic);
                const hasLiked = liked.has(q.id);
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setOpenQuestion(q)}
                    className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 cursor-pointer hover:border-white/[0.12] transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {topic && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${topic.color}20`, color: topic.color }}
                        >
                          {topic.label}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          q.status === "answered"
                            ? "bg-[#22C55E]/15 text-[#22C55E]"
                            : "bg-[#F59E0B]/15 text-[#F59E0B]"
                        }`}
                      >
                        {q.status === "answered" ? "Answered" : "Open"}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white leading-tight mb-1">{q.title}</h3>
                    <p className="text-[13px] text-[#A09DB1] leading-relaxed line-clamp-2 mb-2">{q.body}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white">
                          {q.author === "Anonymous" ? "?" : q.author.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-white">{q.author}</p>
                          <p className="text-[9px] text-[#94A3B8]">
                            {new Date(q.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[#94A3B8]">
                        {q.answers.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-bold">
                            <MessageCircle size={12} /> {q.answers.length} {q.answers.length === 1 ? "answer" : "answers"}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px]">
                          <Heart size={12} /> {q.likes}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              </div>
            )}

            {/* No results after filtering */}
            {!questionsLoading && !questionsError && questions.length > 0 && filteredQuestions.length === 0 && (
              <div className="text-center py-12">
                <Search size={32} className="mx-auto text-[#475569] mb-2" />
                <p className="text-sm text-[#475569]">No questions match your search.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {openPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60] p-0 md:p-6"
            onClick={(e) => e.target === e.currentTarget && setOpenPost(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="relative h-32" style={{ background: CHURCH_GRADIENTS[openPost.cover_gradient] }}>
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] to-transparent" />
                <button
                  onClick={() => setOpenPost(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 -mt-12 relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#38BDF8] to-[#A855F7] flex items-center justify-center text-base font-bold text-white border-4 border-[#1C1929]">
                    {openPost.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{openPost.author}</p>
                    <p className="text-[10px] text-[#94A3B8]">
                      {new Date(openPost.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {(() => {
                  const topic = APOLOGETICS_TOPICS.find((t) => t.id === openPost.topic);
                  return (
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${topic?.color}20`, color: topic?.color }}
                    >
                      {topic?.label}
                    </span>
                  );
                })()}

                <h2 className="text-xl font-extrabold text-white leading-tight">{openPost.title}</h2>
                <p className="text-sm text-[#A09DB1] leading-relaxed whitespace-pre-line">{openPost.body}</p>

                <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => toggleLike(openPost.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      liked.has(openPost.id)
                        ? "bg-[#EC4899]/15 text-[#EC4899] border border-[#EC4899]/30"
                        : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                    }`}
                  >
                    <Heart size={14} fill={liked.has(openPost.id) ? "currentColor" : "none"} />
                    {openPost.likes + (liked.has(openPost.id) ? 1 : 0)}
                  </button>
                  <button
                    onClick={() => sharePost(openPost)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] transition-all"
                  >
                    <Share2 size={14} /> Share
                  </button>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-[#94A3B8]">
                    <Eye size={12} /> {(openPost.likes * 8).toLocaleString()} views
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Detail Modal */}
      <AnimatePresence>
        {openQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60] p-0 md:p-6"
            onClick={(e) => e.target === e.currentTarget && setOpenQuestion(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setOpenQuestion(null)}
                    className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors"
                  >
                    <X size={14} /> Close
                  </button>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      openQuestion.status === "answered"
                        ? "bg-[#22C55E]/15 text-[#22C55E]"
                        : "bg-[#F59E0B]/15 text-[#F59E0B]"
                    }`}
                  >
                    {openQuestion.status === "answered" ? "Answered" : "Open"}
                  </span>
                </div>

                {(() => {
                  const topic = APOLOGETICS_TOPICS.find((t) => t.id === openQuestion.topic);
                  return (
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${topic?.color}20`, color: topic?.color }}
                    >
                      {topic?.label}
                    </span>
                  );
                })()}

                <h2 className="text-xl font-extrabold text-white leading-tight">{openQuestion.title}</h2>
                <p className="text-sm text-[#A09DB1] leading-relaxed">{openQuestion.body}</p>

                <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white">
                    {openQuestion.author === "Anonymous" ? "?" : openQuestion.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white">{openQuestion.author}</p>
                    <p className="text-[9px] text-[#94A3B8]">
                      {new Date(openQuestion.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Answers — read-only display of the admin's answer */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                    {openQuestion.answers.length} {openQuestion.answers.length === 1 ? "Answer" : "Answers"}
                  </p>
                  {openQuestion.answers.length === 0 ? (
                    <div className="rounded-xl p-4 border border-dashed border-white/[0.08] bg-white/[0.02] text-center">
                      <p className="text-xs text-[#94A3B8]">
                        This question hasn't been answered yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {openQuestion.answers.map((a) => (
                        <div
                          key={a.id}
                          className={`rounded-xl p-3 border ${
                            a.is_accepted
                              ? "bg-[#22C55E]/8 border-[#22C55E]/30"
                              : "bg-white/[0.03] border-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A855F7] to-[#38BDF8] flex items-center justify-center text-[10px] font-bold text-white">
                              {a.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                                {a.author}
                                {a.is_accepted && (
                                  <span className="flex items-center gap-0.5 text-[#22C55E] text-[9px] font-bold uppercase">
                                    <CheckCircle2 size={10} /> Accepted
                                  </span>
                                )}
                              </p>
                              <p className="text-[9px] text-[#94A3B8]">
                                {a.authorRole}{a.authorChurch ? ` · ${a.authorChurch}` : ""} · {a.date}
                              </p>
                            </div>
                          </div>
                          <p className="text-[12px] text-[#A09DB1] leading-relaxed whitespace-pre-line">{a.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin-only answer notice — normal users cannot post answers */}
                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-start gap-2">
                    <ShieldCheck size={14} className="text-[#38BDF8] shrink-0 mt-0.5" />
                    <p className="text-[10px] text-[#64748B] leading-relaxed">
                      Official answers are written by the Koino team. Your question is reviewed
                      before an answer is posted here.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ask Question Modal */}
      <AnimatePresence>
        {showAskModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60]"
            onClick={(e) => e.target === e.currentTarget && setShowAskModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#38BDF8] to-[#A855F7] bg-clip-text text-transparent">
                  Ask a Question
                </h2>
                <button onClick={() => setShowAskModal(false)} className="text-[#64748B] hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAskQuestion} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Question Title *
                  </label>
                  <input
                    type="text"
                    value={askForm.title}
                    onChange={(e) => setAskForm({ ...askForm, title: e.target.value })}
                    className="neo-input text-sm"
                    placeholder="e.g. How do we know Jesus is God?"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Topic
                  </label>
                  <select
                    value={askForm.topic}
                    onChange={(e) => setAskForm({ ...askForm, topic: e.target.value })}
                    className="neo-input text-sm"
                  >
                    <option value="">Select topic</option>
                    {APOLOGETICS_TOPICS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Question Details *
                  </label>
                  <textarea
                    value={askForm.body}
                    onChange={(e) => setAskForm({ ...askForm, body: e.target.value })}
                    className="neo-input h-32 resize-none text-sm"
                    placeholder="Provide context, what you've read so far, what specifically you're struggling with..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    value={askForm.author}
                    onChange={(e) => setAskForm({ ...askForm, author: e.target.value })}
                    className="neo-input text-sm"
                    placeholder="Leave blank for Anonymous"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => !submittingQuestion && setShowAskModal(false)}
                    disabled={submittingQuestion}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingQuestion}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #38BDF8, #A855F7)" }}
                  >
                    {submittingQuestion ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting…
                      </>
                    ) : (
                      "Post Question"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
