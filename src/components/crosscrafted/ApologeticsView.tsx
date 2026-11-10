"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  MessageCircle,
  Share2,
  X,
  Search,
  Eye,
  Plus,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  PenLine,
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
import { shareLinks } from "@/lib/share/links";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";
import ReactionBar, { type EngagementCounts } from "@/components/crosscrafted/ReactionBar";
import ApologeticsComments from "@/components/crosscrafted/ApologeticsComments";
import ContributorStudio from "@/components/crosscrafted/ContributorStudio";
import { bibleRefFromDisplay, bibleRefHref } from "@/lib/bible-ref";

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

// i18n: topic id → translation key. Topic ids are stored on DB questions —
// only the display label is translated at render time.
const TOPIC_LABEL_KEYS: Record<string, string> = {
  gods_existence: "apologetics.topic.godsExistence",
  problem_of_evil: "apologetics.topic.problemOfEvil",
  resurrection: "apologetics.topic.resurrection",
  bible_reliability: "apologetics.topic.bibleReliability",
  science_faith: "apologetics.topic.scienceFaith",
  world_religions: "apologetics.topic.worldReligions",
};

export default function ApologeticsView({
  deepLinkQuestionId = null,
}: {
  deepLinkQuestionId?: string | null; // ?view=apologetics&question=<id> (HomeApp)
} = {}) {
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
  const [dbQuestions, setDbQuestions] = useState<ApologeticsQuestion[]>([]);
  const [questions, setQuestions] = useState<ApologeticsQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // ─── PART 2: real engagement (replaces the fake client-only like) ───
  // counts keyed by target id; myReactions maps id → kinds; bookmarks is the
  // set of saved article ids. All loaded from /api/apologetics/engagement.
  const [engagement, setEngagement] = useState<Record<string, EngagementCounts>>({});
  const [myReactions, setMyReactions] = useState<Record<string, string[]>>({});
  const [myBookmarks, setMyBookmarks] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  // PART 2: Contributor Studio (approved contributors only — server-verified)
  const [contributorName, setContributorName] = useState<string | null>(null);
  const [showStudio, setShowStudio] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ type: "article" | "question"; id: string } | null>(null);

  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [openPost, setOpenPost] = useState<ApologeticsPost | null>(null);
  // Universal share sheet — Task 121.
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
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
      if (!res.ok) throw new Error(data.error || t("apologetics.error.articles"));
      const articles = data.articles || [];
      // Map DB article → ApologeticsPost shape. likes/comments are now real
      // values from the engagement endpoint (PART 2) — set to 0 here and
      // rendered from `engagement` so nothing is fabricated.
      const mapped: ApologeticsPost[] = articles.map((a: any) => ({
        id: a.id,
        title: a.title,
        body: a.excerpt || a.shortAnswer || "", // use excerpt as the preview body
        author: a.authorName || "Koino",
        topic: mapCategoryToTopicId(a.category), // map category label → topic id
        date: a.publishedAt || a.createdAt,
        likes: 0, // real count comes from /api/apologetics/engagement
        comments: 0, // real count comes from /api/apologetics/engagement
        cover_gradient: 0,
        cover_image: a.coverImageUrl || undefined,
        slug: a.slug, // for linking to /apologetics/[slug]
        featured: a.featured,
      }));
      setPosts(mapped);
    } catch (e: any) {
      setPostsError(e.message || t("apologetics.error.articles"));
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
  // ApologeticsQuestion shape. The official answer (adminNotes) is rendered
  // with its real attribution (PART 2).
  const loadQuestions = async () => {
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const res = await fetch("/api/questions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("apologetics.error.questions"));
      const mapped: (ApologeticsQuestion & {
        refs: string[]; // PART 2: validated Bible references
        answeredByName: string | null; // PART 2: official answer attribution
      })[] = (data.questions || []).map((q: any) => {
        const fullQuestion: string = q.question || "";
        const firstLine = fullQuestion.split("\n")[0]?.trim() || "";
        const title = (firstLine.slice(0, 100) || fullQuestion.slice(0, 100)) || t("apologetics.untitled");
        const dateStr = (q.createdAt || "").split("T")[0] || new Date().toISOString().split("T")[0];
        const answers: ApologeticsAnswer[] = q.answer
          ? [{
              id: `${q.id}-a1`,
              author: q.answeredByName || "Koino",
              authorRole: (q.answeredByName ? "Contributor" : "Admin") as any,
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
          refs: Array.isArray(q.bibleRefs) ? q.bibleRefs : [],
          answeredByName: q.answeredByName || null,
        };
      });
      setDbQuestions(mapped);
      setQuestions(mapped);
    } catch (e: any) {
      setQuestionsError(e.message || t("apologetics.error.questions"));
      setQuestions([]);
      setDbQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  // ─── PART 2: engagement batch load (reactions/comments/bookmarks) ───
  // Re-runs when the article/question lists change (e.g. after loadPosts).
  const loadEngagement = useCallback(async () => {
    const articleIds = posts.map((p) => p.id).slice(0, 60);
    const questionIds = dbQuestions.map((q) => q.id).slice(0, 60);
    if (articleIds.length === 0 && questionIds.length === 0) return;
    try {
      const params = new URLSearchParams();
      if (articleIds.length) params.set("articles", articleIds.join(","));
      if (questionIds.length) params.set("questions", questionIds.join(","));
      const res = await fetch(`/api/apologetics/engagement?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      const merged: Record<string, EngagementCounts> = {};
      for (const [k, v] of Object.entries(data.articles || {})) merged[k] = v as EngagementCounts;
      for (const [k, v] of Object.entries(data.questions || {})) merged[k] = v as EngagementCounts;
      setEngagement(merged);
      if (data.my) {
        setMyReactions(data.my.reactions || {});
        setMyBookmarks(new Set(data.my.bookmarks || []));
      }
    } catch {
      // engagement stays at zeros — cards still render
    }
  }, [posts, dbQuestions]);

  useEffect(() => {
    loadEngagement();
  }, [loadEngagement]);

  // ─── PART 2: contributor check (Studio entry point) ───
  useEffect(() => {
    (async () => {
      // Server decides (401/403/null = hidden) — never client-asserted.
      try {
        const res = await fetch("/api/contributor/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.contributor?.status === "approved") {
            setContributorName(data.contributor.displayName);
          }
        }
      } catch {
        // ignore — studio simply never shows
      }
    })();
  }, []);

  // Open the deep-linked question once the list is loaded
  useEffect(() => {
    if (questionsLoading || !dbQuestions.length || !deepLinkQuestionId) return;
    const match = dbQuestions.find((q) => q.id === deepLinkQuestionId);
    if (match) {
      setActiveTab("qa");
      setOpenQuestion(match);
    }
  }, [questionsLoading, dbQuestions, deepLinkQuestionId]);

  // ─── PART 2: reaction toggle handler passed to every ReactionBar ───
  const onReactionChange = (
    targetType: string,
    targetId: string,
    kind: string,
    reacted: boolean,
    count: number
  ) => {
    setEngagement((prev) => ({
      ...prev,
      [targetId]: { ...prev[targetId] || { AMEN: 0, INSIGHTFUL: 0, comments: 0 }, [kind]: count },
    }));
    setMyReactions((prev) => {
      const current = prev[targetId] || [];
      return {
        ...prev,
        [targetId]: reacted ? [...new Set([...current, kind])] : current.filter((k) => k !== kind),
      };
    });
  };

  const toggleSaveArticle = async (articleId: string) => {
    if (!isAuthenticated) {
      toast.error(t("apologetics.error.signInToSave"));
      return;
    }
    const wasSaved = myBookmarks.has(articleId);
    try {
      const res = await fetch("/api/apologetics/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "article", targetId: articleId, saved: !wasSaved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("apologetics.error.save"));
      setMyBookmarks((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(articleId);
        else next.add(articleId);
        return next;
      });
      toast.success(wasSaved ? t("events.unsavedToast") : t("apologetics.saved"));
    } catch (e: any) {
      toast.error(e?.message || t("apologetics.error.save"));
    }
  };

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (savedOnly && !myBookmarks.has(p.id)) return false;
      if (filterTopic && p.topic !== filterTopic) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [posts, filterTopic, search, savedOnly, myBookmarks]);

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

  const sharePost = (p: ApologeticsPost) => {
    // Published DB articles carry a slug → canonical /apologetics/<slug>
    // link + branded card. Mock/legacy entries without a slug keep a plain
    // text share (no fabricated URL).
    if (p.slug) {
      setShareReq({
        heading: t("apologetics.shareHeading", { title: p.title.slice(0, 60) }),
        shareText: t("apologetics.shareText", { title: p.title, author: p.author }),
        shareUrl: shareLinks.apologetics(p.slug),
        cardUrl: `/api/share-card?type=article&kind=apologetics&slug=${encodeURIComponent(p.slug)}`,
        formats: ["portrait", "landscape"],
        fileName: `koino-apologetics-${p.slug}.png`,
      });
      return;
    }
    navigator.clipboard.writeText(t("apologetics.copyText", { title: p.title, author: p.author }));
    toast.success(t("apologetics.toast.copied"));
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askForm.title.trim() || !askForm.body.trim()) {
      toast.error(t("apologetics.form.errorRequired"));
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
        throw new Error(data.error || t("apologetics.form.errorHttp", { status: res.status }));
      }
      toast.success(t("apologetics.form.success"), {
        description: t("apologetics.form.successDesc"),
      });
      setAskForm({ title: "", body: "", topic: "", author: "" });
      setShowAskModal(false);
      // Refresh — the new question won't appear in the public list (status=new)
      // but this keeps the list + count in sync.
      loadQuestions();
    } catch (e: any) {
      toast.error(e.message || t("apologetics.form.errorSubmit"));
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
            style={{ background: "linear-gradient(135deg, #22D3EE, #A855F7)" }}
          >
            <Plus size={14} /> {t("apologetics.askShort")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl mb-4">
        <button
          onClick={() => setActiveTab("articles")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "articles" ? "bg-[#22D3EE] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <BookOpen size={12} /> {t("apologetics.tab.articles")}
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "qa" ? "bg-[#22D3EE] text-slate-950" : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <HelpCircle size={12} /> {t("apologetics.tab.qa")}
          <span className="px-1.5 py-0.5 rounded-full bg-[#22D3EE]/15 text-[#22D3EE] text-[9px] font-bold tabular-nums">
            {questionsLoading ? "…" : dbQuestions.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={t("apologetics.searchPlaceholder", { articles: activeTab === "articles" ? "articles" : "questions" })}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="neo-input text-sm mb-3"
      />

      {/* Topic Pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-2">
        <button
          onClick={() => { setFilterTopic(""); setSavedOnly(false); }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            !filterTopic && !savedOnly
              ? "bg-white text-slate-950"
              : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
          }`}
        >
          {t("apologetics.allTopics")}
        </button>
        {isAuthenticated && (
          <button
            onClick={() => { setSavedOnly(!savedOnly); setFilterTopic(""); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              savedOnly
                ? "bg-[#F5B84A] text-slate-950"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
          >
            <Bookmark size={11} fill={savedOnly ? "currentColor" : "none"} /> {t("apologetics.saved")}
          </button>
        )}
        {APOLOGETICS_TOPICS.map((topic) => (
          <button
            key={topic.id}
            onClick={() => { setFilterTopic(topic.id); setSavedOnly(false); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterTopic === topic.id && !savedOnly ? "text-slate-950" : "text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
            style={filterTopic === topic.id && !savedOnly ? { background: topic.color } : {}}
          >
            {t(TOPIC_LABEL_KEYS[topic.id])}
          </button>
        ))}
      </div>

      {/* PART 2: Contributor Studio entry (approved contributors only —
          the flag comes from the server, never from the client) */}
      {contributorName && (
        <button
          onClick={() => setShowStudio(true)}
          className="w-full flex items-center gap-2.5 bg-gradient-to-r from-[#2563EB]/15 to-[#22D3EE]/10 border border-[#2563EB]/25 rounded-2xl p-3 mb-4 hover:border-[#2563EB]/45 transition-all text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-[#2563EB]/20 flex items-center justify-center shrink-0">
            <PenLine size={16} className="text-[#60A5FA]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white">{t("apologetics.studio.title")}</p>
            <p className="text-[10px] text-[#94A3B8]">{t("apologetics.studio.subtitle", { name: contributorName })}</p>
          </div>
          <span className="text-[10px] font-bold text-[#60A5FA]">{t("apologetics.studio.open")}</span>
        </button>
      )}

      <AnimatePresence mode="wait">
        {activeTab === "articles" ? (
          <motion.div key="articles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Loading state */}
            {postsLoading && (
              <div className="text-center py-12">
                <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#2563EB] animate-spin mb-3" />
                <p className="text-xs text-[#94A3B8]">{t("apologetics.loadingArticles")}</p>
              </div>
            )}

            {/* Error state */}
            {!postsLoading && postsError && (
              <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-2xl p-5 text-center">
                <p className="text-sm font-bold text-[#EF4444] mb-1">{t("apologetics.error.articles")}</p>
                <p className="text-xs text-[#A09DB1] mb-3">{postsError}</p>
                <button
                  onClick={loadPosts}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
                >
                  {t("common.retry")}
                </button>
              </div>
            )}

            {/* Empty state — no published articles yet */}
            {!postsLoading && !postsError && posts.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/15 border border-[#2563EB]/25 mb-3">
                  <BookOpen size={24} className="text-[#60A5FA]" />
                </div>
                <p className="text-sm font-bold text-white mb-1">{t("apologetics.emptyArticles.title")}</p>
                <p className="text-xs text-[#A09DB1] max-w-sm mx-auto">
                  {t("apologetics.emptyArticles.desc")}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-[#13294A] via-[#13294A]/40 to-transparent" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#22C55E]/15 backdrop-blur-sm border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">
                    {t("common.featured")}
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
                      🙏 {(engagement[filtered[0].id]?.AMEN ?? 0) + (engagement[filtered[0].id]?.INSIGHTFUL ?? 0)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Post List */}
            <div className="space-y-3">
              {(filterTopic || search || savedOnly ? filtered : filtered.slice(1)).map((post, i) => {
                const topic = APOLOGETICS_TOPICS.find((t) => t.id === post.topic);
                const counts = engagement[post.id] || { AMEN: 0, INSIGHTFUL: 0, comments: 0 };
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      // DB-backed posts navigate to the public article page.
                      if (post.slug) {
                        window.location.href = `/apologetics/${post.slug}`;
                      } else {
                        setOpenPost(post);
                      }
                    }}
                    className="bg-[#13294A] border border-white/[0.06] rounded-2xl p-4 cursor-pointer hover:border-white/[0.12] transition-all"
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
                          {topic ? t(TOPIC_LABEL_KEYS[topic.id]) : ""}
                        </span>
                        <h3 className="text-base font-bold text-white leading-tight">{post.title}</h3>
                      </div>
                      {post.cover_image && (
                        <img src={post.cover_image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                      )}
                    </div>
                    <p className="text-[13px] text-[#A09DB1] leading-relaxed line-clamp-3 mb-3">{post.body}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#A855F7] flex items-center justify-center text-[10px] font-bold text-white">
                          {post.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-white">{post.author}</p>
                          <p className="text-[9px] text-[#94A3B8]">
                            {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ReactionBar
                          targetType="article"
                          targetId={post.id}
                          counts={counts}
                          myReactions={myReactions[post.id] || []}
                          isAuthenticated={isAuthenticated}
                          onChange={onReactionChange}
                          compact
                        />
                        <button
                          onClick={() => toggleSaveArticle(post.id)}
                          title={myBookmarks.has(post.id) ? t("apologetics.saved") : t("apologetics.save")}
                          className={`p-1.5 rounded-lg transition-colors ${
                            myBookmarks.has(post.id)
                              ? "text-[#F5B84A]"
                              : "text-[#94A3B8] hover:text-white"
                          }`}
                        >
                          <Bookmark size={13} fill={myBookmarks.has(post.id) ? "currentColor" : "none"} />
                        </button>
                        <button
                          onClick={() => {
                            // Comments live on the public article page
                            if (post.slug) window.location.href = `/apologetics/${post.slug}`;
                          }}
                          className="flex items-center gap-1 text-[10px] text-[#94A3B8] hover:text-white px-1"
                        >
                          <MessageCircle size={12} /> {counts.comments}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Search size={32} className="mx-auto text-[#475569] mb-2" />
                <p className="text-sm text-[#475569]">{t("apologetics.noResults")}</p>
              </div>
            )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Q&A Banner */}
            <div className="bg-gradient-to-br from-[#13294A] to-[#1A3A66] border border-[#22D3EE]/20 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#22D3EE]/15 border border-[#22D3EE]/30 flex items-center justify-center shrink-0">
                  <HelpCircle size={18} className="text-[#22D3EE]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white mb-1">{t("apologetics.qaBanner.title")}</p>
                  <p className="text-[11px] text-[#A09DB1] leading-relaxed">
                    {t("apologetics.qaBanner.desc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Loading state */}
            {questionsLoading && (
              <div className="text-center py-12">
                <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#22D3EE] animate-spin mb-3" />
                <p className="text-xs text-[#94A3B8]">{t("apologetics.loadingQuestions")}</p>
              </div>
            )}

            {/* Error state */}
            {!questionsLoading && questionsError && (
              <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-2xl p-5 text-center">
                <p className="text-sm font-bold text-[#EF4444] mb-1">{t("apologetics.error.questions")}</p>
                <p className="text-xs text-[#A09DB1] mb-3">{questionsError}</p>
                <button
                  onClick={loadQuestions}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
                >
                  {t("common.retry")}
                </button>
              </div>
            )}

            {/* Empty state — no answered questions yet */}
            {!questionsLoading && !questionsError && questions.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#22D3EE]/10 border border-[#22D3EE]/25 mb-3">
                  <HelpCircle size={24} className="text-[#22D3EE]" />
                </div>
                <p className="text-sm font-bold text-white mb-1">{t("apologetics.emptyQuestions.title")}</p>
                <p className="text-xs text-[#A09DB1] max-w-sm mx-auto mb-4">
                  {t("apologetics.emptyQuestions.desc")}
                </p>
                {isAuthenticated ? (
                  <button
                    onClick={() => setShowAskModal(true)}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #22D3EE, #A855F7)" }}
                  >
                    <Plus size={14} /> {t("apologetics.askQuestion")}
                  </button>
                ) : (
                  <a
                    href="/login"
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #22D3EE, #A855F7)" }}
                  >
                    {t("apologetics.signInToAsk")}
                  </a>
                )}
              </div>
            )}

            {/* Questions List (only when loaded + has items) */}
            {!questionsLoading && !questionsError && questions.length > 0 && (
              <div className="space-y-3">
                {filteredQuestions.map((q, i) => {
                const topic = APOLOGETICS_TOPICS.find((t) => t.id === q.topic);
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setOpenQuestion(q)}
                    className="bg-[#13294A] border border-white/[0.06] rounded-2xl p-4 cursor-pointer hover:border-white/[0.12] transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {topic && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${topic.color}20`, color: topic.color }}
                        >
                          {topic ? t(TOPIC_LABEL_KEYS[topic.id]) : ""}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          q.status === "answered"
                            ? "bg-[#22C55E]/15 text-[#22C55E]"
                            : "bg-[#F5B84A]/15 text-[#F5B84A]"
                        }`}
                      >
                        {q.status === "answered" ? t("apologetics.statusAnswered") : t("apologetics.statusOpen")}
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
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ReactionBar
                          targetType="question"
                          targetId={q.id}
                          counts={engagement[q.id] || { AMEN: 0, INSIGHTFUL: 0, comments: 0 }}
                          myReactions={myReactions[q.id] || []}
                          isAuthenticated={isAuthenticated}
                          onChange={onReactionChange}
                          compact
                        />
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
                <p className="text-sm text-[#475569]">{t("apologetics.noQuestionsMatch")}</p>
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
              className="bg-[#13294A] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="relative h-32" style={{ background: CHURCH_GRADIENTS[openPost.cover_gradient] }}>
                <div className="absolute inset-0 bg-gradient-to-t from-[#13294A] to-transparent" />
                <button
                  onClick={() => setOpenPost(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 -mt-12 relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#22D3EE] to-[#A855F7] flex items-center justify-center text-base font-bold text-white border-4 border-[#13294A]">
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
                  {openPost.slug ? (
                    <ReactionBar
                      targetType="article"
                      targetId={openPost.id}
                      counts={engagement[openPost.id] || { AMEN: 0, INSIGHTFUL: 0, comments: 0 }}
                      myReactions={myReactions[openPost.id] || []}
                      isAuthenticated={isAuthenticated}
                      onChange={onReactionChange}
                    />
                  ) : (
                    <span className="text-[10px] text-[#64748B]">{t("apologetics.openFullArticle")}</span>
                  )}
                  <button
                    onClick={() => sharePost(openPost)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] transition-all"
                  >
                    <Share2 size={14} /> {t("common.share")}
                  </button>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-[#94A3B8]">
                    <Eye size={12} /> {t("apologetics.reactionsCount", { count: (engagement[openPost.id]?.AMEN ?? 0) + (engagement[openPost.id]?.INSIGHTFUL ?? 0) })}
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
              className="bg-[#13294A] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setOpenQuestion(null)}
                    className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors"
                  >
                    <X size={14} /> {t("common.close")}
                  </button>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      openQuestion.status === "answered"
                        ? "bg-[#22C55E]/15 text-[#22C55E]"
                        : "bg-[#F5B84A]/15 text-[#F5B84A]"
                    }`}
                  >
                    {openQuestion.status === "answered" ? t("apologetics.statusAnswered") : t("apologetics.statusOpen")}
                  </span>
                </div>

                {(() => {
                  const topic = APOLOGETICS_TOPICS.find((t) => t.id === openQuestion.topic);
                  return (
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${topic?.color}20`, color: topic?.color }}
                    >
                      {topic ? t(TOPIC_LABEL_KEYS[topic.id]) : ""}
                    </span>
                  );
                })()}

                <h2 className="text-xl font-extrabold text-white leading-tight">{openQuestion.title}</h2>
                <p className="text-sm text-[#A09DB1] leading-relaxed">{openQuestion.body}</p>

                {/* PART 2: Bible references — validated, clickable */}
                {(openQuestion as any).refs?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(openQuestion as any).refs.map((ref: string, i: number) => {
                      const parsed = bibleRefFromDisplay(ref);
                      return parsed ? (
                        <a
                          key={i}
                          href={bibleRefHref(parsed)}
                          onClick={(e) => e.stopPropagation()}
                          className="px-2 py-1 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] text-[10px] font-bold hover:bg-[#22D3EE]/20 transition-colors"
                          title={t("apologetics.refTitle")}
                        >
                          {ref} ↗
                        </a>
                      ) : (
                        <span key={i} className="px-2 py-1 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] text-[10px] font-bold">
                          {ref}
                        </span>
                      );
                    })}
                  </div>
                )}

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

                {/* Answers — the official answer with real attribution */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                    {t("apologetics.answersCount", { count: openQuestion.answers.length })}
                  </p>
                  {openQuestion.answers.length === 0 ? (
                    <div className="rounded-xl p-4 border border-dashed border-white/[0.08] bg-white/[0.02] text-center">
                      <p className="text-xs text-[#94A3B8]">
                        {t("apologetics.noAnswers")}
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
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A855F7] to-[#22D3EE] flex items-center justify-center text-[10px] font-bold text-white">
                              {a.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                                {a.author}
                                {a.is_accepted && (
                                  <span className="flex items-center gap-0.5 text-[#22C55E] text-[9px] font-bold uppercase">
                                    <CheckCircle2 size={10} /> {t("apologetics.accepted")}
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

                {/* PART 2: reactions + threaded discussion on the question */}
                <div className="pt-3 border-t border-white/[0.06] space-y-3">
                  <ReactionBar
                    targetType="question"
                    targetId={openQuestion.id}
                    counts={engagement[openQuestion.id] || { AMEN: 0, INSIGHTFUL: 0, comments: 0 }}
                    myReactions={myReactions[openQuestion.id] || []}
                    isAuthenticated={isAuthenticated}
                    onChange={onReactionChange}
                  />
                  {commentTarget?.type === "question" && commentTarget.id === openQuestion.id ? (
                    <ApologeticsComments targetType="question" targetId={openQuestion.id} />
                  ) : (
                    <button
                      onClick={() => setCommentTarget({ type: "question", id: openQuestion.id })}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[#22D3EE] hover:bg-[#22D3EE]/10 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <MessageCircle size={12} />
                      {t("apologetics.discussion", { count: engagement[openQuestion.id]?.comments ?? 0 })}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setShareReq({
                        heading: t("apologetics.shareQaHeading"),
                        shareText: t("apologetics.shareQaText", { title: openQuestion.title }),
                        shareUrl: shareLinks.apologeticsQuestion(openQuestion.id),
                        formats: ["landscape"],
                        fileName: `koino-qa-${openQuestion.id.slice(-8)}.png`,
                      })
                    }
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[#94A3B8] hover:text-white px-2 py-1.5 transition-colors"
                  >
                    <Share2 size={12} /> {t("common.share")}
                  </button>
                </div>

                {/* Sign-in notice — only approved contributors may propose answers,
                    and those go through admin review before publishing */}
                <div className="pt-3 border-t border-white/[0.06] flex items-start gap-2">
                  <BookOpen size={14} className="text-[#22D3EE] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#64748B] leading-relaxed">
                    {t("apologetics.answersNote")}
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
              className="bg-[#13294A] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
                  {t("apologetics.askQuestion")}
                </h2>
                <button onClick={() => setShowAskModal(false)} className="text-[#64748B] hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAskQuestion} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("apologetics.form.title")}
                  </label>
                  <input
                    type="text"
                    value={askForm.title}
                    onChange={(e) => setAskForm({ ...askForm, title: e.target.value })}
                    className="neo-input text-sm"
                    placeholder={t("apologetics.form.titlePlaceholder")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("apologetics.form.topic")}
                  </label>
                  <select
                    value={askForm.topic}
                    onChange={(e) => setAskForm({ ...askForm, topic: e.target.value })}
                    className="neo-input text-sm"
                  >
                    <option value="">{t("apologetics.form.selectTopic")}</option>
                    {APOLOGETICS_TOPICS.map((topic) => (
                      <option key={topic.id} value={topic.id}>{t(TOPIC_LABEL_KEYS[topic.id])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("apologetics.form.details")}
                  </label>
                  <textarea
                    value={askForm.body}
                    onChange={(e) => setAskForm({ ...askForm, body: e.target.value })}
                    className="neo-input h-32 resize-none text-sm"
                    placeholder={t("apologetics.form.detailsPlaceholder")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("apologetics.form.author")}
                  </label>
                  <input
                    type="text"
                    value={askForm.author}
                    onChange={(e) => setAskForm({ ...askForm, author: e.target.value })}
                    className="neo-input text-sm"
                    placeholder={t("apologetics.form.authorPlaceholder")}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => !submittingQuestion && setShowAskModal(false)}
                    disabled={submittingQuestion}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingQuestion}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #22D3EE, #A855F7)" }}
                  >
                    {submittingQuestion ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> {t("common.submitting")}
                      </>
                    ) : (
                      t("apologetics.form.submit")
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── UNIVERSAL SHARE SHEET ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />

      {/* ─── PART 2: CONTRIBUTOR STUDIO ─── */}
      {showStudio && contributorName && (
        <ContributorStudio displayName={contributorName} onClose={() => setShowStudio(false)} />
      )}
    </div>
  );
}
