"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type Props = {
  value: string; // current coverImageUrl (may be "")
  onChange: (url: string) => void; // called with the new URL after upload, or "" on remove
  label?: string; // default "Cover Image"
};

// ─── Constants ─────────────────────────────────────────────────────────────

// Matches the server-side validation in /api/admin/upload/route.ts.
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * ImageUploader — a reusable cover-image upload component for the Koino admin.
 *
 * Behaviour:
 *   - No image  → dashed drop zone with "Upload Image" button + hidden <input>.
 *   - Has image  → preview + "Replace Image" / "Remove" buttons.
 *   - Uploading  → spinner + "Uploading…" text. Both buttons disabled.
 *   - On success → calls onChange(url). Preview updates automatically via `value`.
 *   - On error   → shows the message in red below the drop zone. Old image kept.
 *   - On remove  → calls onChange(""). Does NOT delete from Supabase Storage
 *                  (safer to leave orphaned than accidentally delete).
 *
 * Uses the Koino dark theme + neo-input styling. Mobile-friendly: file input
 * uses accept="image/*" to trigger the native iOS/Android picker, all tap
 * targets are ≥ 44px.
 */
export default function ImageUploader({ value, onChange, label = "Cover Image" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Upload logic ───────────────────────────────────────────────────────
  // Validates client-side first (MIME + size), then POSTs to /api/admin/upload
  // as multipart/form-data. On success, calls onChange(url). On error, sets
  // the local error state + shows a toast. Never calls onChange on failure.
  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);

      // Client-side validation (mirrors the server rules).
      if (!ALLOWED_TYPES.includes(file.type)) {
        const msg = "Image must be JPG, PNG, or WEBP.";
        setError(msg);
        toast.error(msg);
        return;
      }
      if (file.size > MAX_SIZE) {
        const msg = "Image must be under 10 MB.";
        setError(msg);
        toast.error(msg);
        return;
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || `Upload failed (HTTP ${res.status})`);
        }
        if (!data?.url || typeof data.url !== "string") {
          throw new Error("Upload succeeded but no URL was returned.");
        }
        onChange(data.url);
        toast.success("Image uploaded successfully.");
      } catch (e: any) {
        const msg = e?.message || "Failed to upload image.";
        setError(msg);
        toast.error(msg);
      } finally {
        setUploading(false);
        // Reset the file input so the same file can be re-selected after an
        // error or remove. Otherwise onChange won't fire for the same path.
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onChange]
  );

  // ─── Input handlers ────────────────────────────────────────────────────
  const onPick = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  };

  // Drag & drop — optional but nice. Prevents default browser behavior of
  // navigating to the dropped file.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const onRemove = () => {
    if (uploading) return;
    setError(null);
    onChange("");
    // NOTE: We intentionally do NOT call /api/admin/upload with a DELETE —
    // the spec says "safer to leave orphaned than accidentally delete".
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Hidden file input — always present so we can trigger the picker
          from both the drop zone and the "Replace Image" button. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={onFileChange}
        className="hidden"
        // Don't disable the input itself while uploading — instead we gate
        // clicks via onPick. Disabling the input can confuse some browsers.
      />

      {/* Either a drop zone (no image) or the preview (image exists). */}
      {value ? (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0f0f1a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className="w-full max-h-32 object-cover"
              onError={(e) => {
                // If the URL 404s or fails to load, swap the <img> out for a
                // placeholder box so the admin can Replace / Remove.
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = "none";
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPick}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-bold border border-white/[0.08] transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              {uploading ? "Uploading…" : "Replace Image"}
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] text-xs font-bold border border-[#EF4444]/30 transition-colors disabled:opacity-50"
            >
              <X size={12} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={onPick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPick();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`border-2 border-dashed rounded-2xl p-6 text-center hover:border-[#7C3AED]/40 transition-colors cursor-pointer min-h-[140px] flex flex-col items-center justify-center gap-2 ${
            dragOver
              ? "border-[#7C3AED] bg-[#7C3AED]/5"
              : "border-white/[0.12] bg-white/[0.02]"
          } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin text-[#A78BFA]" />
              <span className="text-xs font-bold text-[#A09DB1]">Uploading…</span>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                {dragOver ? (
                  <Upload size={18} className="text-[#A78BFA]" />
                ) : (
                  <ImageIcon size={18} className="text-[#A09DB1]" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  {dragOver ? "Drop image to upload" : "Upload Image"}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  JPG, PNG, or WEBP · max 10 MB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  // Stop propagation so the outer click handler doesn't fire
                  // twice — the button is inside the clickable drop zone.
                  e.stopPropagation();
                  onPick();
                }}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition-colors"
              >
                <Upload size={12} />
                Choose File
              </button>
            </>
          )}
        </div>
      )}

      {/* Error message — shown in red below the drop zone / preview.
          The old image (if any) is preserved. */}
      {error && (
        <p className="text-[11px] text-[#EF4444] leading-relaxed break-words">
          {error}
        </p>
      )}
    </div>
  );
}
