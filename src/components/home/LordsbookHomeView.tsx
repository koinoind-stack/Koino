"use client";

/**
 * Lordsbook home — the centre column of the three-column layout.
 *
 * Structure (APPROVED DESIGN — "Lordsbook Christian Social Platform UI"):
 *   1. Hero banner — the sunrise-and-cross artwork with the horizontal
 *      shield+wordmark on top, heading "Faith. Fellowship. Community."
 *      (last word orange), description, orange "Get Started" + blue
 *      "Read the Bible" buttons, and the right-side "WHAT YOU CAN DO"
 *      glass panel (Read the Bible / Join Groups & Fellowships / Share
 *      Prayer Requests / Watch Christian Shorts / Explore Christian
 *      Marketplace).
 *   2. Feature cards — one row of six on desktop: Bible, Comic Bible,
 *      Bible Trivia, Groups, Churches, Marketplace. Each card navigates
 *      to its existing SPA view.
 *   3. The live feed below — the existing FeedView (post composer,
 *      For You / Following / Trending tabs, infinite scroll). Stories
 *      stay on the dedicated Feed view; the approved home shows the
 *      composer directly under the cards.
 *
 * No statistics, users or posts are fabricated: cards are navigation only,
 * and everything below the fold is the real feed. The tab labels come from
 * i18n (feed.tab.*) — "For You" is the Discover tab's display name.
 *
 * Hero artwork note: the approved design's sunrise-cross photograph was
 * NOT present in the project. public/brand/hero-sunrise-cross.png is a
 * generated stand-in matching the approved composition — swap the file to
 * replace it with the official asset (no code change needed).
 */

import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Church,
  HandHeart,
  MonitorPlay,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import FeedView from "@/components/social/FeedView";
import { BRAND } from "@/lib/brand";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Props = {
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onOpenCreate: () => void;
  onOpenEvents: () => void;
  /** Navigate to any existing SPA view (feature cards / hero actions). */
  onOpenView: (view: string) => void;
  deepLinkPostId?: string | null;
};

type FeatureCard = {
  view: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  /** Icon tint (approved design: blue book, orange comic, gold trophy,
      blue people, white church, gold bag). */
  color: string;
};

const FEATURE_CARDS: FeatureCard[] = [
  { view: "bible", icon: BookOpen, titleKey: "side.bible", descKey: "home.card.bible.desc", color: "text-[#60A5FA]" },
  { view: "comic", icon: Sparkles, titleKey: "side.comics", descKey: "home.card.comics.desc", color: "text-[#FB923C]" },
  { view: "trivia", icon: Trophy, titleKey: "side.trivia", descKey: "home.card.trivia.desc", color: "text-[#F5B84A]" },
  { view: "groups", icon: Users, titleKey: "side.groups", descKey: "home.card.groups.desc", color: "text-[#60A5FA]" },
  { view: "churches", icon: Church, titleKey: "side.churches", descKey: "home.card.churches.desc", color: "text-[#E2E8F0]" },
  { view: "shop", icon: ShoppingBag, titleKey: "side.marketplace", descKey: "home.card.marketplace.desc", color: "text-[#F5B84A]" },
];

type WycdItem = {
  view: string;
  icon: LucideIcon;
  labelKey: string;
};

/** "WHAT YOU CAN DO" panel — five quick actions from the approved design. */
const WHAT_YOU_CAN_DO: WycdItem[] = [
  { view: "bible", icon: BookOpen, labelKey: "home.readBible" },
  { view: "groups", icon: Users, labelKey: "home.wycd.groups" },
  { view: "prayer-wall", icon: HandHeart, labelKey: "home.wycd.prayer" },
  { view: "reels", icon: MonitorPlay, labelKey: "home.wycd.shorts" },
  { view: "shop", icon: ShoppingBag, labelKey: "home.wycd.market" },
];

