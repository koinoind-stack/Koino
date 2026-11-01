"use client";

/**
 * Koino emoji picker — one shared control wired into every user-authored
 * text field (feed quick composer, full-post caption, comments + replies,
 * group posts, caption edit, story replies/captions, group form, profile bio).
 *
 * Design:
 *   - Curated Christian categories (Faith / Prayer & Blessings / Worship &
 *     Music) are plain standard-Unicode grids — no image assets, no database.
 *   - "All Emojis" renders emoji-picker-react (maintained library): built-in
 *     search, dark theme, native glyph rendering, lazy-loaded chunk. Its
 *     Smileys & People category is renamed "Feelings" so the picker exposes
 *     exactly the five required groups: Christian Faith, Prayer & Blessings,
 *     Worship & Music, Feelings, All Emojis.
 *   - Closes on outside click or Escape; stays open while tapping emojis so
 *     several can be inserted in a row.
 *   - `insertAtCursor()` splices the emoji at the caret of a controlled
 *     input/textarea without touching surrounding text — hashtags, mentions
 *     and Bible references are unaffected.
 */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Smile } from "lucide-react";
import type { Categories } from "emoji-picker-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const Picker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => <div className="h-[320px] bg-[#111827] animate-pulse" />,
});

/** Christian Faith — symbols, places, the Word. */
const FAITH_EMOJIS = [
  "✝️", "☦️", "🛐", "⛪", "💒", "🕊️", "📖", "📜", "🕯️", "👑",
  "🌈", "⚓", "🍞", "🍷", "🐟", "🌿", "✨", "🤍", "❤️", "💛", "💜", "🧡",
];

/** Prayer & Blessings. */
const PRAYER_EMOJIS = [
  "🙏", "🙌", "🤲", "🧎", "🙇", "🕯️", "🌟", "💫", "✨", "🌅",
  "🌞", "🫶", "👏", "🌹", "🍃", "💝", "❤️‍🔥", "🕊️", "💚", "💙",
];

/** Worship & Music. */
const WORSHIP_EMOJIS = [
  "🎶", "🎵", "🎼", "🎤", "🎸", "🎹", "🎻", "🎺", "🥁", "🪘",
  "🎧", "🔊", "📻", "🙌", "👏", "💃", "🕺", "🎉", "✨", "🙏",
];

type EmojiTab = "faith" | "prayer" | "worship" | "all";

const TABS: { id: EmojiTab; label: string; icon: string }[] = [
  { id: "faith", label: "Faith", icon: "✝️" },
  { id: "prayer", label: "Prayer", icon: "🙏" },
  { id: "worship", label: "Worship", icon: "🎶" },
  { id: "all", label: "All", icon: "😀" },
];

const CURATED: Partial<Record<EmojiTab, string[]>> = {
  faith: FAITH_EMOJIS,
  prayer: PRAYER_EMOJIS,
  worship: WORSHIP_EMOJIS,
};

type Props = {
  /** Receives the picked emoji (already spliced into the field by the caller). */
  onPick: (emoji: string) => void;
  /** Popover opens above (bottom composers) or below the button. */
  direction?: "up" | "down";
  align?: "left" | "right";
  className?: string;
};

export default function EmojiPickerButton({
  onPick,
  direction = "down",
  align = "right",
  className = "",
}: Props) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<EmojiTab>("all");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / touch, and on Escape (req: close when clicking out).
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const curated = CURATED[tab];

  return (
    <div ref={wrapRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("social.emoji.addAria")}
        aria-expanded={open}
        title={t("social.emoji.title")}
        className="text-[#94A3B8] hover:text-[#C4B5FD] transition-colors p-1.5 rounded-full hover:bg-white/5"
      >
        <Smile size={18} />
      </button>

      {open && (
        <div
          className={`absolute ${direction === "up" ? "bottom-full mb-2" : "top-full mt-2"} ${
            align === "right" ? "right-0" : "left-0"
          } z-[60] w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#111827] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden`}
        >
          {/* category tabs — Christian categories first, then the full library */}
          <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 border-b border-white/[0.06] bg-white/[0.02]">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  tab === id
                    ? "bg-[#7C3AED]/25 text-white"
                    : "text-[#94A3B8] hover:text-white hover:bg-white/5"
                }`}
                title={`${label} emojis`}
              >
                <span className="text-[13px] leading-none">{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {curated ? (
            <div className="grid grid-cols-6 sm:grid-cols-7 gap-0.5 p-2.5 max-h-[248px] overflow-y-auto">
              {curated.map((e, i) => (
                <button
                  key={`${e}-${i}`}
                  type="button"
                  onClick={() => onPick(e)}
                  title=""
                  className="text-[26px] leading-none p-1.5 rounded-xl hover:bg-white/10 active:scale-90 transition-all"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <Picker
              onEmojiClick={(d) => onPick(d.emoji)}
              theme="dark"
              emojiStyle="native"
              lazyLoadEmojis
              searchDisabled={false}
              skinTonesDisabled={false}
              previewConfig={{ showPreview: false }}
              searchPlaceholder="Search emoji…"
              width="100%"
              height={316}
              categories={[
                { category: "smileys_people" as Categories, name: "Feelings" },
                "animals_nature" as Categories,
                "food_drink" as Categories,
                "travel_places" as Categories,
                "activities" as Categories,
                "objects" as Categories,
                "symbols" as Categories,
                "flags" as Categories,
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Splice `text` into a controlled input/textarea at the current caret
 * position (or replace the selection) without deleting surrounding text.
 * The caret is restored after React commits the new value; optional
 * maxLength mirrors the field's own cap so server limits stay honest.
 */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
  setValue: (v: string) => void,
  maxLength?: number,
) {
  if (!el) {
    setValue(text);
    return;
  }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  let next = el.value.slice(0, start) + text + el.value.slice(end);
  if (maxLength !== undefined && next.length > maxLength) next = next.slice(0, maxLength);
  setValue(next);
  const caret = Math.min(start + text.length, next.length);
  requestAnimationFrame(() => {
    el.focus();
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      // some inputs reject setSelectionRange — insertion still worked
    }
  });
}
