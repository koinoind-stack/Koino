"use client";

/**
 * ArticleShareBar (Task 73) — share controls for the public article page.
 * Reuses the universal ShareSheet (Task 121) with the existing branded
 * share-card endpoint (kind=blog) — no new sharing infrastructure.
 */

import { useState } from "react";
import { Share2 } from "lucide-react";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Props = {
  title: string;
  excerpt: string | null;
  slug: string;
  imageUrl: string | null;
  shareUrl: string;
};

export default function ArticleShareBar({ title, excerpt, slug, imageUrl, shareUrl }: Props) {
  const t = useTranslation();
  const [req, setReq] = useState<ShareRequest | null>(null);

  const open = () => {
    setReq({
      heading: title,
      shareText: excerpt ? `${title}\n\n${excerpt}` : title,
      shareUrl,
      cardUrl: `/api/share-card?type=article&kind=blog&slug=${encodeURIComponent(slug)}`,
      imageUrl: imageUrl ?? undefined,
      fileName: `koino-article-${slug}.png`,
      formats: ["square", "portrait", "story", "landscape"],
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-4 py-2 text-xs font-bold text-white transition-colors"
      >
        <Share2 size={13} /> {t("common.share")}
      </button>
      {req && <ShareSheet request={req} onClose={() => setReq(null)} />}
    </>
  );
}
