"use client";

/**
 * Memorial create/edit form (Part 4 — In Loving Memory).
 * Used by /memorials/new (create) and /memorials/[id]/manage (edit tab).
 *
 * - Saves as DRAFT or PUBLISHES (explicit consent buttons).
 * - Photographs upload directly to Supabase Storage via the existing
 *   /api/social/upload-url signed-URL endpoint (same as the feed composer).
 * - Clear notice: the creator must have permission to share photos and
 *   personal information of the deceased.
 */

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flower2, ImagePlus, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { INDIAN_STATES, INDIAN_CITIES_BY_STATE } from "@/lib/crosscrafted-data";
import { useSupabaseUser } from "@/lib/supabase/use-user";

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
  creatorRelation: string;
  visibility: "public" | "unlisted" | "private";
};

export const EMPTY_MEMORIAL_FORM: MemorialFormData = {
  fullName: "", photoUrl: "", gallery: [], dob: "", dod: "",
  state: "", city: "", tribute: "", lifeStory: "", milestones: "",
  qualities: "", verse: "", verseRef: "", creatorRelation: "Family",
  visibility: "public",
};

async function uploadImage(file: File): Promise<string> {
  const urlRes = await fetch("/api/social/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size, kind: "image" }),
  });
  if (!urlRes.ok) {
    const data = await urlRes.json().catch(() => ({}));
    throw new Error(data.error || "Could not start the upload");
  }
  const { uploadUrl, publicUrl } = await urlRes.json();
  const put = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!put.ok) throw new Error("Upload failed — please try again");
  return publicUrl;
}

type Props = {
  mode: "create" | "edit";
  memorialId?: string; // edit mode
  initial?: MemorialFormData;
  onSaved?: (memorialId: string, status: string) => void;
};

