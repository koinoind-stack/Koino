"use client";

/**
 * Inline quick composer for the top of the main feed — approved design:
 * avatar + "What's on your mind today?", then a control row with quick
 * language pills (EN / हिन्दी / తెలుగు — the real UI-language switcher),
 * image / poll / emoji / location controls and the orange Post button.
 *
 * Text-first quick posting (the full media composer stays available via the
 * image button). Faith post-type chips stamp a shared hashtag onto the
 * caption (#prayerrequest, #testimony, #verse, #question, #announcement) so
 * every post type becomes instantly discoverable through Explore hashtag
 * grids and the Trending feed — no schema changes required.
 *
 * Poll and location have no backing API yet — they render as disabled
 * "coming soon" affordances rather than fake flows (no mock APIs).
 */

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  HeartHandshake,
  HelpCircle,
  Images,
  MapPin,
  Megaphone,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Post } from "./types";
import { api } from "./types";
import { LANGUAGES, useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";

type Props = {
  onPosted: (post: Post) => void;
  onOpenFull: () => void;
};

type Viewer = { name: string | null; image: string | null; username: string | null };

// Label is an i18n key — resolved with t() at render time so language
// switches re-render (never call t() at module scope).
const KINDS = [
  { id: "prayer", labelKey: "feed.kind.prayer", icon: HeartHandshake, tag: "#prayerrequest" },
  { id: "testimony", labelKey: "feed.kind.testimony", icon: Sparkles, tag: "#testimony" },
  { id: "verse", labelKey: "feed.kind.verse", icon: BookOpen, tag: "#verse" },
  { id: "question", labelKey: "feed.kind.question", icon: HelpCircle, tag: "#question" },
  { id: "announce", labelKey: "feed.kind.announce", icon: Megaphone, tag: "#announcement" },
] as const;

const MAX_LEN = 2200;

/** Quick language pills on the composer (approved design): English, Hindi,
 *  Telugu — wired to the REAL UI-language system, not a post field. */
const QUICK_LANG_CODES = ["en", "hi", "te"] as const;

export default function FeedComposer({ onPosted, onOpenFull }: Props) {
  const t = useTranslation();
  const { lang, setLang } = useLanguage();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const quickLangs = QUICK_LANG_CODES
    .map((code) => LANGUAGES.find((l) => l.code === code))
    .filter((l): l is (typeof LANGUAGES)[number] => Boolean(l));

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
      toast.success(t("feed.shared"));
      setText("");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || t("feed.errorPost"));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-[#0F2038]/60 border border-white/[0.05] rounded-2xl p-3 md:p-4 mb-4">
      {!open ? (
        <div>
          {/* Row 1 — avatar + prompt (approved copy: "What's on your mind today?") */}
          <div className="flex items-center gap-3">
            {viewer?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.image} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white font-bold text-sm shrink-0">
                {(viewer?.name || viewer?.username || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => setOpen(true)}
              className="flex-1 text-left text-sm text-[#94A3B8] hover:text-white transition-colors"
            >
              {t("feed.whatsOnYourHeart")}
            </button>
          </div>

          {/* Row 2 — quick languages · media controls · orange Post */}
          <div className="flex items-center gap-1.5 mt-3 pl-12 flex-wrap">
            {quickLangs.map((l) => {
              const active = lang === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  aria-pressed={active}
                  title={l.name}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all ${
                    active
                      ? "bg-[#2563EB] text-white shadow-[0_0_14px_rgba(37,99,235,0.4)]"
                      : "bg-white/[0.06] text-[#94A3B8] hover:text-white hover:bg-white/[0.1]"
                  }`}
                >
                  {l.code === "en" ? "EN" : l.nativeName}
                </button>
              );
            })}
            <span aria-hidden className="w-px h-5 bg-white/[0.09] mx-1" />
            <button
              onClick={onOpenFull}
              title={t("feed.openFullTitle")}
              aria-label={t("feed.openFullTitle")}
              className="p-2 rounded-full text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Images size={17} />
            </button>
            <button
              disabled
              aria-disabled
              title={t("composer.comingSoon")}
              className="p-2 rounded-full text-[#94A3B8] opacity-40 cursor-not-allowed"
            >
              <BarChart3 size={17} />
            </button>
            <EmojiPickerButton
              align="left"
              onPick={(e) => {
                setOpen(true);
                setText((prev) => (prev ? `${prev}${e}` : e));
              }}
            />
            <button
              disabled
              aria-disabled
              title={t("composer.comingSoon")}
              className="p-2 rounded-full text-[#94A3B8] opacity-40 cursor-not-allowed"
            >
              <MapPin size={17} />
            </button>
            <div className="flex-1 min-w-[8px]" />
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center px-6 py-2 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white text-sm font-extrabold shadow-[0_6px_20px_rgba(249,115,22,0.4)] hover:shadow-[0_6px_26px_rgba(249,115,22,0.6)] hover:from-[#EA580C] hover:to-[#F97316] transition-all"
            >
              {t("feed.postButton")}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
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
              placeholder={t("feed.placeholder")}
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-white placeholder:text-[#64748B] py-1.5"
            />
            <button
              onClick={() => { setOpen(false); setText(""); }}
              className="text-[#64748B] hover:text-white transition-colors"
              aria-label={t("composer.closeAria")}
            >
              <X size={18} />
            </button>
          </div>

          {/* faith post-type chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2 pl-12">
            {KINDS.map(({ id, labelKey, icon: Icon, tag }) => {
              const active = text.toLowerCase().includes(tag);
              return (
                <button
                  key={id}
                  onClick={() => toggleKind(tag)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                    active
                      ? "bg-[#2563EB]/20 border-[#2563EB]/60 text-[#93C5FD]"
                      : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8] hover:text-white hover:border-[#2563EB]/40"
                  }`}
                >
                  <Icon size={13} /> {t(labelKey)}
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
                className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white text-sm font-extrabold disabled:opacity-40 disabled:cursor-not-allowed hover:from-[#EA580C] hover:to-[#F97316] transition-all"
              >
                {posting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                {t("feed.postButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
