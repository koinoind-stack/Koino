"use client";

/**
 * Individual memorial page (In Loving Memory).
 * Auth-aware: fetches /api/memorials/[id], which enforces the memorial's
 * visibility. Dignified header with candles, tabbed sections (About, Photos,
 * Videos & Memories, Tributes, Verse & Faith, Family), tributes with hearts
 * and replies, moderation tools for managers, share and report.
 *
 * Section visibility honours the family's `display` toggles.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flower2, MapPin, Share2, Flag, Trash2, EyeOff, Eye,
  Pencil, Send, Loader2, ShieldAlert, Lock, Heart, Flame,
  Film, X, ExternalLink, Reply, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/social/format";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { shareLinks } from "@/lib/share/links";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";
import {
  youtubeEmbedUrl, youtubeThumbUrl, youtubeWatchUrl, MEMORIAL_VIDEO_CATEGORIES,
} from "@/lib/youtube";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Hearted = {
  heartCount: number;
  likedByViewer: boolean;
};

type Condolence = Hearted & {
  id: string;
  authorId: string;
  authorName: string;
  kind: string; // "condolence" | "memory"
  body: string;
  hidden: boolean;
  parentId: string | null;
  createdAt: string;
  replies: Condolence[];
};

type MemorialVideoItem = {
  id: string;
  videoId: string;
  title: string;
  description: string | null;
  category: string;
  status: string; // pending | approved | rejected (managers/admins see all)
  rejectionReason: string | null;
  addedByName: string;
  createdAt: string;
};

type MemorialData = {
  memorial: {
    id: string; fullName: string; photoUrl: string | null; gallery: string[];
    dob: string | null; dod: string | null; city: string | null; state: string | null;
    tribute: string | null; lifeStory: string | null; milestones: string | null;
    qualities: string | null; verse: string | null; verseRef: string | null;
    testimony: string | null;
    display: { photos: boolean; videos: boolean; tributes: boolean; verse: boolean; family: boolean; candles: boolean };
    visibility: string; status: string; rejectionReason: string | null;
    creatorName: string; creatorRelation: string; createdAt: string; publishedAt: string | null;
  };
  viewer: { role: "owner" | "manager" | null; isAdmin: boolean; userId: string | null };
  managers: { userId: string; name: string; username: string | null; image: string | null; role: string }[];
  candleCount: number;
  viewerLitCandle: boolean;
  videos: MemorialVideoItem[];
  condolences: Condolence[];
};

type TabId = "about" | "photos" | "videos" | "tributes" | "verse" | "family";

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "";

const categoryLabel = (id: string): string =>
  MEMORIAL_VIDEO_CATEGORIES.find((c) => c.id === id)?.label || "Other";

export default function MemorialView({ memorialId }: { memorialId: string }) {
  const t = useTranslation();
  const { isAuthenticated } = useSupabaseUser();
  const [data, setData] = useState<MemorialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("about");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<"condolence" | "memory">("condolence");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [candleBusy, setCandleBusy] = useState(false);
  const [playing, setPlaying] = useState<MemorialVideoItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  // Universal share sheet. The card endpoint only renders status=published +
  // visibility=public memorials; private pages keep text + link sharing only.
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || t("memorials.view.notAvailable"));
        setData(null);
      } else {
        setData(body);
      }
    } catch {
      setError(t("memorials.view.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [memorialId, t]);

  useEffect(() => { load(); }, [load]);

  // Deep link ?v=<videoId> → open the Videos tab and start the player.
  useEffect(() => {
    if (!data) return;
    const v = new URLSearchParams(window.location.search).get("v");
    if (!v) return;
    const video = data.videos.find((x) => x.id === v || x.videoId === v);
    if (video) {
      setTab("videos");
      setPlaying(video);
      setTimeout(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
     
  }, [!!data]);

  async function postCondolence(parentId?: string) {
    const text = parentId ? replyMsg : msg;
    if (posting || text.trim().length < 2) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim(), kind, ...(parentId ? { parentId } : {}) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not post your message");
      if (parentId) { setReplyMsg(""); setReplyTo(null); } else { setMsg(""); }
      toast.success(parentId ? "Reply shared" : kind === "memory" ? "Memory shared" : "Condolence sent");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function toggleHeart(cid: string) {
    if (busyId === cid) return;
    setBusyId(cid);
    // optimistic update
    setData((d) => {
      if (!d) return d;
      const bump = (list: Condolence[]): Condolence[] =>
        list.map((c) => ({
          ...c,
          likedByViewer: c.id === cid ? !c.likedByViewer : c.likedByViewer,
          heartCount: c.id === cid ? c.heartCount + (c.likedByViewer ? -1 : 1) : c.heartCount,
          replies: bump(c.replies),
        }));
      return { ...d, condolences: bump(d.condolences) };
    });
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences/${cid}/heart`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save your heart");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function moderate(cid: string, action: "hide" | "unhide" | "delete") {
    if (busyId) return;
    if (action === "delete" && !confirm("Remove this message permanently?")) return;
    setBusyId(cid);
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/memorials/${memorialId}/condolences/${cid}`, { method: "DELETE" })
          : await fetch(`/api/memorials/${memorialId}/condolences/${cid}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hidden: action === "hide" }),
            });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Action failed");
      }
      toast.success(action === "delete" ? "Message removed" : action === "hide" ? "Message hidden" : "Message visible again");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOwn(cid: string) {
    if (busyId) return;
    if (!confirm("Delete your message?")) return;
    setBusyId(cid);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences/${cid}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete your message");
      toast.success("Your message was deleted");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reportTarget(targetType: string, targetId: string, reason: string, details: string) {
    try {
      const res = await fetch("/api/social/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, details: details.slice(0, 1000) }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Could not report");
      }
      toast.success("Report submitted. Thank you.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function reportMessage(cid: string) {
    reportTarget("memorial_condolence", cid, "inappropriate", "Reported tribute message");
  }

  function reportVideo(v: MemorialVideoItem) {
    reportTarget("memorial_video", v.id, "inappropriate", `Reported video: ${v.title}`);
  }

  function reportMemorial() {
    const reason = prompt(
      "Why are you reporting this memorial?\n\n- false information or impersonation\n- offensive or inappropriate content\n- shared without family permission\n\nDescribe briefly:",
    );
    if (!reason?.trim()) return;
    reportTarget("memorial", memorialId, "inappropriate", reason.trim());
  }

  function share() {
    const m = data?.memorial;
    setShareReq({
      heading: m ? `In loving memory of ${m.fullName}` : t("memorials.view.action.share"),
      shareText: m ? `In loving memory of ${m.fullName} — ${m.tribute || "Remembered with love on Koino."}` : undefined,
      shareUrl: shareLinks.memorial(memorialId),
      cardUrl: `/api/share-card?type=memorial&id=${encodeURIComponent(memorialId)}`,
      formats: ["portrait", "square"],
      fileName: `koino-memorial-${memorialId}.png`,
    });
  }

  function shareVideo(v: MemorialVideoItem) {
    const m = data?.memorial;
    const url = `${shareLinks.memorial(memorialId)}?v=${encodeURIComponent(v.id)}`;
    setShareReq({
      heading: v.title,
      shareText: m ? `${v.title} — in loving memory of ${m.fullName}` : v.title,
      shareUrl: url,
      cardUrl: `/api/share-card?type=memorial&id=${encodeURIComponent(memorialId)}`,
      formats: ["portrait", "square"],
      fileName: `koino-memorial-video-${v.id}.png`,
    });
  }

  async function lightCandle() {
    if (candleBusy) return;
    if (!isAuthenticated) {
      toast.error("Please sign in to light a candle");
      return;
    }
    setCandleBusy(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/candle`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not light the candle");
      toast.success(data?.viewerLitCandle ? "Your candle is already burning" : "A candle has been lit in their memory");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCandleBusy(false);
    }
  }

  async function unlightCandle() {
    if (candleBusy) return;
    setCandleBusy(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/candle`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove the candle");
      toast.success("Candle removed");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCandleBusy(false);
    }
  }

  async function shareToFeed() {
    if (sharing) return;
    if (!confirm("Share a respectful announcement of this memorial in the Koino feed?")) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/share-feed`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not share");
      toast.success("Announcement shared in the feed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  async function submitForReview() {
    if (submitting) return;
    if (!confirm("Submit this memorial for review? A Koino admin will check it before it appears publicly.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not submit");
      toast.success("Submitted for review");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function removeVideo(vid: string) {
    if (!confirm("Remove this video from the memorial?")) return;
    setBusyId(vid);
    fetch(`/api/memorials/${memorialId}/videos/${vid}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.error || "Could not remove the video");
        }
        setPlaying(null);
        toast.success("Video removed");
        await load();
      })
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setBusyId(null));
  }

  // ─── states ───
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <Flower2 size={30} className="mx-auto text-[#475569] mb-4" />
        <h1 className="text-lg font-bold text-white mb-2">{t("memorials.view.notAvailable")}</h1>
        <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">{error}</p>
        <Link href="/memorials" className="inline-flex items-center px-5 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm font-bold text-white hover:bg-white/10">
          <Flower2 size={14} className="mr-2" /> {t("memorials.view.visitDirectory")}
        </Link>
      </div>
    );
  }

  const m = data.memorial;
  const isManager = !!data.viewer.role;
  const isAdmin = data.viewer.isAdmin;
  const isDraft = m.status === "draft";
  const isPending = m.status === "pending";
  const isRejected = m.status === "rejected";
  const isUnpublished = m.status === "unpublished";
  const dates = [fmtDate(m.dob), fmtDate(m.dod)].filter(Boolean);

  const approvedVideos = data.videos.filter((v) => v.status === "approved");
  const pendingVideos = data.videos.filter((v) => v.status === "pending");
  const rejectedVideos = data.videos.filter((v) => v.status === "rejected");

  // Tabs honouring the family's display toggles + available content.
  const tabs: { id: TabId; label: string }[] = [];
  tabs.push({ id: "about", label: t("memorials.view.tab.about") });
  if (m.display.photos) tabs.push({ id: "photos", label: `${t("memorials.view.tab.photos")}${m.gallery.length ? ` (${m.gallery.length})` : ""}` });
  if (m.display.videos) tabs.push({ id: "videos", label: `${t("memorials.view.tab.videos")}${approvedVideos.length ? ` (${approvedVideos.length})` : ""}` });
  if (m.display.tributes) tabs.push({ id: "tributes", label: t("memorials.view.tab.tributes") });
  if (m.display.verse && (m.verse || m.testimony)) tabs.push({ id: "verse", label: t("memorials.view.tab.verse") });
  if (m.display.family && (m.milestones || m.qualities)) tabs.push({ id: "family", label: t("memorials.view.tab.family") });
  const activeTab: TabId = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id || "about";

  const renderCondolence = (c: Condolence, isReply = false) => {
    const own = data.viewer.userId === c.authorId;
    const canModerate = isManager || isAdmin;
    return (
      <div key={c.id} className={isReply ? "mt-2.5" : ""}>
        <div className={`rounded-2xl border px-4 py-3.5 ${
          c.hidden ? "bg-[#111827]/30 border-red-500/10 opacity-70" : isReply ? "bg-white/[0.02] border-white/[0.05]" : "bg-[#111827]/60 border-white/[0.05]"
        }`}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-white">{c.authorName}</span>
            {c.kind === "memory" && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7C3AED]/15 text-[#C4B5FD]">Memory</span>
            )}
            <span className="text-[10px] text-[#64748B]">{timeAgo(c.createdAt)}</span>
            {c.hidden && <span className="text-[9px] font-bold text-red-300 uppercase">Hidden</span>}
          </div>
          <p className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{c.body}</p>
          <div className="flex items-center gap-3.5 mt-2.5">
            <button
              onClick={() => toggleHeart(c.id)}
              disabled={busyId === c.id || !isAuthenticated}
              aria-label={c.likedByViewer ? "Remove your heart from this message" : "Send a heart for this message"}
              className={`text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-40 ${c.likedByViewer ? "text-[#F472B6]" : "text-[#64748B] hover:text-[#F472B6]"}`}
            >
              <Heart size={12} fill={c.likedByViewer ? "currentColor" : "none"} /> {c.heartCount}
            </button>
            {!isReply && isAuthenticated && (
              <button
                onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyMsg(""); }}
                className="text-[11px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1"
              >
                <Reply size={11} /> {t("memorials.view.reply")}
              </button>
            )}
            {own && (
              <button onClick={() => deleteOwn(c.id)} disabled={busyId === c.id} className="text-[10px] font-bold text-[#64748B] hover:text-red-300 inline-flex items-center gap-1">
                <Trash2 size={10} /> {t("memorials.view.msg.delete")}
              </button>
            )}
            {canModerate && !own && (
              <>
                <button onClick={() => moderate(c.id, c.hidden ? "unhide" : "hide")} disabled={busyId === c.id} className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1">
                  {c.hidden ? <><Eye size={10} /> {t("memorials.view.msg.unhide")}</> : <><EyeOff size={10} /> {t("memorials.view.msg.hide")}</>}
                </button>
                <button onClick={() => moderate(c.id, "delete")} disabled={busyId === c.id} className="text-[10px] font-bold text-[#64748B] hover:text-red-300 inline-flex items-center gap-1">
                  <Trash2 size={10} /> {t("memorials.view.msg.remove")}
                </button>
              </>
            )}
            {!own && !canModerate && (
              <button onClick={() => reportMessage(c.id)} className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1">
                <Flag size={10} /> {t("memorials.view.msg.report")}
              </button>
            )}
          </div>

          {/* reply composer */}
          {replyTo === c.id && (
            <div className="mt-3">
              <textarea
                value={replyMsg}
                onChange={(e) => setReplyMsg(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={`Reply to ${c.authorName}…`}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50 resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setReplyTo(null)} className="px-3 py-1.5 rounded-full text-[11px] font-bold text-[#64748B] hover:text-white">{t("common.cancel")}</button>
                <button
                  onClick={() => postCondolence(c.id)}
                  disabled={posting || replyMsg.trim().length < 2}
                  className="px-3.5 py-1.5 rounded-full bg-[#7C3AED] text-white text-[11px] font-bold disabled:opacity-40"
                >
                  {posting ? t("memorials.view.composer.sending") : "Send reply"}
                </button>
              </div>
            </div>
          )}
        </div>
        {c.replies.length > 0 && (
          <div className="ml-4 sm:ml-6">
            {c.replies.map((r) => renderCondolence(r, true))}
          </div>
        )}
      </div>
    );
  };

  const videoCard = (v: MemorialVideoItem, managerView: boolean) => (
    <li key={v.id} className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] overflow-hidden">
      <button
        onClick={() => { setPlaying(v); setTimeout(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150); }}
        className="block w-full text-left group"
        aria-label={`Play video: ${v.title}`}
      >
        <div className="relative aspect-video bg-black/40">
          { }
          <img
            src={youtubeThumbUrl(v.videoId)}
            alt={v.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            loading="lazy"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-11 h-11 rounded-full bg-black/60 border border-white/20 flex items-center justify-center group-hover:bg-[#7C3AED]/80 transition-colors">
              <Film size={17} className="text-white" />
            </span>
          </span>
        </div>
      </button>
      <div className="px-3.5 py-3">
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-bold text-white leading-snug flex-1">{v.title}</h3>
          {managerView && v.status !== "approved" && (
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${
              v.status === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"
            }`}>
              {v.status}
            </span>
          )}
        </div>
        {v.description && <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2 leading-relaxed">{v.description}</p>}
        <p className="text-[10px] text-[#64748B] mt-1.5">
          {categoryLabel(v.category)} · shared by {v.addedByName}
        </p>
        {managerView && v.status === "rejected" && v.rejectionReason && (
          <p className="text-[10px] text-red-300/80 mt-1.5">Admin note: {v.rejectionReason}</p>
        )}
        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-white/[0.04]">
          <button onClick={() => setPlaying(v)} className="text-[10px] font-bold text-[#C4B5FD] hover:text-white">Play</button>
          <a href={youtubeWatchUrl(v.videoId)} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1">
            {t("memorials.view.openOnYouTube")} <ExternalLink size={9} />
          </a>
          <button onClick={() => shareVideo(v)} className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1">
            <Share2 size={9} /> {t("common.share")}
          </button>
          {isManager && (
            <button onClick={() => removeVideo(v.id)} disabled={busyId === v.id} className="text-[10px] font-bold text-[#64748B] hover:text-red-300 inline-flex items-center gap-1 ml-auto">
              <Trash2 size={9} /> {t("memorials.view.msg.remove")}
            </button>
          )}
          {!isManager && !isAdmin && (
            <button onClick={() => reportVideo(v)} className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1 ml-auto">
              <Flag size={9} /> {t("memorials.view.action.report")}
            </button>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <div className="max-w-[680px] mx-auto px-4 pt-8 pb-24">
      {/* ─── status banners (managers only) ─── */}
      {isManager && (isDraft || isPending || isRejected || isUnpublished) && (
        <div className={`rounded-xl border px-4 py-3 mb-5 flex items-center gap-2.5 ${
          isDraft ? "bg-amber-500/[0.06] border-amber-500/25"
          : isPending ? "bg-sky-500/[0.06] border-sky-500/25"
          : isRejected ? "bg-red-500/[0.06] border-red-500/25"
          : "bg-red-500/[0.06] border-red-500/25"
        }`}>
          {isDraft ? <Pencil size={14} className="text-amber-300 shrink-0" />
          : isPending ? <Clock size={14} className="text-sky-300 shrink-0" />
          : <EyeOff size={14} className="text-red-300 shrink-0" />}
          <p className="text-xs text-[#94A3B8] flex-1 leading-relaxed">
            {isDraft && t("memorials.view.banner.draft")}
            {isPending && t("memorials.view.banner.pending")}
            {isRejected && `A Koino admin declined this version. Reason: ${m.rejectionReason || "No reason given"} — you can edit and submit it again.`}
            {isUnpublished && t("memorials.view.banner.unpublished")}
          </p>
          {isDraft && (
            <button onClick={submitForReview} disabled={submitting} className="px-3 py-1.5 rounded-full bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] disabled:opacity-40 shrink-0">
              {submitting ? t("memorials.view.submitting") : t("memorials.view.submit")}
            </button>
          )}
        </div>
      )}

      {/* ─── peaceful header ─── */}
      <header className="text-center mb-8">
        {m.photoUrl ? (
          <Image
            src={m.photoUrl}
            alt={m.fullName}
            width={112}
            height={112}
            className="w-28 h-28 rounded-full object-cover mx-auto border-2 border-white/10"
            unoptimized
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#7C3AED]/25 to-[#1C1929] flex items-center justify-center mx-auto border border-white/10">
            <Flower2 size={36} className="text-[#C4B5FD]" />
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-5">{m.fullName}</h1>
        {dates.length > 0 && (
          <p className="text-sm text-[#94A3B8] mt-2">{dates.join("  ·  ")}</p>
        )}
        {(m.city || m.state) && (
          <p className="text-xs text-[#64748B] mt-1.5 inline-flex items-center gap-1">
            <MapPin size={11} /> {[m.city, m.state].filter(Boolean).join(", ")}
          </p>
        )}
        <p className="text-xs text-[#64748B] mt-3">
          Remembered by {m.creatorName} · {m.creatorRelation}
        </p>

        {/* candles */}
        {m.display.candles && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={data.viewerLitCandle ? unlightCandle : lightCandle}
              disabled={candleBusy}
              aria-label={data.viewerLitCandle ? "Your candle is lit — tap to remove it" : `Light a candle in memory of ${m.fullName}`}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-colors disabled:opacity-40 ${
                data.viewerLitCandle
                  ? "bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-amber-200"
                  : "bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-amber-100 hover:bg-[#F59E0B]/20"
              }`}
            >
              <Flame size={14} className={data.viewerLitCandle ? "text-amber-300" : "text-amber-200/70"} />
              {data.viewerLitCandle ? t("memorials.view.candle.lit") : t("memorials.view.candle.light")}
            </button>
            <span className="text-xs text-[#94A3B8]" aria-label={t("memorials.view.candleCount", { n: data.candleCount })}>
              {t("memorials.view.candleCount", { n: data.candleCount })}
            </span>
          </div>
        )}

        {/* actions row */}
        <div className="flex items-center justify-center flex-wrap gap-2 mt-5">
          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10"
          >
            <Share2 size={13} /> {t("memorials.view.action.share")}
          </button>
          {isManager && m.status === "published" && m.visibility === "public" && (
            <button
              onClick={shareToFeed}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#7C3AED] text-xs font-bold text-white hover:bg-[#6D28D9] disabled:opacity-40"
            >
              {sharing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t("memorials.view.action.shareToFeed")}
            </button>
          )}
          {isManager && (
            <Link
              href={`/memorials/${m.id}/manage`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10"
            >
              <Pencil size={13} /> {t("memorials.view.action.manage")}
            </Link>
          )}
          {!isManager && (
            <button
              onClick={reportMemorial}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.03] text-[11px] font-bold text-[#64748B] hover:text-white"
            >
              <Flag size={12} /> {t("memorials.view.action.report")}
            </button>
          )}
        </div>
      </header>

      {/* ─── video player (shared section) ─── */}
      {playing && (
        <div ref={playerRef} className="mb-8 rounded-2xl bg-[#0B0F1A] border border-white/[0.08] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
            <Film size={13} className="text-[#C4B5FD] shrink-0" />
            <p className="text-xs font-bold text-white truncate flex-1">{playing.title}</p>
            <a href={youtubeWatchUrl(playing.videoId)} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1 shrink-0">
              {t("memorials.view.openOnYouTube")} <ExternalLink size={9} />
            </a>
            <button
              onClick={() => setPlaying(null)}
              aria-label="Close video player"
              className="w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center hover:bg-white/10 shrink-0"
            >
              <X size={13} className="text-white" />
            </button>
          </div>
          <div className="aspect-video">
            <iframe
              src={youtubeEmbedUrl(playing.videoId)}
              title={playing.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* ─── tabs ─── */}
      <div className="flex gap-1.5 mb-5 border-b border-white/[0.05] pb-3 overflow-x-auto" role="tablist" aria-label="Memorial sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === t.id ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── about tab ─── */}
      {activeTab === "about" && (
        <div className="space-y-5">
          {m.tribute && (
            <p className="text-[15px] text-[#E2E8F0] leading-relaxed font-medium">{m.tribute}</p>
          )}
          {m.lifeStory ? (
            <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{m.lifeStory}</div>
          ) : (
            !m.tribute && (
              <p className="text-sm text-[#64748B] italic">The life story will be added by the family.</p>
            )
          )}
          {!m.tribute && !m.lifeStory && (
            <p className="text-sm text-[#64748B] italic text-center py-6">
              The family has not added the story yet — please check again soon.
            </p>
          )}
        </div>
      )}

      {/* ─── photos tab ─── */}
      {activeTab === "photos" && (
        m.gallery.length === 0 ? (
          <p className="text-sm text-[#64748B] italic text-center py-10">{t("memorials.view.noPhotos")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {m.gallery.map((g) => (
              <a key={g} href={g} target="_blank" rel="noreferrer" className="block">
                <Image src={g} alt="" width={220} height={220} className="w-full aspect-square object-cover rounded-xl border border-white/[0.06]" unoptimized />
              </a>
            ))}
          </div>
        )
      )}

      {/* ─── videos tab ─── */}
      {activeTab === "videos" && (
        <div className="space-y-4">
          {(isManager || isAdmin) && pendingVideos.length > 0 && (
            <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/25 px-4 py-3">
              <p className="text-xs font-bold text-amber-200 mb-2.5">
                {pendingVideos.length} video{pendingVideos.length === 1 ? "" : "s"} waiting for admin approval
              </p>
              <ul className="space-y-2.5">
                {pendingVideos.map((v) => videoCard(v, true))}
              </ul>
            </div>
          )}
          {(isManager || isAdmin) && rejectedVideos.length > 0 && (
            <div className="rounded-xl bg-red-500/[0.06] border border-red-500/25 px-4 py-3">
              <p className="text-xs font-bold text-red-200 mb-2.5">Rejected videos (only managers can see these)</p>
              <ul className="space-y-2.5">
                {rejectedVideos.map((v) => videoCard(v, true))}
              </ul>
            </div>
          )}
          {approvedVideos.length === 0 ? (
            <p className="text-sm text-[#64748B] italic text-center py-10">
              {t("memorials.view.noVideos")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {approvedVideos.map((v) => videoCard(v, isManager || isAdmin))}
            </ul>
          )}
          <p className="text-[10px] text-[#475569] text-center">
            {t("memorials.view.videoNote")}
          </p>
        </div>
      )}

      {/* ─── tributes tab ─── */}
      {activeTab === "tributes" && (
        <div className="space-y-4">
          {/* composer */}
          {isAuthenticated && !isDraft && !isPending ? (
            <div className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] p-4">
              <div className="flex gap-1.5 mb-2.5">
                <button
                  onClick={() => setKind("condolence")}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${kind === "condolence" ? "bg-[#7C3AED] text-white" : "bg-white/[0.04] text-[#94A3B8]"}`}
                >
                  {t("memorials.view.composer.condolence")}
                </button>
                <button
                  onClick={() => setKind("memory")}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${kind === "memory" ? "bg-[#7C3AED] text-white" : "bg-white/[0.04] text-[#94A3B8]"}`}
                >
                  {t("memorials.view.composer.memory")}
                </button>
              </div>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={kind === "condolence" ? t("memorials.view.composer.condolencePlaceholder") : t("memorials.view.composer.memoryPlaceholder")}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => postCondolence()}
                  disabled={posting || msg.trim().length < 2}
                  className="px-4 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
                >
                  {posting ? t("memorials.view.composer.sending") : kind === "condolence" ? t("memorials.view.composer.sendCondolence") : t("memorials.view.composer.shareMemory")}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#64748B] text-center py-3">
              <Link href="/auth/signin" className="text-[#C4B5FD] font-bold hover:text-white">Sign in</Link>
              {" "}to leave a condolence or share a memory.
            </p>
          )}

          {/* list */}
          {data.condolences.length === 0 ? (
            <p className="text-sm text-[#64748B] italic text-center py-8">
              {t("memorials.view.noMessages")}
            </p>
          ) : (
            <ul className="space-y-3">
              {data.condolences.map((c) => renderCondolence(c))}
            </ul>
          )}
        </div>
      )}

      {/* ─── verse & faith tab ─── */}
      {activeTab === "verse" && (
        <div className="space-y-5">
          {m.verse && (
            <div className="text-center px-6 py-6 rounded-2xl bg-[#7C3AED]/[0.05] border border-[#7C3AED]/15">
              <p className="text-[15px] italic text-[#C4B5FD] leading-relaxed">“{m.verse}”</p>
              {m.verseRef && <p className="text-[11px] font-bold text-[#64748B] mt-2 uppercase tracking-wider">{m.verseRef}</p>}
            </div>
          )}
          {m.testimony && (
            <section>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Faith &amp; message of hope</h2>
              <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{m.testimony}</div>
            </section>
          )}
        </div>
      )}

      {/* ─── family tab ─── */}
      {activeTab === "family" && (
        <div className="space-y-5">
          {m.milestones && (
            <section>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Family background &amp; milestones</h2>
              <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{m.milestones}</div>
            </section>
          )}
          {m.qualities && (
            <section>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Qualities, achievements &amp; memories</h2>
              <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{m.qualities}</div>
            </section>
          )}
        </div>
      )}

      {/* ─── managers footer ─── */}
      {data.managers.length > 0 && (
        <div className="mt-10 pt-5 border-t border-white/[0.05] text-center">
          <p className="text-[11px] text-[#64748B]">
            {isManager ? "Managed by" : "This memorial is cared for by"}{" "}
            {data.managers.map((mm, i) => (
              <span key={mm.userId}>
                {i > 0 && ", "}
                <span className="text-[#94A3B8] font-semibold">{mm.name}</span>
                {mm.role === "owner" && " (owner)"}
              </span>
            ))}
          </p>
          {!isManager && (
            <p className="text-[10px] text-[#475569] mt-1.5 inline-flex items-center gap-1 justify-center">
              <Lock size={9} /> Managed with respect — report anything inappropriate using the button above.
            </p>
          )}
        </div>
      )}

      {isAdmin && !isManager && (
        <div className="mt-4 rounded-xl bg-red-500/[0.05] border border-red-500/20 px-4 py-2.5 flex items-center gap-2">
          <ShieldAlert size={13} className="text-red-300" />
          <p className="text-[11px] text-[#94A3B8]">You are viewing this memorial as a Koino administrator.</p>
        </div>
      )}

      <div className="text-center mt-8">
        <Link href="/memorials" className="text-[11px] text-[#64748B] hover:text-white">
          {t("memorials.view.allMemorials")}
        </Link>
      </div>

      {/* ─── UNIVERSAL SHARE SHEET ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />
    </div>
  );
}
