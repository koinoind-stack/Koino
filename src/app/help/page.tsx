import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import Link from "next/link";

const db = new PrismaClient();

export const metadata: Metadata = {
  title: "Koino Help Center",
  description: "Find answers to common questions about Koino — accounts, Bible, trivia, churches, events, prayer, marketplace, business directory, and more.",
  openGraph: { title: "Koino Help Center", siteName: "Koino" },
};

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Account", "Bible", "Bible Trivia", "Churches", "Events", "Prayer Wall",
  "Marketplace", "Business Directory", "Koino Merch", "Prizes", "Support Koino", "Privacy & Security",
];

export default async function HelpPage() {
  const articles = await db.helpArticle.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
  });

  // Group by category
  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    articles: articles.filter((a) => a.category === cat),
  })).filter((g) => g.articles.length > 0);

  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white mb-2">Koino Help Center</h1>
          <p className="text-sm text-[#A09DB1]">Find answers to common questions about Koino.</p>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#94A3B8] mb-2">No help articles published yet.</p>
            <p className="text-xs text-[#64748B]">Help articles are being prepared. Please check back soon.</p>
            <Link href="/contact" className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#F39B9B] text-slate-950 text-xs font-bold">
              Contact Us
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {byCategory.map((group) => (
              <div key={group.category}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#F39B9B] mb-3">{group.category}</h2>
                <div className="space-y-2">
                  {group.articles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/help/${article.slug}`}
                      className="block bg-[#1C1929] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.15] transition-all"
                    >
                      <p className="text-sm font-bold text-white">{article.title}</p>
                      {article.seoDescription && <p className="text-[11px] text-[#A09DB1] mt-0.5">{article.seoDescription}</p>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicPageLayout>
  );
}
