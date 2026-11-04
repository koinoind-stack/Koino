"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, X, Upload, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  /** Current artwork URL (storage path like https://...supabase.co/.../GEN2-P01.webp) */
  artworkUrl: string | null;
  /** Called when artwork is uploaded/replaced — receives the new URL */
  onChange: (url: string | null) => void;
  /** Book ID for storage path (e.g. "genesis") */
  bookId: string;
  /** Chapter number for storage path (e.g. "2") */
  chapter: number;
  /** Panel ID for filename (e.g. "GEN2-P01") */
  panelId: string;
  /** Optional ComicChapter.id — when provided, the API will also persist the URL to DB */
  chapterId?: string;
  label?: string;
};

/**
 * Dedicated comic artwork uploader for the Bible Comics CMS.
 *
 * Flow:
 *   Admin selects image → uploads to /api/admin/comics/upload →
 *   server validates + converts to WebP via sharp → saves to Supabase
 *   Storage → returns public URL → saved in ComicPanel.artworkUrl
 *
 * Does NOT use base64 data URLs — artwork is stored as files in Supabase Storage.
 * Does NOT break the existing ImagePicker (separate component).
 *
 * Error handling:
 *   - Never blindly calls res.json() — checks res.ok, status, Content-Type,
 *     and empty bodies first.
 *   - Surfaces the actual server error message instead of generic
 *     "Unexpected end of JSON input".
 *   - Handles 403 (Forbidden), 405 (wrong route), 500 (config/storage error)
 *     with specific user-facing messages.
 */
export default function ComicArtworkUploader({
  artworkUrl,
  onChange,
  bookId,
  chapter,
  panelId,
  chapterId,
  label = "Artwork",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Safe JSON parser — never throws "Unexpected end of JSON input".
   * Returns `{ ok: false, error }` if the body is empty / non-JSON.
   */
  async function safeParseJson(res: Response): Promise<{ ok: boolean; data?: any; error?: string }> {
    const text = await res.text().catch(() => "");
    if (!text || text.trim() === "") {
      return {
        ok: false,
        error: `Server returned an empty response (HTTP ${res.status}). This usually means the upload route is missing or the server crashed.`,
      };
    }
    // Check Content-Type — warn if it's HTML (e.g. Vercel 404 page)
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json") && !ct.includes("text/plain")) {
      // Try to parse anyway — sometimes Next.js returns JSON without proper CT
      try {
        const data = JSON.parse(text);
        return { ok: true, data };
      } catch {
        return {
          ok: false,
          error: `Server returned ${ct || "non-JSON"} (HTTP ${res.status}). Response: ${text.slice(0, 200)}`,
        };
      }
    }
    try {
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch (e: any) {
      return {
        ok: false,
        error: `Server returned malformed JSON (HTTP ${res.status}): ${e?.message || "parse error"}. First 200 chars: ${text.slice(0, 200)}`,
      };
    }
  }

  const handleFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError(`Unsupported type: ${file.type}. Use PNG, JPG, or WEBP.`);
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB.`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bookId", bookId);
      formData.append("chapter", String(chapter));
      formData.append("panelId", panelId);
      if (chapterId) formData.append("chapterId", chapterId);

      const res = await fetch("/api/admin/comics/upload", {
        method: "POST",
        body: formData,
      });

      const parsed = await safeParseJson(res);
      if (!parsed.ok) {
        throw new Error(parsed.error || "Upload failed (invalid server response)");
      }

      const data = parsed.data || {};

      // Handle non-OK responses with a structured error
      if (!res.ok) {
        // Special-case the missing-config error so the admin sees exactly
        // which Vercel env var to set.
        if (data.missing) {
          const envVar = data.missing;
          throw new Error(
            `${data.error || "Upload failed"} (Set ${envVar} in Vercel → Project → Settings → Environment Variables.)`
          );
        }
        if (res.status === 403) {
          throw new Error("Forbidden — you must be signed in as an admin to upload artwork.");
        }
        if (res.status === 405) {
          throw new Error("Upload endpoint returned 405 Method Not Allowed. The route /api/admin/comics/upload may not be deployed. Try redeploying.");
        }
        throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
      }

      // Success — prefer the `artworkUrl` alias, fall back to `url`
      const finalUrl = data.artworkUrl || data.url;
      if (!finalUrl) {
        throw new Error("Server returned success but no artwork URL was provided.");
      }

      onChange(finalUrl);

      const sizeNote =
        data.optimizedSize && data.originalSize
          ? ` · WebP ${(data.optimizedSize / 1024).toFixed(0)}KB (from ${(data.originalSize / 1024).toFixed(0)}KB)`
          : ` · ${(file.size / 1024).toFixed(0)}KB original`;

      const dbNote = data.dbUpdated === true ? " · saved to DB" : "";

      toast.success("Artwork uploaded!", {
        description: `Saved to Supabase Storage${sizeNote}${dbNote}`,
      });
    } catch (e: any) {
      const msg = e?.message || "Upload failed";
      setError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
        {label}
      </label>

      {artworkUrl ? (
        <div className="relative group">
          <div className="w-full h-32 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0f0f1a]">
            <img
              src={artworkUrl}
              alt="Comic panel artwork"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute top-1 right-1 flex gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all"
              title="Replace artwork"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="w-6 h-6 rounded-md bg-[#EF4444]/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[#EF4444] transition-all"
              title="Remove artwork"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 rounded-xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.2] transition-all flex flex-col items-center justify-center gap-2 text-[#64748B] hover:text-[#94A3B8] disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin text-[#F39B9B]" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Upload Artwork</span>
              <span className="text-[9px] text-[#475569]">PNG, JPG, or WEBP (max 10MB)</span>
            </>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-[10px] text-[#EF4444]">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />
    </div>
  );
}
