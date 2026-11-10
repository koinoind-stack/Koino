"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Award,
  BookOpen,
  Search,
  Building2,
  Store,
  HeartHandshake,
  Calendar,
  Users,
  Menu,
  X,
  Clapperboard,
  Flower2,
  MessageCircle,
  MapPin,
  FileText,
} from "lucide-react";
import LanguageSwitcher from "@/components/crosscrafted/LanguageSwitcher";
import KoinoFooter from "@/components/crosscrafted/KoinoFooter";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { BRAND } from "@/lib/brand";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { CHURCH_GRADIENTS } from "@/lib/crosscrafted-data";
import { useFeaturedPicks } from "@/lib/showcase";

type Props = {
  onEnterApp: (view: string) => void;
};

// Public shape returned by GET /api/blog/latest. Only the fields the landing
// page cards need — no content/draft/admin fields ever exposed.
type BlogCardData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  category: string;
  author: string | null;
  publishedAt: string | null; // ISO string (serialized by the API)
};

// Public shape returned by GET /api/events (published events only).
type EventCardData = {
  id: string;
  title: string;
  date: string; // ISO — startDate
  city?: string;
  state?: string;
  location?: string;
  organizerName?: string;
  church?: string;
  cover_image?: string | null;
  cover_gradient?: number;
  eventType?: string;
  is_online?: boolean;
};

// ─── FEATURE SHOWCASE (§4) ───
// Three meaningful groups. Items with `view` open the existing SPA view via
// onEnterApp; items with `href` navigate to a public App Router page
// (/videos, /memorials) — these are real routes that work for BOTH guests
// and signed-in users, so they never enter the SPA router blind.
type FeatureItem = {
  icon: typeof BookOpen;
  color: string;
  titleKey: string;
  descKey: string;
  view?: string;
  href?: string;
};

type FeatureGroup = {
  titleKey: string;
  subKey: string;
  items: FeatureItem[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    titleKey: "features.groups.grow",
    subKey: "features.groups.growSub",
    items: [
      { icon: BookOpen, color: "#2563EB", titleKey: "feature.bible.title", descKey: "feature.bible.desc", view: "bible" },
      { icon: Sparkles, color: "#F97316", titleKey: "feature.comics.title", descKey: "feature.comics.desc", view: "comic" },
      { icon: Clapperboard, color: "#F97316", titleKey: "feature.videos.title", descKey: "feature.videos.desc", href: "/videos" },
      { icon: Award, color: "#22C55E", titleKey: "feature.trivia.title", descKey: "feature.trivia.desc", view: "trivia" },
      { icon: HeartHandshake, color: "#F5B84A", titleKey: "feature.prayer.title", descKey: "feature.prayer.desc", view: "prayer-wall" },
    ],
  },
  {
    titleKey: "features.groups.community",
    subKey: "features.groups.communitySub",
    items: [
      { icon: Search, color: "#F97316", titleKey: "feature.churches.title", descKey: "feature.churches.desc", view: "churches" },
      { icon: Calendar, color: "#22D3EE", titleKey: "feature.events.title", descKey: "feature.events.desc", view: "events" },
      { icon: Users, color: "#A855F7", titleKey: "feature.groups.title", descKey: "feature.groups.desc", view: "groups" },
      { icon: Flower2, color: "#B9A8E8", titleKey: "feature.memorials.title", descKey: "feature.memorials.desc", href: "/memorials" },
    ],
  },
  {
    titleKey: "features.groups.discover",
    subKey: "features.groups.discoverSub",
    items: [
      { icon: Store, color: "#3B82F6", titleKey: "feature.marketplace.title", descKey: "feature.marketplace.desc", view: "shop" },
      { icon: Building2, color: "#0EA5E9", titleKey: "feature.businessDirectory.title", descKey: "feature.businessDirectory.desc", view: "business-directory" },
    ],
  },
];

// §7 — a small selection from the SAME datasets the in-app Marketplace and
// Business Directory render. Featured listings float to the front. No data
// is invented; if a list is empty its subsection is hidden.


