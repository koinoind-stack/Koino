"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Bookmark, Calendar, Share2 } from "lucide-react";
import { toast } from "sonner";
import MarkdownRenderer from "@/components/crosscrafted/MarkdownRenderer";
import CopyLinkButton from "@/components/crosscrafted/CopyLinkButton";
import ApologeticsComments from "@/components/crosscrafted/ApologeticsComments";
import ReactionBar, { type EngagementCounts } from "@/components/crosscrafted/ReactionBar";
import { shareLinks } from "@/lib/share/links";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";
import { bibleRefFromDisplay, bibleRefHref } from "@/lib/bible-ref";
import { useSupabaseUser } from "@/lib/supabase/use-user";

// ─── Types ─────────────────────────────────────────────────────────────────

type RelatedArticle = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
};

type SourceQuestion = {
  id: string;
  question: string;
  answeredByName: string | null;
} | null;

type ArticleData = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  difficulty: string | null;
  excerpt: string | null;
  shortAnswer: string | null;
  content: string;
  coverImageUrl: string | null;
  authorName: string | null;
  publishedAt: string | null; // ISO string (serialized from Date)
  bibleRefs: string[];
  tags: string[];
  sources: any[];
  sourceQuestion: SourceQuestion;
  relatedArticles: RelatedArticle[];
};

