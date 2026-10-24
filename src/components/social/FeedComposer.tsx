"use client";

/**
 * Inline quick composer for the top of the main feed — "What's on your heart?".
 *
 * Text-first quick posting (the full media composer stays available via the
 * photo/video button). Faith post-type chips stamp a shared hashtag onto the
 * caption (#prayerrequest, #testimony, #verse, #question, #announcement) so
 * every post type becomes instantly discoverable through Explore hashtag
 * grids and the Trending feed — no schema changes required.
 */

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  HeartHandshake,
  HelpCircle,
  Images,
  Megaphone,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Post } from "./types";
import { api } from "./types";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";

type Props = {
  onPosted: (post: Post) => void;
  onOpenFull: () => void;
};

type Viewer = { name: string | null; image: string | null; username: string | null };

const KINDS = [
  { id: "prayer", label: "Prayer Request", icon: HeartHandshake, tag: "#prayerrequest" },
  { id: "testimony", label: "Testimony", icon: Sparkles, tag: "#testimony" },
  { id: "verse", label: "Verse Reflection", icon: BookOpen, tag: "#verse" },
  { id: "question", label: "Faith Question", icon: HelpCircle, tag: "#question" },
  { id: "announce", label: "Announcement", icon: Megaphone, tag: "#announcement" },
] as const;

const MAX_LEN = 2200;

export default function FeedComposer({ onPosted, onOpenFull }: Props) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<Viewer & Record<string, unknown>>("/api/auth/me")
      .then((d) => setViewer((d as { user?: Viewer }).user ?? d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) areaRef.current?.focus();
  }, [open]);

  function toggleKind(tag: string) {
    setText((prev) => {
      const has = prev.toLowerCase().includes(tag);
      if (has) {
        return prev
          .replace(new RegExp(`\\s*${tag}`, "ig"), "")
          .replace(/\s{2,}/g, " ")
          .trimEnd();
      }
      const base = prev.trimEnd();
      return base ? `${base} ${tag}` : `${tag} `;
    });
  }

  async function submit() {
    const content = text.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const data = await api<{ post: Post }>("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mediaType: "text" }),
      });
      onPosted(data.post);
      toast.success("Shared with the Koino family");
      setText("");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Could not post right now");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-3 md:p-4 mb-4">
      {!open ? (
        <div className="flex items-center gap-3">
          {viewer?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewer.image} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {(viewer?.name || viewer?.username || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            className="flex-1 text-left px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-[#94A3B8] hover:border-[#7C3AED]/40 hover:text-white transition-all"
          >
            What&apos;s on your heart?
          </button>
          <button
            onClick={onOpenFull}
            title="Share photos, a Reel or a video"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-[#94A3B8] hover:text-white hover:border-[#7C3AED]/40 transition-all"
          >
            <Images size={15} /> <span className="hidden sm:inline">Photo · Reel · Video</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
              {viewer?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.image} alt="" className="w-full h-full object-cover" />
              ) : (
                (viewer?.name || viewer?.username || "?").charAt(0).toUpperCase()
              )}
            </div>
            <textarea
              ref={areaRef}
              value={text}
              maxLength={MAX_LEN}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
              rows={3}
              placeholder="What's on your heart? Share a prayer, testimony, verse or question…"
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-white placeholder:text-[#64748B] py-1.5"
            />
            <button
              onClick={() => { setOpen(false); setText(""); }}
              className="text-[#64748B] hover:text-white transition-colors"
              aria-label="Close composer"
            >
              <X size={18} />
            </button>
          </div>

          {/* faith post-type chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2 pl-12">
            {KINDS.map(({ id, label, icon: Icon, tag }) => {
              const active = text.toLowerCase().includes(tag);
              return (
                <button
                  key={id}
                  onClick={() => toggleKind(tag)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                    active
                      ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]"
                      : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8] hover:text-white hover:border-[#7C3AED]/40"
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pl-12">
            <EmojiPickerButton
              align="left"
              onPick={(e) => insertAtCursor(areaRef.current, e, setText, MAX_LEN)}
            />
            <div className="flex items-center gap-3">
              <span className={`text-[11px] ${text.length > MAX_LEN - 200 ? "text-[#F87171]" : "text-[#64748B]"}`}>
                {text.length}/{MAX_LEN}
              </span>
              <button
                onClick={submit}
                disabled={!text.trim() || posting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#7C3AED] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#6D28D9] transition-colors"
              >
                {posting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
