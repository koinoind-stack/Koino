import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import MemorialView from "@/components/memorials/MemorialView";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Only PUBLIC memorials are indexed by search engines. Unlisted memorials get
 * noindex (direct-link only); private/draft/unpublished ones are never even
 * rendered to non-managers (MemorialView fetches auth-aware), and we also
 * serve noindex + no title data here so nothing leaks through metadata.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let m: { fullName: string; tribute: string | null; photoUrl: string | null; visibility: string; status: string } | null = null;
  try {
    m = await db.memorial.findUnique({
      where: { id },
      select: { fullName: true, tribute: true, photoUrl: true, visibility: true, status: true },
    });
  } catch {
    m = null; // table not created yet — treat as not indexable
  }

  if (!m || m.status !== "published" || m.visibility !== "public") {
    return {
      title: "Memorial — In Loving Memory | Koino",
      robots: { index: false, follow: false },
    };
  }

  const title = `In Loving Memory of ${m.fullName} | Koino`;
  const description =
    m.tribute ||
    `A memorial page honouring the life of ${m.fullName} — life story, photographs, memories, and condolences.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      siteName: "Koino",
      url: `https://www.koino.in/memorials/${id}`,
      type: "profile",
      images: m.photoUrl ? [{ url: m.photoUrl }] : undefined,
    },
    twitter: {
      card: m.photoUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: m.photoUrl ? [m.photoUrl] : undefined,
    },
  };
}

export default async function MemorialPage({ params }: Props) {
  const { id } = await params;
  return (
    <PublicPageLayout>
      <MemorialView memorialId={id} />
    </PublicPageLayout>
  );
}
