import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import Link from "next/link";
import { Search, Sparkles, MessageCircle, BookOpen } from "lucide-react";

const db = new PrismaClient();

export const metadata: Metadata = {
  title: "Apologetics — Koino",
  description: "Explore thoughtful, Bible-grounded answers to difficult questions about God, Jesus, the Bible, faith, science and life.",
  openGraph: { title: "Apologetics — Koino", siteName: "Koino" },
};

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { name: "God & Existence", icon: "🌍" },
  { name: "Jesus Christ", icon: "✝️" },
  { name: "Resurrection", icon: "🌅" },
  { name: "Bible", icon: "📖" },
  { name: "Science & Faith", icon: "🔬" },
  { name: "Suffering & Evil", icon: "💔" },
  { name: "Morality & Ethics", icon: "⚖️" },
  { name: "Other Worldviews", icon: "🌐" },
  { name: "Doubt & Faith", icon: "🙏" },
  { name: "Culture & Christianity", icon: "🏛️" },
  { name: "Salvation", icon: "🕊️" },
];

export default async function ApologeticsPage() {
  const articles = await db.koinoArticle.findMany({
    where: { status: "published", contentType: "APOLOGETICS" },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    take: 12,
    select: {
      id: true, title: true, slug: true, category: true, excerpt: true,
      coverImageUrl: true, authorName: true, difficulty: true, featured: true, publishedAt: true,
    },
  });

  const featured: any = articles.find((a: any) => (a as any).featured) || articles[0];
  const rest = articles.filter(a => a.id !== featured?.id);

  return (
    <PublicPageLayout>
      {/* Hero */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles size={12} fill="currentColor" /> Apologetics
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          Have questions about{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F39B9B] to-[#9786E3]">
            Christianity?
          </span>
        </h1>
        <p className="text-base text-[#A09DB1] leading-relaxed max-w-2xl mx-auto mb-8">
          Explore thoughtful, Bible-grounded answers to difficult questions about God,
          Jesus, the Bible, faith, science and life.
        </p>
      </section>

      {/* Explore Topics */}
      <section className="py-8 px-6 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-4">Explore Topics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href={`/apologetics?category=${encodeURIComponent(cat.name)}`}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.15] transition-all group"
            >
              <p className="text-2xl mb-2">{cat.icon}</p>
              <p className="text-xs font-bold text-white group-hover:text-[#A78BFA] transition-colors">{cat.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured + Recent Articles */}
      {articles.length > 0 ? (
        <section className="py-8 px-6 max-w-5xl mx-auto">
          {/* Featured Article — large card with prominent cover image */}
          {featured && (
            <Link href={`/apologetics/${featured.slug}`} className="block bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden mb-8 hover:border-white/[0.15] transition-all group">
              {/* Cover image — prominent, full-width, 16:9-ish aspect ratio */}
              {featured.coverImageUrl ? (
                <div className="relative aspect-[16/9] bg-[#0f0f1a] overflow-hidden">
                  <img src={featured.coverImageUrl} alt={featured.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                  {/* FEATURED badge overlay */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#22C55E]/20 backdrop-blur-sm border border-[#22C55E]/40 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">
                    Featured
                  </div>
                </div>
              ) : (
                <div className="relative aspect-[16/9] bg-gradient-to-br from-[#1C1929] via-[#2B254E] to-[#0f0f1a] overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen size={48} className="text-[#475569]/50" />
                  </div>
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#22C55E]/20 backdrop-blur-sm border border-[#22C55E]/40 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">
                    Featured
                  </div>
                </div>
              )}
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-2">
                  {featured.category && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#F39B9B]">{featured.category}</span>
                  )}
                  {featured.difficulty && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#A78BFA]">{featured.difficulty}</span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white mb-2 group-hover:text-[#A78BFA] transition-colors">{featured.title}</h2>
                {featured.excerpt && <p className="text-sm text-[#A09DB1] leading-relaxed line-clamp-2">{featured.excerpt}</p>}
                <div className="flex items-center gap-2 mt-3 text-[10px] text-[#64748B]">
                  {featured.authorName && <span>by {featured.authorName}</span>}
                  {featured.publishedAt && (
                    <>
                      <span>·</span>
                      <span>{new Date(featured.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          )}

          {/* Non-featured Articles — horizontal card layout on desktop, stacked on mobile */}
          {rest.length > 0 && (
            <div className="space-y-3">
              {rest.map((article) => (
                <Link
                  key={article.id}
                  href={`/apologetics/${article.slug}`}
                  className="flex flex-col sm:flex-row bg-[#1C1929] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.15] transition-all group"
                >
                  {/* Cover image — left on desktop, top on mobile, 16:9 */}
                  <div className="sm:w-56 shrink-0">
                    {article.coverImageUrl ? (
                      <div className="relative aspect-[16/9] sm:h-full bg-[#0f0f1a] overflow-hidden">
                        <img
                          src={article.coverImageUrl}
                          alt={article.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="relative aspect-[16/9] sm:h-full bg-gradient-to-br from-[#1C1929] via-[#2B254E] to-[#0f0f1a] overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BookOpen size={24} className="text-[#475569]/60" />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Content — right on desktop, below on mobile */}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {article.category && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#F39B9B]">{article.category}</span>
                      )}
                      {article.difficulty && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#A78BFA]">{article.difficulty}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#A78BFA] transition-colors line-clamp-2">{article.title}</h3>
                    {article.excerpt && <p className="text-[11px] text-[#A09DB1] mt-1 line-clamp-2">{article.excerpt}</p>}
                    <div className="flex items-center gap-2 mt-2 text-[9px] text-[#64748B]">
                      {article.authorName && <span>by {article.authorName}</span>}
                      {article.publishedAt && (
                        <>
                          <span>·</span>
                          <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="py-12 px-6 max-w-2xl mx-auto text-center">
          <BookOpen size={32} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#94A3B8] mb-2">No apologetics articles published yet.</p>
          <p className="text-xs text-[#64748B]">Articles are being prepared by Koino contributors. Check back soon.</p>
        </section>
      )}

      {/* Ask a Question CTA */}
      <section className="py-8 px-6 max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-3xl p-6 text-center">
          <MessageCircle size={24} className="mx-auto text-[#A78BFA] mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Still have a question?</h2>
          <p className="text-xs text-[#A09DB1] mb-4">Submit your question and our team may address it in a future article.</p>
          <Link href="/contact?subject=Apologetics+Question" className="inline-block px-6 py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all">
            Ask Koino
          </Link>
        </div>
      </section>

      {/* Partner CTA */}
      <section className="py-8 px-6 max-w-3xl mx-auto">
        <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-1">Partner With Koino</h2>
          <p className="text-[11px] text-[#A09DB1] leading-relaxed mb-3">
            Are you a pastor, Bible teacher, apologist or Christian writer? Apply to become a Koino contributor and help Christians ask better questions, grow deeper in Scripture and explore the Christian faith.
          </p>
          <Link href="/partner" className="text-[#A78BFA] text-xs font-bold hover:text-white transition-colors">
            Apply to Become a Contributor →
          </Link>
        </div>
      </section>
    </PublicPageLayout>
  );
}
