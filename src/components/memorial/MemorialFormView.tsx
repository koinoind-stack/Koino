"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Flower2, Upload, X } from "lucide-react";
import { MONTH_NAMES, MEMORIAL_LIMITS } from "@/lib/memorial/shared";
import type { MemorialDetail, MemorialInputPayload } from "./types";

/**
 * Part 4 — create/edit memorial form.
 * Partial dates: every component (day/month/year) has an "—" unknown option;
 * the API enforces the rules (death year required, day needs month, etc.).
 * Photo upload uses the same signed-URL flow as the social composer.
 */
const emptyForm: MemorialInputPayload = {
  fullName: "",
  birthYear: "", birthMonth: "", birthDay: "",
  deathYear: "", deathMonth: "", deathDay: "",
  epitaph: "", biography: "", serviceInfo: "",
  photoUrl: "",
  visibility: "public",
  condolencePolicy: "approved",
};

function fromDetail(m: MemorialDetail): MemorialInputPayload {
  return {
    fullName: m.fullName,
    birthYear: m.birthYear?.toString() ?? "",
    birthMonth: m.birthMonth?.toString() ?? "",
    birthDay: m.birthDay?.toString() ?? "",
    deathYear: m.deathYear?.toString() ?? "",
    deathMonth: m.deathMonth?.toString() ?? "",
    deathDay: m.deathDay?.toString() ?? "",
    epitaph: m.epitaph ?? "",
    biography: m.biography ?? "",
    serviceInfo: m.serviceInfo ?? "",
    photoUrl: m.photoUrl ?? "",
    visibility: m.visibility,
    condolencePolicy: m.condolencePolicy,
  };
}

