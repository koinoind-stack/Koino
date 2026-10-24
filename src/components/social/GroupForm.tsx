"use client";

/**
 * GroupForm — shared form for creating and editing a group.
 *
 * Covers every community field: name, description (+ emoji picker), category,
 * cover image, logo, city/state/preferred language, visibility (public or
 * private), join mode (open vs owner approval — public groups only; private
 * groups always require approval), group rules, and the optional church
 * affiliation (searched from the live Churches directory; display-only —
 * linking never grants anyone permissions).
 *
 * Cover/logo upload through the standard signed-URL pipeline
 * (/api/social/upload-url → direct PUT to Storage), validated again
 * server-side on save.
 */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, MapPin, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "./types";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";

export type GroupFormValue = {
  name: string;
  description: string;
  category: string;
  visibility: "public" | "private" | string;
  joinMode: "open" | "approval" | string;
  coverImage: string;
  logoUrl: string;
  city: string;
  state: string;
  language: string;
  rules: string;
  churchId: string;
  churchName: string;
};

export const EMPTY_GROUP_FORM: GroupFormValue = {
  name: "",
  description: "",
  category: "fellowship",
  visibility: "public",
  joinMode: "open",
  coverImage: "",
  logoUrl: "",
  city: "",
  state: "",
  language: "",
  rules: "",
  churchId: "",
  churchName: "",
};

