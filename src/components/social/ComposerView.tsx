"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Video, Images, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "./types";
import { captureVideoPoster } from "@/lib/social/format";

type Props = {
  onClose: () => void;
  onPosted: () => void;
};

type Item = {
  file: File;
  preview: string;
  poster: string | null;
  progress: number;
  publicUrl?: string;
};

const MAX_IMAGES = 10;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

/**
 * Post composer: up to 10 images OR one video, drag & drop, per-file upload
 * progress via signed URLs, client-captured video poster, "Share as Reel".
 */
export default function ComposerView({ onClose, onPosted }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [isReel, setIsReel] = useState(false);
  const [posting, setPosting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const videoItem = items.find((i) => i.file.type.startsWith("video/"));
  const imageItems = items.filter((i) => !i.file.type.startsWith("video/"));

  function addFiles(files: FileList | File[]) {
    const list = [...files];
    for (const f of list) {
      const isVideo = f.type.startsWith("video/");
      if (isVideo) {
        if (f.size > MAX_VIDEO_SIZE) {
          toast.error("Video must be smaller than 100 MB");
          continue;
        }
        if (!/\.(mp4|webm|mov|m4v)$/i.test(f.name) && !["video/mp4", "video/webm", "video/quicktime"].includes(f.type)) {
          toast.error("Supported video formats: MP4, WebM, MOV");
          continue;
        }
        setItems((prev) => {
          const withoutVideos = prev.filter((i) => !i.file.type.startsWith("video/"));
          const item: Item = { file: f, preview: URL.createObjectURL(f), poster: null, progress: 0 };
          captureVideoPoster(f).then((poster) => item.poster = poster);
          return [...withoutVideos, item];
        });
      } else {
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
          toast.error(`${f.name}: only JPG, PNG, WEBP are supported`);
          continue;
        }
        if (f.size > 10 * 1024 * 1024) {
          toast.error(`${f.name}: images must be smaller than 10 MB`);
          continue;
        }
        setItems((prev) => {
          if (prev.filter((i) => !i.file.type.startsWith("video/")).length >= MAX_IMAGES) {
            toast.error(`Up to ${MAX_IMAGES} images per post`);
            return prev;
          }
          return [...prev, { file: f, preview: URL.createObjectURL(f), poster: null, progress: 0 }];
        });
      }
    }
  }

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadOne(item: Item): Promise<string> {
    const isVideo = item.file.type.startsWith("video/");
    const urlRes = await api<{ uploadUrl: string; publicUrl: string }>("/api/social/upload-url", {
      method: "POST",
      body: JSON.stringify({
        contentType: item.file.type,
        size: item.file.size,
        kind: isVideo ? "video" : "image",
      }),
    });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", urlRes.uploadUrl);
      xhr.upload.onprogress = (e) =>
        e.lengthComputable &&
        setItems((prev) =>
          prev.map((p) => (p.preview === item.preview ? { ...p, progress: Math.round((e.loaded / e.total) * 100) } : p)),
        );
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(item.file);
    });
    return urlRes.publicUrl;
  }

  async function submit() {
    if (posting) return;
    if (items.length === 0 && !caption.trim()) {
      toast.error("Add a caption, photo, or video first");
      return;
    }
    setPosting(true);
    try {
      // Upload everything that hasn't been uploaded yet.
      const uploaded: string[] = [];
      let poster: string | null = videoItem?.poster ?? null;
      for (const item of items) {
        const url = item.publicUrl ?? (await uploadOne(item));
        uploaded.push(url);
        if (item.file.type.startsWith("video/") && !poster) {
          poster = await captureVideoPoster(item.file);
        }
      }
      const hasVideo = !!videoItem;
      const hasImages = imageItems.length > 0;

      await api("/api/social/posts", {
        method: "POST",
        body: JSON.stringify({
          content: caption.trim() || null,
          mediaType: hasVideo ? "video" : hasImages ? "image" : "text",
          mediaUrls: uploaded,
          thumbnailUrl: poster,
          aspectRatio: hasVideo ? "9:16" : "4:5",
          isReel: hasVideo && isReel,
        }),
      });
      toast.success(isReel && hasVideo ? "Reel shared!" : "Post shared!");
      onPosted();
    } catch (err) {
      toast.error((err as Error).message);
      setPosting(false);
    }
  }

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-extrabold text-white">Create post</h1>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5">
          <X size={18} className="text-[#94A3B8]" />
        </button>
      </div>

      {/* drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all mb-4 ${
          dragOver ? "border-[#7C3AED] bg-[#7C3AED]/10" : "border-white/15 hover:border-white/30"
        }`}
      >
        <div className="flex items-center justify-center gap-4 text-[#94A3B8]">
          <Images size={22} />
          <Video size={22} />
        </div>
        <p className="text-sm font-bold text-white mt-3">Drag photos or a video here</p>
        <p className="text-[11px] text-[#64748B] mt-1">
          Up to {MAX_IMAGES} images · or 1 video (≤100 MB, MP4/WebM/MOV)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* previews */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {items.map((item) => (
            <div key={item.preview} className="relative aspect-square rounded-xl overflow-hidden bg-black/40">
              {item.file.type.startsWith("video/") ? (
                <>
                  {item.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.poster} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <video src={item.preview} muted className="w-full h-full object-cover" />
                  )}
                  <Video size={16} className="absolute top-2 left-2 text-white" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview} alt="" className="w-full h-full object-cover" />
              )}
              {item.progress > 0 && item.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-[#7C3AED]" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              <button
                onClick={() => setItems((prev) => prev.filter((p) => p.preview !== item.preview))}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* caption */}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={4}
        maxLength={2200}
        placeholder="Write a caption… use #hashtags, @mentions, and Bible references like John 3:16"
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-sm text-white resize-none focus:outline-none focus:border-[#7C3AED]"
      />
      <p className="text-[10px] text-[#64748B] text-right mt-1">{caption.length}/2200</p>

      {/* reel toggle */}
      {videoItem && (
        <label className="flex items-center gap-3 mt-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 cursor-pointer">
          <input
            type="checkbox"
            checked={isReel}
            onChange={(e) => setIsReel(e.target.checked)}
            className="w-4 h-4 accent-[#7C3AED]"
          />
          <div>
            <p className="text-sm font-bold text-white">Share as a Reel</p>
            <p className="text-[11px] text-[#64748B]">Reels appear in the vertical video feed</p>
          </div>
        </label>
      )}

      <button
        onClick={submit}
        disabled={posting || (items.length === 0 && !caption.trim())}
        className="w-full mt-5 py-3.5 rounded-2xl bg-[#7C3AED] text-white font-extrabold disabled:opacity-40 shadow-[0_0_30px_rgba(124,58,237,0.3)]"
      >
        {posting ? "Sharing…" : "Share"}
      </button>
    </div>
  );
}
