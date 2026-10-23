"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type Props = {
  onInsert: (markdown: string) => void; // called with the markdown image syntax to insert
  onClose: () => void;
};

// ─── Constants ─────────────────────────────────────────────────────────────

// Matches the server-side validation in /api/admin/upload/route.ts.
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ──────────────────────────────────────────────────────────────

// Sanitize a filename into a usable alt-text fallback. Strips extension,
// replaces separators with spaces, trims, and clamps length.
function filenameToAlt(filename: string): string {
  const noExt = filename.replace(/\.[^/.]+$/, "");
  const cleaned = noExt
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "image";
  // Clamp to a reasonable alt-text length.
  return cleaned.length > 80 ? cleaned.slice(0, 80).trim() + "…" : cleaned;
}

// Escape alt text for safe embedding in markdown. Markdown alt text is wrapped
// in `![...]` — `]` and `\` are the only characters that need escaping.
function escapeAlt(alt: string): string {
  return alt.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * InlineImagePopover — a modal that lets the admin upload an image and insert
 * it inline into the article markdown. Triggered from the Image button in the
 * ApologeticsEditorModal toolbar.
 *
 * Behaviour:
 *   - File picker (validated client-side: JPG/PNG/WEBP, ≤ 10 MB).
 *   - Optional Alt Text field — falls back to the sanitized filename.
 *   - "Upload & Insert" uploads via /api/admin/upload, constructs the
 *     markdown `![alt](url)`, calls onInsert(markdown), then onClose().
 *   - "Cancel" closes the popover without inserting anything.
 *   - On error: shows the message inline, keeps the popover open.
 *
 * Mobile: full-width on mobile (max-w-sm with mx-4). All tap targets ≥ 44px.
 */
export default function InlineImagePopover({ onInsert, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);

  // Escape closes the popover (matches the modal pattern in ApologeticsTab).
  // Lock body scroll while the popover is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Autofocus the alt-text field after mount so the admin can type immediately
  // after picking a file. (We do NOT autofocus on mount because the file
  // picker is the first interaction — that would trap focus. Instead we focus
  // the alt field once a file is chosen.)
  useEffect(() => {
    if (file) {
      altRef.current?.focus();
    }
  }, [file]);

  // ─── File selection ────────────────────────────────────────────────────
  const validateAndSetFile = useCallback((f: File | null) => {
    setError(null);
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      const msg = "Image must be JPG, PNG, or WEBP.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (f.size > MAX_SIZE) {
      const msg = "Image must be under 10 MB.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setFile(f);
    // Pre-fill alt text from the filename if the admin hasn't typed anything.
    setAlt((prev) => prev || filenameToAlt(f.name));
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(e.target.files?.[0] ?? null);
  };

  const onPick = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  // Drag & drop on the drop zone.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (uploading) return;
    validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
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

  // ─── Upload + insert ──────────────────────────────────────────────────
  const onUpload = async () => {
    if (!file) return;
    setError(null);
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

      // Build the markdown. Always use non-empty alt text (admin-entered or
      // fallback to sanitized filename).
      const finalAlt = (alt.trim() || filenameToAlt(file.name)).trim();
      const markdown = `![${escapeAlt(finalAlt)}](${data.url})`;

      onInsert(markdown);
      toast.success("Image inserted.");
      // Parent calls onClose() after onInsert — but be defensive in case it
      // doesn't.
    } catch (e: any) {
      const msg = e?.message || "Failed to upload image.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1929] border border-white/[0.1] rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon size={14} className="text-[#A78BFA] shrink-0" />
            <h3 className="text-sm font-extrabold text-white">Insert Image</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3">
          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            onChange={onFileChange}
            className="hidden"
          />

          {/* Drop zone / selected-file display */}
          {file ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                <ImageIcon size={16} className="text-[#A09DB1]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-[#94A3B8]">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setAlt("");
                    setError(null);
                  }}
                  className="shrink-0 w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white"
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              )}
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
              className={`border-2 border-dashed rounded-xl p-5 text-center hover:border-[#7C3AED]/40 transition-colors cursor-pointer min-h-[120px] flex flex-col items-center justify-center gap-2 ${
                dragOver
                  ? "border-[#7C3AED] bg-[#7C3AED]/5"
                  : "border-white/[0.12] bg-white/[0.02]"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <Upload size={16} className="text-[#A09DB1]" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  {dragOver ? "Drop image to upload" : "Choose Image"}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  JPG, PNG, or WEBP · max 10 MB
                </p>
              </div>
            </div>
          )}

          {/* Alt text */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              Alt Text
              <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-[#64748B]">
                (optional — defaults to filename)
              </span>
            </label>
            <input
              ref={altRef}
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              disabled={uploading}
              className="neo-input text-sm"
              placeholder="Describe the image for accessibility…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (file && !uploading) void onUpload();
                }
              }}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-[11px] text-[#EF4444] leading-relaxed break-words">
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onUpload()}
              disabled={!file || uploading}
              className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload &amp; Insert
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
