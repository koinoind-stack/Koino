import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import MemorialsDirectory from "@/components/memorials/MemorialsDirectory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "In Loving Memory — Memorial Pages | Koino",
  description:
    "A peaceful place to remember, honour, and celebrate the lives of loved ones — life stories, photographs, Bible verses, memories, and condolences.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "In Loving Memory — Koino",
    description:
      "A lasting place to remember, honour, and celebrate the lives of loved ones.",
    siteName: "Koino",
    url: "https://www.koino.in/memorials",
    type: "website",
  },
};

export default function MemorialsPage() {
  return (
    <PublicPageLayout>
      <MemorialsDirectory />
    </PublicPageLayout>
  );
}
