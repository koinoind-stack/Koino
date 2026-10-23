"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus, X, Send } from "lucide-react";
import { toast } from "sonner";
import type { StoryGroup } from "./types";
import { api } from "./types";
import { timeAgo } from "@/lib/social/format";

type BarProps = {
  groups: StoryGroup[];
  onOpen: (username: string) => void;
  onCreate: () => void;
  onOpenProfile: (username: string) => void;
};

/** Horizontal story rings: "Your story" + everyone else (unseen first). */
export function StoryBar({ groups, onOpen, onCreate, onOpenProfile }: BarProps) {
  const mine = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {/* your story */}
      <div className="shrink-0 flex flex-col items-center gap-1.5">
        {mine ? (
          <button
            onClick={() => mine.user.username && onOpen(mine.user.username)}
            className={`w-16 h-16 rounded-full p-[3px] ${mine.allSeen ? "bg-white/15" : "bg-gradient-to-tr from-[#7C3AED] via-[#EC4899] to-[#F59E0B]"}`}
          >
            <div className="w-full h-full rounded-full p-[2px] bg-[#12101A]">
              {mine.user.image ? (
                <Image src={mine.user.image} alt="" width={56} height={56} className="w-full h-full rounded-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full rounded-full bg-[#1C1929] flex items-center justify-center text-white font-bold">
                  {(mine.user.name || mine.user.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </button>
        ) : (
          <button
            onClick={onCreate}
            className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center hover:border-[#7C3AED]"
          >
            <Plus size={22} className="text-[#94A3B8]" />
          </button>
        )}
        <button onClick={mine ? () => onCreate() : onCreate} className="text-[10px] font-bold text-[#94A3B8] hover:text-white">
          Your story
        </button>
      </div>
      {/* others */}
      {others.map((g) => (
        <div key={g.user.id} className="shrink-0 flex flex-col items-center gap-1.5">
          <button
            onClick={() => g.user.username && onOpen(g.user.username)}
            className={`w-16 h-16 rounded-full p-[3px] ${g.allSeen ? "bg-white/15" : "bg-gradient-to-tr from-[#7C3AED] via-[#EC4899] to-[#F59E0B]"}`}
          >
            <div className="w-full h-full rounded-full p-[2px] bg-[#12101A]">
              {g.user.image ? (
                <Image src={g.user.image} alt="" width={56} height={56} className="w-full h-full rounded-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full rounded-full bg-[#1C1929] flex items-center justify-center text-white font-bold">
                  {(g.user.name || g.user.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </button>
          <button
            onClick={() => g.user.username && onOpenProfile(g.user.username)}
            className="text-[10px] font-bold text-[#94A3B8] hover:text-white max-w-[64px] truncate"
          >
            {g.user.username}
          </button>
        </div>
      ))}
    </div>
  );
}

type ViewerProps = {
  groups: StoryGroup[];
  startUsername: string;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
};

/** Full-screen story viewer: progress bars, tap zones, reply box. */
export function StoryViewer({ groups, startUsername, onClose, onOpenProfile }: ViewerProps) {
  const startIdx = Math.max(groups.findIndex((g) => g.user.username === startUsername), 0);
  const [groupIdx, setGroupIdx] = useState(startIdx);
  const [itemIdx, setItemIdx] = useState(0);
  const [reply, setReply] = useState("");
  const [paused, setPaused] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const group = groups[groupIdx];
  const item = group?.items[itemIdx];

  // Mark viewed + advance timer
  useEffect(() => {
    if (!item) return;
    api(`/api/social/stories/${item.id}`, { method: "POST", body: JSON.stringify({}) }).catch(() => {});
    setPaused(false);
    if (progressRef.current) {
      progressRef.current.style.transition = "none";
      progressRef.current.style.width = "0%";
      requestAnimationFrame(() => {
        if (progressRef.current) {
          progressRef.current.style.transition = item.mediaType === "video" ? "width 15s linear" : "width 5s linear";
          progressRef.current.style.width = "100%";
        }
      });
    }
    const timer = setTimeout(() => next(), item.mediaType === "video" ? 15000 : 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, itemIdx]);

  function next() {
    if (!group) return onClose();
    if (itemIdx < group.items.length - 1) return setItemIdx((i) => i + 1);
    if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setItemIdx(0);
      return;
    }
    onClose();
  }

  function prev() {
    if (itemIdx > 0) return setItemIdx((i) => i - 1);
    if (groupIdx > 0) {
      setGroupIdx((g) => g - 1);
      setItemIdx(0);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !item) return;
    try {
      await api(`/api/social/stories/${item.id}`, { method: "POST", body: JSON.stringify({ reply: reply.trim() }) });
      toast.success("Reply sent");
      setReply("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!group || !item) return null;

  return (
    <div className="fixed inset-0 z-[75] bg-black flex flex-col">
      {/* progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {group.items.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/25 rounded overflow-hidden">
            <div
              ref={i === itemIdx ? progressRef : null}
              className={`h-full bg-white ${i < itemIdx ? "w-full" : ""}`}
            />
          </div>
        ))}
      </div>
      {/* user row */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button onClick={() => group.user.username && onOpenProfile(group.user.username)} className="flex items-center gap-2.5">
          {group.user.image ? (
            <Image src={group.user.image} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" unoptimized />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white text-xs font-bold">
              {(group.user.name || group.user.username || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-white text-sm font-bold">{group.user.username}</span>
          <span className="text-white/50 text-xs">{timeAgo(item.createdAt)}</span>
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="p-2 text-white/80 hover:text-white">
          <X size={22} />
        </button>
      </div>
      {/* media + tap zones */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}>
        {item.mediaType === "video" ? (
          <video src={item.mediaUrl} autoPlay muted playsInline className="max-h-full max-w-full object-contain" />
        ) : (
          <Image src={item.mediaUrl} alt="" fill sizes="100vw" className="object-contain" unoptimized />
        )}
        <button onClick={prev} className="absolute left-0 top-0 bottom-10 w-1/3" aria-label="previous" />
        <button onClick={next} className="absolute right-0 top-0 bottom-10 w-1/3" aria-label="next" />
        {item.caption && (
          <p className="absolute bottom-28 left-4 right-4 text-white text-center text-sm drop-shadow-lg">{item.caption}</p>
        )}
      </div>
      {/* reply */}
      {!item.isMine && (
        <div className="p-3 flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendReply()}
            onFocus={() => setPaused(true)}
            placeholder="Reply to story…"
            className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none"
          />
          <button onClick={sendReply} className="w-10 h-10 rounded-full bg-[#7C3AED] flex items-center justify-center text-white">
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

type CreatorProps = { onClose: () => void; onPosted: () => void };

/** Story creator: pick image/video → optional caption → upload with progress. */
export function StoryCreator({ onClose, onPosted }: CreatorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function uploadAndPost() {
    if (!file) return;
    setUploading(true);
    try {
      const kind = file.type.startsWith("video/") ? "story-video" : "story-image";
      const urlRes = await api<{ uploadUrl: string; publicUrl: string }>("/api/social/upload-url", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type, size: file.size, kind }),
      });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", urlRes.uploadUrl);
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });
      await api("/api/social/stories", {
        method: "POST",
        body: JSON.stringify({
          mediaUrl: urlRes.publicUrl,
          mediaType: file.type.startsWith("video/") ? "video" : "image",
          caption: caption.trim() || null,
        }),
      });
      toast.success("Story shared");
      onPosted();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[75] bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-white font-extrabold">New story</h2>
        <button onClick={onClose} className="p-2 text-white/80"><X size={22} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        {preview ? (
          file?.type.startsWith("video/") ? (
            <video src={preview} controls muted className="max-h-full max-w-full rounded-2xl" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
          )
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-64 h-64 rounded-3xl border-2 border-dashed border-white/25 flex flex-col items-center justify-center gap-3 text-white/60 hover:border-[#7C3AED]"
          >
            <Plus size={36} />
            <span className="text-sm font-bold">Choose a photo or video</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="p-4 space-y-3">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          maxLength={200}
          className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7C3AED]"
        />
        {uploading && (
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#7C3AED] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <button
          onClick={uploadAndPost}
          disabled={!file || uploading}
          className="w-full py-3.5 rounded-2xl bg-[#7C3AED] text-white font-extrabold disabled:opacity-40"
        >
          {uploading ? `Uploading… ${progress}%` : "Share to story"}
        </button>
      </div>
    </div>
  );
}

export default StoryBar;
