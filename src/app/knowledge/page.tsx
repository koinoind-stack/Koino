import type { Metadata } from "next";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { BRAND, siteUrl } from "@/lib/brand";
import { getTaxonomyLanding } from "@/lib/taxonomy-server";
import KnowledgeHubContent, {
  type HubCategory,
} from "@/components/crosscrafted/KnowledgeHubContent";

// Public DB-backed surface — always fresh (matches /blog and /apologetics).
export const dynamic = "force-dynamic";

// SEO metadata stays English site-wide (see /blog, /apologetics); the visible
// page chrome is localized client-side via KnowledgeHubContent.
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

export default async function KnowledgePage() {
  // DB-managed taxonomy (Phase 2). Never throws on an empty taxonomy — the
  // seed or the admin Taxonomy panel populates it; until then the page shows
  // its graceful empty state.
  const categories = await getTaxonomyLanding().catch(() => []);

  // Minimal serializable contract for the client component.
  const hubCategories: HubCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    iconKey: c.iconKey,
    topics: c.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      color: topic.color,
    })),
  }));

  return (
    <PublicPageLayout>
      <main className="max-w-5xl mx-auto px-4 py-10">
        <KnowledgeHubContent categories={hubCategories} />
      </main>
    </PublicPageLayout>
  );
}
