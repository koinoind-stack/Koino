"use client";

/**
 * GroupEventForm — create an event inside a group.
 *
 * Deliberately reuses the EXISTING Koino Events system end-to-end:
 *   - poster upload via POST /api/events/upload-image
 *   - persistence via POST /api/events (status starts as PENDING — platform
 *     moderators approve before a public event reaches the main Events
 *     section; the group's Events tab shows it right away with a review badge)
 *   - the API verifies the creator is an active member of the group and
 *     forces members-only visibility for private groups server-side.
 *
 * Fields follow the spec: title, description, poster image, date/time,
 * venue or online meeting details, registration/ticket URL, contact info,
 * and public vs members-only visibility.
 */

import { useRef, useState } from "react";
import { CalendarDays, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "./types";

type Props = {
  groupId: string;
  isPrivateGroup: boolean;
  onCreated: () => void;
  onCancel: () => void;
};

const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50";
const labelCls = "text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-1.5 block";

export default function GroupEventForm({ groupId, isPrivateGroup, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [posterBusy, setPosterBusy] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [eventType, setEventType] = useState<"in-person" | "online" | "hybrid">("in-person");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [registrationType, setRegistrationType] = useState<"free" | "registration_required">("free");
  const [ticketUrl, setTicketUrl] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [visibility, setVisibility] = useState<"public" | "members">(isPrivateGroup ? "members" : "public");
  const [submitting, setSubmitting] = useState(false);
  const posterRef = useRef<HTMLInputElement>(null);

  async function uploadPoster(file: File) {
    setPosterBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/events/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCoverImage(data.url);
      toast.success("Poster ready");
    } catch (err) {
      toast.error((err as Error).message || "Upload failed — use a JPG/PNG/WEBP under 5 MB");
    } finally {
      setPosterBusy(false);
    }
  }

  function pickPoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Use a JPG, PNG or WEBP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Poster must be under 5 MB");
      return;
    }
    uploadPoster(file);
  }

  async function submit() {
    if (!title.trim() || !startDate || submitting) return;
    if (eventType !== "online" && (!city.trim() || !state)) {
      toast.error("City and State are required for in-person events");
      return;
    }
    if (eventType !== "in-person" && !onlineUrl.trim()) {
      toast.error("An online meeting link is required for online/hybrid events");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || title.trim(),
          startDate,
          startTime: startTime || undefined,
          allDay: !startTime,
          eventType,
          onlineUrl: eventType !== "in-person" ? onlineUrl.trim() : undefined,
          venueName: venueName.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state || undefined,
          registrationType,
          ticketUrl: registrationType === "registration_required" ? ticketUrl.trim() : undefined,
          organizerName: organizerName.trim() || undefined,
          organizerPhone: organizerPhone.trim() || undefined,
          category: "fellowship",
          coverImage: coverImage || undefined,
          groupId,
          groupVisibility: isPrivateGroup ? "members" : visibility,
        }),
      });
      toast.success(
        visibility === "public" && !isPrivateGroup
          ? "Event submitted — it appears here now and in the main Events section once approved"
          : "Event submitted — it will appear in the group's Events tab"
      );
      onCreated();
    } catch (err) {
      toast.error((err as Error).message || "Could not create the event");
    } finally {
      setSubmitting(false);
    }
  }

  const valid = title.trim().length >= 3 && !!startDate;

  return (
    <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-white">Create a group event</h3>
        <button onClick={onCancel} className="p-1.5 rounded-lg bg-white/[0.04] text-[#94A3B8] hover:text-white" aria-label="Close form">
          <X size={15} />
        </button>
      </div>

      <div>
        <label className={labelCls}>Event title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Friday Night Worship & Prayer" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} placeholder="What's happening? Who should come?" className={`${inputCls} resize-none`} />
      </div>

      {/* poster */}
      <div>
        <label className={labelCls}>Poster (optional)</label>
        {coverImage ? (
          <div className="relative w-32 h-40 rounded-xl overflow-hidden border border-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt="Event poster" className="w-full h-full object-cover" />
            <button onClick={() => setCoverImage("")} className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white" aria-label="Remove poster">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => posterRef.current?.click()}
            disabled={posterBusy}
            className="w-32 h-40 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] text-[#64748B] hover:text-white hover:border-[#7C3AED]/40 flex flex-col items-center justify-center gap-1 text-[11px] font-bold"
          >
            {posterBusy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
            {posterBusy ? "Uploading…" : "Upload poster"}
          </button>
        )}
        <input ref={posterRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPoster} />
      </div>

      {/* date + time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Time</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* venue / online */}
      <div>
        <label className={labelCls}>Where?</label>
        <div className="flex gap-1.5 mb-2">
          {(["in-person", "online", "hybrid"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setEventType(t)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
                eventType === t ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
              }`}
            >
              {t === "in-person" ? "In person" : t}
            </button>
          ))}
        </div>
        {eventType !== "online" && (
          <div className="space-y-2">
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={200} placeholder="Venue name (e.g. Grace Community Hall)" className={inputCls} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="Address (optional)" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="City" className={inputCls} />
              <input value={state} onChange={(e) => setState(e.target.value)} maxLength={80} placeholder="State" className={inputCls} />
            </div>
          </div>
        )}
        {eventType !== "in-person" && (
          <input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} maxLength={500} placeholder="Online meeting link (YouTube/Zoom/Meet…)" className={`${inputCls} mt-2`} />
        )}
      </div>

      {/* registration */}
      <div>
        <label className={labelCls}>Registration</label>
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => setRegistrationType("free")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
              registrationType === "free" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            Free entry
          </button>
          <button
            onClick={() => setRegistrationType("registration_required")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
              registrationType === "registration_required" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            Registration required
          </button>
        </div>
        {registrationType === "registration_required" && (
          <input value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} maxLength={500} placeholder="Registration / ticket link" className={inputCls} />
        )}
      </div>

      {/* contact */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Contact name</label>
          <input value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} maxLength={200} placeholder="Who hosts this?" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Contact phone</label>
          <input value={organizerPhone} onChange={(e) => setOrganizerPhone(e.target.value)} maxLength={30} placeholder="+91…" className={inputCls} />
        </div>
      </div>

      {/* visibility */}
      <div>
        <label className={labelCls}>Who can see this event?</label>
        <div className="flex gap-1.5">
          <button
            onClick={() => setVisibility("public")}
            disabled={isPrivateGroup}
            className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border disabled:opacity-40 ${
              isPrivateGroup || visibility === "public" ? (isPrivateGroup ? "bg-white/[0.03] border-white/[0.06] text-[#64748B]" : "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]") : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            Everyone
          </button>
          <button
            onClick={() => setVisibility("members")}
            className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border ${
              visibility === "members" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            Members only
          </button>
        </div>
        <p className="text-[10px] text-[#64748B] mt-1.5 leading-relaxed">
          {isPrivateGroup
            ? "Private groups always keep events members-only."
            : visibility === "public"
              ? "Shown in the group and eligible for the main Events section after review."
              : "Only group members can see this event."}
        </p>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#64748B]">
          <CalendarDays size={11} /> Reviewed by the Koino team before going public
        </span>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-bold text-[#94A3B8] hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={!valid || submitting || posterBusy}
            className="px-5 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Create event"}
          </button>
        </div>
      </div>
    </div>
  );
}
