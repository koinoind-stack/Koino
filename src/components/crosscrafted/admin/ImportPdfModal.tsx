"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FileUp, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void;
  onImported: (articleId: string) => void;
};

// ─── Constants ─────────────────────────────────────────────────────────────

// Mirrors the server-side validation in /api/admin/articles/import-pdf/route.ts.
const ALLOWED_TYPE = "application/pdf";
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * ImportPdfModal — lets the admin upload a PDF, extract its text + first-page
 * cover image, and create a draft KoinoArticle. After the article is created
 * the modal calls onImported(articleId) so the parent can open the existing
 * editor with the new article.
 *
 * Behaviour:
 *   - Drag & drop OR click-to-select a PDF.
 *   - Validates client-side (MIME + size). Shows the file name + KB size.
 *   - "Create Article from PDF" uploads the PDF to the import endpoint as
 *     multipart/form-data. Shows a "Processing PDF…" state while the server
 *     extracts text + renders the cover.
 *   - On success: toast + calls onImported(articleId). Parent closes modal
 *     and opens the editor.
 *   - On error (including the scanned-PDF case): shows the error inline and
 *     keeps the modal open so the admin can try a different PDF.
 *   - "Cancel" closes the modal.
 *
 * Mobile-friendly: full-width modal, native file picker, ≥ 44px tap targets.
 * Uses the existing Koino dark theme + neo-input styling.
 */
export default function ImportPdfModal({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape closes the modal (matches the pattern in InlineImagePopover +
  // ApologeticsEditorModal). We lock body scroll while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, uploading]);

  // ─── File selection ────────────────────────────────────────────────────
  const validateAndSetFile = useCallback((f: File | null) => {
    setError(null);
    if (!f) return;
    if (f.type !== ALLOWED_TYPE) {
      const msg = "File must be a PDF.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      const msg = "File must have a .pdf extension.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (f.size > MAX_SIZE) {
      const msg = "PDF must be under 20 MB.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setFile(f);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(e.target.files?.[0] ?? null);
  };

  const onPick = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

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

  // ─── Upload + create article ───────────────────────────────────────────
  const onUpload = async () => {
    if (!file || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/articles/import-pdf", {
        method: "POST",
        body: fd,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Special-case the scanned-PDF error so we can show a friendlier
        // message. The server returns { error, scanned: true } with status 400.
        if (data?.scanned) {
          throw new Error(
            data?.error ||
              "This PDF appears to be scanned or image-based. Text could not be extracted automatically."
          );
        }
        throw new Error(data?.error || `Import failed (HTTP ${res.status})`);
      }
      if (!data?.articleId || typeof data.articleId !== "string") {
        throw new Error("Import succeeded but no article ID was returned.");
      }

      toast.success("PDF imported successfully.", {
        description: data?.message || "Draft created. Review and publish when ready.",
      });
      onImported(data.articleId);
    } catch (e: any) {
      const msg = e?.message || "Failed to import PDF.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      // Reset the file input so the same file can be re-selected after an
      // error. Otherwise onChange won't fire for the same path.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => {
        if (!uploading) onClose();
      }}
    >
      <div
        className="bg-[#1C1929] border border-white/[0.1] rounded-2xl p-5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/15 flex items-center justify-center shrink-0">
              <FileUp size={14} className="text-[#A78BFA]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                Import Apologetics PDF
              </h3>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">
                Extracts text + cover image into a new draft article.
              </p>
            </div>
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
          {/* Hidden file input — always present so we can trigger the picker
              from both the drop zone and the "Choose PDF" button. */}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFileChange}
            className="hidden"
          />

          {/* Drop zone / selected-file display */}
          {file ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/15 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-[#A78BFA]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-[#94A3B8]">{formatSize(file.size)}</p>
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white"
                  aria-label="Remove file"
                >
                  <X size={12} />
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
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer min-h-[160px] flex flex-col items-center justify-center gap-2 ${
                dragOver
                  ? "border-[#7C3AED] bg-[#7C3AED]/5"
                  : "border-white/[0.12] bg-white/[0.02] hover:border-[#7C3AED]/40"
              } ${uploading ? "pointer-events-none opacity-70" : ""}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                {dragOver ? (
                  <FileUp size={18} className="text-[#A78BFA]" />
                ) : (
                  <FileText size={18} className="text-[#A09DB1]" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  {dragOver ? "Drop PDF to upload" : "Upload PDF"}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  PDF only · max 20 MB
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
                <FileUp size={12} />
                Choose PDF
              </button>
            </div>
          )}

          {/* Error message — shown in red below the drop zone / file chip.
              Kept open with the modal so the admin can retry with a different
              PDF. */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-3">
              <AlertCircle size={14} className="text-[#EF4444] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#EF4444] leading-relaxed break-words flex-1">
                {error}
              </p>
            </div>
          )}

          {/* Processing hint — shown while the server is extracting text +
              rendering the cover. The endpoint can take a few seconds on
              large PDFs. */}
          {uploading && (
            <div className="flex items-center gap-2 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 p-3">
              <Loader2 size={14} className="text-[#A78BFA] shrink-0 animate-spin" />
              <p className="text-[11px] text-[#A78BFA] leading-relaxed">
                Processing PDF — extracting text, detecting Bible references,
                and rendering the first page as a cover image…
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-bold border border-white/[0.08] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={!file || uploading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Processing PDF…
              </>
            ) : (
              <>
                <FileUp size={14} />
                Create Article from PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
