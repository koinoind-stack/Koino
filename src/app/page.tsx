"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  Award,
  BookOpen,
  Store,
  Building2,
  Heart,
  Sparkles,
  LogOut,
  Home as HomeIcon,
  HeartHandshake,
  ListChecks,
  Grid,
  X,
  Shield,
  Globe,
  FileText,
  HandHeart,
} from "lucide-react";
import LandingHero from "@/components/crosscrafted/LandingHero";
import ChurchesView from "@/components/crosscrafted/ChurchesView";
import TriviaView from "@/components/crosscrafted/TriviaView";
import PrayerWallView from "@/components/crosscrafted/PrayerWallView";
import EventsView from "@/components/crosscrafted/EventsView";
import ApologeticsView from "@/components/crosscrafted/ApologeticsView";
import ShopView from "@/components/crosscrafted/ShopView";
import ListYourEntity from "@/components/crosscrafted/ListYourEntity";
import BibleView from "@/components/crosscrafted/BibleView";
import BiblePlansView from "@/components/crosscrafted/BiblePlansView";
import AdminView from "@/components/crosscrafted/AdminView";
import HeaderUserSection from "@/components/crosscrafted/HeaderUserSection";
import LanguageSwitcher from "@/components/crosscrafted/LanguageSwitcher";
import ComicView from "@/components/crosscrafted/ComicView";
import BusinessDirectoryView from "@/components/crosscrafted/BusinessDirectoryView";
import AppHomeView from "@/components/crosscrafted/AppHomeView";
import OnboardingView from "@/components/crosscrafted/OnboardingView";
import { toast } from "sonner";
import { type Translation } from "@/lib/bible-data";
import { useSupabaseUser } from "@/lib/supabase/use-user";

type View =
  | "landing"
  | "onboarding" // Profile setup flow (shown when !profileCompleted)
  | "home" // App Home dashboard (default after Enter App + onboarding)
  | "bible"
  | "bible-plans"
  | "comic"
  | "churches"
  | "events"
  | "trivia"
  | "prayer-wall"
  | "apologetics"
  | "shop"
  | "list-church"
  | "list-business" // kept for backward-compat route (the ListYourEntity form)
  | "business-directory" // public browse page
  | "small-groups"
  | "community" // Global Christian Community → /community (Lordsbook CTA page)
  | "blog" // Blog → /blog (public App Router page, opens in new tab/route)
  | "support" // Support Koino → /support (public App Router page, accessible while authenticated)
  | "admin";

// Bible is the main feature — placed at the top of the sidebar.
// Bible Comics and Reading Plans are NOT separate sidebar entries —
// they are modes inside the Bible hub.
// Small Groups and List Church are also NOT top-level entries —
// Small Groups is part of the Churches hub (Groups section inside church profile),
// and List Your Church is a primary action inside the Churches hub.
//
// "community" is a special sidebar entry: clicking it does a full route
// navigation to /community (the Lordsbook community CTA page). It does NOT
// render inside the SPA — goView() catches it and redirects.
const SIDEBAR_LINKS: { id: View; icon: typeof Search; label: string }[] = [
  { id: "home", icon: HomeIcon, label: "Home" },
  { id: "bible", icon: BookOpen, label: "Bible" },
  { id: "churches", icon: Search, label: "Churches" },
  { id: "events", icon: Calendar, label: "Events" },
  { id: "trivia", icon: Award, label: "Bible Trivia" },
  { id: "apologetics", icon: ListChecks, label: "Apologetics" },
  // ─── COMMUNITY ─── Global Christian Community → /community
  { id: "community", icon: Globe, label: "Global Christian Community" },
  // ─── DISCOVER ─── Marketplace + Business Directory
  { id: "shop", icon: Store, label: "Marketplace" },
  { id: "business-directory", icon: Building2, label: "Business Directory" },
  { id: "prayer-wall", icon: HeartHandshake, label: "Prayer Wall" },
  // ─── CONTENT & SUPPORT ─── reachable while authenticated (no logout)
  { id: "blog", icon: FileText, label: "Blog" },
  { id: "support", icon: HandHeart, label: "Support Koino" },
  { id: "admin", icon: Shield, label: "Admin" },
];

