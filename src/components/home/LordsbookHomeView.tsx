"use client";

/**
 * Lordsbook home — the centre column of the three-column layout.
 *
 * Structure (Part 1 spec):
 *   1. Hero banner — brand gradient, welcome heading "Faith. Fellowship.
 *      Community.", supporting description, Get Started + Read the Bible
 *      actions, shield emblem artwork.
 *   2. Feature cards — Bible, Comic Bible, Bible Trivia, Groups, Churches
 *      and Marketplace. Each card navigates to its existing SPA view.
 *   3. The live feed below — the existing FeedView (stories, post composer,
 *      For You / Following / Trending tabs, infinite scroll).
 *
 * No statistics, users or posts are fabricated: cards are navigation only,
 * and everything below the fold is the real feed. The tab labels come from
 * i18n (feed.tab.*) — "For You" is the Discover tab's display name.
 */

import Image from "next/image";
import {
  ArrowRight,
  Award,
  BookOpen,
  Church,
  Sparkles,
  Store,
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
  /** Icon-chip tint (brand palette: royal/electric blue, cyan, orange, gold). */
  chip: string;
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    view: "bible",
    icon: BookOpen,
    titleKey: "side.bible",
    descKey: "home.card.bible.desc",
    chip: "bg-[#2563EB]/15 text-[#60A5FA] border-[#2563EB]/25",
  },
  {
    view: "comic",
    icon: Sparkles,
    titleKey: "side.comics",
    descKey: "home.card.comics.desc",
    chip: "bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/25",
  },
  {
    view: "trivia",
    icon: Award,
    titleKey: "side.trivia",
    descKey: "home.card.trivia.desc",
    chip: "bg-[#F5B84A]/10 text-[#F5B84A] border-[#F5B84A]/25",
  },
  {
    view: "groups",
    icon: Users,
    titleKey: "side.groups",
    descKey: "home.card.groups.desc",
    chip: "bg-[#3B82F6]/10 text-[#93C5FD] border-[#3B82F6]/25",
  },
  {
    view: "churches",
    icon: Church,
    titleKey: "side.churches",
    descKey: "home.card.churches.desc",
    chip: "bg-[#F97316]/10 text-[#FB923C] border-[#F97316]/25",
  },
  {
    view: "shop",
    icon: Store,
    titleKey: "side.marketplace",
    descKey: "home.card.marketplace.desc",
    chip: "bg-white/[0.06] text-[#C3CAD6] border-white/[0.10]",
  },
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

  return (
    <div className="pb-24 md:pb-8">
      {/* ─── 1. HERO BANNER ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/[0.05]">
        {/* Brand gradient field — deep navy → royal/electric blue */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#0A1729] via-[#0E2138] to-[#153E75]" />
        {/* Glow accents — cyan (top right), orange (bottom left), royal halo */}
        <div aria-hidden className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[#22D3EE]/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-[#F97316]/10 blur-3xl" />
        <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[220px] rounded-full bg-[#2563EB]/15 blur-3xl" />

        <div className="relative max-w-[760px] mx-auto px-4 md:px-6 py-10 md:py-14 flex flex-col md:flex-row items-center gap-8 md:gap-10">
          <div className="flex-1 text-center md:text-left min-w-0">
            <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#22D3EE] mb-3">
              <span className="w-6 h-px bg-gradient-to-r from-transparent to-[#22D3EE]" />
              {t("home.welcome", { brand: BRAND.name })}
              <span className="w-6 h-px bg-gradient-to-l from-transparent to-[#22D3EE] md:hidden" />
            </p>
            <h1 className="text-3xl md:text-[40px] leading-tight font-black tracking-tight text-white mb-4">
              <span className="gradient-text">{t("brand.tagline")}</span>
            </h1>
            <p className="text-sm md:text-[15px] text-[#94A3B8] leading-relaxed max-w-md mx-auto md:mx-0 mb-6">
              {t("home.heroDescription", { brand: BRAND.name })}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button
                onClick={() => onOpenView("explore")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-sm font-extrabold shadow-[0_10px_30px_rgba(37,99,235,0.4)] hover:shadow-[0_10px_36px_rgba(37,99,235,0.6)] hover:from-[#1D4ED8] hover:to-[#2563EB] transition-all"
              >
                {t("home.getStarted")}
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
              <button
                onClick={() => onOpenView("bible")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.12] text-white text-sm font-bold hover:bg-white/[0.09] hover:border-[#22D3EE]/40 transition-all"
              >
                <BookOpen size={16} strokeWidth={2} className="text-[#22D3EE]" />
                {t("home.readBible")}
              </button>
            </div>
          </div>

          {/* Shield emblem — supplied artwork, aspect preserved */}
          <div className="relative shrink-0 hidden sm:block">
            <div aria-hidden className="absolute inset-0 bg-[#22D3EE]/20 blur-2xl rounded-full scale-90" />
            <Image
              src={BRAND.assets.emblem}
              alt={BRAND.name}
              width={1187}
              height={989}
              className="relative w-44 md:w-56 h-auto drop-shadow-[0_16px_40px_rgba(34,211,238,0.25)]"
              priority
            />
          </div>
        </div>
      </section>

      {/* ─── 2. FEATURE CARDS ──────────────────────────────────────────── */}
      <section className="max-w-[760px] mx-auto px-4 md:px-6 pt-6">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-3">
          {t("home.exploreFeatures", { brand: BRAND.name })}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FEATURE_CARDS.map(({ view, icon: Icon, titleKey, descKey, chip }) => (
            <button
              key={view}
              onClick={() => onOpenView(view)}
              className="group text-left rounded-2xl bg-[#0F2038]/80 border border-white/[0.05] hover:border-[#2563EB]/40 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(2,8,23,0.5)]"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${chip}`}>
                <Icon size={19} strokeWidth={2} />
              </div>
              <p className="text-sm font-extrabold text-white mb-1 flex items-center gap-1">
                {t(titleKey)}
                <ArrowRight
                  size={13}
                  className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#22D3EE]"
                />
              </p>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed line-clamp-2">{t(descKey)}</p>
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
      />
    </div>
  );
}