const CATEGORIES = [
  { id: "fellowship", label: "Fellowship" },
  { id: "youth", label: "Youth" },
  { id: "bible-study", label: "Bible Study" },
  { id: "prayer", label: "Prayer" },
  { id: "worship", label: "Worship" },
  { id: "entrepreneurs", label: "Christian Business" },
  { id: "church", label: "Church" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const LANGUAGES = [
  "English", "Hindi", "Malayalam", "Tamil", "Telugu", "Kannada", "Marathi",
  "Bengali", "Gujarati", "Punjabi", "Odia", "Assamese", "Urdu",
];

type ChurchHit = { id: string; name: string; city: string | null; state: string | null };

type Props = {
  mode: "create" | "edit";
  initial?: Partial<GroupFormValue>;
  submitting: boolean;
  onSubmit: (value: GroupFormValue) => void;
  onCancel: () => void;
};

const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50";
const labelCls = "text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-1.5 block";

export default function GroupForm({ mode, initial, submitting, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<GroupFormValue>({ ...EMPTY_GROUP_FORM, ...initial });
  const [coverBusy, setCoverBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [churchQuery, setChurchQuery] = useState("");
  const [churchHits, setChurchHits] = useState<ChurchHit[]>([]);
  const [churchSearching, setChurchSearching] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<GroupFormValue>) => setForm((f) => ({ ...f, ...patch }));

  // ─── Church search (debounced, live Churches directory) ──────────────────
  useEffect(() => {
    const q = churchQuery.trim();
    if (q.length < 2) {
      setChurchHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setChurchSearching(true);
      try {
        const d = await api<{ churches: ChurchHit[] }>(`/api/churches?q=${encodeURIComponent(q)}`);
        setChurchHits((d.churches || []).slice(0, 6));
      } catch {
        setChurchHits([]);
      } finally {
        setChurchSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [churchQuery]);

  /** Signed-URL direct PUT — the same pipeline posts use. */
  async function uploadImage(file: File, kind: "cover" | "logo") {
    const busy = kind === "cover" ? setCoverBusy : setLogoBusy;
    busy(true);
    try {
      const res = await api<{ uploadUrl: string; publicUrl: string }>("/api/social/upload-url", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type, size: file.size, kind: "image" }),
      });
      const put = await fetch(res.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      set(kind === "cover" ? { coverImage: res.publicUrl } : { logoUrl: res.publicUrl });
      toast.success(kind === "cover" ? "Cover image ready" : "Group picture ready");
    } catch (err) {
      toast.error((err as Error).message || "Upload failed — try a JPG, PNG or WEBP under 10 MB");
    } finally {
      busy(false);
    }
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>, kind: "cover" | "logo") {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Use a JPG, PNG or WEBP image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    uploadImage(file, kind);
  }

  const valid = form.name.trim().length >= 3;

  return (
    <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-white">
          {mode === "create" ? "Create a group" : "Edit group"}
        </h3>
        <button onClick={onCancel} className="p-1.5 rounded-lg bg-white/[0.04] text-[#94A3B8] hover:text-white" aria-label="Close form">
          <X size={15} />
        </button>
      </div>

      {/* name + description */}
      <div>
        <label className={labelCls}>Group name</label>
        <input
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={60}
          placeholder="e.g. Youth Fellowship Bengaluru"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          ref={descRef}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          maxLength={500}
          rows={2}
          placeholder="What is this community about?"
          className={`${inputCls} resize-none`}
        />
        <div className="mt-1.5">
          <EmojiPickerButton
            align="left"
            onPick={(e) => insertAtCursor(descRef.current, e, (v) => set({ description: v }), 500)}
          />
        </div>
      </div>

      {/* cover + logo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Cover image</label>
          {form.coverImage ? (
            <div className="relative h-20 rounded-xl overflow-hidden border border-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.coverImage} alt="Group cover" className="w-full h-full object-cover" />
              <button
                onClick={() => set({ coverImage: "" })}
                className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white"
                aria-label="Remove cover"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={coverBusy}
              className="w-full h-20 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] text-[#64748B] hover:text-white hover:border-[#7C3AED]/40 flex flex-col items-center justify-center gap-1 text-[11px] font-bold"
            >
              {coverBusy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
              {coverBusy ? "Uploading…" : "Upload cover"}
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickImage(e, "cover")} />
        </div>
        <div>
          <label className={labelCls}>Group picture</label>
          {form.logoUrl ? (
            <div className="relative h-20 rounded-xl overflow-hidden border border-white/[0.06] flex items-center justify-center bg-white/[0.02]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logoUrl} alt="Group picture" className="w-14 h-14 rounded-full object-cover" />
              <button
                onClick={() => set({ logoUrl: "" })}
                className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white"
                aria-label="Remove picture"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoBusy}
              className="w-full h-20 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] text-[#64748B] hover:text-white hover:border-[#7C3AED]/40 flex flex-col items-center justify-center gap-1 text-[11px] font-bold"
            >
              {logoBusy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
              {logoBusy ? "Uploading…" : "Upload picture"}
            </button>
          )}
          <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickImage(e, "logo")} />
        </div>
      </div>

      {/* category */}
      <div>
        <label className={labelCls}>Category</label>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => set({ category: c.id })}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                form.category === c.id
                  ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]"
                  : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* location + language */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>City</label>
          <input value={form.city} onChange={(e) => set({ city: e.target.value })} maxLength={80} placeholder="Bengaluru" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>State</label>
          <select value={form.state} onChange={(e) => set({ state: e.target.value })} className={`${inputCls} appearance-none`}>
            <option value="" className="bg-[#111827]">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s} className="bg-[#111827]">{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Preferred language</label>
        <select value={form.language} onChange={(e) => set({ language: e.target.value })} className={`${inputCls} appearance-none`}>
          <option value="" className="bg-[#111827]">Any language</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l} className="bg-[#111827]">{l}</option>
          ))}
        </select>
      </div>

      {/* privacy + join mode */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Who can see this group?</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => set({ visibility: "public" })}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border ${
                form.visibility === "public" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
              }`}
            >
              Public
            </button>
            <button
              onClick={() => set({ visibility: "private" })}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border ${
                form.visibility === "private" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
              }`}
            >
              Private
            </button>
          </div>
          <p className="text-[10px] text-[#64748B] mt-1.5 leading-relaxed">
            {form.visibility === "private"
              ? "Only members see posts, members and events. Everyone can see the name and description."
              : "Anyone on Koino can find this group and see its posts."}
          </p>
        </div>
        <div>
          <label className={labelCls}>Joining</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => set({ joinMode: "open" })}
              disabled={form.visibility === "private"}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border disabled:opacity-40 ${
                form.visibility === "private" || form.joinMode === "open"
                  ? form.visibility === "private" ? "bg-white/[0.03] border-white/[0.06] text-[#64748B]" : "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]"
                  : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
              }`}
            >
              Open
            </button>
            <button
              onClick={() => set({ joinMode: "approval" })}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border ${
                form.visibility === "private" || form.joinMode === "approval"
                  ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]"
                  : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
              }`}
            >
              Approval
            </button>
          </div>
          <p className="text-[10px] text-[#64748B] mt-1.5 leading-relaxed">
            {form.visibility === "private"
              ? "Private groups always review join requests."
              : form.joinMode === "approval"
                ? "Anyone can ask to join — managers approve each request."
                : "Anyone can join instantly."}
          </p>
        </div>
      </div>

      {/* rules */}
      <div>
        <label className={labelCls}>Group rules (optional)</label>
        <textarea
          value={form.rules}
          onChange={(e) => set({ rules: e.target.value })}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Be kind. Keep discussions Christ-centred. No spam or promotions."
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* church affiliation */}
      <div>
        <label className={labelCls}>Church affiliation (optional)</label>
        {form.churchId ? (
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
            <MapPin size={14} className="text-[#7C3AED] shrink-0" />
            <span className="text-xs font-bold text-white truncate flex-1">{form.churchName}</span>
            <button onClick={() => set({ churchId: "", churchName: "" })} className="p-1 rounded-lg bg-white/[0.04] text-[#94A3B8] hover:text-white" aria-label="Remove church link">
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <input
              value={churchQuery}
              onChange={(e) => setChurchQuery(e.target.value)}
              maxLength={100}
              placeholder="Search the Churches directory…"
              className={inputCls}
            />
            {churchSearching && <p className="text-[10px] text-[#64748B] mt-1.5">Searching…</p>}
            {churchHits.length > 0 && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {churchHits.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      set({ churchId: c.id, churchName: c.name });
                      setChurchQuery("");
                      setChurchHits([]);
                    }}
                    className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2"
                  >
                    <span className="text-xs font-bold text-white block truncate">{c.name}</span>
                    <span className="text-[10px] text-[#64748B]">{[c.city, c.state].filter(Boolean).join(", ") || "Church directory"}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-[#64748B] mt-1.5 leading-relaxed">
              Display-only link. The &quot;official&quot; badge is granted only after
              platform verification — linking alone never claims official status.
            </p>
          </>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-bold text-[#94A3B8] hover:text-white">
          Cancel
        </button>
        <button
          onClick={() => valid && onSubmit(form)}
          disabled={!valid || submitting || coverBusy || logoBusy}
          className="px-5 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
        >
          {submitting ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? "Create group" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
