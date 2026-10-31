"use client";

/**
 * Memorial manage panel (Part 4) — for the OWNER and invited MANAGERS.
 * Tabs: Edit details · Managers · Unpublish.
 * The API enforces every permission; this UI only mirrors what the server allows.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Flower2, Pencil, Users, EyeOff, Loader2, Plus, Trash2, Crown, ArrowLeft,
  Film, ExternalLink, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import MemorialForm, { EMPTY_MEMORIAL_FORM, type MemorialFormData } from "./MemorialForm";
import { timeAgo } from "@/lib/social/format";
import { extractYouTubeId, youtubeThumbUrl, youtubeWatchUrl, MEMORIAL_VIDEO_CATEGORIES } from "@/lib/youtube";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type MemorialVideoRow = {
  id: string;
  videoId: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  rejectionReason: string | null;
  addedByName: string;
  createdAt: string;
};

type Detail = {
  memorial: {
    id: string; fullName: string; status: string; visibility: string;
    photoUrl: string | null; dob: string | null; dod: string | null;
    city: string | null; state: string | null; tribute: string | null;
    lifeStory: string | null; milestones: string | null; qualities: string | null;
    verse: string | null; verseRef: string | null; testimony: string | null;
    display: { photos: boolean; videos: boolean; tributes: boolean; verse: boolean; family: boolean; candles: boolean };
    rejectionReason: string | null;
    gallery: string[];
  };
  viewer: { role: "owner" | "manager" | null; isAdmin: boolean };
};

type Manager = { userId: string; name: string; username: string | null; role: string; since: string };

type Props = { memorialId: string };

export default function MemorialManage({ memorialId }: Props) {
  const t = useTranslation();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "videos" | "settings" | "managers">("edit");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [invite, setInvite] = useState("");
  const [inviting, setInviting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [videos, setVideos] = useState<MemorialVideoRow[]>([]);
  const [vUrl, setVUrl] = useState("");
  const [vTitle, setVTitle] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vCat, setVCat] = useState("life_story");
  const [addingVideo, setAddingVideo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setDenied(body.error || t("memorials.manage.unavailable"));
        setDetail(null);
      } else {
        setDetail(body);
        if (!body.viewer.role) {
          setDenied(t("memorials.manage.denied"));
          setDetail(null);
        }
      }
    } catch {
      setDenied(t("memorials.manage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [memorialId, t]);

  useEffect(() => { load(); }, [load]);

  const loadManagers = useCallback(async () => {
    try {
      const res = await fetch(`/api/memorials/${memorialId}/managers`, { cache: "no-store" });
      if (res.ok) setManagers((await res.json()).managers || []);
    } catch { /* best-effort */ }
  }, [memorialId]);

  useEffect(() => {
    if (tab === "managers") loadManagers();
    if (tab === "videos" && detail) {
      fetch(`/api/memorials/${memorialId}/videos`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { videos: [] }))
        .then((b) => setVideos(b.videos || []))
        .catch(() => {});
    }
  }, [tab, loadManagers, detail, memorialId]);

  async function inviteManager() {
    const username = invite.trim().replace(/^@/, "");
    if (!username || inviting) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("memorials.manage.err.invite"));
      toast.success(t("memorials.manage.invited", { username }));
      setInvite("");
      await loadManagers();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function removeManager(userId: string, name: string) {
    if (!confirm(t("memorials.manage.confirmRemoveManager", { name }))) return;
    try {
      const res = await fetch(`/api/memorials/${memorialId}/managers?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("memorials.manage.err.removeManager"));
      toast.success(t("memorials.manage.managerRemoved"));
      await loadManagers();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function unpublish() {
    if (!confirm(t("memorials.manage.confirmUnpublish"))) return;
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "unpublished" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("memorials.manage.err.unpublish"));
      toast.success(t("memorials.manage.unpublished"));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUnpublishing(false);
    }
  }

  async function requestDeletion() {
    if (!confirm(t("memorials.manage.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("memorials.manage.err.delete"));
      toast.success(t("memorials.manage.deleted"));
      window.location.href = "/memorials";
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function addVideo() {
    if (addingVideo) return;
    const videoId = extractYouTubeId(vUrl.trim());
    if (!videoId) {
      toast.error(t("memorials.form.err.badYoutube"));
      return;
    }
    if (vTitle.trim().length < 2) {
      toast.error(t("memorials.form.err.videoTitle"));
      return;
    }
    setAddingVideo(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: vUrl.trim(), title: vTitle.trim(), description: vDesc.trim(), category: vCat }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("memorials.manage.err.addVideo"));
      toast.success(t("memorials.manage.videoAddedAdmin"));
      setVUrl(""); setVTitle(""); setVDesc(""); setVCat("life_story");
      const fresh = await fetch(`/api/memorials/${memorialId}/videos`, { cache: "no-store" });
      if (fresh.ok) setVideos((await fresh.json()).videos || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAddingVideo(false);
    }
  }

  async function removeVideo(vid: string) {
    if (!confirm(t("memorials.manage.confirmRemoveVideo"))) return;
    try {
      const res = await fetch(`/api/memorials/${memorialId}/videos/${vid}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("memorials.manage.err.removeVideo"));
      toast.success(t("memorials.manage.videoRemoved"));
      setVideos((prev) => prev.filter((v) => v.id !== vid));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function setDisplay(key: string, value: boolean) {
    if (!detail) return;
    const next = { ...detail.memorial.display, [key]: value };
    setDetail({ ...detail, memorial: { ...detail.memorial, display: next } });
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display: next }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || t("memorials.manage.err.save"));
      }
      toast.success(t("memorials.manage.displaySaved"));
    } catch (err) {
      toast.error((err as Error).message);
      setDetail(detail); // revert
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
      </div>
    );
  }

  if (denied || !detail) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <Flower2 size={30} className="mx-auto text-[#475569] mb-4" />
        <h1 className="text-lg font-bold text-white mb-2">{t("memorials.manage.openFailed")}</h1>
        <p className="text-sm text-[#94A3B8] mb-6">{denied}</p>
        <Link href={`/memorials/${memorialId}`} className="text-xs font-bold text-[#C4B5FD] hover:text-white">
          {t("memorials.manage.backToMemorial")}
        </Link>
      </div>
    );
  }

  const m = detail.memorial;
  const isOwner = detail.viewer.role === "owner" || detail.viewer.isAdmin;

  // Map API detail → form initial values (dates as yyyy-mm-dd for <input type=date>).
  const d = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const initial: MemorialFormData = {
    ...EMPTY_MEMORIAL_FORM,
    fullName: m.fullName,
    photoUrl: m.photoUrl || "",
    gallery: m.gallery || [],
    dob: d(m.dob),
    dod: d(m.dod),
    state: m.state || "",
    city: m.city || "",
    tribute: m.tribute || "",
    lifeStory: m.lifeStory || "",
    milestones: m.milestones || "",
    qualities: m.qualities || "",
    verse: m.verse || "",
    verseRef: m.verseRef || "",
    testimony: m.testimony || "",
    visibility: (m.visibility as MemorialFormData["visibility"]) || "public",
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 pt-8 pb-24">
      <Link href={`/memorials/${memorialId}`} className="text-[11px] text-[#64748B] hover:text-white inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={11} /> {t("memorials.manage.backTo", { name: m.fullName })}
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center">
          <Flower2 size={18} className="text-[#C4B5FD]" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white">{t("memorials.manage.title")}</h1>
          <p className="text-[11px] text-[#64748B]">{m.fullName} · {m.status}</p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-6 flex-wrap">
        <button
          onClick={() => setTab("edit")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${tab === "edit" ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"}`}
        >
          <Pencil size={12} /> {t("memorials.manage.tab.details")}
        </button>
        <button
          onClick={() => setTab("videos")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${tab === "videos" ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"}`}
        >
          <Film size={12} /> {t("memorials.manage.tab.videos")}
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${tab === "settings" ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"}`}
        >
          <Settings2 size={12} /> {t("memorials.manage.tab.display")}
        </button>
        <button
          onClick={() => setTab("managers")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${tab === "managers" ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"}`}
        >
          <Users size={12} /> {t("memorials.manage.tab.managers")}
        </button>
      </div>

      {tab === "edit" && (
        <>
          <MemorialForm
            mode="edit"
            memorialId={memorialId}
            initial={initial}
            onSaved={(id) => { window.location.href = `/memorials/${id}`; }}
          />
          {/* lifecycle actions below the form */}
          <div className="max-w-[680px] mx-auto px-4 pb-24 -mt-16">
            <div className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] p-4 space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B]">{t("memorials.manage.statusTitle")}</h2>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                {t("memorials.manage.statusCurrently")} <b className="text-white">{m.status}</b> ({m.visibility}).
                {m.status === "draft" && t("memorials.manage.statusDraftHint")}
                {m.status === "pending" && t("memorials.manage.statusPendingHint")}
                {m.status === "rejected" && (m.rejectionReason ? t("memorials.manage.statusRejectedReason", { reason: m.rejectionReason }) : t("memorials.manage.statusRejectedHint"))}
                {m.status === "unpublished" && t("memorials.manage.statusUnpublishedHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {m.status === "published" && (
                  <button onClick={unpublish} disabled={unpublishing} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40">
                    {unpublishing ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />} {t("memorials.manage.unpublish")}
                  </button>
                )}
                {isOwner && (
                  <button onClick={requestDeletion} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-300 hover:bg-red-500/15">
                    <Trash2 size={12} /> {t("memorials.manage.delete")}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#475569]">
                {t("memorials.manage.reviewNote")}
              </p>
            </div>
          </div>
        </>
      )}

      {tab === "videos" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] p-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-1.5">{t("memorials.manage.addVideoTitle")}</h2>
            <p className="text-[11px] text-[#94A3B8] mb-3 leading-relaxed">
              {t("memorials.manage.addVideoNote")}
            </p>
            <div className="space-y-2.5">
              <input value={vUrl} onChange={(e) => setVUrl(e.target.value)} placeholder={t("memorials.form.videoUrlPh")} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50" />
              <div className="grid grid-cols-[1fr_150px] gap-2.5">
                <input value={vTitle} onChange={(e) => setVTitle(e.target.value)} placeholder={t("memorials.form.videoTitlePh")} maxLength={150} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50" />
                <select value={vCat} onChange={(e) => setVCat(e.target.value)} aria-label={t("memorials.form.videoCatAria")} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#7C3AED]/50 [&>option]:bg-[#1C1929]">
                  {MEMORIAL_VIDEO_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(`memorials.videoCat.${c.id}`)}</option>)}
                </select>
              </div>
              <input value={vDesc} onChange={(e) => setVDesc(e.target.value)} placeholder={t("memorials.form.videoDescPh")} maxLength={1000} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50" />
              <button onClick={addVideo} disabled={addingVideo || !vUrl.trim() || vTitle.trim().length < 2} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40">
                {addingVideo ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {t("memorials.manage.addVideoBtn")}
              </button>
            </div>
          </div>

          {videos.length === 0 ? (
            <p className="text-sm text-[#64748B] italic text-center py-8">{t("memorials.manage.noVideos")}</p>
          ) : (
            <ul className="space-y-2.5">
              {videos.map((v) => (
                <li key={v.id} className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] px-3.5 py-3 flex items-center gap-3">
                  { }
                  <img src={youtubeThumbUrl(v.videoId)} alt="" className="w-20 h-[45px] rounded-lg object-cover border border-white/10 shrink-0" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{v.title}</p>
                    <p className="text-[10px] text-[#64748B] truncate">
                      {v.category && MEMORIAL_VIDEO_CATEGORIES.some((c) => c.id === v.category) ? t(`memorials.videoCat.${v.category}`) : t("memorials.videoCat.other")} · {t("memorials.manage.by", { name: v.addedByName })}
                    </p>
                    {v.status !== "approved" && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-block mt-1 ${v.status === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>
                        {v.status}{v.status === "rejected" && v.rejectionReason ? ` — ${v.rejectionReason}` : ""}
                      </span>
                    )}
                  </div>
                  <a href={youtubeWatchUrl(v.videoId)} target="_blank" rel="noreferrer" className="p-1.5 text-[#64748B] hover:text-white shrink-0" aria-label={t("memorials.manage.openOnYouTubeAria", { title: v.title })}>
                    <ExternalLink size={13} />
                  </a>
                  <button onClick={() => removeVideo(v.id)} className="p-1.5 rounded-full text-[#64748B] hover:text-red-300 shrink-0" aria-label={t("memorials.manage.removeAria", { title: v.title })}>
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] p-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-1.5">{t("memorials.manage.sectionOnPage")}</h2>
          <p className="text-[11px] text-[#94A3B8] mb-4 leading-relaxed">
            {t("memorials.manage.settingsNote")}
          </p>
          <ul className="space-y-2">
            {([
              { key: "photos", label: t("memorials.manage.row.photos.label"), desc: t("memorials.manage.row.photos.desc") },
              { key: "videos", label: t("memorials.manage.row.videos.label"), desc: t("memorials.manage.row.videos.desc") },
              { key: "tributes", label: t("memorials.manage.row.tributes.label"), desc: t("memorials.manage.row.tributes.desc") },
              { key: "verse", label: t("memorials.manage.row.verse.label"), desc: t("memorials.manage.row.verse.desc") },
              { key: "family", label: t("memorials.manage.row.family.label"), desc: t("memorials.manage.row.family.desc") },
              { key: "candles", label: t("memorials.manage.row.candles.label"), desc: t("memorials.manage.row.candles.desc") },
            ] as const).map((row) => (
              <li key={row.key} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white">{row.label}</p>
                  <p className="text-[10px] text-[#64748B]">{row.desc}</p>
                </div>
                <button
                  onClick={() => setDisplay(row.key, !m.display[row.key as keyof typeof m.display])}
                  role="switch"
                  aria-checked={m.display[row.key as keyof typeof m.display]}
                  aria-label={m.display[row.key as keyof typeof m.display] ? t("memorials.manage.switchHideAria", { label: row.label }) : t("memorials.manage.switchShowAria", { label: row.label })}
                  className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${m.display[row.key as keyof typeof m.display] ? "bg-[#7C3AED]" : "bg-white/[0.08]"}`}
                  style={{ height: 22 }}
                >
                  <span
                    className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all"
                    style={{ height: 18, width: 18, left: m.display[row.key as keyof typeof m.display] ? 20 : 2 }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "managers" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] p-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-1.5">{t("memorials.manage.inviteTitle")}</h2>
            <p className="text-[11px] text-[#94A3B8] mb-3 leading-relaxed">
              {t("memorials.manage.inviteNote")}
            </p>
            <div className="flex gap-2">
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder={t("memorials.manage.usernamePh")}
                className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
              />
              <button
                onClick={inviteManager}
                disabled={inviting || !invite.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
              >
                {inviting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {t("memorials.manage.add")}
              </button>
            </div>
          </div>

          <ul className="space-y-2.5">
            {managers.map((mm) => (
              <li key={mm.userId} className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED]/40 to-[#1C1929] flex items-center justify-center shrink-0">
                  {mm.role === "owner" ? <Crown size={14} className="text-amber-300" /> : <Users size={13} className="text-[#C4B5FD]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
                    {mm.name} {mm.username && <span className="text-[#64748B] font-normal">@{mm.username}</span>}
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {mm.role === "owner" ? t("memorials.manage.owner") : t("memorials.manage.manager")} · {t("memorials.manage.since", { when: timeAgo(mm.since) })}
                  </p>
                </div>
                {isOwner && mm.role !== "owner" && (
                  <button onClick={() => removeManager(mm.userId, mm.name)} className="p-1.5 rounded-full text-[#64748B] hover:text-red-300" aria-label={t("memorials.manage.removeAria", { title: mm.name })}>
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
