"use client";

/**
 * ─── MATRIMONY PHOTOS (Task 74 Stage B) ─────────────────────────────────────
 *
 * Three optional photo slots. Uploads go through POST /api/matrimony/photos
 * (server validates type/size/content and enforces the max-3 limit); display
 * uses the AUTHORIZED route path (/api/matrimony/photos/[id]) — owner-only
 * in Stage B. No storage URLs ever reach this component.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

import { MATRIMONY_LIMITS } from "@/lib/matrimony";
import type { SerializedMatrimonyPhoto } from "@/lib/matrimony/server";

export default function MatrimonyPhotos({
  photos,
  visibility,
  onChanged,
}: {
  photos: SerializedMatrimonyPhoto[];
  visibility: string;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slots: (SerializedMatrimonyPhoto | null)[] = [0, 1, 2].map(
    (pos) => photos.find((p) => p.position === pos) ?? null
  );

  const upload = async (file: File) => {
    if (photos.length >= MATRIMONY_LIMITS.photosMax) {
      toast.error(`You can have up to ${MATRIMONY_LIMITS.photosMax} photos.`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/matrimony/photos", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error || "Upload failed.");
        return;
      }
      toast.success("Photo added.");
      onChanged();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async (photo: SerializedMatrimonyPhoto) => {
    if (!window.confirm("Remove this photo?")) return;
    setRemovingId(photo.id);
    try {
      const res = await fetch(`/api/matrimony/photos/${photo.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Could not remove the photo.");
        return;
      }
      toast.success("Photo removed.");
      onChanged();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-4 md:p-5">
      <h3 className="text-sm font-black text-white">Profile photos</h3>
      <p className="mt-1 text-[12px] text-[#94A3B8]">
        Up to {MATRIMONY_LIMITS.photosMax} photos, stored privately. Your first
        photo is your primary photo.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {slots.map((photo, idx) => (
          <div
            key={idx}
            className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03]"
          >
            {photo ? (
              <>
                {/* Authorized owner-only serving route — never a storage URL */}
                <img
                  src={photo.url}
                  alt={`Matrimony photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {idx === 0 && (
                  <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur text-[9px] font-black text-amber-300">
                    <Star size={9} className="fill-amber-300" /> PRIMARY
                  </span>
                )}
                <button
                  onClick={() => remove(photo)}
                  disabled={removingId === photo.id || uploading}
                  aria-label={`Remove photo ${idx + 1}`}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-red-300 hover:bg-black/80 transition-colors disabled:opacity-50"
                >
                  {removingId === photo.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || photos.length >= MATRIMONY_LIMITS.photosMax}
                className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#64748B] hover:text-[#94A3B8] hover:bg-white/[0.02] transition-colors disabled:opacity-40"
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ImagePlus size={20} strokeWidth={1.6} />
                )}
                <span className="text-[10px] font-bold">Add photo</span>
              </button>
            )}
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      <p className="mt-3 text-[11px] text-[#64748B] leading-relaxed">
        Current setting:{" "}
        <span className="text-[#94A3B8] font-bold">
          {visibility === "ELIGIBLE_MEMBERS" ? "Eligible members" : "Connections only"}
        </span>{" "}
        — change it in the Privacy tab. Photos are checked server-side on every
        view and are never publicly accessible. Screenshots can never be fully
        prevented — share thoughtfully. JPG, PNG or WEBP, up to 4 MB.
      </p>
    </div>
  );
}
