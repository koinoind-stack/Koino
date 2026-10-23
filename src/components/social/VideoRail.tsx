"use client";

/**
 * "Featured Videos" rail for the main feed (Part 5) — surfaces admin-featured
 * Bible movies, Christian films, and teachings directly in the social feed.
 *
 * Deliberately NON-flooding: reads /api/videos?featured=1 (max 6), renders
 * NOTHING when nothing is featured, and never creates feed posts on its own.
 * Users can still consciously share a video via its watch page.
 */

import { useEffect, useState } from "react";
import { Clapperboard, Play } from "lucide-react";
import { formatDuration } from "@/lib/videos";

type FeedVideo = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnailUrl: string | null;
  youtubeId: string | null;
  durationSec: number | null;
};

export default function VideoRail() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/videos?featured=1&take=6", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d: { videos?: FeedVideo[] }) => {
        if (!cancelled) setVideos((d.videos || []).slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (videos.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-white">
          <Clapperboard size={15} className="text-[#C4B5FD]" />
          Bible Movies &amp; Videos
        </h3>
        <a href="/videos" className="text-[11px] font-bold text-[#A78BFA] hover:text-white">
          Browse library →
        </a>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {videos.map((v) => (
          <a
            key={v.id}
            href={`/videos/${v.slug}`}
            className="group shrink-0 w-52 bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-[#7C3AED]/40 transition-all"
          >
            <div className="relative aspect-video bg-black/60">
              {(v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : null)) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.thumbnailUrl || `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                  alt={v.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#64748B]">
                  <Play size={18} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                <div className="w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center">
                  <Play size={13} fill="white" className="ml-0.5" />
                </div>
              </div>
              {formatDuration(v.durationSec) && (
                <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/80 text-[10px] font-bold text-white">
                  {formatDuration(v.durationSec)}
                </span>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-bold text-white leading-snug line-clamp-2 group-hover:text-[#C4B5FD] transition-colors">
                {v.title}
              </p>
              {v.summary && <p className="text-[10px] text-[#94A3B8] mt-1 line-clamp-1">{v.summary}</p>}
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-extrabold text-[#C4B5FD]">
                <Play size={9} fill="currentColor" /> Watch Now
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
