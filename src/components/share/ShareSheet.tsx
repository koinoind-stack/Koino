"use client";

/**
 * ─── UNIVERSAL SHARE SHEET (Task 121) ────────────────────────────────────────
 *
 * The ONE share UI used across Koino (Bible reader, comics, trivia, watch,
 * posts, prayer wall, groups, events, marketplace, directory, memorials,
 * articles). Consistent actions, honest platform capabilities:
 *
 *  • Share Image  — native share sheet WITH the PNG file when the platform
 *                   supports it (mobile); otherwise falls back to a download.
 *  • WhatsApp     — wa.me compose link with text + canonical URL. WhatsApp's
 *                   web/compose flow cannot receive image attachments, so the
 *                   sheet offers the image download alongside (no false
 *                   auto-attach claims).
 *  • Facebook     — official sharer.php dialog for the canonical URL
 *                   (Facebook does not accept pre-supplied images); the link
 *                   preview comes from the page's OG metadata.
 *  • Instagram    — no web publish API: downloads the card + copies the
 *                   caption; on supporting mobile browsers opens the native
 *                   share sheet so the image can be posted into the app.
 *  • Copy Text / Copy Link / Download Image — always available where relevant.
 *  • Original image download (comics artwork) — untouched source file.
 *
 * If the card endpoint refuses (private/unpublished content), the image
 * section hides and text/link actions keep working.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Share2, Download, Copy, Link2, Loader2, AlertCircle,
  Image as ImageIcon, FileDown, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export type ShareFormat = "square" | "portrait" | "story" | "landscape";

// format → i18n key. Resolved with t() at render time inside the component so
// language switches re-render (never call t() at module scope).
const FORMAT_KEYS: Record<ShareFormat, string> = {
  square: "share.format.square",
  portrait: "share.format.portrait",
  story: "share.format.story",
  landscape: "share.format.landscape",
};

export type ShareRequest = {
  /** Sheet heading, e.g. "Share Genesis 1" */
  heading?: string;
  /** Caption / verse text carried with the share. */
  shareText?: string;
  /** Canonical URL (omit when the content has no public URL). */
  shareUrl?: string;
  /** /api/share-card base URL (without format param) for the share image. */
  cardUrl?: string;
  /** Formats offered for the card (defaults to the card's own format). */
  formats?: ShareFormat[];
  imageUrl?: string;
  imageLabel?: string;
  fileName?: string;
};

function buildCardUrl(base: string, format: ShareFormat): string {
  try {
    const u = new URL(base, window.location.origin);
    u.searchParams.set("format", format);
    return u.toString();
  } catch {
    return base;
  }
}

