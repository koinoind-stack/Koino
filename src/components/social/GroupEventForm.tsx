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
import { useTranslation } from "@/lib/i18n/LanguageContext";

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
  const t = useTranslation();
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
      if (!res.ok) throw new Error(data.error || t("groupEvent.uploadFailed"));
      setCoverImage(data.url);
      toast.success(t("groupEvent.posterReady"));
    } catch (err) {
      toast.error((err as Error).message || t("groupEvent.uploadFailed"));
    } finally {
      setPosterBusy(false);
    }
  }

  function pickPoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error(t("groupEvent.badType"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("groupEvent.posterTooLarge"));
      return;
    }
    uploadPoster(file);
  }

  async function submit() {
    if (!title.trim() || !startDate || submitting) return;
    if (eventType !== "online" && (!city.trim() || !state)) {
      toast.error(t("groupEvent.cityStateRequired"));
      return;
    }
    if (eventType !== "in-person" && !onlineUrl.trim()) {
      toast.error(t("groupEvent.onlineLinkRequired"));
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
          ? t("groupEvent.submittedPublic")
          : t("groupEvent.submittedMembers")
      );
      onCreated();
    } catch (err) {
      toast.error((err as Error).message || t("groupEvent.createError"));
    } finally {
      setSubmitting(false);
    }
  }

  const valid = title.trim().length >= 3 && !!startDate;

  return (
    <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-white">{t("groupEvent.title")}</h3>
        <button onClick={onCancel} className="p-1.5 rounded-lg bg-white/[0.04] text-[#94A3B8] hover:text-white" aria-label={t("groupEvent.closeAria")}>
          <X size={15} />
        </button>
      </div>

      <div>
        <label className={labelCls}>{t("groupEvent.title")}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("groupEvent.titlePlaceholder")} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>{t("groupEvent.description")}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} placeholder={t("groupEvent.descPlaceholder")} className={`${inputCls} resize-none`} />
      </div>

      {/* poster */}
      <div>
        <label className={labelCls}>{t("groupEvent.posterOptional")}</label>
        {coverImage ? (
          <div className="relative w-32 h-40 rounded-xl overflow-hidden border border-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt={t("groupEvent.posterAlt")} className="w-full h-full object-cover" />
            <button onClick={() => setCoverImage("")} className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white" aria-label={t("groupEvent.removePosterAria")}>
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
            {posterBusy ? t("groupEvent.uploading") : t("groupEvent.uploadPoster")}
          </button>
        )}
        <input ref={posterRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPoster} />
      </div>

      {/* date + time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("groupEvent.date")}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("groupEvent.time")}</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* venue / online */}
      <div>
        <label className={labelCls}>{t("groupEvent.where")}</label>
        <div className="flex gap-1.5 mb-2">
          {(["in-person", "online", "hybrid"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setEventType(mode)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
                eventType === mode ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
              }`}
            >
              {mode === "in-person" ? t("groupEvent.type.inPerson") : mode === "online" ? t("groupEvent.type.online") : t("groupEvent.type.hybrid")}
            </button>
          ))}
        </div>
        {eventType !== "online" && (
          <div className="space-y-2">
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={200} placeholder={t("groupEvent.venuePlaceholder")} className={inputCls} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder={t("groupEvent.addressPlaceholder")} className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder={t("groupEvent.cityPlaceholder")} className={inputCls} />
              <input value={state} onChange={(e) => setState(e.target.value)} maxLength={80} placeholder={t("groupEvent.statePlaceholder")} className={inputCls} />
            </div>
          </div>
        )}
        {eventType !== "in-person" && (
          <input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} maxLength={500} placeholder={t("groupEvent.onlinePlaceholder")} className={`${inputCls} mt-2`} />
        )}
      </div>

      {/* registration */}
      <div>
        <label className={labelCls}>{t("groupEvent.registration")}</label>
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => setRegistrationType("free")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
              registrationType === "free" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            {t("groupEvent.freeEntry")}
          </button>
          <button
            onClick={() => setRegistrationType("registration_required")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
              registrationType === "registration_required" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            {t("groupEvent.registrationRequired")}
          </button>
        </div>
        {registrationType === "registration_required" && (
          <input value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} maxLength={500} placeholder={t("groupEvent.ticketPlaceholder")} className={inputCls} />
        )}
      </div>

      {/* contact */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("groupEvent.contactName")}</label>
          <input value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} maxLength={200} placeholder={t("groupEvent.hostPlaceholder")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("groupEvent.contactPhone")}</label>
          <input value={organizerPhone} onChange={(e) => setOrganizerPhone(e.target.value)} maxLength={30} placeholder={t("groupEvent.phonePlaceholder")} className={inputCls} />
        </div>
      </div>

      {/* visibility */}
      <div>
        <label className={labelCls}>{t("groupEvent.visibilityLabel")}</label>
        <div className="flex gap-1.5">
          <button
            onClick={() => setVisibility("public")}
            disabled={isPrivateGroup}
            className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border disabled:opacity-40 ${
              isPrivateGroup || visibility === "public" ? (isPrivateGroup ? "bg-white/[0.03] border-white/[0.06] text-[#64748B]" : "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]") : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            {t("groupEvent.public")}
          </button>
          <button
            onClick={() => setVisibility("members")}
            className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border ${
              visibility === "members" ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]" : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
            }`}
          >
            {t("groupEvent.membersOnly")}
          </button>
        </div>
        <p className="text-[10px] text-[#64748B] mt-1.5 leading-relaxed">
          {isPrivateGroup
            ? t("groupEvent.notePrivate")
            : visibility === "public"
              ? t("groupEvent.notePublic")
              : t("groupEvent.noteMembers")}
        </p>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#64748B]">
          <CalendarDays size={11} /> {t("groupEvent.reviewNote")}
        </span>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-bold text-[#94A3B8] hover:text-white">{t("common.cancel")}</button>
          <button
            onClick={submit}
            disabled={!valid || submitting || posterBusy}
            className="px-5 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
          >
            {submitting ? t("groupEvent.submitting") : t("groupEvent.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
