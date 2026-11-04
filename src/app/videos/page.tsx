import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import VideosLibrary from "@/components/videos/VideosLibrary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bible Movies & Videos — Watch Scripture Come Alive | Koino",
  description:
    "Bible movies, animated Bible stories, Christian films, sermons, worship videos, and Bible teachings — connected to the Bible passages they bring to life. Read the Bible. Watch its stories.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Bible Movies & Videos — Koino",
    description:
      "Discover Bible movies, Christian films, animated Bible stories, sermons, and worship — connected to Scripture.",
    siteName: "Koino",
    url: "https://www.koino.in/videos",
    type: "website",
  },
};

type Props = { searchParams: Promise<{ book?: string; chapter?: string }> };

export default async function VideosPage({ searchParams }: Props) {
  const { book, chapter } = await searchParams;
  const chapterNum = chapter ? parseInt(chapter, 10) : undefined;
  return (
    <PublicPageLayout>
      <VideosLibrary
        initialBook={book && /^[a-z0-9_]{2,20}$/.test(book) ? book : undefined}
        initialChapter={chapterNum && Number.isFinite(chapterNum) ? chapterNum : undefined}
      />
    </PublicPageLayout>
  );
}