export default function MemorialForm({ mode, memorialId, initial, onSaved }: Props) {
  const { user, username, displayName, loading: authLoading } = useSupabaseUser();
  const [form, setForm] = useState<MemorialFormData>(initial || EMPTY_MEMORIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "gallery" | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof MemorialFormData>(key: K, value: MemorialFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ─── auth gate ───
  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <Flower2 size={30} className="mx-auto text-[#C4B5FD] mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Sign in to create a memorial</h2>
        <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">
          Memorials are created by family members and friends. Please sign in with your
          Koino account so we can protect these pages from misuse.
        </p>
        <Link
          href="/auth/signin"
          className="inline-flex items-center px-6 py-3 rounded-full bg-[#7C3AED] text-white text-sm font-bold hover:bg-[#6D28D9]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setUploading("photo");
    try {
      set("photoUrl", await uploadImage(file));
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
        added.push(await uploadImage(f));
      }
      setForm((prev) => ({ ...prev, gallery: [...prev.gallery, ...added].slice(0, 12) }));
      toast.success(`${added.length} photo${added.length === 1 ? "" : "s"} added`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function save(status: "draft" | "published") {
    if (busy) return;
    if (form.fullName.trim().length < 2) return toast.error("Please enter the full name");
    if (!form.dod) return toast.error("Please enter the date of passing");
    if (form.dob && form.dod && form.dob > form.dod) {
      return toast.error("Date of birth cannot be after the date of passing");
    }
    setBusy(true);
    try {
      const payload = { ...form, status, creatorName: displayName || username || undefined };
      const res = await fetch(mode === "create" ? "/api/memorials" : `/api/memorials/${memorialId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the memorial");
      toast.success(status === "published" ? "Memorial published" : "Draft saved");
      const id = mode === "create" ? data.memorial.id : memorialId!;
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
    "w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50";
  const labelCls = "block text-xs font-bold text-[#94A3B8] mb-1.5";

  return (
    <div className="max-w-[680px] mx-auto px-4 pt-8 pb-24">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 mb-3">
          <Flower2 size={22} className="text-[#C4B5FD]" />
        </div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
          {mode === "create" ? "Create a memorial" : "Edit memorial"}
        </h1>
        <p className="text-sm text-[#94A3B8] mt-1.5">Honour the life of someone you loved.</p>
      </div>

      {/* consent notice */}
      <div className="rounded-xl bg-[#7C3AED]/[0.06] border border-[#7C3AED]/20 px-4 py-3 mb-6 flex gap-2.5">
        <ShieldCheck size={16} className="text-[#C4B5FD] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
          Please only share photographs and personal information that your family permits.
          Do not publish private addresses, phone numbers, or sensitive details. Memorials
          are reviewed when reported, and managers can moderate every message.
        </p>
      </div>

      <div className="space-y-5">
        {/* photograph */}
        <div>
          <span className={labelCls}>Photograph</span>
          <div className="flex items-center gap-4">
            {form.photoUrl ? (
              <div className="relative">
                <Image src={form.photoUrl} alt="" width={72} height={72} className="w-[72px] h-[72px] rounded-full object-cover border border-white/10" unoptimized />
                <button
                  onClick={() => set("photoUrl", "")}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1C1929] border border-white/10 flex items-center justify-center"
                  aria-label="Remove photo"
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
              {uploading === "photo" ? "Uploading…" : "Change photo"}
            </button>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => handlePhoto(e.target.files?.[0])} />
          </div>
        </div>

        {/* name + dates */}
        <div>
          <label className={labelCls}>Full name of your loved one *</label>
          <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={120} placeholder="e.g. George Mathew Varghese" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date of birth (if known)</label>
            <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date of passing *</label>
            <input type="date" value={form.dod} onChange={(e) => set("dod", e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>State (optional)</label>
            <select value={form.state} onChange={(e) => { set("state", e.target.value); set("city", ""); }} className={`${inputCls} [&>option]:bg-[#1C1929]`}>
              <option value="">—</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>City (optional)</label>
            <select value={form.city} onChange={(e) => set("city", e.target.value)} disabled={!form.state} className={`${inputCls} disabled:opacity-40 [&>option]:bg-[#1C1929]`}>
              <option value="">—</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* tribute */}
        <div>
          <label className={labelCls}>Short tribute (shown on memorial cards) </label>
          <textarea value={form.tribute} onChange={(e) => set("tribute", e.target.value)} rows={2} maxLength={500} placeholder="A sentence or two that captures their life." className={`${inputCls} resize-none`} />
        </div>

        {/* story sections */}
        <div>
          <label className={labelCls}>Life story / obituary</label>
          <textarea value={form.lifeStory} onChange={(e) => set("lifeStory", e.target.value)} rows={6} maxLength={20000} placeholder="Tell their story — where they were born, their family, their faith, the life they built." className={`${inputCls} resize-y`} />
        </div>
        <div>
          <label className={labelCls}>Family background & life milestones</label>
          <textarea value={form.milestones} onChange={(e) => set("milestones", e.target.value)} rows={4} maxLength={10000} placeholder="Marriage, children, career, ministry, service to the community…" className={`${inputCls} resize-y`} />
        </div>
        <div>
          <label className={labelCls}>Personal qualities, achievements & memories</label>
          <textarea value={form.qualities} onChange={(e) => set("qualities", e.target.value)} rows={4} maxLength={10000} placeholder="What they loved, how they cared for people, the things they were proud of." className={`${inputCls} resize-y`} />
        </div>

        {/* verse */}
        <div className="grid grid-cols-[1fr_180px] gap-3">
          <div>
            <label className={labelCls}>Bible verse or words of comfort (optional)</label>
            <textarea value={form.verse} onChange={(e) => set("verse", e.target.value)} rows={2} maxLength={500} placeholder="“I am the resurrection and the life…”" className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Reference</label>
            <input value={form.verseRef} onChange={(e) => set("verseRef", e.target.value)} maxLength={120} placeholder="John 11:25" className={inputCls} />
          </div>
        </div>

        {/* gallery */}
        <div>
          <span className={labelCls}>Additional photographs (up to 12)</span>
          <div className="flex flex-wrap gap-2.5">
            {form.gallery.map((g) => (
              <div key={g} className="relative">
                <Image src={g} alt="" width={64} height={64} className="w-16 h-16 rounded-xl object-cover border border-white/10" unoptimized />
                <button
                  onClick={() => set("gallery", form.gallery.filter((x) => x !== g))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1C1929] border border-white/10 flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {form.gallery.length < 12 && (
              <button
                onClick={() => galleryInput.current?.click()}
                disabled={uploading !== null}
                className="w-16 h-16 rounded-xl bg-white/[0.03] border border-dashed border-white/15 flex items-center justify-center hover:border-[#7C3AED]/40 disabled:opacity-40"
                aria-label="Add photos"
              >
                {uploading === "gallery" ? <Loader2 size={16} className="animate-spin text-[#94A3B8]" /> : <ImagePlus size={16} className="text-[#64748B]" />}
              </button>
            )}
          </div>
          <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => handleGallery(e.target.files)} />
        </div>

        {/* creator */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Your name (shown as creator)</label>
            <input value={displayName || username || ""} disabled className={`${inputCls} opacity-60`} />
          </div>
          <div>
            <label className={labelCls}>Your relationship</label>
            <input value={form.creatorRelation} onChange={(e) => set("creatorRelation", e.target.value)} maxLength={80} placeholder="e.g. Daughter, Church friend" className={inputCls} />
          </div>
        </div>

        {/* visibility */}
        <div>
          <span className={labelCls}>Who can visit this memorial?</span>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "public", label: "Public", desc: "Anyone — listed in the directory & search engines" },
              { id: "unlisted", label: "Unlisted", desc: "Anyone with the link — hidden from search" },
              { id: "private", label: "Private", desc: "Only managers and Koino admins" },
            ] as const).map((v) => (
              <button
                key={v.id}
                onClick={() => set("visibility", v.id)}
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  form.visibility === v.id
                    ? "bg-[#7C3AED]/15 border-[#7C3AED]/50"
                    : "bg-white/[0.03] border-white/[0.06] hover:border-white/15"
                }`}
              >
                <p className={`text-xs font-bold ${form.visibility === v.id ? "text-[#C4B5FD]" : "text-white"}`}>{v.label}</p>
                <p className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            onClick={() => save("published")}
            disabled={busy || form.fullName.trim().length < 2 || !form.dod}
            className="flex-1 px-5 py-3 rounded-full bg-[#7C3AED] text-white text-sm font-bold hover:bg-[#6D28D9] disabled:opacity-40"
          >
            {busy ? "Saving…" : mode === "create" ? "Publish memorial" : "Save & publish"}
          </button>
          <button
            onClick={() => save("draft")}
            disabled={busy || form.fullName.trim().length < 2 || !form.dod}
            className="flex-1 px-5 py-3 rounded-full bg-white/[0.05] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/10 disabled:opacity-40"
          >
            {busy ? "Saving…" : mode === "create" ? "Save as draft" : "Save as draft"}
          </button>
        </div>
        <p className="text-[11px] text-[#64748B] text-center">
          Drafts are private to the memorial managers until you publish.
        </p>
      </div>
    </div>
  );
}