const gradientFor = (idx: number | undefined) =>
  CHURCH_GRADIENTS[(idx ?? 0) % CHURCH_GRADIENTS.length];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function LandingHero({ onEnterApp }: Props) {
  const t = useTranslation();
  const { products: PRODUCT_PICKS, businesses: BUSINESS_PICKS } = useFeaturedPicks(3);
  const { isAuthenticated } = useSupabaseUser();
  const [menuOpen, setMenuOpen] = useState(false);

  // Guest entry route = the existing sign-in/sign-up page (same destination
  // the in-app header uses for signed-out visitors). Signed-in users who
  // revisit the landing go straight into the app.
  const joinCta = (className: string, withArrow = true) =>
    isAuthenticated ? (
      <button onClick={() => onEnterApp("home")} className={className}>
        {t("landing.cta.join")}
        {withArrow && <ArrowRight size={18} strokeWidth={2.5} />}
      </button>
    ) : (
      <a href="/auth/signin" className={className}>
        {t("landing.cta.join")}
        {withArrow && <ArrowRight size={18} strokeWidth={2.5} />}
      </a>
    );

  // ─── Latest blog posts (`From the ${BRAND.name} Community`) ───
  // Nothing renders while loading — an empty result collapses to a slim strip
  // instead of a large reserved block (§8).
  const [blogPosts, setBlogPosts] = useState<BlogCardData[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);

  // ─── Upcoming events (§6) — real published events from /api/events ───
  const [events, setEvents] = useState<EventCardData[] | null>(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/blog/latest?limit=3", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { posts?: BlogCardData[] };
        if (!cancelled) setBlogPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch {
        if (!cancelled) setBlogPosts([]);
      } finally {
        if (!cancelled) setBlogLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setEvents([]);
          return;
        }
        const data = (await res.json()) as { events?: EventCardData[] };
        const all = Array.isArray(data.events) ? data.events : [];
        // Upcoming only — start of today, local time.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = all
          .filter((e) => e?.date && new Date(e.date) >= today)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 3);
        if (!cancelled) setEvents(upcoming);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const NAV_ITEMS = [
    { label: t("nav.bible"), view: "bible" },
    { label: t("nav.churches"), view: "churches" },
    { label: t("nav.events"), view: "events" },
    { label: t("nav.trivia"), view: "trivia" },
    { label: t("nav.prayer"), view: "prayer-wall" },
  ];

  return (
    <div className="min-h-screen bg-[#071120] text-white flex flex-col">
      {/* ─── HEADER (§3) — logo, focused nav, language, clear Join action ─── */}
      <header className="sticky top-0 z-40 bg-[#071120]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Image
              src={BRAND.assets.shield}
              alt={BRAND.name + ""}
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            <h1 className="text-base font-black tracking-tight">{t("brand.name")}</h1>
          </div>

          {/* Desktop nav — focused on the primary discovery paths */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#94A3B8]">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                onClick={() => onEnterApp(item.view)}
                className="hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {joinCta(
              "hidden sm:inline-flex px-5 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all hover:-translate-y-px items-center gap-1.5",
              false
            )}
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t("nav.menu")}
              className="md:hidden w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="md:hidden border-t border-white/[0.05] bg-[#071120]/95 backdrop-blur-xl px-6 py-4 space-y-1"
            >
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    setMenuOpen(false);
                    onEnterApp(item.view);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-[#94A3B8] hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-2 sm:hidden">
                {joinCta(
                  "w-full justify-center inline-flex px-5 py-3 bg-[#F97316] hover:bg-[#EA580C] text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider items-center gap-1.5",
                  false
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HERO (§2) — what Koino is + why join, in one screen ─── */}
      <section className="relative pt-16 sm:pt-20 pb-14 px-6 max-w-7xl mx-auto w-full overflow-hidden">
        {/* Subtle brand glows — restrained, no oversized artwork */}
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[280px] bg-[#2563EB]/10 blur-[100px] rounded-full" />
        <div aria-hidden className="pointer-events-none absolute top-24 -left-24 w-[320px] h-[220px] bg-[#F97316]/[0.07] blur-[90px] rounded-full" />

        <div className="relative text-center max-w-3xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F97316]/10 border border-[#F97316]/20 text-[#F97316] text-xs font-bold uppercase tracking-wider"
          >
            <Sparkles size={12} fill="currentColor" />
            {t("brand.tagline")}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08]"
          >
            {t("landing.hero.titleLine1")} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F97316] to-[#3B82F6]">
              {t("landing.hero.titleGradient")}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-[#A09DB1] max-w-xl mx-auto leading-relaxed"
          >
            {t("landing.hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 pt-2"
          >
            {joinCta(
              "px-8 py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-slate-950 font-extrabold rounded-2xl text-sm uppercase tracking-wider shadow-lg shadow-[#F97316]/20 flex items-center gap-2 transition-all hover:-translate-y-px"
            )}
            <button
              onClick={() => onEnterApp("bible")}
              className="px-8 py-3.5 border border-white/[0.08] hover:border-white/[0.15] text-[#A09DB1] hover:text-white font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all bg-white/[0.02] flex items-center gap-2"
            >
              <BookOpen size={18} /> {t("landing.cta.exploreBible")}
            </button>
          </motion.div>

          {/* Real feature stats — no engagement/follower counts */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-4 gap-4 sm:gap-6 pt-8 border-t border-white/[0.04] max-w-lg mx-auto"
          >
            <div>
              <p className="text-xl font-extrabold text-[#F97316]">800+</p>
              <p className="text-[10px] text-[#726E88] font-bold uppercase tracking-wider mt-0.5">{t("landing.stats.questions")}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-[#2563EB]">7</p>
              <p className="text-[10px] text-[#726E88] font-bold uppercase tracking-wider mt-0.5">{t("landing.stats.tiers")}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-[#22D3EE]">13</p>
              <p className="text-[10px] text-[#726E88] font-bold uppercase tracking-wider mt-0.5">{t("landing.stats.languages")}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-[#22C55E]">{t("landing.stats.free")}</p>
              <p className="text-[10px] text-[#726E88] font-bold uppercase tracking-wider mt-0.5">{t("landing.stats.toUse")}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURE SHOWCASE (§4) — three meaningful groups ─── */}
      <section className="py-14 border-t border-white/[0.03] bg-[#13294A]/30">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t("features.title")}</h2>
            <p className="text-sm text-[#A09DB1]">{t("features.groups.subtitle")}</p>
          </div>

          {FEATURE_GROUPS.map((group) => (
            <div key={group.titleKey}>
              <div className="flex items-baseline gap-3 mb-5">
                <h3 className="text-lg font-extrabold tracking-tight text-white">{t(group.titleKey)}</h3>
                <p className="text-xs text-[#726E88] hidden sm:block">{t(group.subKey)}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {group.items.map((f, i) => {
                  const inner = (
                    <>
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0"
                        style={{ backgroundColor: `${f.color}1A`, borderColor: `${f.color}40` }}
                      >
                        <f.icon style={{ color: f.color }} size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-white group-hover:opacity-90 transition-opacity">
                          {t(f.titleKey)}
                        </h4>
                        <p className="text-xs text-[#A09DB1] leading-relaxed mt-1.5 line-clamp-3">
                          {t(f.descKey)}
                        </p>
                      </div>
                    </>
                  );
                  const cls =
                    "group text-left flex items-start gap-4 bg-[#13294A] border hover:bg-[#22202F] transition-all rounded-3xl p-5 h-full";
                  const style = { borderColor: `${f.color}33` };
                  return f.href ? (
                    <motion.a
                      key={f.titleKey}
                      href={f.href}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: i * 0.05 }}
                      className={cls}
                      style={style}
                    >
                      {inner}
                    </motion.a>
                  ) : (
                    <motion.button
                      key={f.titleKey}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: i * 0.05 }}
                      onClick={() => onEnterApp(f.view as string)}
                      className={cls}
                      style={style}
                    >
                      {inner}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── COMMUNITY PREVIEW (§5) ───
          Koino has no public post feed for guests (posts are member content),
          so instead of fake activity we present an honest, tasteful invitation
          describing real community life inside the app. */}
      <section className="py-14 px-6 max-w-5xl mx-auto w-full">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#13294A] to-[#1A3A66] border border-[#2563EB]/20 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div aria-hidden className="absolute -top-14 -right-14 w-40 h-40 bg-[#F97316]/10 blur-3xl rounded-full" />
          <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2563EB]/15 border border-[#2563EB]/25 text-[#60A5FA] text-xs font-bold">
                <Users size={12} /> {t("community.preview.badge")}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {t("community.preview.title")}
              </h2>
              <p className="text-sm text-[#A09DB1] leading-relaxed">
                {t("community.preview.subtitle")}
              </p>
              <div className="pt-1">
                {joinCta(
                  "inline-flex px-7 py-3 bg-[#F97316] hover:bg-[#EA580C] text-slate-950 font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-[#F97316]/20 items-center gap-2 transition-all hover:-translate-y-px",
                  false
                )}
              </div>
              <p className="text-[11px] text-[#726E88]">{t("community.preview.note")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: BookOpen, label: t("community.preview.topic.reflections") },
                { icon: Sparkles, label: t("community.preview.topic.testimonies") },
                { icon: HeartHandshake, label: t("community.preview.topic.prayer") },
                { icon: MessageCircle, label: t("community.preview.topic.questions") },
              ].map((topic) => (
                <div
                  key={topic.label}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-5 flex flex-col items-center gap-2 text-center"
                >
                  <topic.icon size={18} className="text-[#60A5FA]" />
                  <p className="text-[11px] font-bold text-[#C9C5DB] leading-snug">{topic.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── UPCOMING EVENTS (§6) — real published events only ─── */}
      <section className="py-14 border-t border-white/[0.03] bg-[#13294A]/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t("home.events.title")}</h2>
              <p className="text-sm text-[#A09DB1]">{t("home.events.subtitle")}</p>
            </div>
            <button
              onClick={() => onEnterApp("events")}
              className="text-xs font-extrabold uppercase tracking-wider text-[#F97316] hover:text-[#EA580C] transition-colors inline-flex items-center gap-1"
            >
              {t("home.events.viewAll")} <ArrowRight size={13} />
            </button>
          </div>

          {events === null ? null : events.length === 0 ? (
            // Compact empty state — never a large reserved block (§6).
            <div className="flex flex-wrap items-center justify-center gap-3 bg-[#13294A]/60 border border-dashed border-white/[0.08] rounded-2xl px-6 py-5">
              <Calendar size={15} className="text-[#726E88]" />
              <p className="text-xs text-[#94A3B8]">{t("home.events.empty")}</p>
              <button
                onClick={() => onEnterApp("events")}
                className="text-xs font-bold text-[#F97316] hover:text-[#EA580C] transition-colors"
              >
                {t("home.events.browse")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((ev) => {
                const d = new Date(ev.date);
                const day = d.toLocaleDateString(undefined, { day: "numeric" });
                const month = d.toLocaleDateString(undefined, { month: "short" });
                const place = ev.city || ev.location || ev.state || "";
                const host = ev.organizerName || ev.church || "";
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEnterApp("events")}
                    className="group text-left bg-[#13294A] border border-white/[0.06] rounded-3xl overflow-hidden hover:border-white/[0.15] transition-all flex flex-col"
                  >
                    <div className="relative h-36" style={{ background: gradientFor(ev.cover_gradient) }}>
                      {ev.cover_image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={ev.cover_image}
                          alt={ev.title}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : null}
                      <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-xl bg-black/45 backdrop-blur-sm border border-white/10 text-center leading-none">
                        <p className="text-sm font-black text-white">{day}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-white/80 mt-0.5">{month}</p>
                      </div>
                      {ev.is_online && (
                        <span className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/45 backdrop-blur-sm border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/90">
                          {t("home.events.online")}
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-1.5 flex-1 flex flex-col">
                      <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-[#60A5FA] transition-colors">
                        {ev.title}
                      </h3>
                      {place && (
                        <p className="text-[11px] text-[#94A3B8] flex items-center gap-1">
                          <MapPin size={11} className="shrink-0" /> <span className="line-clamp-1">{place}</span>
                        </p>
                      )}
                      {host && <p className="text-[10px] text-[#726E88] line-clamp-1">{host}</p>}
                      <span className="mt-auto pt-2 text-[10px] font-extrabold uppercase tracking-wider text-[#F97316] inline-flex items-center gap-1">
                        {t("home.events.viewEvent")} <ArrowRight size={11} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── MARKETPLACE & BUSINESSES (§7) — real listings, kept secondary ─── */}
      {(PRODUCT_PICKS.length > 0 || BUSINESS_PICKS.length > 0) && (
        <section className="py-14 px-6 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {PRODUCT_PICKS.length > 0 && (
              <div>
                <div className="flex items-end justify-between gap-3 mb-5">
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                      <Store size={17} className="text-[#3B82F6]" /> {t("home.market.title")}
                    </h2>
                    <p className="text-xs text-[#726E88]">{t("home.market.subtitle")}</p>
                  </div>
                  <button
                    onClick={() => onEnterApp("shop")}
                    className="text-[11px] font-extrabold uppercase tracking-wider text-[#3B82F6] hover:text-white transition-colors shrink-0"
                  >
                    {t("home.market.browse")}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {PRODUCT_PICKS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onEnterApp("shop")}
                      className="group text-left bg-[#13294A] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.15] transition-all flex flex-col"
                    >
                      <div className="h-20" style={{ background: gradientFor(p.cover_gradient) }}>
                        {p.cover_image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.cover_image} alt={p.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="p-2.5 space-y-1 flex-1 flex flex-col">
                        <p className="text-[11px] font-bold text-white line-clamp-1">{p.name}</p>
                        <p className="text-[11px] font-extrabold text-[#F97316]">{inr.format(p.price)}</p>
                        <span className="mt-auto text-[9px] font-bold uppercase tracking-wider text-[#726E88] group-hover:text-[#3B82F6] transition-colors">
                          {t("home.market.viewProduct")}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {BUSINESS_PICKS.length > 0 && (
              <div>
                <div className="flex items-end justify-between gap-3 mb-5">
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                      <Building2 size={17} className="text-[#0EA5E9]" /> {t("home.biz.title")}
                    </h2>
                    <p className="text-xs text-[#726E88]">{t("home.biz.subtitle")}</p>
                  </div>
                  <button
                    onClick={() => onEnterApp("business-directory")}
                    className="text-[11px] font-extrabold uppercase tracking-wider text-[#0EA5E9] hover:text-white transition-colors shrink-0"
                  >
                    {t("home.biz.browse")}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {BUSINESS_PICKS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onEnterApp("business-directory")}
                      className="group text-left bg-[#13294A] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.15] transition-all flex flex-col"
                    >
                      <div className="h-20" style={{ background: gradientFor(b.cover_gradient) }}>
                        {b.logo || b.cover_image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={(b.logo || b.cover_image) as string} alt={b.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="p-2.5 space-y-1 flex-1 flex flex-col">
                        <p className="text-[11px] font-bold text-white line-clamp-1">{b.name}</p>
                        <p className="text-[10px] text-[#94A3B8] line-clamp-1">{b.category}</p>
                        <span className="mt-auto text-[9px] font-bold uppercase tracking-wider text-[#726E88] group-hover:text-[#0EA5E9] transition-colors">
                          {t("home.biz.viewBusiness")}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── FROM THE KOINO COMMUNITY (§8) ───
          Compact when empty: a slim strip instead of a large reserved block.
          The section header only appears when articles exist. */}
      {!blogLoading && blogPosts.length > 0 && (
        <section id="from-community" className="py-14 px-6 max-w-6xl mx-auto w-full border-t border-white/[0.03]">
          <div className="text-center mb-8 space-y-3">
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.25em] text-[#F97316]">
              {t("articles.eyebrow")}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {t("articles.title")}
            </h2>
            <p className="text-sm text-[#A09DB1] max-w-xl mx-auto">
              {t("articles.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <a
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group bg-[#13294A] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.15] transition-all flex flex-col"
              >
                {post.featuredImage ? (
                  <div className="h-40 bg-[#0f0f1a] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-[#1A3A66] via-[#13294A] to-[#0f0f1a]" />
                )}
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#F97316]">
                    {post.category}
                  </span>
                  <h3 className="text-sm font-bold text-white group-hover:text-[#60A5FA] transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-[11px] text-[#A09DB1] line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-auto pt-2 flex items-center gap-2 text-[10px] text-[#64748B]">
                    {post.publishedAt && (
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    {post.author && (
                      <span>
                        · <span className="text-[#94A3B8] font-semibold">{post.author}</span>
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="flex justify-center mt-8">
            <a
              href="/blog"
              className="bg-[#F97316] hover:bg-[#EA580C] text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-2xl px-7 py-3.5 transition-all hover:-translate-y-px inline-flex items-center gap-2"
            >
              {t("articles.viewAll")} <ArrowRight size={14} strokeWidth={2.5} />
            </a>
          </div>
        </section>
      )}
      {!blogLoading && blogPosts.length === 0 && (
        <div className="px-6 max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-center gap-2 py-5 border-t border-white/[0.03] text-[#726E88]">
            <FileText size={13} />
            <p className="text-xs">{t("articles.empty")}</p>
          </div>
        </div>
      )}

      {/* ─── CLOSING CTA (§9) — the one strong join moment ─── */}
      <section className="py-12 px-6 text-center max-w-4xl mx-auto w-full mt-auto">
        <div className="bg-gradient-to-tr from-[#13294A] to-slate-900 border border-white/[0.06] rounded-3xl p-8 sm:p-12 space-y-5 shadow-2xl relative overflow-hidden">
          <div aria-hidden className="absolute -top-12 -right-12 w-28 h-28 bg-[#F97316]/5 blur-2xl rounded-full" />
          <div aria-hidden className="absolute -bottom-12 -left-12 w-28 h-28 bg-[#3B82F6]/5 blur-2xl rounded-full" />
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight relative">{t("cta.title")}</h2>
          <p className="text-xs sm:text-sm text-[#A09DB1] max-w-lg mx-auto leading-relaxed relative">
            {t("cta.subtitle")}
          </p>
          <div className="pt-2 relative">
            {joinCta(
              "px-9 py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-slate-950 font-extrabold rounded-2xl text-xs uppercase tracking-widest shadow-lg transition-all inline-flex items-center gap-2 hover:-translate-y-px"
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <KoinoFooter />
    </div>
  );
}