async function blobFromUrl(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ShareSheet({
  request,
  onClose,
}: {
  request: ShareRequest | null;
  onClose: () => void;
}) {
  const t = useTranslation();
  const open = !!request;
  const formats = useMemo<ShareFormat[]>(
    () => (request?.formats?.length ? request.formats : request?.cardUrl ? ["square"] : []),
    [request]
  );
  const [format, setFormat] = useState<ShareFormat>("square");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [cardError, setCardError] = useState(false);

  // Reset the chosen format whenever a new share request opens.
  useEffect(() => {
    if (!request?.cardUrl) return;
    setFormat(request.formats?.[0] ?? "square");
  }, [request]);

  useEffect(() => {
    if (!open || !request?.cardUrl || !format) return;
    let revoked: string | null = null;
    let cancelled = false;
    setLoadingCard(true);
    setCardError(false);
    (async () => {
      const blob = await blobFromUrl(buildCardUrl(request.cardUrl!, format));
      if (cancelled) return;
      setLoadingCard(false);
      if (!blob) {
        setCardError(true);
        return;
      }
      revoked = URL.createObjectURL(blob);
      setPreviewUrl(revoked);
    })();
    return () => {
      cancelled = true;
      setLoadingCard(false);
      if (revoked) URL.revokeObjectURL(revoked);
      setPreviewUrl(null);
    };
  }, [open, request?.cardUrl, format]);

  const fileName = request?.fileName || "koino-share.png";
  const text = request?.shareText || "";
  const url = request?.shareUrl || "";
  const composedText = url ? (text ? `${text}\n\n${url}` : url) : text;

  const nativeShareFiles = useCallback(
    async (blob: Blob): Promise<boolean> => {
      try {
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        const file = new File([blob], fileName, { type: "image/png" });
        if (nav.share && nav.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], text: text || undefined, url: url || undefined });
          return true;
        }
      } catch {
        /* user cancelled */
      }
      return false;
    },
    [fileName, text, url]
  );

  const actionShareImage = async () => {
    if (cardError || !request?.cardUrl) return;
    const blob = await blobFromUrl(buildCardUrl(request.cardUrl, format));
    if (!blob) {
      toast.error(t("share.imageError"));
      return;
    }
    if (await nativeShareFiles(blob)) return;
    await downloadBlob(blob, fileName);
    toast.success(t("share.downloaded"), { description: t("share.downloadedDesc") });
  };

  const actionWhatsApp = () => {
    if (!composedText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(composedText)}`, "_blank");
  };

  const actionFacebook = () => {
    if (!url) return;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "width=600,height=540"
    );
  };

  const actionInstagram = async () => {
    if (!request?.cardUrl) return;
    const blob = await blobFromUrl(buildCardUrl(request.cardUrl, format));
    if (blob && (await nativeShareFiles(blob))) return;
    if (blob) await downloadBlob(blob, fileName);
    if (text) await copyText(text);
    toast.success(t("share.instagramDone"), {
      description: t("share.instagramDoneDesc"),
    });
  };

  const actionDownloadCard = async () => {
    if (!request?.cardUrl) return;
    const blob = await blobFromUrl(buildCardUrl(request.cardUrl, format));
    if (!blob) {
      toast.error(t("share.imageError"));
      return;
    }
    await downloadBlob(blob, fileName);
    toast.success(t("share.downloaded"));
  };

  const actionCopyText = async () => {
    if (!text) return;
    if (await copyText(text)) toast.success(t("share.copied"));
  };

  const actionCopyLink = async () => {
    if (!url) return;
    if (await copyText(url)) toast.success(t("share.linkCopied"));
  };

  const actionDownloadOriginal = async () => {
    if (!request?.imageUrl) return;
    const blob = await blobFromUrl(request.imageUrl);
    if (blob) {
      await downloadBlob(blob, request.imageLabel || "koino-original.png");
      toast.success(t("share.originalDownloaded"));
    } else {
      window.open(request.imageUrl, "_blank");
    }
  };

  return (
    <AnimatePresence>
      {open && request && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-label={request.heading || t("churches.share")}
            className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-[#17141F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 size={16} className="text-[#A78BFA]" />
                {request.heading || t("churches.share")}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5"
                aria-label={t("common.close")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Card preview */}
            {request.cardUrl && (
              <div className="mb-4">
                {formats.length > 1 && (
                  <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                    {formats.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all ${
                          format === f
                            ? "bg-[#7C3AED]/25 border-[#7C3AED]/50 text-[#C4B5FD]"
                            : "bg-white/[0.04] border-white/[0.08] text-[#94A3B8] hover:text-white"
                        }`}
                      >
                        {t(FORMAT_KEYS[f])}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/30 flex items-center justify-center min-h-[120px]">
                  {loadingCard && (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Loader2 size={22} className="text-[#A78BFA] animate-spin" />
                      <p className="text-[11px] text-[#94A3B8]">{t("share.creating")}</p>
                    </div>
                  )}
                  {!loadingCard && cardError && (
                    <div className="flex items-center gap-2 py-6 px-4 text-center">
                      <AlertCircle size={15} className="text-[#F59E0B] shrink-0" />
                      <p className="text-[11px] text-[#94A3B8]">
                        {t("share.unavailable")}
                      </p>
                    </div>
                  )}
                  {!loadingCard && !cardError && previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={t("share.previewAlt")}
                      className="w-full max-h-[46vh] object-contain"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              {request.cardUrl && !cardError && (
                <SheetButton
                  onClick={actionShareImage}
                  icon={loadingCard ? Loader2 : ImageIcon}
                  label={t("share.shareImage")}
                  primary
                  spin={loadingCard}
                />
              )}
              {composedText && (
                <SheetButton onClick={actionWhatsApp} icon={WhatsAppIcon} label="WhatsApp" wa />
              )}
              {url && <SheetButton onClick={actionFacebook} icon={FacebookIcon} label="Facebook" fb />}
              {request.cardUrl && !cardError && (
                <SheetButton onClick={actionInstagram} icon={InstagramIcon} label="Instagram" ig />
              )}
              {request.cardUrl && !cardError && (
                <SheetButton onClick={actionDownloadCard} icon={Download} label={t("share.downloadImage")} />
              )}
              {request.imageUrl && (
                <SheetButton
                  onClick={actionDownloadOriginal}
                  icon={FileDown}
                  label={request.imageLabel || t("share.originalImage")}
                />
              )}
              {text && <SheetButton onClick={actionCopyText} icon={Copy} label={t("share.copyText")} />}
              {url && <SheetButton onClick={actionCopyLink} icon={Link2} label={t("share.copyLink")} />}
            </div>

            <p className="text-[10px] text-[#64748B] mt-4 text-center leading-relaxed">
              {t("share.footerNote")}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Buttons + tiny brand glyphs ───────────────────────────────────────── */

function SheetButton({
  onClick, icon: Icon, label, primary, spin, wa, fb, ig,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  primary?: boolean;
  spin?: boolean;
  wa?: boolean;
  fb?: boolean;
  ig?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[11px] font-bold border transition-all ${
        primary
          ? "bg-[#7C3AED]/20 border-[#7C3AED]/40 text-[#C4B5FD] hover:bg-[#7C3AED]/30"
          : wa
            ? "bg-[#25D366]/15 border-[#25D366]/30 text-[#4ADE80] hover:bg-[#25D366]/25"
            : fb
              ? "bg-[#1877F2]/15 border-[#1877F2]/30 text-[#93C5FD] hover:bg-[#1877F2]/25"
              : ig
                ? "bg-[#EC4899]/15 border-[#EC4899]/30 text-[#F9A8D4] hover:bg-[#EC4899]/25"
                : "bg-white/[0.05] border-white/[0.09] text-[#CBD5E1] hover:text-white hover:bg-white/[0.09]"
      }`}
    >
      <Icon size={14} className={spin ? "animate-spin" : undefined} />
      {label}
    </button>
  );
}

function WhatsAppIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.66 15.01L2 22l5.13-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.04.77.8-2.96-.2-.31A8.2 8.2 0 1 1 12 20.2Zm4.5-6.13c-.25-.12-1.46-.72-1.68-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.19-.53.06a6.68 6.68 0 0 1-1.97-1.21 7.4 7.4 0 0 1-1.36-1.7c-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.6.19 1.13.16 1.56.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}

function FacebookIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function InstagramIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Small helper so callers can read back what the sheet supports without
// importing internals (used by feature flag-ish UI decisions).
export const ShareSheetCapabilities = { Check };
