"use client";

/**
 * Memorial create/edit form — 4 steps (In Loving Memory).
 * Used by /memorials/new (create) and /memorials/[id]/manage (edit tab).
 *
 * Step 1 — Basic information (name, photo, dates, place, short tribute)
 * Step 2 — Life story (biography, memories, favourite verse, testimony)
 * Step 3 — Photos & videos (gallery upload + YouTube links)
 * Step 4 — Privacy & submission (visibility + authorization consent)
 *
 * - SAVE AS DRAFT any time (drafts stay private to the managers).
 * - SUBMIT FOR REVIEW requires the name, a short tribute, and the consent
 *   checkbox. A Koino admin reviews the memorial before it is published.
 * - Photographs upload directly to Supabase Storage via the existing
 *   /api/social/upload-url signed-URL endpoint (same as the feed composer).
 * - Entered data is never lost when moving between steps (single state object).
 * - YouTube links collected in step 3 are submitted right after the memorial
 *   exists — they stay pending until an admin approves them.
 */

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flower2, ImagePlus, Loader2, ShieldCheck, X, ArrowLeft, ArrowRight,
  Check, Film,
} from "lucide-react";
import { toast } from "sonner";
import { INDIAN_STATES, INDIAN_CITIES_BY_STATE } from "@/lib/crosscrafted-data";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { extractYouTubeId, MEMORIAL_VIDEO_CATEGORIES } from "@/lib/youtube";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export type MemorialVideoDraft = {
  url: string;
  title: string;
  description: string;
  category: string;
};

export type MemorialFormData = {
  fullName: string;
  photoUrl: string;
  gallery: string[];
  dob: string; // yyyy-mm-dd or ""
  dod: string;
  state: string;
  city: string;
  tribute: string;
  lifeStory: string;
  milestones: string;
  qualities: string;
  verse: string;
  verseRef: string;
  testimony: string;
  creatorRelation: string;
  visibility: "public" | "unlisted" | "private";
  videos: MemorialVideoDraft[];
};

export const EMPTY_MEMORIAL_FORM: MemorialFormData = {
  fullName: "", photoUrl: "", gallery: [], dob: "", dod: "",
  state: "", city: "", tribute: "", lifeStory: "", milestones: "",
  qualities: "", verse: "", verseRef: "", testimony: "",
  creatorRelation: "Family", visibility: "public", videos: [],
};

async function uploadImage(file: File, errStart: string, errPut: string): Promise<string> {
  const urlRes = await fetch("/api/social/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size, kind: "image" }),
  });
  if (!urlRes.ok) {
    const data = await urlRes.json().catch(() => ({}));
    throw new Error(data.error || errStart);
  }
  const { uploadUrl, publicUrl } = await urlRes.json();
  const put = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!put.ok) throw new Error(errPut);
  return publicUrl;
}

type Props = {
  mode: "create" | "edit";
  memorialId?: string; // edit mode
  initial?: MemorialFormData;
  onSaved?: (memorialId: string, status: string) => void;
};

const STEPS = ["memorials.form.step1", "memorials.form.step2", "memorials.form.step3", "memorials.form.step4"];

