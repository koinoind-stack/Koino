"use client";

/**
 * Shared video card for the library, rails, and related-video grids.
 * Thumbnail (YouTube poster or custom), title, summary, category chip,
 * language + duration meta. Clicking navigates to /videos/[slug].
 */

import { categoryLabel, formatDuration, languageLabel } from "@/lib/videos";

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
};

export default function VideoCard({ video, href }: { video: VideoCardData; href?: string }) {
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
      className="group block bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-[#7C3AED]/40 transition-all"
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
          <div className="w-11 h-11 rounded-full bg-[#7C3AED] flex items-center justify-center shadow-lg">
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
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#7C3AED] text-[9px] font-extrabold uppercase tracking-wide text-white">
            Featured
          </span>
        )}
        {/* continue-watching progress bar */}
        {pct != null && pct > 0 && !video.completed && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div className="h-full bg-[#38BDF8]" style={{ width: `${pct}%` }} />
          </div>
        )}
        {video.completed && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#22C55E]/90 text-[9px] font-extrabold uppercase tracking-wide text-white">
            Watched
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-[#C4B5FD] transition-colors">
          {video.title}
        </h3>
        {video.summary && (
          <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2">{video.summary}</p>
        )}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="px-1.5 py-0.5 rounded-md bg-[#7C3AED]/15 text-[#C4B5FD] text-[10px] font-bold">
            {categoryLabel(video.category)}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-white/[0.05] text-[#94A3B8] text-[10px] font-bold">
            {languageLabel(video.language)}
          </span>
        </div>
      </div>
    </a>
  );
}
