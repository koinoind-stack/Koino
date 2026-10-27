import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { BRAND, siteUrl } from "@/lib/brand";
import WritePageClient from "@/components/blog/WritePageClient";

export const metadata: Metadata = {
  title: `Write an Article — ${BRAND.name} Blog`,
  description: `Share a Bible study, devotional, testimony or reflection with the ${BRAND.name} community. Member articles are reviewed before publishing.`,
  alternates: { canonical: siteUrl("/blog/write") },
};

export const dynamic = "force-dynamic";

export default function WriteArticlePage() {
  return (
    <PublicPageLayout>
      <WritePageClient />
    </PublicPageLayout>
  );
}
