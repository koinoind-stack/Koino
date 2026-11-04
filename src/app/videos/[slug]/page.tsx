import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import VideoWatch from "@/components/videos/VideoWatch";
import { db } from "@/lib/db";
import { youtubeThumbnail } from "@/lib/videos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * SEO metadata: only PUBLISHED videos are indexed. Draft/unpublished entries
 * get noindex and no title data so nothing leaks through metadata.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  let v: { title: string; summary: string | null; thumbnailUrl: string | null; youtubeId: string | null; status: string } | null = null;
  try {
    v = await db.video.findUnique({
      where: { slug },
      select: { title: true, summary: true, thumbnailUrl: true, youtubeId: true, status: true },
    });
  } catch {
    v = null; // table not created yet — treat as not indexable
  }

  if (!v || v.status !== "published") {
    return {
      title: "Watch — Bible Movies & Videos | Koino",
      robots: { index: false, follow: false },
    };
  }

  const title = `${v.title} | Koino Videos`;
  const description =
    v.summary ||
    "Watch Bible movies, Christian films, animated Bible stories, sermons, and worship on Koino.";

  /* thumbnailUrl sometimes holds a YouTube WATCH page URL (bad data), which
   * crawlers cannot render as an image — og:image must be a real image.
   * Order: a true image URL from the DB → the video's own public YouTube
   * thumbnail (plain preview, no Koino overlay) → the Koino branded
   * landscape share-card (always renders). */
  const dbThumbIsImage =
    !!v.thumbnailUrl && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(v.thumbnailUrl);
  const ogImages = dbThumbIsImage
    ? [v.thumbnailUrl!]
    : v.youtubeId
      ? [youtubeThumbnail(v.youtubeId)]
      : [
          `https://www.koino.in/api/share-card?type=video&slug=${encodeURIComponent(
            slug
          )}&format=landscape`,
        ];

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      siteName: "Koino",
      url: `https://www.koino.in/videos/${slug}`,
      type: "video.other",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages,
    },
  };
}

export default async function VideoPage({ params }: Props) {
  const { slug } = await params;
  return (
    <PublicPageLayout>
      <VideoWatch slug={slug} />
    </PublicPageLayout>
  );
}