// Reading time — same computation as the admin editor preview (words/200wpm).
function readingMinutes(content: string): number {
  const words = (content || "").replace(/[#>*_\-\[\]()`]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * ApologeticsArticleContent — client component that renders the article page.
 *
 * The Server Component (page.tsx) handles DB queries + SEO; this component
 * renders the article plus the PART 2 engagement layer: validated clickable
 * Bible references (deep links into the existing reader), tags, reading time,
 * the Q&A back-link box, persisted reactions, save/bookmark, threaded
 * comments and the universal ShareSheet.
 */
export default function ApologeticsArticleContent({ article }: { article: ArticleData }) {
  // Universal share sheet — Task 121 (published articles only reach this
  // page; the card endpoint re-verifies publication server-side).
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
  const { isAuthenticated } = useSupabaseUser();

  // Engagement: counts + my reactions/bookmark, loaded from the batch endpoint
  const [counts, setCounts] = useState<EngagementCounts>({ AMEN: 0, INSIGHTFUL: 0, comments: 0 });
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/apologetics/engagement?articles=${encodeURIComponent(article.id)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancelled) return;
        const bucket = data.articles?.[article.id];
        if (bucket) setCounts(bucket);
        if (data.my) {
          setMyReactions(data.my.reactions?.[article.id] || []);
          setSaved((data.my.bookmarks || []).includes(article.id));
        }
      } catch {
        // counts stay zero — page still renders
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [article.id]);

  const onReactionChange = (
    _targetType: string,
    targetId: string,
    kind: string,
    reacted: boolean,
    count: number
  ) => {
    if (targetId !== article.id) return;
    setCounts((c) => ({ ...c, [kind]: count }));
    setMyReactions((prev) => {
      const next = reacted ? [...new Set([...prev, kind])] : prev.filter((k) => k !== kind);
      return next;
    });
  };

  const toggleSave = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to save articles");
      return;
    }
    setSaveBusy(true);
    try {
      const res = await fetch("/api/apologetics/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "article", targetId: article.id, saved: !saved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setSaved(data.saved);
      toast.success(data.saved ? "Saved — find it under \"Saved\" on the Apologetics page" : "Removed from saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaveBusy(false);
    }
  };

  const difficultyColor: Record<string, string> = {
    BEGINNER: "#22C55E",
    INTERMEDIATE: "#F5B84A",
    ADVANCED: "#EF4444",
  };

  return (
    <article className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/apologetics" className="text-xs text-[#60A5FA] hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft size={12} /> Back to Apologetics
      </Link>

      {/* Category + difficulty badges + reading time */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {article.category && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#F97316]">{article.category}</span>
        )}
        {article.difficulty && (
          <span
            className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${difficultyColor[article.difficulty] || "#94A3B8"}20`, color: difficultyColor[article.difficulty] || "#94A3B8" }}
          >
            {article.difficulty}
          </span>
        )}
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
          ~{readingMinutes(article.content)} min read
        </span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 mb-3 leading-tight">{article.title}</h1>

      {article.excerpt && <p className="text-base text-[#A09DB1] leading-relaxed mb-4 font-semibold">{article.excerpt}</p>}

      {/* Author display */}
      {article.authorName && (
        <div className="flex items-center gap-2 mb-6 text-[11px] text-[#94A3B8]">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {article.authorName.charAt(0).toUpperCase()}
          </div>
          <span>by <span className="font-bold text-white">{article.authorName}</span></span>
        </div>
      )}

      {article.publishedAt && (
        <p className="text-[10px] text-[#64748B] mb-4 flex items-center gap-1">
          <Calendar size={10} /> Published {new Date(article.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </p>
      )}

      {article.coverImageUrl && (
        <img src={article.coverImageUrl} alt={article.title} className="w-full rounded-2xl mb-6 max-h-96 object-cover" />
      )}

      {/* PART 2: Q&A back-link box — this article came from a real question */}
      {article.sourceQuestion && (
        <Link
          href={`/?view=apologetics&question=${article.sourceQuestion.id}`}
          className="block bg-[#22D3EE]/8 border border-[#22D3EE]/20 rounded-xl p-3 mb-6 hover:border-[#22D3EE]/40 transition-colors"
        >
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#22D3EE] mb-1 flex items-center gap-1">
            <BookOpen size={9} /> From the Koino Q&amp;A
          </p>
          <p className="text-[12px] text-[#A09DB1] leading-relaxed line-clamp-2">
            “{article.sourceQuestion.question}”
          </p>
          {article.sourceQuestion.answeredByName && (
            <p className="text-[10px] text-[#64748B] mt-1">
              Answered by {article.sourceQuestion.answeredByName} — read the original discussion →
            </p>
          )}
        </Link>
      )}

      {/* Short Answer */}
      {article.shortAnswer && (
        <div className="bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-xl p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA] mb-1">Short Answer</p>
          <p className="text-sm text-[#A09DB1] leading-relaxed">{article.shortAnswer}</p>
        </div>
      )}

      {/* Article body */}
      <div className="apologetics-article mb-8">
        <MarkdownRenderer content={article.content} />
      </div>

      {/* Bible References — PART 2: validated, clickable, open the existing
          reader (/?view=bible&book=..&chapter=..&verse=..). Legacy free-text
          refs that don't parse render as plain chips. */}
      {article.bibleRefs.length > 0 && (
        <div className="bg-[#13294A] border border-white/[0.06] rounded-xl p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2 flex items-center gap-1">
            <BookOpen size={10} /> Bible References
          </p>
          <div className="flex flex-wrap gap-2">
            {article.bibleRefs.map((ref, i) => {
              const parsed = bibleRefFromDisplay(ref);
              return parsed ? (
                <a
                  key={i}
                  href={bibleRefHref(parsed)}
                  className="px-2.5 py-1 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] text-[11px] font-semibold hover:bg-[#22D3EE]/20 transition-colors"
                  title="Open this passage in the Bible reader"
                >
                  {ref} ↗
                </a>
              ) : (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] text-[11px] font-semibold">
                  {ref}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* PART 2: tags */}
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {article.tags.map((t, i) => (
            <span key={i} className="px-2 py-1 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7] text-[10px] font-bold">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Sources */}
      {article.sources.length > 0 && (
        <div className="bg-[#13294A] border border-white/[0.06] rounded-xl p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Sources &amp; Further Reading</p>
          <ol className="space-y-1.5">
            {article.sources.map((src, i) => (
              <li key={i} className="text-[11px] text-[#A09DB1]">
                {i + 1}. {src.author ? `${src.author} — ` : ""}
                {src.title || src.publication || "Source"}
                {src.year ? ` (${src.year})` : ""}
                {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[#22D3EE] ml-1 underline">↗</a> : null}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Related Articles */}
      {article.relatedArticles.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">Related Articles</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {article.relatedArticles.map((ra) => (
              <Link
                key={ra.id}
                href={`/apologetics/${ra.slug}`}
                className="block bg-[#13294A] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.15] transition-all group"
              >
                {ra.coverImageUrl && (
                  <img src={ra.coverImageUrl} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />
                )}
                {ra.category && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#F97316]">{ra.category}</span>
                )}
                <h3 className="text-xs font-bold text-white mt-0.5 group-hover:text-[#60A5FA] transition-colors line-clamp-2">{ra.title}</h3>
                {ra.excerpt && <p className="text-[10px] text-[#A09DB1] mt-1 line-clamp-2">{ra.excerpt}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* PART 2: reactions + save */}
      <div className="flex items-center gap-2 py-4 border-t border-white/[0.04] flex-wrap">
        <ReactionBar
          targetType="article"
          targetId={article.id}
          counts={counts}
          myReactions={myReactions}
          isAuthenticated={isAuthenticated}
          onChange={onReactionChange}
        />
        <button
          onClick={toggleSave}
          disabled={saveBusy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-50 ${
            saved
              ? "bg-[#F5B84A]/15 border-[#F5B84A]/40 text-[#F5B84A]"
              : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white"
          }`}
        >
          <Bookmark size={12} fill={saved ? "currentColor" : "none"} />
          {saved ? "Saved" : "Save"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <CopyLinkButton />
          <button
            onClick={() =>
              setShareReq({
                heading: `Share "${article.title.slice(0, 60)}"`,
                shareText: `${article.title} — Koino Apologetics${article.authorName ? ` by ${article.authorName}` : ""}`,
                shareUrl: shareLinks.apologetics(article.slug),
                cardUrl: `/api/share-card?type=article&kind=apologetics&slug=${encodeURIComponent(article.slug)}`,
                formats: ["portrait", "landscape"],
                fileName: `koino-apologetics-${article.slug}.png`,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-white text-[11px] font-bold transition-all"
          >
            <Share2 size={12} /> Share
          </button>
        </div>
      </div>

      {/* PART 2: threaded comments */}
      <div className="mb-6">
        <ApologeticsComments targetType="article" targetId={article.id} />
      </div>

      {/* Continue exploring */}
      <div className="mt-8 p-4 bg-gradient-to-br from-[#13294A] to-[#1A3A66] border border-[#2563EB]/15 rounded-2xl">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA] mb-3">Continue exploring Koino</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/?view=bible" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-[10px] font-bold transition-all">📖 Read the Bible</Link>
          <Link href="/?view=prayer-wall" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-[10px] font-bold transition-all">🙏 Prayer Wall</Link>
          <Link href="/?view=churches" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-[10px] font-bold transition-all">⛪ Find a Church</Link>
        </div>
      </div>
      {/* ─── UNIVERSAL SHARE SHEET ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />
    </article>
  );
}
