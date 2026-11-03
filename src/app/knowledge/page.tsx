import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Church,
  Heart,
  HeartHandshake,
  Library,
  ShieldCheck,
  Users,
} from "lucide-react";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { BRAND, siteUrl } from "@/lib/brand";
import { getTaxonomyLanding } from "@/lib/taxonomy-server";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_DESCRIPTIONS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ROUTES,
} from "@/lib/content-taxonomy";

// Public DB-backed surface — always fresh (matches /blog and /apologetics).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles & Knowledge — Koino",
  description:
    "One home for Blog, Articles, Bible Study, Devotionals, Testimonies and Apologetics — browsable by category and topic.",
  alternates: { canonical: `${siteUrl}/knowledge` },
  openGraph: {
    title: "Articles & Knowledge — Koino",
    description:
      "One home for Blog, Articles, Bible Study, Devotionals, Testimonies and Apologetics.",
    url: `${siteUrl}/knowledge`,
    siteName: BRAND.name,
  },
};

// Small icon registry for seeded iconKey values (lucide names). Categories
// created later with an unknown iconKey fall back to the Library glyph.
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ShieldCheck,
  BookOpen,
  Heart,
  Church,
  Users,
  HeartHandshake,
};

export default async function KnowledgePage() {
  // DB-managed taxonomy (Phase 2). Never throws on an empty taxonomy — the
  // seed or the admin Taxonomy panel populates it; until then the page shows
  // its graceful empty state.
  const categories = await getTaxonomyLanding().catch(() => []);

  return (
    <PublicPageLayout>
      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED]/15 text-[#A78BFA] text-xs font-bold px-3 py-1 mb-4">
            <Library size={13} />
            Grow · Articles &amp; Knowledge
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Articles &amp; Knowledge
          </h1>
          <p className="text-sm sm:text-base text-[#94A3B8] max-w-2xl mx-auto">
            One home for the written word on Koino — browse every content type,
            category and topic in one place.
          </p>
        </div>

        {/* Content-type navigation — the six unified types (Plan v2 Table 3).
           Every type has a REAL destination: Blog and Apologetics keep their
           dedicated listings; Article, Bible Study, Devotional and Testimony
           open the read-only /knowledge/browse listing over the existing
           KoinoArticle model — no dead "coming soon" cards. */}
        <section aria-label="Content types" className="mb-12">
          <h2 className="text-sm font-bold text-white mb-3">By content type</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CONTENT_TYPES.map((type) => (
              <Link
                key={type}
                href={CONTENT_TYPE_ROUTES[type]}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#7C3AED]/40 p-4 flex flex-col gap-1 transition-all"
              >
                <span className="text-sm font-bold text-white">
                  {CONTENT_TYPE_LABELS[type]}
                </span>
                <span className="text-[11px] text-[#94A3B8]">
                  {CONTENT_TYPE_DESCRIPTIONS[type]}
                </span>
                <span className="text-[11px] font-bold text-[#A78BFA]">Browse →</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Category → topic navigation — DB-managed taxonomy (Phase 2) */}
        <section aria-label="Categories and topics">
          <h2 className="text-sm font-bold text-white mb-3">By category</h2>
          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] p-10 text-center">
              <p className="text-sm font-bold text-white mb-1">Category navigation is warming up.</p>
              <p className="text-xs text-[#94A3B8]">
                Categories and topics appear here as soon as the unified taxonomy is
                seeded on this environment — a one-time admin action (Admin →
                Taxonomy, or the seed script). Every content type above already works
                without it.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {categories.map((c) => {
                const Icon = (c.iconKey && CATEGORY_ICONS[c.iconKey]) || Library;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-7 h-7 rounded-lg bg-[#7C3AED]/15 text-[#A78BFA] flex items-center justify-center shrink-0">
                        <Icon size={14} />
                      </span>
                      <h3 className="text-sm font-bold text-white">{c.name}</h3>
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-[#94A3B8] mb-2">{c.description}</p>
                    )}
                    {c.topics.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {c.topics.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#CBD5E1]"
                          >
                            {t.color && (
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: t.color }}
                              />
                            )}
                            {t.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-[#64748B]">No topics yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </PublicPageLayout>
  );
}
