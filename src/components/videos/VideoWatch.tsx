"use client";

/**
 * Video watch page (Part 5) — official YouTube embed, metadata, related
 * Bible passages, related videos, personal lists (Watch Later / Favorite),
 * share (link + feed), report, and signed-in continue-watching progress.
 *
 * Progress model: a heartbeat POSTs the approximate position every 30s while
 * the page is visible, plus a final call when the page is hidden — only when
 * signed in. The embed resumes from the stored position via the `start` param.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play, Share2, Bookmark, Heart, Flag, Youtube, TriangleAlert,
  BookOpen, ChevronDown, ChevronLeft, Check, Clock, Eye,
} from "lucide-react";
import { toast } from "sonner";
import VideoCard, { type VideoCardData } from "./VideoCard";
import {
  categoryLabel, languageLabel, formatDuration, youtubeWatchUrl, youtubeEmbedUrl,
  type BibleRefLike, formatBibleRef,
} from "@/lib/videos";
import { BIBLE_BOOKS } from "@/lib/bible-data";

type BibleRef = BibleRefLike & { id: string };

type VideoData = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  source: string;
  youtubeId: string | null;
  canonicalUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  category: string;
  language: string;
  subtitleLanguages: string; // JSON string[]
  dubLanguages: string;      // JSON string[]
  originalLanguage: string | null;
  contentWarning: string | null;
  status: string;
  featured: boolean;
  embeddable: boolean;
  sourceName: string | null;
  rightsNote: string | null;
  viewCount: number;
  createdAt: string;
  bibleRefs: BibleRef[];
};

type DetailResponse = {
  video: VideoData;
  related: VideoCardData[];
  resumeAt: number;
  savedIn: { watchLater: boolean; favorite: boolean };
};

const bookName = (bookId: string) => BIBLE_BOOKS.find((b) => b.id === bookId)?.name || bookId;

function parseJsonArray(s: string | null | undefined): string[] {
  try {
    const v = s ? JSON.parse(s) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function VideoWatch({ slug }: { slug: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [embedStart, setEmbedStart] = useState(0);
  const [savedIn, setSavedIn] = useState({ watchLater: false, favorite: false });
  const [sharing, setSharing] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const playerRef = useRef<HTMLDivElement | null>(null);

  // Load the video (session-aware: also returns resumeAt + saved lists).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/${slug}`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b.error || "Could not load the video");
        return b as DetailResponse;
      })
      .then((b) => {
        if (cancelled) return;
        setData(b);
        setSavedIn(b.savedIn || { watchLater: false, favorite: false });
        if (b.resumeAt > 5) {
          setEmbedStart(b.resumeAt);
          setPlaying(true); // resume automatically
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSignedIn(Boolean(d?.id)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const sendProgress = useCallback(
    (opts?: { completed?: boolean; keepalive?: boolean }) => {
      if (!signedIn || !data?.video) return;
      const started = startedAtRef.current;
      if (started == null && !opts?.completed) return;
      const elapsed = started != null ? Math.floor((Date.now() - started) / 1000) : 0;
      const position = Math.max(embedStart, elapsed);
      // Avoid spamming identical positions.
      if (!opts?.completed && position - lastSentRef.current < 5 && !opts?.keepalive) return;
      lastSentRef.current = position;
      fetch(`/api/videos/${slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: opts?.keepalive,
        body: JSON.stringify({
          positionSec: position,
          completed: opts?.completed || (data.video.durationSec ? position >= data.video.durationSec * 0.92 : false),
        }),
      }).catch(() => {});
    },
    [signedIn, data, slug, embedStart],
  );

  // Heartbeat while watching + final save when the page is hidden.
  useEffect(() => {
    if (!playing || !signedIn) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") sendProgress();
    }, 30_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") sendProgress({ keepalive: true });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      sendProgress({ keepalive: true });
    };
  }, [playing, signedIn, sendProgress]);

  function watchNow() {
    setPlaying(true);
    if (startedAtRef.current == null) startedAtRef.current = Date.now() - embedStart * 1000;
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    sendProgress();
  }

  async function toggleSave(list: "watch_later" | "favorite") {
    if (!signedIn) {
      toast.error("Sign in to save videos to your list");
      return;
    }
    if (!data) return;
    const on = !(list === "watch_later" ? savedIn.watchLater : savedIn.favorite);
    try {
      const res = await fetch("/api/videos/me/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: data.video.id, list, on }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "Could not update your list");
      setSavedIn((s) => ({
        watchLater: list === "watch_later" ? on : s.watchLater,
        favorite: list === "favorite" ? on : s.favorite,
      }));
      toast.success(
        on
          ? list === "watch_later"
            ? "Saved to Watch Later"
            : "Added to Favorites"
          : list === "watch_later"
            ? "Removed from Watch Later"
            : "Removed from Favorites",
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function shareLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: data?.video.title || "Watch on Koino", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied — you can paste it in a message");
      }
    } catch {
      // user cancelled the share sheet — not an error
    }
  }

  async function shareToFeed() {
    if (!signedIn) {
      toast.error("Sign in to share videos in the feed");
      return;
    }
    if (sharing || !data) return;
    const caption = prompt(
      "Share this video in the Koino feed? You can add a short message (optional):",
      "",
    );
    if (caption === null) return; // cancelled
    setSharing(true);
    try {
      const res = await fetch(`/api/videos/${slug}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "Could not share the video");
      toast.success("Shared to the feed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  async function report() {
    const reason = prompt(
      "Why are you reporting this video?\n\n- broken or unavailable link\n- inappropriate content\n- copyright concern\n\nDescribe briefly:",
    );
    if (!reason?.trim()) return;
    try {
      const res = await fetch("/api/social/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "video",
          targetId: data?.video.id,
          reason: "inappropriate",
          details: reason.trim().slice(0, 1000),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Could not report");
      }
      toast.success("Report submitted for admin review. Thank you.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ─── loading / error / missing states ───
  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto px-4 pt-10 pb-24">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#94A3B8]">Loading video…</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="max-w-[900px] mx-auto px-4 pt-10 pb-24 text-center py-24">
        <TriangleAlert size={32} className="mx-auto text-[#F59E0B] mb-3" />
        <p className="text-sm text-[#94A3B8] max-w-xs mx-auto">{error || "Video not found"}</p>
        <a href="/videos" className="inline-flex items-center gap-1 mt-5 px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold">
          <ChevronLeft size={14} /> Back to the library
        </a>
      </div>
    );
  }

  const v = data.video;
  const subtitles = parseJsonArray(v.subtitleLanguages);
  const dubs = parseJsonArray(v.dubLanguages);
  const watchUrl = v.canonicalUrl || (v.youtubeId ? youtubeWatchUrl(v.youtubeId) : "#");
  const canEmbed = v.embeddable && v.youtubeId;
  const duration = formatDuration(v.durationSec);

  return (
    <div className="max-w-[900px] mx-auto px-4 pt-6 pb-24">
      {/* ─── back ─── */}
      <a href="/videos" className="inline-flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white mb-4">
        <ChevronLeft size={14} /> Bible Movies &amp; Videos
      </a>

      {/* ─── player ─── */}
      <div ref={playerRef} className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/[0.08]">
        {canEmbed && playing ? (
          <iframe
            src={`${youtubeEmbedUrl(v.youtubeId!, embedStart)}&autoplay=1`}
            title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        ) : (
          <button onClick={watchNow} className="absolute inset-0 group text-left">
            {v.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-70 transition-opacity" />
            ) : (
              <div className="w-full h-full bg-[#1C1929]" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-[#7C3AED] flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.5)] group-hover:scale-105 transition-transform">
                <Play size={24} fill="white" className="text-white ml-1" />
              </div>
              <span className="px-4 py-2 rounded-full bg-black/70 text-white text-xs font-extrabold tracking-wide">
                {embedStart > 5 ? `Continue from ${formatDuration(embedStart)}` : "Watch Now"}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Embed unavailable → always offer the YouTube link (spec §3). */}
      {!canEmbed && (
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 px-4 py-3 text-xs text-[#FCD34D] hover:bg-[#F59E0B]/15 transition-colors"
        >
          <Youtube size={16} className="shrink-0" />
          This video cannot be embedded here (embedding disabled or unavailable) — watch it directly on YouTube.
        </a>
      )}

      {/* ─── title + actions ─── */}
      <div className="mt-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg md:text-xl font-black text-white leading-snug">{v.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-[#94A3B8]">
            <span className="px-1.5 py-0.5 rounded-md bg-[#7C3AED]/15 text-[#C4B5FD] font-bold">{categoryLabel(v.category)}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/[0.05] font-bold">{languageLabel(v.language)}</span>
            {duration && (
              <span className="inline-flex items-center gap-1"><Clock size={11} /> {duration}</span>
            )}
            <span className="inline-flex items-center gap-1"><Eye size={11} /> {v.viewCount.toLocaleString()} views</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!playing && (
            <button
              onClick={watchNow}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold"
            >
              <Play size={13} fill="currentColor" /> Watch Now
            </button>
          )}
          <button
            onClick={() => toggleSave("watch_later")}
            title="Watch Later"
            className={`p-2.5 rounded-xl border transition-all ${
              savedIn.watchLater
                ? "bg-[#7C3AED]/20 border-[#7C3AED]/50 text-[#C4B5FD]"
                : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white"
            }`}
          >
            <Bookmark size={15} fill={savedIn.watchLater ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => toggleSave("favorite")}
            title="Favorite"
            className={`p-2.5 rounded-xl border transition-all ${
              savedIn.favorite
                ? "bg-[#EF4444]/15 border-[#EF4444]/40 text-[#FCA5A5]"
                : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white"
            }`}
          >
            <Heart size={15} fill={savedIn.favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={shareLink}
            title="Share"
            className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-white transition-all"
          >
            <Share2 size={15} />
          </button>
        </div>
      </div>

      {/* ─── content warning ─── */}
      {v.contentWarning && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#F59E0B]/[0.08] border border-[#F59E0B]/25 px-4 py-3">
          <TriangleAlert size={15} className="text-[#FCD34D] shrink-0 mt-0.5" />
          <p className="text-xs text-[#FCD34D] leading-relaxed">
            <span className="font-bold">Content note: </span>
            {v.contentWarning}
          </p>
        </div>
      )}

      {/* ─── related Bible passages ─── */}
      {v.bibleRefs.length > 0 && (
        <div className="mt-5">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#94A3B8] mb-2">
            <BookOpen size={13} className="text-[#7C3AED]" /> Related Bible Passages
          </h2>
          <div className="flex flex-wrap gap-2">
            {v.bibleRefs.map((r) => (
              <a
                key={r.id}
                href={`/?view=bible&book=${r.bookId}&chapter=${r.chapterStart}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C3AED]/[0.08] border border-[#7C3AED]/25 text-xs font-bold text-[#C4B5FD] hover:bg-[#7C3AED]/15 transition-colors"
              >
                <BookOpen size={12} />
                {formatBibleRef(r, bookName)}
                <span className="text-[#94A3B8] font-normal">· Read</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ─── description + meta ─── */}
      <div className="mt-5 bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
        {v.summary && <p className="text-sm text-[#C4C2D0] font-medium leading-relaxed">{v.summary}</p>}
        {v.description && (
          <div className={`relative mt-2 ${descOpen ? "" : "max-h-24 overflow-hidden"}`}>
            <p className="text-xs text-[#94A3B8] leading-relaxed whitespace-pre-wrap">{v.description}</p>
            {!descOpen && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#1C1929] to-transparent" />
            )}
          </div>
        )}
        {(v.description && v.description.length > 180) && (
          <button
            onClick={() => setDescOpen((o) => !o)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#A78BFA] hover:text-white"
          >
            {descOpen ? "Show less" : "Show more"} <ChevronDown size={11} className={descOpen ? "rotate-180" : ""} />
          </button>
        )}
        <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#64748B]">
          {v.sourceName && <span><span className="text-[#94A3B8] font-bold">Source:</span> {v.sourceName}</span>}
          <span><span className="text-[#94A3B8] font-bold">Audio:</span> {languageLabel(v.language)}</span>
          {subtitles.length > 0 && (
            <span><span className="text-[#94A3B8] font-bold">Subtitles:</span> {subtitles.map(languageLabel).join(", ")}</span>
          )}
          {dubs.length > 0 && (
            <span><span className="text-[#94A3B8] font-bold">Dubbed:</span> {dubs.map(languageLabel).join(", ")}</span>
          )}
          {v.originalLanguage && (
            <span><span className="text-[#94A3B8] font-bold">Original:</span> {languageLabel(v.originalLanguage)}</span>
          )}
          {v.rightsNote && <span><span className="text-[#94A3B8] font-bold">Rights:</span> {v.rightsNote}</span>}
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#A78BFA] hover:text-white">
            <Youtube size={12} /> Watch on YouTube
          </a>
        </div>
      </div>

      {/* ─── share to feed + report ─── */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={shareToFeed}
          disabled={sharing}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-[#C4C2D0] hover:text-white disabled:opacity-50"
        >
          <Share2 size={13} /> {sharing ? "Sharing…" : "Share to Feed"}
        </button>
        <button
          onClick={report}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-[#64748B] hover:text-white"
        >
          <Flag size={13} /> Report
        </button>
      </div>

      {/* ─── related videos ─── */}
      {data.related.length > 0 && (
        <section className="mt-9">
          <h2 className="text-base font-extrabold text-white tracking-tight mb-3">More Videos for You</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.related.map((rv) => (
              <VideoCard key={rv.id} video={rv} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
