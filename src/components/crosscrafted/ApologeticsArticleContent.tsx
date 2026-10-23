"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Calendar } from "lucide-react";
import MarkdownRenderer from "@/components/crosscrafted/MarkdownRenderer";
import CopyLinkButton from "@/components/crosscrafted/CopyLinkButton";

// ─── Types ─────────────────────────────────────────────────────────────────

type RelatedArticle = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
};

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
  sources: any[];
  relatedArticles: RelatedArticle[];
};

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * ApologeticsArticleContent — client component that renders the article page.
 *
 * This is a "use client" component because:
 * 1. It renders MarkdownRenderer (which uses react-markdown with hooks)
 * 2. It renders CopyLinkButton (which uses onClick)
 * 3. By making the entire article content a Client Component, we ensure
 *    that NO event handlers or non-serializable values cross the
 *    Server→Client boundary. The Server Component passes only plain
 *    serializable data (strings, arrays, objects) as props.
 *
 * The Server Component (page.tsx) handles:
 * - Database query (Prisma)
 * - JSON parsing (bibleRefs, sources, relatedIds)
 * - Related articles query
 * - SEO metadata generation
 * - Status/contentType checks (404 for drafts)
 */
export default function ApologeticsArticleContent({ article }: { article: ArticleData }) {
  const difficultyColor: Record<string, string> = {
    BEGINNER: "#22C55E",
    INTERMEDIATE: "#F59E0B",
    ADVANCED: "#EF4444",
  };

  return (
    <article className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/apologetics" className="text-xs text-[#A78BFA] hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft size={12} /> Back to Apologetics
      </Link>

      {/* Category + difficulty badges */}
      <div className="flex items-center gap-2 mb-3">
        {article.category && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#F39B9B]">{article.category}</span>
        )}
        {article.difficulty && (
          <span
            className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${difficultyColor[article.difficulty] || "#94A3B8"}20`, color: difficultyColor[article.difficulty] || "#94A3B8" }}
          >
            {article.difficulty}
          </span>
        )}
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 mb-3 leading-tight">{article.title}</h1>

      {article.excerpt && <p className="text-base text-[#A09DB1] leading-relaxed mb-4 font-semibold">{article.excerpt}</p>}

      {/* Author display */}
      {article.authorName && (
        <div className="flex items-center gap-2 mb-6 text-[11px] text-[#94A3B8]">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#F39B9B] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
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

      {/* Short Answer */}
      {article.shortAnswer && (
        <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA] mb-1">Short Answer</p>
          <p className="text-sm text-[#A09DB1] leading-relaxed">{article.shortAnswer}</p>
        </div>
      )}

      {/* Article body */}
      <div className="apologetics-article mb-8">
        <MarkdownRenderer content={article.content} />
      </div>

      {/* Bible References */}
      {article.bibleRefs.length > 0 && (
        <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2 flex items-center gap-1">
            <BookOpen size={10} /> Bible References
          </p>
          <div className="flex flex-wrap gap-2">
            {article.bibleRefs.map((ref, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#38BDF8] text-[11px] font-semibold">{ref}</span>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {article.sources.length > 0 && (
        <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Sources & Further Reading</p>
          <ol className="space-y-1.5">
            {article.sources.map((src, i) => (
              <li key={i} className="text-[11px] text-[#A09DB1]">
                {i + 1}. {src.author ? `${src.author} — ` : ""}
                {src.title || src.publication || "Source"}
                {src.year ? ` (${src.year})` : ""}
                {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[#38BDF8] ml-1 underline">↗</a> : null}
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
                className="block bg-[#1C1929] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.15] transition-all group"
              >
                {ra.coverImageUrl && (
                  <img src={ra.coverImageUrl} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />
                )}
                {ra.category && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#F39B9B]">{ra.category}</span>
                )}
                <h3 className="text-xs font-bold text-white mt-0.5 group-hover:text-[#A78BFA] transition-colors line-clamp-2">{ra.title}</h3>
                {ra.excerpt && <p className="text-[10px] text-[#A09DB1] mt-1 line-clamp-2">{ra.excerpt}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Share */}
      <div className="flex items-center gap-2 pt-4 border-t border-white/[0.04]">
        <CopyLinkButton />
      </div>

      {/* Continue exploring */}
      <div className="mt-8 p-4 bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/15 rounded-2xl">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA] mb-3">Continue exploring Koino</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/?view=bible" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-[10px] font-bold transition-all">📖 Read the Bible</Link>
          <Link href="/?view=prayer-wall" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-[10px] font-bold transition-all">🙏 Prayer Wall</Link>
          <Link href="/?view=churches" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-[10px] font-bold transition-all">⛪ Find a Church</Link>
        </div>
      </div>
    </article>
  );
}