export default function MemorialForm({ mode, memorialId, initial, onSaved }: Props) {
  const t = useTranslation();
  const { user, username, displayName, loading: authLoading } = useSupabaseUser();
  const [form, setForm] = useState<MemorialFormData>(initial || EMPTY_MEMORIAL_FORM);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "gallery" | null>(null);
  const [consent, setConsent] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoCat, setVideoCat] = useState("life_story");
  const photoInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof MemorialFormData>(key: K, value: MemorialFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ─── auth gate ───
  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <Flower2 size={30} className="mx-auto text-[#93C5FD] mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">{t("memorials.form.signinTitle")}</h2>
        <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">
          {t("memorials.form.signinBody")}
        </p>
        <Link
          href="/auth/signin"
          className="inline-flex items-center px-6 py-3 rounded-full bg-[#2563EB] text-white text-sm font-bold hover:bg-[#1D4ED8]"
        >
          {t("memorials.form.signinCta")}
        </Link>
      </div>
    );
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setUploading("photo");
    try {
      set("photoUrl", await uploadImage(file, t("memorials.form.err.uploadStart"), t("memorials.form.err.uploadPut")));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function handleGallery(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading("gallery");
    try {
      const added: string[] = [];
      for (const f of Array.from(files).slice(0, 12)) {
        added.push(await uploadImage(f, t("memorials.form.err.uploadStart"), t("memorials.form.err.uploadPut")));
      }
      setForm((prev) => ({ ...prev, gallery: [...prev.gallery, ...added].slice(0, 12) }));
      toast.success(t("memorials.form.photosAdded", { n: added.length }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(null);
    }
  }

  function addVideo() {
    const url = videoUrl.trim();
    if (!url) return;
    if (!extractYouTubeId(url)) {
      toast.error(t("memorials.form.err.badYoutube"));
      return;
    }
    if (videoTitle.trim().length < 2) {
      toast.error(t("memorials.form.err.videoTitle"));
      return;
    }
    if (form.videos.length >= 30) {
      toast.error(t("memorials.form.err.videoMax"));
      return;
    }
    set("videos", [
      ...form.videos,
      { url, title: videoTitle.trim(), description: videoDesc.trim(), category: videoCat },
    ]);
    setVideoUrl("");
    setVideoTitle("");
    setVideoDesc("");
    setVideoCat("life_story");
    toast.success(t("memorials.form.videoAdded"));
  }

  /** Per-step validation before moving forward. */
  function next() {
    if (step === 0) {
      if (form.fullName.trim().length < 2) return toast.error(t("memorials.form.nameRequired"));
      if (form.dob && form.dod && form.dob > form.dod) {
        return toast.error(t("memorials.form.dobAfterDod"));
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitVideos(createdId: string) {
    for (const v of form.videos) {
      try {
        const res = await fetch(`/api/memorials/${createdId}/videos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(v),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          toast.error(t("memorials.form.err.videoAdd", { title: v.title, reason: b.error || t("memorials.form.err.unknown") }));
        }
      } catch {
        toast.error(t("memorials.form.err.videoAddGeneric", { title: v.title }));
      }
    }
  }

  async function save(status: "draft" | "pending") {
    if (busy) return;
    if (form.fullName.trim().length < 2) return toast.error(t("memorials.form.nameRequired"));
    if (form.dob && form.dod && form.dob > form.dod) {
      return toast.error(t("memorials.form.dobAfterDod"));
    }
    if (status === "pending") {
      if (form.tribute.trim().length < 2) {
        return toast.error(t("memorials.form.err.tributeRequired"));
      }
      if (!consent) {
        return toast.error(t("memorials.form.err.consentRequired"));
      }
    }
    setBusy(true);
    try {
      const payload = { ...form, videos: undefined, status, creatorName: displayName || username || undefined };
      const res = await fetch(mode === "create" ? "/api/memorials" : `/api/memorials/${memorialId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("memorials.form.saveFailed"));
      const id = mode === "create" ? data.memorial.id : memorialId!;
      if (form.videos.length > 0) await submitVideos(id);
      toast.success(
        status === "pending"
          ? t("memorials.form.submittedToast")
          : t("memorials.form.draftSavedToast"),
      );
      onSaved?.(id, status);
      if (!onSaved) window.location.href = `/memorials/${id}`;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cities = form.state ? INDIAN_CITIES_BY_STATE[form.state] || [] : [];
  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50";
  const labelCls = "block text-xs font-bold text-[#94A3B8] mb-1.5";
  const canSubmit = form.fullName.trim().length >= 2 && form.tribute.trim().length >= 2 && consent;

  return (
    <div className="max-w-[680px] mx-auto px-4 pt-8 pb-24">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#2563EB]/10 border border-[#2563EB]/20 mb-3">
          <Flower2 size={22} className="text-[#93C5FD]" />
        </div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
          {mode === "create" ? t("memorials.form.createTitle") : t("memorials.form.editTitle")}
        </h1>
        <p className="text-sm text-[#94A3B8] mt-1.5">{t("memorials.form.subtitle")}</p>
      </div>

      {/* step indicator */}
      <div className="flex items-center gap-1.5 mb-7" role="group" aria-label={t("memorials.form.progressAria")}>
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            disabled={i >= step}
            className={`flex-1 rounded-full h-1.5 transition-colors ${i <= step ? "bg-[#2563EB]" : "bg-white/[0.08]"} ${i < step ? "cursor-pointer" : ""}`}
            aria-label={`${t("memorials.form.stepOf", { n: i + 1, m: STEPS.length, label: t(label) })}${i < step ? " " + t("memorials.form.stepBackHint") : ""}`}
            title={t("memorials.form.stepOf", { n: i + 1, m: STEPS.length, label: t(label) })}
          />
        ))}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#93C5FD] mb-5">
        {t("memorials.form.stepOf", { n: step + 1, m: STEPS.length, label: t(STEPS[step]) })}
      </p>

      {/* consent notice */}
      <div className="rounded-xl bg-[#2563EB]/[0.06] border border-[#2563EB]/20 px-4 py-3 mb-6 flex gap-2.5">
        <ShieldCheck size={16} className="text-[#93C5FD] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          {t("memorials.form.consentNotice")}
        </p>
      </div>

      <div className="space-y-5">
        {/* ─── STEP 1: basic information ─── */}
        {step === 0 && (
          <>
            <div>
              <span className={labelCls}>{t("memorials.form.photoOptional")}</span>
              <div className="flex items-center gap-4">
                {form.photoUrl ? (
                  <div className="relative">
                    <Image src={form.photoUrl} alt="" width={72} height={72} className="w-[72px] h-[72px] rounded-full object-cover border border-white/10" unoptimized />
                    <button
                      onClick={() => set("photoUrl", "")}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#13294A] border border-white/10 flex items-center justify-center"
                      aria-label={t("memorials.form.removePhoto")}
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-[72px] h-[72px] rounded-full bg-white/[0.04] border border-dashed border-white/15 flex items-center justify-center">
                    <Flower2 size={24} className="text-[#475569]" />
                  </div>
                )}
                <button
                  onClick={() => photoInput.current?.click()}
                  disabled={uploading !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40"
                >
                  {uploading === "photo" ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  {uploading === "photo" ? t("memorials.form.uploading") : form.photoUrl ? t("memorials.form.changePhoto") : t("memorials.form.addPhoto")}
                </button>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => handlePhoto(e.target.files?.[0])} />
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("memorials.form.fullNameLabel")}</label>
              <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={120} placeholder={t("memorials.form.fullNamePh")} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("memorials.form.dobLabel")}</label>
                <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("memorials.form.dodLabel")}</label>
                <input type="date" value={form.dod} onChange={(e) => set("dod", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("memorials.form.stateLabel")}</label>
                <select value={form.state} onChange={(e) => { set("state", e.target.value); set("city", ""); }} className={`${inputCls} [&>option]:bg-[#13294A]`}>
                  <option value="">—</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t("memorials.form.cityLabel")}</label>
                <select value={form.city} onChange={(e) => set("city", e.target.value)} disabled={!form.state} className={`${inputCls} disabled:opacity-40 [&>option]:bg-[#13294A]`}>
                  <option value="">—</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("memorials.form.tributeLabel")}</label>
              <textarea value={form.tribute} onChange={(e) => set("tribute", e.target.value)} rows={2} maxLength={500} placeholder={t("memorials.form.tributePh")} className={`${inputCls} resize-none`} />
            </div>
          </>
        )}

        {/* ─── STEP 2: life story ─── */}
        {step === 1 && (
          <>
            <div>
              <label className={labelCls}>{t("memorials.form.bioLabel")}</label>
              <textarea value={form.lifeStory} onChange={(e) => set("lifeStory", e.target.value)} rows={6} maxLength={20000} placeholder={t("memorials.form.bioPh")} className={`${inputCls} resize-y`} />
            </div>
            <div>
              <label className={labelCls}>{t("memorials.form.qualitiesLabel")}</label>
              <textarea value={form.qualities} onChange={(e) => set("qualities", e.target.value)} rows={4} maxLength={10000} placeholder={t("memorials.form.qualitiesPh")} className={`${inputCls} resize-y`} />
            </div>
            <div>
              <label className={labelCls}>{t("memorials.form.milestonesLabel")}</label>
              <textarea value={form.milestones} onChange={(e) => set("milestones", e.target.value)} rows={4} maxLength={10000} placeholder={t("memorials.form.milestonesPh")} className={`${inputCls} resize-y`} />
            </div>
            <div className="grid grid-cols-[1fr_180px] gap-3">
              <div>
                <label className={labelCls}>{t("memorials.form.verseLabel")}</label>
                <textarea value={form.verse} onChange={(e) => set("verse", e.target.value)} rows={2} maxLength={500} placeholder={t("memorials.form.versePh")} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className={labelCls}>{t("memorials.form.verseRefLabel")}</label>
                <input value={form.verseRef} onChange={(e) => set("verseRef", e.target.value)} maxLength={120} placeholder={t("memorials.form.verseRefPh")} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("memorials.form.testimonyLabel")}</label>
              <textarea value={form.testimony} onChange={(e) => set("testimony", e.target.value)} rows={4} maxLength={10000} placeholder={t("memorials.form.testimonyPh")} className={`${inputCls} resize-y`} />
            </div>
          </>
        )}

        {/* ─── STEP 3: photos & videos ─── */}
        {step === 2 && (
          <>
            <div>
              <span className={labelCls}>{t("memorials.form.photosLabel")}</span>
              <div className="flex flex-wrap gap-2.5">
                {form.gallery.map((g) => (
                  <div key={g} className="relative">
                    <Image src={g} alt="" width={64} height={64} className="w-16 h-16 rounded-xl object-cover border border-white/10" unoptimized />
                    <button
                      onClick={() => set("gallery", form.gallery.filter((x) => x !== g))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#13294A] border border-white/10 flex items-center justify-center"
                      aria-label={t("memorials.form.removePhoto")}
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
                {form.gallery.length < 12 && (
                  <button
                    onClick={() => galleryInput.current?.click()}
                    disabled={uploading !== null}
                    className="w-16 h-16 rounded-xl bg-white/[0.03] border border-dashed border-white/15 flex items-center justify-center hover:border-[#2563EB]/40 disabled:opacity-40"
                    aria-label={t("memorials.form.addPhoto")}
                  >
                    {uploading === "gallery" ? <Loader2 size={16} className="animate-spin text-[#94A3B8]" /> : <ImagePlus size={16} className="text-[#64748B]" />}
                  </button>
                )}
              </div>
              <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => handleGallery(e.target.files)} />
            </div>

            <div className="rounded-2xl bg-[#0F2038]/60 border border-white/[0.05] p-4">
              <p className="text-xs font-bold text-white inline-flex items-center gap-1.5 mb-1">
                <Film size={13} className="text-[#93C5FD]" /> YouTube videos &amp; memories
              </p>
              <p className="text-[11px] text-[#64748B] mb-3 leading-relaxed">
                {t("memorials.form.videosNote")}
              </p>
              <div className="space-y-2.5">
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={t("memorials.form.videoUrlPh")}
                  className={inputCls}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVideo(); } }}
                />
                <div className="grid grid-cols-[1fr_150px] gap-2.5">
                  <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder={t("memorials.form.videoTitlePh")} maxLength={150} className={inputCls} />
                  <select value={videoCat} onChange={(e) => setVideoCat(e.target.value)} className={`${inputCls} [&>option]:bg-[#13294A]`} aria-label={t("memorials.form.videoCatAria")}>
                    {MEMORIAL_VIDEO_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(`memorials.videoCat.${c.id}`)}</option>)}
                  </select>
                </div>
                <input value={videoDesc} onChange={(e) => setVideoDesc(e.target.value)} placeholder={t("memorials.form.videoDescPh")} maxLength={1000} className={inputCls} />
                <button
                  onClick={addVideo}
                  disabled={!videoUrl.trim() || videoTitle.trim().length < 2}
                  className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40"
                >
                  {t("memorials.form.addVideoBtn")}
                </button>
              </div>
              {form.videos.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {form.videos.map((v, i) => (
                    <li key={`${v.url}-${i}`} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{v.title}</p>
                        <p className="text-[10px] text-[#64748B] truncate">{v.url}</p>
                      </div>
                      <button
                        onClick={() => set("videos", form.videos.filter((_, j) => j !== i))}
                        className="text-[10px] font-bold text-[#64748B] hover:text-red-300 shrink-0"
                        aria-label={t("memorials.form.removeVideoAria", { title: v.title })}
                      >
                        {t("common.remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* ─── STEP 4: privacy & submission ─── */}
        {step === 3 && (
          <>
            <div>
              <span className={labelCls}>{t("memorials.form.privacyTitle")}</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { id: "public", label: t("memorials.form.vis.public.label"), desc: t("memorials.form.vis.public.desc") },
                  { id: "unlisted", label: t("memorials.form.vis.unlisted.label"), desc: t("memorials.form.vis.unlisted.desc") },
                  { id: "private", label: t("memorials.form.vis.private.label"), desc: t("memorials.form.vis.private.desc") },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => set("visibility", v.id)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                      form.visibility === v.id
                        ? "bg-[#2563EB]/15 border-[#2563EB]/50"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/15"
                    }`}
                  >
                    <p className={`text-xs font-bold ${form.visibility === v.id ? "text-[#93C5FD]" : "text-white"}`}>{v.label}</p>
                    <p className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{v.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("memorials.form.creatorNameLabel")}</label>
                <input value={displayName || username || ""} disabled className={`${inputCls} opacity-60`} />
              </div>
              <div>
                <label className={labelCls}>{t("memorials.form.relationLabel")}</label>
                <input value={form.creatorRelation} onChange={(e) => set("creatorRelation", e.target.value)} maxLength={80} placeholder={t("memorials.form.relationPh")} className={inputCls} />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#2563EB] shrink-0"
              />
              <span className="text-[11px] text-[#94A3B8] leading-relaxed">
                {t("memorials.form.consentCheckbox")}
              </span>
            </label>

            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                <span className="font-bold text-white">{t("memorials.form.reviewInfoLabel")}</span>{" "}
                {t("memorials.form.reviewInfo")}
              </p>
            </div>
          </>
        )}

        {/* ─── navigation ─── */}
        <div className="flex items-center gap-2.5 pt-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
            >
              <ArrowLeft size={14} /> {t("common.back")}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-full bg-[#2563EB] text-white text-sm font-bold hover:bg-[#1D4ED8] disabled:opacity-40"
            >
              {t("memorials.form.continue")} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => save("pending")}
              disabled={busy || !canSubmit}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-full bg-[#2563EB] text-white text-sm font-bold hover:bg-[#1D4ED8] disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {busy ? t("common.submitting") : t("memorials.form.submitForReview")}
            </button>
          )}
          <button
            onClick={() => save("draft")}
            disabled={busy || form.fullName.trim().length < 2}
            className="inline-flex items-center px-4 py-3 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
            title={t("memorials.form.draftTitle")}
          >
            {busy ? t("memorials.form.saving") : t("memorials.form.saveDraft")}
          </button>
        </div>
        <p className="text-[11px] text-[#64748B] text-center">
          {t("memorials.form.draftNote")}
        </p>
      </div>
    </div>
  );
}