// Mobile bottom nav — 4 quick-access slots + a "More" button that opens the full menu.
// The 4 quick slots are the most-used features; everything else lives behind "More".
const MOBILE_NAV: { id: View; icon: typeof Search; label: string }[] = [
  { id: "bible", icon: BookOpen, label: "Bible" },
  { id: "churches", icon: Search, label: "Churches" },
  { id: "trivia", icon: Award, label: "Trivia" },
  { id: "shop", icon: Store, label: "Shop" },
];

// Views that are NOT in the quick-access bottom nav (shown in the "More" sheet).
// Note: Bible Comics and Reading Plans are both accessible from inside the
// Bible view via the READ / BIBLE COMICS / READING PLANS mode switcher.
// Small Groups and List Church are accessible from inside the Churches hub.
const MOBILE_MORE_VIEWS: { id: View; icon: typeof Search; label: string }[] = [
  { id: "events", icon: Calendar, label: "Events" },
  { id: "apologetics", icon: ListChecks, label: "Apologetics" },
  { id: "community", icon: Globe, label: "Global Christian Community" },
  { id: "prayer-wall", icon: HeartHandshake, label: "Prayer Wall" },
  { id: "business-directory", icon: Building2, label: "Business Directory" },
  { id: "blog", icon: FileText, label: "Blog" },
  { id: "support", icon: HandHeart, label: "Support Koino" },
  { id: "admin", icon: Shield, label: "Admin" },
];

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const { isAuthenticated, profileCompleted, isAdmin, loading: authLoading } = useSupabaseUser();
  const [headerVisible, setHeaderVisible] = useState(true);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const lastScrollY = useRef(0);
  // Bible Comics state — data-driven, not hardcoded.
  // Default to Genesis 1 (the first chapter of the Bible).
  // Changed when user navigates between comic chapters or opens a shared URL.
  const [comicBookId, setComicBookId] = useState("genesis");
  const [comicChapter, setComicChapter] = useState(1);

  // Navigate to a new view, also resetting header + scroll position.
  const navigate = (next: View) => {
    setView(next);
    setHeaderVisible(true);
    setShowMoreSheet(false);
    lastScrollY.current = 0;
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  // Auto-hide header on mobile scroll
  useEffect(() => {
    if (view === "landing") return;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 10) setHeaderVisible(true);
      else if (y > lastScrollY.current + 8) setHeaderVisible(false);
      else if (y < lastScrollY.current - 8) setHeaderVisible(true);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view]);

  // ─── ONBOARDING REDIRECT ───
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && !profileCompleted && view !== "onboarding" && view !== "landing") {
      navigate("onboarding");
    }
    if (isAuthenticated && profileCompleted && view === "onboarding") {
      navigate("home");
    }
  }, [isAuthenticated, profileCompleted, authLoading]);

  // ─── DEEP-LINK ROUTING FROM ?view=<view> QUERY PARAM ───
  // Footer links and shared URLs use /?view=bible, /?view=comic, etc.
  // On mount (and when auth state changes), if the URL has a ?view= param,
  // route the SPA to that view directly — but ONLY if the user is
  // authenticated AND has completed onboarding. For unauthenticated
  // visitors, they land on the public landing page (they can sign in
  // and then click the footer link again, or use Enter App).
  // Supported deep-link views: bible, comic, churches, events, trivia,
  // prayer-wall, apologetics, shop, business-directory, community.
  // "community" is special-cased: it redirects to /community (full route).
  // This effect runs ONCE on initial mount — it does not re-run on every
  // navigation (otherwise clicking sidebar items would fight with the URL).
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !profileCompleted) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const deepView = params.get("view");
    if (!deepView) return;

    // Validate that the deep-link view is a known SPA view.
    const validViews: View[] = [
      "bible", "comic", "churches", "events", "trivia",
      "prayer-wall", "apologetics", "shop", "business-directory",
    ];
    if (!validViews.includes(deepView as View)) return;

    // Route to the deep-linked view.
    // Use a small timeout to ensure the SPA shell has mounted.
    navigate(deepView as View);

    // Clean the URL so subsequent in-SPA navigations don't fight with it.
    // (replaceState so we don't add a history entry)
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, profileCompleted]);

  const enterApp = (v: string) => {
    if (isAuthenticated && !profileCompleted) {
      navigate("onboarding");
    } else {
      navigate(v as View);
    }
  };
  // goHome: if authenticated → App Home; if not → public landing page.
  // This is the ROOT FIX for the "Home button sends completed users back
  // to Get Started" bug. Previously goHome always navigated to "landing"
  // regardless of auth state.
  const goHome = () => {
    if (isAuthenticated && profileCompleted) {
      navigate("home");
    } else if (isAuthenticated && !profileCompleted) {
      navigate("onboarding");
    } else {
      navigate("landing");
    }
  };
  const goView = (v: View) => {
    // Several sidebar entries are "pseudo-views" — they don't render inside
    // the SPA. Instead, navigate to a public App Router route. This lets
    // authenticated users reach /community, /blog, /support WITHOUT logging
    // out (the public pages use PublicPageLayout, which works for both
    // authenticated and unauthenticated visitors).
    //
    // Fire-and-forget analytics if available, then perform a full route
    // navigation. Mirrors navigate() cleanup so the More sheet closes
    // immediately on mobile.
    if (v === "community" || v === "blog" || v === "support") {
      setShowMoreSheet(false);
      setHeaderVisible(true);
      try {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event:
              v === "community" ? "global_christian_community_nav_click" :
              v === "blog" ? "blog_nav_click" :
              "support_koino_nav_click",
            source: "sidebar",
          }),
        }).catch(() => {});
      } catch {}
      if (typeof window !== "undefined") {
        window.location.href = `/${v}`;
      }
      return;
    }
    navigate(v);
  };

  // ─── AUTH LOADING GUARD ───
  // While auth is loading, show a minimal loading screen instead of flashing
  // the public landing page for authenticated users. This prevents the race
  // condition where an authenticated user briefly sees the landing page
  // before the onboarding redirect effect kicks in.
  if (authLoading && view === "landing") {
    return (
      <div className="min-h-screen bg-[#12101A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F39B9B]/30 border-t-[#F39B9B] rounded-full animate-spin" />
      </div>
    );
  }

  // Landing view — full screen (only for unauthenticated users)
  if (view === "landing") {
    return <LandingHero onEnterApp={enterApp} />;
  }

  // Onboarding view — full screen, shown when !profileCompleted
  if (view === "onboarding") {
    return <OnboardingView onComplete={() => navigate("home")} />;
  }

  // App view with sidebar + bottom nav
  return (
    <div className="min-h-screen bg-[#12101A]">
      {/* Header — auto-hides on mobile scroll */}
      <header
        className={`sticky top-0 z-50 bg-[#12101A]/80 backdrop-blur-2xl border-b border-white/[0.04] transition-transform duration-300 ${
          headerVisible ? "translate-y-0" : "md:translate-y-0 -translate-y-full"
        }`}
      >
        <div className="flex justify-between items-center h-12 md:h-14 px-4 md:px-5">
          <button onClick={goHome} className="flex items-center gap-2">
            {/* Koino Logo */}
            <Image
              src="/koino-logo.png"
              alt="Koino"
              width={32}
              height={32}
              className="rounded-lg shrink-0"
              priority
            />
            <h1 className="text-base md:text-lg font-black tracking-tight text-white">Koino</h1>
          </button>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <HeaderUserSection />
            <button
              onClick={goHome}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
              title="Back to home"
            >
              <HomeIcon size={18} strokeWidth={1.8} className="text-[#64748B]" />
            </button>
            <button
              onClick={goHome}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} strokeWidth={1.8} className="text-[#64748B]" />
            </button>
          </div>
          {/* Mobile: minimal right side */}
          <div className="md:hidden flex items-center gap-2">
            <LanguageSwitcher compact />
            <HeaderUserSection mobile />
            <button
              onClick={goHome}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06]"
            >
              <LogOut size={14} className="text-[#64748B]" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-56 border-r border-white/[0.04] min-h-[calc(100vh-56px)] sticky top-[56px] bg-[#0B1120] px-3 pt-6">
          <nav className="space-y-1">
            {SIDEBAR_LINKS.filter(({ id }) => id !== "admin" || isAdmin).map(({ id, icon: Icon, label }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => goView(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-[14px] transition-all duration-200 border ${
                    active
                      ? "bg-[#7C3AED]/15 text-white border-[#7C3AED]/30 shadow-[0_0_15px_rgba(124,58,237,0.1)]"
                      : "text-[#94A3B8] hover:text-white hover:bg-white/[0.04] border-transparent"
                  }`}
                >
                  <div className="relative">
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.4 : 1.8}
                      className={active ? "text-[#7C3AED]" : ""}
                    />
                  </div>
                  {label}
                  {active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto pt-6 pb-4">
            <div className="bg-gradient-to-br from-[#7C3AED]/15 to-[#EC4899]/15 border border-[#7C3AED]/20 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={12} className="text-[#A78BFA]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">Daily Verse</p>
              </div>
              <p className="text-[11px] text-white leading-snug italic mb-1">
                "I can do all things through Christ who strengthens me."
              </p>
              <p className="text-[10px] text-[#94A3B8]">— Philippians 4:13</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 pb-24 md:pb-6 scroll-smooth bg-[#0B1120] min-h-[calc(100vh-56px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {view === "home" && (
                <AppHomeView
                  onNavigate={(v) => goView(v)}
                />
              )}
              {view === "bible" && (
                <BibleView
                  onOpenComic={(bookId, chapter) => {
                    // Switch from Bible hub → full ComicView for the chosen chapter.
                    // Preserves the existing comicBookId/comicChapter state so
                    // chapter navigation inside ComicView continues to work.
                    setComicBookId(bookId);
                    setComicChapter(chapter);
                    goView("comic");
                  }}
                />
              )}
              {view === "bible-plans" && (
                <BiblePlansView
                  translation="kjv"
                  onOpenChapter={() => goView("bible")}
                />
              )}
              {view === "comic" && (
                <ComicView
                  bookId={comicBookId}
                  chapter={comicChapter}
                  onNavigateChapter={(bid, ch) => {
                    setComicBookId(bid);
                    setComicChapter(ch);
                  }}
                  onReadChapter={(bid, ch) => {
                    goView("bible");
                  }}
                  onPray={(prompt) => {
                    goView("prayer-wall");
                  }}
                  onDiscuss={(topic) => {
                    toast("Discussion coming soon", { description: topic });
                  }}
                />
              )}
              {view === "churches" && (
                <ChurchesView
                  onListChurch={() => goView("list-church")}
                />
              )}
              {view === "events" && <EventsView />}
              {view === "trivia" && <TriviaView />}
              {view === "prayer-wall" && <PrayerWallView />}
              {view === "apologetics" && <ApologeticsView />}
              {view === "shop" && <ShopView />}
              {view === "list-church" && <ListYourEntity variant="church" />}
              {view === "list-business" && <ListYourEntity variant="business" />}
              {view === "business-directory" && (
                <BusinessDirectoryView onListBusiness={() => goView("list-business")} />
              )}
              {view === "small-groups" && <ComingSoonView title="Small Groups" />}
              {view === "admin" && isAdmin && <AdminView />}
              {view === "admin" && !isAdmin && (
                <div className="text-center py-20">
                  <Shield size={32} className="mx-auto text-[#EF4444] mb-3" />
                  <p className="text-sm text-[#94A3B8]">You don't have permission to access the Admin Panel.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Nav — 4 quick slots + "More" button */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50 rounded-[20px] bg-[#111827]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-around h-14 px-1">
          {MOBILE_NAV.map(({ id, icon: Icon, label }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => goView(id)}
                className="flex flex-col items-center justify-center relative py-1"
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.6}
                    fill={active ? "currentColor" : "none"}
                    className={`transition-all duration-200 ${
                      active
                        ? "text-[#38BDF8] scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                        : "text-[#94A3B8] hover:text-white"
                    }`}
                  />
                  {active && (
                    <motion.div
                      layoutId="mobile-nav-indicator"
                      className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </div>
                <span
                  className={`text-[9px] font-bold tracking-wide mt-1 transition-all ${
                    active ? "text-white font-extrabold" : "text-[#94A3B8]"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}

          {/* "More" button — opens a sheet with all other views */}
          <button
            onClick={() => setShowMoreSheet(true)}
            className="flex flex-col items-center justify-center relative py-1"
          >
            <div className="relative flex items-center justify-center">
              <Grid
                size={20}
                strokeWidth={1.6}
                className="text-[#94A3B8] hover:text-white transition-colors"
              />
              {/* Active dot if current view is in the "More" list */}
              {MOBILE_MORE_VIEWS.some((v) => v.id === view) && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </div>
            <span
              className={`text-[9px] font-bold tracking-wide mt-1 transition-all ${
                MOBILE_MORE_VIEWS.some((v) => v.id === view)
                  ? "text-white font-extrabold"
                  : "text-[#94A3B8]"
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet — full navigation menu */}
      <AnimatePresence>
        {showMoreSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-end"
            onClick={(e) => e.target === e.currentTarget && setShowMoreSheet(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 380 }}
              className="bg-[#1C1929] border-t border-white/[0.08] rounded-t-[28px] w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-[#1C1929] flex items-center justify-between p-5 pb-3 border-b border-white/[0.04]">
                <div>
                  <h2 className="text-lg font-extrabold text-white">All Sections</h2>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Tap any to navigate</p>
                </div>
                <button
                  onClick={() => setShowMoreSheet(false)}
                  className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 grid grid-cols-3 gap-3">
                {/* Show the 4 quick-access views too, so users have everything in one place */}
                {[...MOBILE_NAV, ...MOBILE_MORE_VIEWS].filter(({ id }) => id !== "admin" || isAdmin).map(({ id, icon: Icon, label }) => {
                  const active = view === id;
                  return (
                    <button
                      key={id}
                      onClick={() => goView(id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                        active
                          ? "bg-[#7C3AED]/15 border-[#7C3AED]/40"
                          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          active ? "bg-[#7C3AED]/20" : "bg-white/[0.04]"
                        }`}
                      >
                        <Icon
                          size={18}
                          strokeWidth={active ? 2.4 : 1.8}
                          className={active ? "text-[#A78BFA]" : "text-[#94A3B8]"}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-bold text-center leading-tight ${
                          active ? "text-white" : "text-[#94A3B8]"
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Back to landing */}
              <div className="px-5 pb-6 pt-2 border-t border-white/[0.04]">
                <button
                  onClick={() => navigate("landing")}
                  className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <HomeIcon size={14} /> Back to Home Page
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── COMPACT UTILITY FOOTER ─── */}
      {/* Only shows in the authenticated app shell (not on admin).
          Landing/onboarding are already handled by early returns above.
          Focused flows (CompetitionQuiz, TriviaQuestion) are full-screen
          overlays with no footer. Admin has its own internal footer. */}
      {view !== "admin" && (
        <footer className="border-t border-white/[0.04] mt-8 pb-28 md:pb-4">
          <div className="max-w-[680px] mx-auto px-4 py-4 flex items-center justify-center gap-4">
            <a href="/privacy" className="text-[10px] text-[#475569] hover:text-white transition-colors">Privacy</a>
            <span className="text-[#1C1929]">·</span>
            <a href="/terms" className="text-[10px] text-[#475569] hover:text-white transition-colors">Terms</a>
            <span className="text-[#1C1929]">·</span>
            <a href="/help" className="text-[10px] text-[#475569] hover:text-white transition-colors">Help</a>
          </div>
        </footer>
      )}
    </div>
  );
}

function ComingSoonView({ title }: { title: string }) {
  return (
    <div className="max-w-[680px] mx-auto px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED]/15 to-[#EC4899]/15 border border-[#7C3AED]/25 mb-4">
        <Sparkles size={28} className="text-[#A78BFA]" />
      </div>
      <h2 className="text-xl font-extrabold text-white mb-2">{title}</h2>
      <p className="text-sm text-[#A09DB1] max-w-sm mx-auto">
        This section is coming soon. We're building {title.toLowerCase()} with the same care and
        prayer as everything else on Koino. Check back shortly — or explore Churches, Trivia,
        Apologetics, and more in the meantime!
      </p>
    </div>
  );
}