export default function MemorialFormView({
  editing,
  onDone,
  onCancel,
}: {
  editing: MemorialDetail | null;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MemorialInputPayload>(editing ? fromDetail(editing) : emptyForm);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof MemorialInputPayload>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const years = Array.from({ length: 202 }, (_, i) => 3000 - i); // 3000 → 1799

  const pickPhoto = async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("Photos must be smaller than 10 MB");
      return;
    }
    setUploading(true);
    try {
      const urlRes = await fetch("/api/memorials/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      if (!urlRes.ok) {
        const data = await urlRes.json().catch(() => ({}));
        throw new Error(data.error || "Could not start the upload");
      }
      const { uploadUrl, publicUrl } = (await urlRes.json()) as { uploadUrl: string; publicUrl: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      set("photoUrl", publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!form.fullName.trim()) {
      setError("Please enter your loved one's name");
      return;
    }
    if (!form.deathYear) {
      setError("A memorial needs at least the year of death (choose — if unknown)");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        fullName: form.fullName,
        birthYear: form.birthYear || null,
        birthMonth: form.birthMonth || null,
        birthDay: form.birthDay || null,
        deathYear: form.deathYear || null,
        deathMonth: form.deathMonth || null,
        deathDay: form.deathDay || null,
        epitaph: form.epitaph,
        biography: form.biography,
        serviceInfo: form.serviceInfo,
        photoUrl: form.photoUrl,
        visibility: form.visibility,
        condolencePolicy: form.condolencePolicy,
      };
      const res = await fetch(editing ? `/api/memorials/${editing.id}` : "/api/memorials", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the memorial");
      onDone(editing ? editing.id : data.memorial.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the memorial");
    } finally {
      setBusy(false);
    }
  };

  const dateRow = (
    prefix: "birth" | "death",
    label: string,
    required: boolean,
  ) => (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
        {label} {required ? "" : "(all parts optional)"}
      </label>
      <div className="grid grid-cols-3 gap-2">
        <select
          value={form[`${prefix}Day` as keyof MemorialInputPayload]}
          onChange={(e) => set(`${prefix}Day` as keyof MemorialInputPayload, e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-2.5 text-[13px] text-white outline-none focus:border-[#7C3AED]/50"
          aria-label={`${label} day`}
        >
          <option value="">Day —</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={form[`${prefix}Month` as keyof MemorialInputPayload]}
          onChange={(e) => set(`${prefix}Month` as keyof MemorialInputPayload, e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-2.5 text-[13px] text-white outline-none focus:border-[#7C3AED]/50"
          aria-label={`${label} month`}
        >
          <option value="">Month —</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={form[`${prefix}Year` as keyof MemorialInputPayload]}
          onChange={(e) => set(`${prefix}Year` as keyof MemorialInputPayload, e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-2.5 text-[13px] text-white outline-none focus:border-[#7C3AED]/50"
          aria-label={`${label} year`}
        >
          <option value="">{required ? "Year *" : "Year —"}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-[#64748B] mt-1">
        Leave unknown parts as “—”. Only {label.toLowerCase()} year is required.
      </p>
    </div>
  );

  return (
    <div className="max-w-[680px] mx-auto px-4 py-6">
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-[13px] text-[#94A3B8] hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 mb-1">
        <Flower2 size={20} className="text-[#A78BFA]" />
        {editing ? "Edit memorial" : "Create a memorial"}
      </h1>
      <p className="text-[13px] text-[#94A3B8] mb-6">
        This page will honor your loved one with their story, dates, and condolences from the community.
      </p>

      {/* Photo */}
      <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-4 mb-4">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
          Portrait (optional)
        </label>
        <div className="flex items-center gap-3">
          {form.photoUrl ? (
            <div className="relative">
              <Image src={form.photoUrl} alt="" width={64} height={64} className="w-16 h-16 rounded-xl object-cover border border-white/[0.08]" unoptimized />
              <button
                onClick={() => set("photoUrl", "")}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center"
                aria-label="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-16 h-16 rounded-xl border border-dashed border-white/[0.15] flex flex-col items-center justify-center text-[#64748B] hover:text-[#A78BFA] hover:border-[#7C3AED]/40 transition-colors"
            >
              <Upload size={18} />
              <span className="text-[9px] mt-0.5">{uploading ? "…" : "Add"}</span>
            </button>
          )}
          <p className="text-[12px] text-[#64748B]">JPG, PNG or WEBP · up to 10 MB</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickPhoto(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Name + epitaph */}
      <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-4 mb-4 space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Full name *
          </label>
          <input
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            maxLength={MEMORIAL_LIMITS.fullName}
            placeholder="e.g. Mary Thomas"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-3 text-[14px] text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Epitaph (short line under the name)
          </label>
          <input
            value={form.epitaph}
            onChange={(e) => set("epitaph", e.target.value)}
            maxLength={MEMORIAL_LIMITS.epitaph}
            placeholder="e.g. Faithful servant of Christ, beloved mother of three"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-3 text-[14px] text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-4 mb-4 space-y-4">
        {dateRow("birth", "Born", false)}
        {dateRow("death", "Died", true)}
      </div>

      {/* Biography + service */}
      <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-4 mb-4 space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Life story
          </label>
          <textarea
            value={form.biography}
            onChange={(e) => set("biography", e.target.value)}
            maxLength={MEMORIAL_LIMITS.biography}
            rows={6}
            placeholder="Their journey, family, faith, and what they meant to everyone around them…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-3 text-[14px] text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50 resize-y"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Funeral / memorial service details
          </label>
          <textarea
            value={form.serviceInfo}
            onChange={(e) => set("serviceInfo", e.target.value)}
            maxLength={MEMORIAL_LIMITS.serviceInfo}
            rows={3}
            placeholder="Date, time, venue, and any viewing details…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-3 text-[14px] text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50 resize-y"
          />
        </div>
      </div>

      {/* Privacy + condolences policy */}
      <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-4 mb-4 space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Who can see this memorial
          </label>
          <select
            value={form.visibility}
            onChange={(e) => set("visibility", e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white outline-none focus:border-[#7C3AED]/50"
          >
            <option value="public">Public — anyone with the link</option>
            <option value="members">Members — signed-in Koino members</option>
            <option value="managers">Managers only — private while preparing</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Condolences
          </label>
          <select
            value={form.condolencePolicy}
            onChange={(e) => set("condolencePolicy", e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white outline-none focus:border-[#7C3AED]/50"
          >
            <option value="approved">Managers approve each condolence first (recommended)</option>
            <option value="open">Open — condolences appear immediately</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-[#F87171] bg-[#EF4444]/10 border border-[#EF4444]/25 rounded-xl px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <div className="flex gap-3 pb-4">
        <button
          onClick={submit}
          disabled={busy || uploading}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white text-[14px] font-extrabold shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? "Saving…" : editing ? "Save changes" : "Create memorial"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[#94A3B8] text-[14px] font-bold hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