export default function LordsbookHomeView({
  onOpenProfile,
  onHashtag,
  onOpenCreate,
  onOpenEvents,
  onOpenView,
  deepLinkPostId,
}: Props) {
  const t = useTranslation();

  // "Faith. Fellowship. Community." → last word rendered in orange, exactly
  // like the approved design. Works for every translated tagline.
  const tagline = t("brand.tagline");
  const taglineParts = tagline.split(" ");
  const taglineLast = taglineParts.pop() ?? "";
  const taglineRest = taglineParts.join(" ");

  return (
    <div className="pb-24 md:pb-8">
      {/* ─── 1. HERO BANNER — approved sunrise & cross artwork ──────────── */}
      <section className="px-3 md:px-6 pt-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] shadow-[0_20px_60px_rgba(2,8,23,0.6)]">
          {/* Artwork — generated stand-in for the approved hero photograph.
              Swap public/brand/hero-sunrise-cross.png to replace it. */}
          <Image
            src="/brand/hero-sunrise-cross.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 960px"
            className="object-cover object-center"
          />
          {/* Navy edge blending + readability scrims (left column + bottom) */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#071120]/90 via-[#071120]/40 to-[#071120]/10" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#071120]/60 via-transparent to-[#071120]/30" />

          <div className="relative flex flex-col lg:flex-row lg:items-start gap-5 p-5 md:p-7 min-h-[300px] md:min-h-[320px]">
            {/* Left: logo, heading, description, actions */}
            <div className="flex-1 min-w-0">
              <Image
                src={BRAND.assets.logo}
                alt={BRAND.name}
                width={2172}
                height={724}
                className="h-10 md:h-11 w-auto mb-5 drop-shadow-[0_6px_20px_rgba(2,8,23,0.85)]"
                priority
              />
              <h1 className="text-[30px] md:text-[38px] leading-[1.08] font-black tracking-tight text-white mb-3 drop-shadow-[0_2px_14px_rgba(2,8,23,0.7)]">
                {taglineRest}{taglineRest ? " " : ""}
                <span className="text-[#F97316]">{taglineLast}</span>
              </h1>
              <p className="text-sm md:text-[15px] text-white/90 leading-relaxed max-w-md mb-6 drop-shadow-[0_1px_8px_rgba(2,8,23,0.8)]">
                {t("home.heroDescription")}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onOpenView("explore")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white text-sm font-extrabold shadow-[0_10px_30px_rgba(249,115,22,0.45)] hover:shadow-[0_10px_36px_rgba(249,115,22,0.65)] hover:from-[#EA580C] hover:to-[#F97316] transition-all"
                >
                  {t("home.getStarted")}
                  <ArrowRight size={16} strokeWidth={2.4} />
                </button>
                <button
                  onClick={() => onOpenView("bible")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2563EB] text-white text-sm font-bold shadow-[0_10px_30px_rgba(37,99,235,0.45)] hover:bg-[#1D4ED8] transition-all"
                >
                  <BookOpen size={16} strokeWidth={2.1} className="text-[#7DD3FC]" />
                  {t("home.readBible")}
                </button>
              </div>
            </div>

            {/* Right: WHAT YOU CAN DO glass panel */}
            <aside className="lg:w-[290px] shrink-0 rounded-2xl bg-[#0A1729]/70 backdrop-blur-md border border-white/[0.12] p-4 shadow-[0_14px_40px_rgba(2,8,23,0.55)] self-start">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/90 mb-3">
                {t("home.whatYouCanDo")}
              </p>
              <ul className="space-y-0.5">
                {WHAT_YOU_CAN_DO.map(({ view, icon: Icon, labelKey }) => (
                  <li key={view}>
                    <button
                      onClick={() => onOpenView(view)}
                      className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left hover:bg-white/[0.07] transition-colors group"
                    >
                      <Icon size={19} strokeWidth={2} className="text-[#F97316] shrink-0 group-hover:text-[#FB923C] transition-colors" />
                      <span className="text-[13px] font-bold text-white leading-snug">{t(labelKey)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── 2. FEATURE CARDS — one row of six on desktop ───────────────── */}
      <section className="max-w-[980px] mx-auto px-3 md:px-6 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {FEATURE_CARDS.map(({ view, icon: Icon, titleKey, descKey, color }) => (
            <button
              key={view}
              onClick={() => onOpenView(view)}
              className="group text-center rounded-2xl bg-[#0D1B33]/90 border border-white/[0.06] hover:border-[#2563EB]/40 px-3 pt-4 pb-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(2,8,23,0.55)]"
            >
              <Icon size={30} strokeWidth={1.9} className={`${color} mx-auto mb-2.5 drop-shadow-[0_0_12px_rgba(34,211,238,0.15)]`} />
              <p className="text-[13px] font-extrabold text-white mb-0.5">{t(titleKey)}</p>
              <p className="text-[11px] text-[#94A3B8] leading-snug line-clamp-2">{t(descKey)}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ─── 3. THE FEED — composer + For You / Following tabs ─────────── */}
      <FeedView
        onOpenProfile={onOpenProfile}
        onHashtag={onHashtag}
        onOpenCreate={onOpenCreate}
        onOpenEvents={onOpenEvents}
        deepLinkPostId={deepLinkPostId}
        showStories={false}
      />
    </div>
  );
}
