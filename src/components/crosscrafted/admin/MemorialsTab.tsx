"use client";

/**
 * Admin — In Loving Memory tab.
 * Sections:
 *   1. Memorials — filters (pending/published/rejected/draft/unpublished/
 *      reported), full submission review (photos preview), approve,
 *      reject with a reason, edit where needed, unpublish/restore, delete.
 *   2. Videos — YouTube review queue: safe thumbnail preview (nothing
 *      autoplays), approve / reject with a reason / remove.
 * Every action persists and is timestamped (moderatedAt) via the API.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Flower2, Search, EyeOff, RotateCcw, ExternalLink, Trash2, Check, X, Pencil, Film } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type AdminMemorial = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  city: string | null;
  state: string | null;
  tribute: string | null;
  lifeStory: string | null;
  milestones: string | null;
  qualities: string | null;
  verse: string | null;
  verseRef: string | null;
  testimony: string | null;
  gallery: string;
  rejectionReason: string | null;
  visibility: string;
  status: string;
  creatorName: string;
  creatorRelation: string;
  createdAt: string;
  moderatedAt: string | null;
  creator: { username: string | null; name: string | null; accountStatus: string } | null;
  _count: { condolences: number; videos: number; candles: number };
  pendingReports: number;
};

type AdminVideo = {
  id: string;
  memorialId: string;
  videoId: string;
  url: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  addedByName: string;
  createdAt: string;
  thumbUrl: string;
  watchUrl: string;
  memorial: { fullName: string; status: string };
};

function parseGallery(json: string): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

export default function MemorialsTab() {
  const t = useTranslation();
  const [section, setSection] = useState<"memorials" | "videos">("memorials");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminMemorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<AdminMemorial | null>(null);
  const [editing, setEditing] = useState<{ tribute: string; lifeStory: string } | null>(null);
  const [rejecting, setRejecting] = useState<AdminMemorial | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const firstLoad = useRef(true);

  // videos section
  const [videoStatus, setVideoStatus] = useState("pending");
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoRejecting, setVideoRejecting] = useState<AdminVideo | null>(null);
  const [videoRejectReason, setVideoRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (status === "reported") {
        params.delete("status");
        params.set("filter", "reported");
      }
      const res = await fetch(`/api/admin/memorials?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load memorials");
      setItems(body.memorials || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, firstLoad.current ? 0 : 300);
    firstLoad.current = false;
    return () => clearTimeout(t);
  }, [load]);

  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const params = new URLSearchParams();
      if (videoStatus) params.set("status", videoStatus);
      const res = await fetch(`/api/admin/memorials/videos?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load videos");
      setVideos(body.videos || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setVideosLoading(false);
    }
  }, [videoStatus]);

  useEffect(() => {
    if (section === "videos") loadVideos();
  }, [section, loadVideos]);

  async function action(m: AdminMemorial, act: "approve" | "unpublish" | "restore") {
    if (busyId) return;
    const labels = {
      approve: `Approve “${m.fullName}”? It will appear in the public directory.`,
      unpublish: `Unpublish “${m.fullName}”? It will be hidden from the public.`,
      restore: `Restore (publish) “${m.fullName}”?`,
    };
    if (!confirm(labels[act])) return;
    setBusyId(m.id);
    try {
      const res = await fetch("/api/admin/memorials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, action: act }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success(act === "approve" ? "Memorial approved and published" : act === "unpublish" ? "Memorial unpublished" : "Memorial restored");
      setReviewing(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejecting || busyId) return;
    if (rejectReason.trim().length < 4) {
      toast.error("Please give the family a short reason so they can fix the memorial");
      return;
    }
    setBusyId(rejecting.id);
    try {
      const res = await fetch("/api/admin/memorials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rejecting.id, action: "reject", rejectionReason: rejectReason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success("Memorial rejected — the family can see your reason and resubmit");
      setRejecting(null);
      setRejectReason("");
      setReviewing(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit() {
    if (!reviewing || !editing || busyId) return;
    setBusyId(reviewing.id);
    try {
      const res = await fetch("/api/admin/memorials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewing.id, action: "edit", edit: editing }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save");
      toast.success("Memorial corrected");
      setEditing(null);
      setReviewing(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeMemorial(m: AdminMemorial) {
    if (busyId) return;
    if (!confirm(`Permanently DELETE “${m.fullName}”? This removes every story, photo, candle, video and tribute. Prefer rejecting or unpublishing when possible.`)) return;
    if (!confirm("This cannot be undone. Delete permanently?")) return;
    setBusyId(m.id);
    try {
      const res = await fetch(`/api/admin/memorials?id=${encodeURIComponent(m.id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not delete");
      toast.success("Memorial deleted");
      setReviewing(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function videoAction(v: AdminVideo, act: "approve") {
    if (busyId) return;
    if (!confirm(`Approve “${v.title}”? It will play on the memorial page.`)) return;
    setBusyId(v.id);
    try {
      const res = await fetch("/api/admin/memorials/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, status: "approved" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success("Video approved");
      await loadVideos();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function videoReject() {
    if (!videoRejecting || busyId) return;
    setBusyId(videoRejecting.id);
    try {
      const res = await fetch("/api/admin/memorials/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: videoRejecting.id, status: "rejected", rejectionReason: videoRejectReason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success("Video rejected");
      setVideoRejecting(null);
      setVideoRejectReason("");
      await loadVideos();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function videoRemove(v: AdminVideo) {
    if (busyId) return;
    if (!confirm(`Remove “${v.title}” permanently?`)) return;
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/admin/memorials/videos?id=${encodeURIComponent(v.id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not delete");
      toast.success("Video removed");
      await loadVideos();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const statusChip = (s: string) => (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
      s === "published" ? "bg-emerald-500/15 text-emerald-300"
      : s === "pending" ? "bg-sky-500/15 text-sky-300"
      : s === "draft" ? "bg-amber-500/15 text-amber-300"
      : s === "rejected" ? "bg-red-500/15 text-red-300"
      : "bg-red-500/15 text-red-300"
    }`}>
      {s}
    </span>
  );

  return (
    <div>
      {/* section switch */}
      <div className="flex gap-1.5 mb-5">
        <button
          onClick={() => setSection("memorials")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${section === "memorials" ? "bg-[#2563EB] text-white" : "bg-white/[0.04] text-[#94A3B8] hover:text-white"}`}
        >
          <Flower2 size={12} /> {t("admin.memorials.tab.memorials")}
        </button>
        <button
          onClick={() => setSection("videos")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${section === "videos" ? "bg-[#2563EB] text-white" : "bg-white/[0.04] text-[#94A3B8] hover:text-white"}`}
        >
          <Film size={12} /> {t("admin.memorials.tab.videoQueue")} {videoStatus === "pending" && videos.length > 0 ? `(${videos.length})` : ""}
        </button>
      </div>

      {section === "memorials" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("admin.memorials.searchPlaceholder")}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-[#13294A]"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending review</option>
              <option value="published">{t("common.status.published")}</option>
              <option value="rejected">{t("common.status.rejected")}</option>
              <option value="draft">{t("common.status.draft")}</option>
              <option value="unpublished">Unpublished</option>
              <option value="reported">Reported</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <Flower2 size={26} className="mx-auto text-[#475569] mb-3" />
              <p className="text-sm text-[#94A3B8]">{t("admin.memorials.empty")}</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map((m) => (
                <li key={m.id} className="rounded-2xl bg-[#0F2038]/60 border border-white/[0.05] px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    {m.photoUrl ? (
                       
                      <img src={m.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                        <Flower2 size={15} className="text-[#93C5FD]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setReviewing(m)} className="text-sm font-bold text-white hover:underline inline-flex items-center gap-1">
                          {m.fullName}
                        </button>
                        {statusChip(m.status)}
                        {m.visibility !== "public" && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[#94A3B8]">{m.visibility}</span>
                        )}
                        {m.pendingReports > 0 && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">
                            {m.pendingReports} pending report{m.pendingReports === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1">
                        {[m.city, m.state].filter(Boolean).join(", ") || "No location"} · by {m.creatorName} ({m.creatorRelation})
                        {m.creator?.username ? ` (@${m.creator.username})` : ""}
                        {m.creator?.accountStatus && m.creator.accountStatus !== "active" ? ` · account ${m.creator.accountStatus}` : ""}
                        {" "}{m._count.condolences} tribute{m._count.condolences === 1 ? "" : "s"} · {m._count.videos} video{m._count.videos === 1 ? "" : "s"} · {m._count.candles} candle{m._count.candles === 1 ? "" : "s"}
                      </p>
                      {m.status === "rejected" && m.rejectionReason && (
                        <p className="text-[10px] text-red-300/80 mt-1">Rejected: {m.rejectionReason}</p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {m.status === "pending" && (
                        <button
                          onClick={() => action(m, "approve")}
                          disabled={busyId === m.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                        >
                          <Check size={11} /> Approve
                        </button>
                      )}
                      {m.status === "pending" && (
                        <button
                          onClick={() => { setRejecting(m); setRejectReason(""); }}
                          disabled={busyId === m.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25 text-[11px] font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                        >
                          <X size={11} /> {t("common.action.reject")}
                        </button>
                      )}
                      {m.status === "unpublished" ? (
                        <button
                          onClick={() => action(m, "restore")}
                          disabled={busyId === m.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
                        >
                          <RotateCcw size={11} /> {t("admin.memorials.action.restore")}
                        </button>
                      ) : m.status === "published" ? (
                        <button
                          onClick={() => action(m, "unpublish")}
                          disabled={busyId === m.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
                        >
                          <EyeOff size={11} /> {t("admin.memorials.action.unpublish")}
                        </button>
                      ) : null}
                      <button
                        onClick={() => setReviewing(m)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-bold text-white hover:bg-white/10"
                      >
                        {t("admin.memorials.action.review")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 mb-5">
            <select
              value={videoStatus}
              onChange={(e) => setVideoStatus(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-[#13294A]"
            >
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </select>
            <p className="text-[11px] text-[#64748B]">Safe previews only — thumbnails never autoplay. Open on YouTube to review the full video.</p>
          </div>

          {videosLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-16">
              <Film size={26} className="mx-auto text-[#475569] mb-3" />
              <p className="text-sm text-[#94A3B8]">No videos in this queue.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {videos.map((v) => (
                <li key={v.id} className="rounded-2xl bg-[#0F2038]/60 border border-white/[0.05] px-4 py-3.5 flex items-start gap-3">
                  { }
                  <img src={v.thumbUrl} alt="" className="w-24 h-[54px] rounded-lg object-cover border border-white/10 shrink-0" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{v.title}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      On <b className="text-[#94A3B8]">{v.memorial.fullName}</b> · by {v.addedByName} · {v.status}
                    </p>
                    {v.description && <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-1">{v.description}</p>}
                    <a href={v.watchUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#93C5FD] hover:text-white inline-flex items-center gap-1 mt-1">
                      Open on YouTube <ExternalLink size={9} />
                    </a>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {v.status !== "approved" && (
                      <button
                        onClick={() => videoAction(v, "approve")}
                        disabled={busyId === v.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                      >
                        <Check size={11} /> Approve
                      </button>
                    )}
                    {v.status !== "rejected" && (
                      <button
                        onClick={() => { setVideoRejecting(v); setVideoRejectReason(""); }}
                        disabled={busyId === v.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25 text-[11px] font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                      >
                        <X size={11} /> Reject
                      </button>
                    )}
                    <button
                      onClick={() => videoRemove(v)}
                      disabled={busyId === v.id}
                      className="p-1.5 rounded-full text-[#64748B] hover:text-red-300 disabled:opacity-40"
                      aria-label={`Remove ${v.title}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ─── review modal ─── */}
      {reviewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setReviewing(null)}>
          <div className="bg-[#151022] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-black text-white">{reviewing.fullName}</h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {statusChip(reviewing.status)} · {reviewing.visibility} · submitted by {reviewing.creatorName} ({reviewing.creatorRelation})
                  {reviewing.creator?.username ? ` @${reviewing.creator.username}` : ""}
                </p>
              </div>
              <a
                href={`/memorials/${reviewing.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-[#93C5FD] hover:text-white inline-flex items-center gap-1 shrink-0"
              >
                Open page <ExternalLink size={10} />
              </a>
            </div>

            <div className="space-y-3 text-sm">
              {reviewing.tribute && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Short tribute</p>
                  <p className="text-[#CBD5E1] text-xs leading-relaxed">{reviewing.tribute}</p>
                </div>
              )}
              {reviewing.lifeStory && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Life story</p>
                  <p className="text-[#CBD5E1] text-xs leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{reviewing.lifeStory}</p>
                </div>
              )}
              {reviewing.qualities && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Memories & achievements</p>
                  <p className="text-[#CBD5E1] text-xs leading-relaxed whitespace-pre-wrap">{reviewing.qualities}</p>
                </div>
              )}
              {reviewing.milestones && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Family & milestones</p>
                  <p className="text-[#CBD5E1] text-xs leading-relaxed whitespace-pre-wrap">{reviewing.milestones}</p>
                </div>
              )}
              {(reviewing.verse || reviewing.testimony) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Verse & faith</p>
                  {reviewing.verse && <p className="text-[#93C5FD] text-xs italic">“{reviewing.verse}” {reviewing.verseRef && `— ${reviewing.verseRef}`}</p>}
                  {reviewing.testimony && <p className="text-[#CBD5E1] text-xs leading-relaxed whitespace-pre-wrap mt-1.5">{reviewing.testimony}</p>}
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  Photographs — {parseGallery(reviewing.gallery).length + (reviewing.photoUrl ? 1 : 0)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {reviewing.photoUrl && (
                     
                    <img src={reviewing.photoUrl} alt="Profile" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                  )}
                  {parseGallery(reviewing.gallery).map((g) => (
                     
                    <a key={g} href={g} target="_blank" rel="noreferrer">
                      <img src={g} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                    </a>
                  ))}
                  {!reviewing.photoUrl && parseGallery(reviewing.gallery).length === 0 && (
                    <p className="text-[11px] text-[#64748B]">No photographs uploaded.</p>
                  )}
                </div>
              </div>
            </div>

            {/* edit */}
            {editing ? (
              <div className="mt-4 space-y-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
                <p className="text-[11px] font-bold text-amber-300">Correcting content — recorded with a moderation timestamp</p>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Tribute</p>
                  <textarea value={editing.tribute} onChange={(e) => setEditing({ ...editing, tribute: e.target.value })} rows={2} maxLength={500} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#2563EB]/50" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Life story</p>
                  <textarea value={editing.lifeStory} onChange={(e) => setEditing({ ...editing, lifeStory: e.target.value })} rows={4} maxLength={20000} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#2563EB]/50" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={busyId === reviewing.id} className="px-3.5 py-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-bold disabled:opacity-40">{t("admin.memorials.saveCorrection")}</button>
                  <button onClick={() => setEditing(null)} className="px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-bold text-white">{t("common.cancel")}</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {reviewing.status === "pending" && (
                  <button onClick={() => action(reviewing, "approve")} disabled={busyId === reviewing.id} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40">
                    <Check size={12} /> Approve & publish
                  </button>
                )}
                {reviewing.status === "pending" && (
                  <button onClick={() => { setRejecting(reviewing); setRejectReason(""); }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/25 text-xs font-bold text-red-300 hover:bg-red-500/20">
                    <X size={12} /> Reject with reason
                  </button>
                )}
                <button onClick={() => setEditing({ tribute: reviewing.tribute || "", lifeStory: reviewing.lifeStory || "" })} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10">
                  <Pencil size={12} /> Correct content
                </button>
                {reviewing.status === "published" && (
                  <button onClick={() => action(reviewing, "unpublish")} disabled={busyId === reviewing.id} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40">
                    <EyeOff size={12} /> Unpublish
                  </button>
                )}
                {reviewing.status === "unpublished" && (
                  <button onClick={() => action(reviewing, "restore")} disabled={busyId === reviewing.id} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40">
                    <RotateCcw size={12} /> Restore
                  </button>
                )}
                <button onClick={() => removeMemorial(reviewing)} disabled={busyId === reviewing.id} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/25 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-40 ml-auto">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── reject reason modal ─── */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setRejecting(null)}>
          <div className="bg-[#151022] border border-white/10 rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white mb-1">Reject “{rejecting.fullName}”</h3>
            <p className="text-[11px] text-[#64748B] mb-3">
              The family will see this reason on their memorial and can fix the issues and resubmit.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Please add the family's permission note for the photographs before we can publish this."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50 resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={reject} disabled={busyId === rejecting.id} className="flex-1 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-40">
                Reject memorial
              </button>
              <button onClick={() => setRejecting(null)} className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── video reject reason modal ─── */}
      {videoRejecting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setVideoRejecting(null)}>
          <div className="bg-[#151022] border border-white/10 rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white mb-1">Reject video “{videoRejecting.title}”</h3>
            <p className="text-[11px] text-[#64748B] mb-3">
              The family will see this reason on the memorial page.
            </p>
            <textarea
              value={videoRejectReason}
              onChange={(e) => setVideoRejectReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. This video does not appear to relate to the person remembered here."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50 resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={videoReject} disabled={busyId === videoRejecting.id} className="flex-1 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-40">
                Reject video
              </button>
              <button onClick={() => setVideoRejecting(null)} className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
