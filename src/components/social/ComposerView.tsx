"use client";

/**
 * Full media composer — three explicit post types on top of the existing
 * signed-URL upload pipeline (no new upload system):
 *
 *   Photo  — up to 10 images (≤10 MB each), previews, remove before sharing
 *   Reel   — 1 short vertical video (≤90 s, ≤100 MB) → isReel post; surfaces
 *            in the existing Reels feed, Watch tab and Explore Reels tab
 *   Video  — 1 longer video (≤15 min, ≤100 MB) → regular feed card with an
 *            inline normal player
 *
 * Duration/aspect are probed client-side (metadata only). Sizes and types are
 * enforced again by /api/social/upload-url before any byte moves, and the
 * publish API re-validates counts, extensions and storage namespace — so a
 * cancelled or failed upload can never create a broken post (the post row is
 * created only after every file uploaded successfully).
 */

import { useEffect, useRef, useState } from "react";
import { X, Video, Images, Trash2, Clapperboard, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { api } from "./types";
import { captureVideoPoster, probeVideo, aspectRatioLabel } from "@/lib/social/format";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";

type Props = {
  onClose: () => void;
  onPosted: () => void;
};

type Mode = "photo" | "reel" | "video";

type Item = {
  file: File;
  preview: string;
  poster: string | null;
  progress: number;
  publicUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
};

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB — matches upload-url server cap
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB — matches upload-url server cap
const MAX_REEL_SECONDS = 90; // short vertical reels
const MAX_VIDEO_SECONDS = 900; // 15 min for longer video posts

const MODES: { id: Mode; label: string; icon: typeof Images; hint: string }[] = [
  { id: "photo", label: "Photo", icon: Images, hint: `Up to ${MAX_IMAGES} images · JPG, PNG, WEBP · ≤10 MB each` },
  { id: "reel", label: "Reel", icon: Clapperboard, hint: `1 vertical video · ≤${MAX_REEL_SECONDS}s · ≤100 MB · MP4, WebM, MOV` },
  { id: "video", label: "Video", icon: Video, hint: `1 video up to ${MAX_VIDEO_SECONDS / 60} min · ≤100 MB · MP4, WebM, MOV` },
];

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function ComposerView({ onClose, onPosted }: Props) {
  const [mode, setMode] = useState<Mode>("photo");
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const xhrsRef = useRef<Set<XMLHttpRequest>>(new Set());

  const videoItem = items.find((i) => i.file.type.startsWith("video/"));
  const imageItems = items.filter((i) => !i.file.type.startsWith("video/"));

  // Cancel any in-flight uploads when the composer closes — the post row is
  // only created after ALL uploads finish, so closing mid-upload can never
  // leave a broken post behind.
  useEffect(
    () => () => {
      xhrsRef.current.forEach((x) => x.abort());
      xhrsRef.current.clear();
      setItems((prev) => {
        prev.forEach((i) => URL.revokeObjectURL(i.preview));
        return prev;
      });
    },
    [],
  );

  function patchItem(preview: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((p) => (p.preview === preview ? { ...p, ...patch } : p)));
  }

  /** Read image intrinsic size for a true aspectRatio on the post. */
  function probeImage(preview: string) {
    const img = new Image();
    const t = setTimeout(() => (img.src = ""), 6000);
    img.onload = () => {
      clearTimeout(t);
      if (img.naturalWidth && img.naturalHeight)
        patchItem(preview, { width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => clearTimeout(t);
    img.src = preview;
  }

  /** Read video duration + dimensions; enforce the active mode's duration cap. */
  async function probeAndValidateVideo(item: Item, activeMode: Mode) {
    const meta = await probeVideo(item.file);
    if (!meta) return; // unreadable metadata — size/type checks still apply
    const cap = activeMode === "reel" ? MAX_REEL_SECONDS : MAX_VIDEO_SECONDS;
    if (meta.duration > cap) {
      setItems((prev) => {
        URL.revokeObjectURL(item.preview);
        return prev.filter((p) => p.preview !== item.preview);
      });
      toast.error(
        activeMode === "reel"
          ? `Reels must be ${MAX_REEL_SECONDS} seconds or shorter — this one is ${fmtDuration(meta.duration)}. Trim it, or switch to the Video option.`
          : `Video posts can be up to ${MAX_VIDEO_SECONDS / 60} minutes — this one is ${fmtDuration(meta.duration)}.`,
      );
      return;
    }
    if (activeMode === "reel" && meta.width >= meta.height) {
      toast("Heads up: this video is landscape — Reels look best vertical (9:16)");
    }
    patchItem(item.preview, {
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      poster: null,
    });
    captureVideoPoster(item.file).then((poster) => poster && patchItem(item.preview, { poster }));
  }

  function addFiles(files: FileList | File[]) {
    const list = [...files];
    for (const f of list) {
      const isVideo = f.type.startsWith("video/");
      if (isVideo) {
        if (f.size > MAX_VIDEO_SIZE) {
          toast.error("Video must be smaller than 100 MB");
          continue;
        }
        if (!VIDEO_EXT.test(f.name) && !VIDEO_MIME.includes(f.type)) {
          toast.error("Supported video formats: MP4, WebM, MOV");
          continue;
        }
        setItems((prev) => {
          const hadImages = prev.some((i) => !i.file.type.startsWith("video/"));
          if (hadImages) toast("Photos removed — a post is either photos or one video");
          const nextMode: Mode = mode === "photo" ? "video" : mode;
          setMode(nextMode);
          const item: Item = { file: f, preview: URL.createObjectURL(f), poster: null, progress: 0 };
          void probeAndValidateVideo(item, nextMode);
          return [item];
        });
      } else {
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
          toast.error(`${f.name}: only JPG, PNG, WEBP are supported`);
          continue;
        }
        if (f.size > MAX_IMAGE_SIZE) {
          toast.error(`${f.name}: images must be smaller than 10 MB`);
          continue;
        }
        setItems((prev) => {
          if (prev.length >= MAX_IMAGES) {
            toast.error(`Up to ${MAX_IMAGES} images per post`);
            return prev;
          }
          const hadVideo = prev.some((i) => i.file.type.startsWith("video/"));
          if (hadVideo) toast("Video removed — a post is either photos or one video");
          if (mode !== "photo") setMode("photo");
          const preview = URL.createObjectURL(f);
          const item: Item = { file: f, preview, poster: null, progress: 0 };
          probeImage(preview);
          return [...prev.filter((i) => !i.file.type.startsWith("video/")), item];
        });
      }
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    // Switching mode clears incompatible media so previews always match
    // what will actually be published.
    setItems((prev) => {
      if (next === "photo") {
        const hadVideo = prev.some((i) => i.file.type.startsWith("video/"));
        if (hadVideo) toast("Video removed");
        prev.forEach((i) => i.file.type.startsWith("video/") && URL.revokeObjectURL(i.preview));
        return prev.filter((i) => !i.file.type.startsWith("video/"));
      }
      const hadImages = prev.some((i) => !i.file.type.startsWith("video/"));
      if (hadImages) toast("Photos removed");
      prev.forEach((i) => !i.file.type.startsWith("video/") && URL.revokeObjectURL(i.preview));
      return prev.filter((i) => i.file.type.startsWith("video/"));
    });
  }

  function removeItem(item: Item) {
    URL.revokeObjectURL(item.preview);
    setItems((prev) => prev.filter((p) => p.preview !== item.preview));
  }

  /** Signed-URL direct PUT to Supabase Storage with real progress events. */
  async function uploadBlob(blob: Blob, kind: "image" | "video"): Promise<string> {
    const urlRes = await api<{ uploadUrl: string; publicUrl: string }>("/api/social/upload-url", {
      method: "POST",
      body: JSON.stringify({ contentType: blob.type, size: blob.size, kind }),
    });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrsRef.current.add(xhr);
      const done = () => xhrsRef.current.delete(xhr);
      xhr.open("PUT", urlRes.uploadUrl);
      xhr.onload = () => {
        done();
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status}) — nothing was published`));
      };
      xhr.onerror = () => {
        done();
        reject(new Error("Upload failed — check your connection and try again"));
      };
      xhr.onabort = () => {
        done();
        reject(new Error("Upload cancelled — nothing was published"));
      };
      xhr.send(blob);
    });
    return urlRes.publicUrl;
  }

  async function uploadOne(item: Item): Promise<string> {
    return uploadBlob(item.file, item.file.type.startsWith("video/") ? "video" : "image");
  }

  async function submit() {
    if (posting) return;
    if (items.length === 0 && !caption.trim()) {
      toast.error("Add a caption, photo, or video first");
      return;
    }
    if (mode !== "photo" && !videoItem) {
      toast.error(mode === "reel" ? "Add a short video to share a Reel" : "Add a video to share");
      return;
    }
    setPosting(true);
    try {
      // Upload everything that hasn't been uploaded yet. If ANY upload fails,
      // we bail here — no post row is ever created with partial media.
      const uploaded: string[] = [];
      let poster: string | null = videoItem?.poster ?? null;
      for (const item of items) {
        const url = item.publicUrl ?? (await uploadOne(item));
        uploaded.push(url);
      }
      if (videoItem && !poster) {
        poster = videoItem.poster ?? (await captureVideoPoster(videoItem.file));
      }
      // Upload the client-captured poster through the same signed-URL
      // pipeline so thumbnailUrl is a durable Storage URL — data: URLs are
      // huge feed payloads and got silently truncated server-side before.
      if (poster?.startsWith("data:")) {
        try {
          const blob = await (await fetch(poster)).blob();
          if (blob.size > 0 && blob.size <= MAX_IMAGE_SIZE) poster = await uploadBlob(blob, "image");
        } catch {
          // Poster is cosmetic — never block the post over it.
        }
      }

      const hasVideo = !!videoItem;
      const hasImages = imageItems.length > 0;
      const aspect = hasVideo
        ? videoItem!.width && videoItem!.height
          ? aspectRatioLabel(videoItem!.width, videoItem!.height)
          : mode === "reel"
            ? "9:16"
            : "16:9"
        : hasImages
          ? imageItems[0].width && imageItems[0].height
            ? aspectRatioLabel(imageItems[0].width, imageItems[0].height)
            : "4:5"
          : null;

      await api("/api/social/posts", {
        method: "POST",
        body: JSON.stringify({
          content: caption.trim() || null,
          mediaType: hasVideo ? "video" : hasImages ? "image" : "text",
          mediaUrls: uploaded,
          thumbnailUrl: poster,
          aspectRatio: aspect,
          isReel: hasVideo && mode === "reel",
        }),
      });
      toast.success(hasVideo && mode === "reel" ? "Reel shared! Find it in Watch & Explore" : "Post shared!");
      onPosted();
    } catch (err) {
      toast.error((err as Error).message || "Could not share — try again");
      setPosting(false);
    }
  }

  const overallProgress =
    items.length === 0 ? 0 : Math.round(items.reduce((a, p) => a + p.progress, 0) / items.length);
  const canShare = !posting && (items.length > 0 || !!caption.trim());
  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-extrabold text-white">Create post</h1>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5" aria-label="Close composer">
          <X size={18} className="text-[#94A3B8]" />
        </button>
      </div>

      {/* ─── post type picker ─── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchMode(id)}
            disabled={posting}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold border transition-all disabled:opacity-50 ${
              mode === id
                ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-white"
                : "bg-white/[0.03] border-white/[0.07] text-[#94A3B8] hover:text-white hover:border-[#7C3AED]/40"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ─── drop zone ─── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => !posting && inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all mb-4 ${
          dragOver ? "border-[#7C3AED] bg-[#7C3AED]/10" : "border-white/15 hover:border-white/30"
        }`}
      >
        <div className="flex items-center justify-center gap-3 text-[#94A3B8]">
          {mode === "photo" ? (
            <Images size={22} />
          ) : mode === "reel" ? (
            <Smartphone size={22} />
          ) : (
            <Video size={22} />
          )}
        </div>
        <p className="text-sm font-bold text-white mt-2.5">
          {mode === "photo" ? "Tap to choose photos or drag them here" : mode === "reel" ? "Tap to choose a short vertical video" : "Tap to choose a video or drag it here"}
        </p>
        <p className="text-[11px] text-[#64748B] mt-1">{activeMode.hint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple={mode === "photo"}
          accept={mode === "photo" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm,video/quicktime"}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
      </div>

      {/* ─── previews ─── */}
      {videoItem && (
        <div className="relative w-44 mx-auto rounded-2xl overflow-hidden bg-black/60 border border-white/10 mb-4"
          style={{ aspectRatio: videoItem.width && videoItem.height ? `${videoItem.width}/${videoItem.height}` : "9/16" }}>
          {videoItem.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={videoItem.poster} alt="" className="w-full h-full object-cover" />
          ) : (
            <video src={videoItem.preview} muted playsInline preload="metadata" className="w-full h-full object-cover" />
          )}
          {videoItem.duration !== undefined && (
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[11px] font-bold text-white">
              {fmtDuration(videoItem.duration)}
            </span>
          )}
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7C3AED]/80 text-[10px] font-extrabold uppercase tracking-wide text-white">
            <Clapperboard size={10} /> {mode === "reel" ? "Reel" : "Video"}
          </span>
          {videoItem.progress > 0 && videoItem.progress < 100 && (
            <>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div className="h-full bg-[#7C3AED] transition-all" style={{ width: `${videoItem.progress}%` }} />
              </div>
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/70 text-[10px] font-bold text-white">
                {videoItem.progress}%
              </span>
            </>
          )}
          <button
            onClick={() => removeItem(videoItem)}
            disabled={posting}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/70 transition-colors disabled:opacity-40"
            aria-label="Remove video"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {imageItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {imageItems.map((item) => (
            <div key={item.preview} className="relative aspect-square rounded-xl overflow-hidden bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt="" className="w-full h-full object-cover" />
              {item.progress > 0 && item.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-[#7C3AED] transition-all" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              <button
                onClick={() => removeItem(item)}
                disabled={posting}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/70 transition-colors disabled:opacity-40"
                aria-label="Remove photo"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── caption (hashtags / mentions / Bible references parse server-side) ─── */}
      <textarea
        ref={captionRef}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={4}
        maxLength={2200}
        placeholder="Write a caption… use #hashtags, @mentions, and Bible references like John 3:16"
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-sm text-white resize-none focus:outline-none focus:border-[#7C3AED]"
      />
      <div className="flex items-center justify-between mt-1.5">
        <EmojiPickerButton
          align="left"
          onPick={(e) => insertAtCursor(captionRef.current, e, setCaption, 2200)}
        />
        <p className="text-[10px] text-[#64748B]">{caption.length}/2200</p>
      </div>

      {/* ─── destination info (replaces the old opt-in checkbox — mode decides) ─── */}
      {videoItem && (
        <div className="flex items-center gap-3 mt-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
          {mode === "reel" ? <Clapperboard size={18} className="text-[#C4B5FD] shrink-0" /> : <Video size={18} className="text-[#C4B5FD] shrink-0" />}
          <p className="text-xs text-[#94A3B8]">
            {mode === "reel"
              ? "Will be shared as a Reel — it appears in the full-screen vertical player, the Watch tab and Explore → Reels."
              : "Will be shared as a video post in the community feed with an inline player (up to 15 minutes)."}
          </p>
        </div>
      )}

      <button
        onClick={submit}
        disabled={!canShare}
        className="w-full mt-5 py-3.5 rounded-2xl bg-[#7C3AED] text-white font-extrabold disabled:opacity-40 shadow-[0_0_30px_rgba(124,58,237,0.3)]"
      >
        {posting
          ? items.length > 0 && overallProgress < 100
            ? `Uploading… ${overallProgress}%`
            : "Sharing…"
          : videoItem && mode === "reel"
            ? "Share Reel"
            : "Share"}
      </button>
    </div>
  );
}
