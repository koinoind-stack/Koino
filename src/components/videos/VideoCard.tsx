"use client";

/**
 * Shared video card for the library, rails, and related-video grids.
 * Thumbnail (YouTube poster or custom), title, summary, category chip,
 * language + duration meta. Clicking navigates to /videos/[slug].
 */

import { BookOpen } from "lucide-react";
import { categoryLabel, formatDuration, languageLabel, formatBibleRef, type BibleRefLike } from "@/lib/videos";
import { BIBLE_BOOKS } from "@/lib/bible-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const cardBookName = (bookId: string) =>
  BIBLE_BOOKS.find((b) => b.id === bookId)?.name || bookId;

export type VideoCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnailUrl: string | null;
  youtubeId: string | null;
  durationSec: number | null;
  category: string;
  language: string;
  featured?: boolean;
  positionSec?: number;
  completed?: boolean;
  // Optional Bible passage coverage (P3/P4): cards label which book and
  // chapter range the video brings to life, e.g. "Genesis 1–50" — a whole-book
  // movie must never look like it belongs to a single chapter.
  bibleRefs?: BibleRefLike[];
};

export default function VideoCard({ video, href }: { video: VideoCardData; href?: string }) {
  const t = useTranslation();
  const thumb =
    video.thumbnailUrl ||
    (video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : null);
  const duration = formatDuration(video.durationSec);
  const pct =
    video.positionSec && video.durationSec
      ? Math.min(100, Math.round((video.positionSec / video.durationSec) * 100))
      : null;

  return (
    <a
      href={href || `/videos/${video.slug}`}
      className="group block bg-[#13294A] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-[#2563EB]/40 transition-all"
    >
      <div className="relative aspect-video bg-black/60 overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#64748B]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        {/* play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <div className="w-11 h-11 rounded-full bg-[#2563EB] flex items-center justify-center shadow-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
        </div>
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/80 text-[10px] font-bold text-white">
            {duration}
          </span>
        )}
        {video.featured && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#2563EB] text-[9px] font-extrabold uppercase tracking-wide text-white">
            {t("videos.card.featured")}
          </span>
        )}
        {/* continue-watching progress bar */}
        {pct != null && pct > 0 && !video.completed && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div className="h-full bg-[#22D3EE]" style={{ width: `${pct}%` }} />
          </div>
        )}
        {video.completed && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#22C55E]/90 text-[9px] font-extrabold uppercase tracking-wide text-white">
            {t("videos.card.watched")}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-[#93C5FD] transition-colors">
          {video.title}
        </h3>
        {video.summary && (
          <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2">{video.summary}</p>
        )}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="px-1.5 py-0.5 rounded-md bg-[#2563EB]/15 text-[#93C5FD] text-[10px] font-bold">
            {categoryLabel(video.category)}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-white/[0.05] text-[#94A3B8] text-[10px] font-bold">
            {languageLabel(video.language)}
          </span>
          {video.bibleRefs && video.bibleRefs.length > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#22D3EE]/10 text-[#7DD3FC] text-[10px] font-bold max-w-full"
              title={video.bibleRefs.map((r) => formatBibleRef(r, cardBookName)).join(" · ")}
            >
              <BookOpen size={9} className="shrink-0" />
              <span className="truncate">
                {formatBibleRef(video.bibleRefs[0], cardBookName)}
                {video.bibleRefs.length > 1 && ` +${video.bibleRefs.length - 1}`}
              </span>
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
