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
  Home as HomeIcon,
  HeartHandshake,
  ListChecks,
  Library,
  Grid,
  X,
  Shield,
  FileText,
  HandHeart,
  Bell,
  CircleUser,
  PlusSquare,
  Users,
  Flower2,
  MonitorPlay,
  Church,
  ChevronDown,
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
import ComicLibraryView from "@/components/crosscrafted/ComicLibraryView";
import BusinessDirectoryView from "@/components/crosscrafted/BusinessDirectoryView";
import AppHomeView from "@/components/crosscrafted/AppHomeView";
import OnboardingView from "@/components/crosscrafted/OnboardingView";
import EditProfileView from "@/components/crosscrafted/EditProfileView";
import MatrimonyView from "@/components/matrimony/MatrimonyView";
import FeedView from "@/components/social/FeedView";
import GroupsView from "@/components/social/GroupsView";
import GroupDetailView from "@/components/social/GroupDetailView";
import ExploreView from "@/components/social/ExploreView";
import ReelsView from "@/components/social/ReelsView";
import WatchView from "@/components/social/WatchView";
import ComposerView from "@/components/social/ComposerView";
import SocialProfileView from "@/components/social/SocialProfileView";
import NotificationsView from "@/components/social/NotificationsView";
import PostDetail from "@/components/social/PostDetail";
import HomeRightRail from "@/components/social/HomeRightRail";
import type { Post } from "@/components/social/types";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";
import {
  DEFAULT_VERSION_REF,
  VERSION_STORAGE_KEY,
  sanitizeSavedVersionRef,
  type VersionRef,
} from "@/lib/bible-versions";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/use-user";

type View =
  | "landing"
  | "onboarding" // Profile setup flow (shown when !profileCompleted)
  | "home" // ── SOCIAL FEED (Task 50) — the default authenticated destination
  | "explore"
  | "reels" // full-screen vertical reels overlay (deep links, feed taps)
  | "watch" // Koino Watch hub — reels + Bible movies & stories + Christian videos
  | "notifications"
  | "groups" // Round 2: Groups & Fellowship discovery
  | "memorials" // Part 4: In Loving Memory → /memorials (public App Router page)
  | "group-detail" // Round 2: one group (posts, members, join)
  | "create"
  | "profile" // own social profile (SocialProfileView on own username)
  | "edit-profile"
  | "dashboard" // the previous App Home dashboard (moved — still fully available)
  | "bible"
  | "videos" // Part 5: Bible Movies & Videos → /videos (public App Router page; reachable via Watch — no sidebar entry)
  | "bible-plans"
  | "comic"
  | "churches"
  | "events"
  | "trivia"
  | "prayer-wall"
  | "apologetics"
  | "knowledge" // Articles & Knowledge (Phase 2) → /knowledge (public App Router page)
  | "shop"
  | "list-church"
  | "list-business" // kept for backward-compat route (the ListYourEntity form)
  | "business-directory" // public browse page
  | "small-groups"
  | "blog" // Blog → /blog (public App Router page, opens in new tab/route)
  | "support" // Support Koino → /support (public App Router page, accessible while authenticated)
  | "matrimony" // Task 74: private member-only matchmaking section (SPA view — never a public route)
  | "admin";

// ─── SIDEBAR — three-column social layout ───
// Six primary destinations stay permanently visible; every secondary feature
// lives in an organised, collapsible category below (nothing was removed).
// "App Home" (the feature dashboard) is intentionally NOT a duplicate sidebar
// link anymore — it opens via the "Explore All" button (side.exploreAll).
// Bible Comics is RESTORED here alongside the other Bible-related features.
// Bible Movies & Videos intentionally has NO separate sidebar entry: the
// Watch hub (primary link above) carries it as its "Bible Movies & Stories"
// category, with the full searchable library linked from Watch. One video
// destination, no duplicate navigation.
// Labels are i18n keys (labelKey) resolved via t() at render — never
// translated at module scope.
const PRIMARY_LINKS: { id: View; icon: typeof Search; labelKey: string }[] = [
  { id: "home", icon: HomeIcon, labelKey: "side.home" },
  { id: "explore", icon: Search, labelKey: "side.explore" },
  { id: "watch", icon: MonitorPlay, labelKey: "side.watch" },
  { id: "groups", icon: Users, labelKey: "side.groups" },
  { id: "bible", icon: BookOpen, labelKey: "side.bible" },
  { id: "events", icon: Calendar, labelKey: "side.events" },
];

const SIDEBAR_CATEGORIES: {
  labelKey: string;
  icon: typeof Search;
  links: { id: View; icon: typeof Search; labelKey: string }[];
}[] = [
  {
    labelKey: "side.cat.grow",
    icon: Sparkles,
    links: [
      { id: "knowledge", icon: Library, labelKey: "side.knowledge" },
      { id: "comic", icon: Sparkles, labelKey: "side.comics" },
      { id: "trivia", icon: Award, labelKey: "side.trivia" },
      { id: "apologetics", icon: ListChecks, labelKey: "side.apologetics" },
      { id: "prayer-wall", icon: HeartHandshake, labelKey: "side.prayerWall" },
    ],
  },
  {
    labelKey: "side.cat.community",
    icon: Church,
    links: [
      { id: "churches", icon: Church, labelKey: "side.churches" },
      { id: "memorials", icon: Flower2, labelKey: "side.memorials" },
    ],
  },
  {
    // Task 74: Matrimony is a TOP-LEVEL section (user-confirmed decision).
    // Member-only + 18+ enforced server-side; the view itself handles the
    // friendly eligibility gates (DOB missing / under 18).
    labelKey: "side.matrimony",
    icon: Heart,
    links: [
      { id: "matrimony", icon: Heart, labelKey: "side.matrimony" },
    ],
  },
  {
    labelKey: "side.cat.discover",
    icon: Store,
    links: [
      { id: "shop", icon: Store, labelKey: "side.marketplace" },
      { id: "business-directory", icon: Building2, labelKey: "side.businessDirectory" },
    ],
  },
  {
    labelKey: "side.cat.more",
    icon: Grid,
    links: [
      { id: "blog", icon: FileText, labelKey: "side.blog" },
      { id: "support", icon: HandHeart, labelKey: "side.support" },
      { id: "admin", icon: Shield, labelKey: "nav.admin" },
    ],
  },
];

// Mobile bottom nav — Instagram-style 5 quick slots per the social spec.
const MOBILE_NAV: { id: View; icon: typeof Search; labelKey: string }[] = [
  { id: "home", icon: HomeIcon, labelKey: "side.home" },
  { id: "explore", icon: Search, labelKey: "side.explore" },
  { id: "watch", icon: MonitorPlay, labelKey: "side.watch" },
  { id: "create", icon: PlusSquare, labelKey: "side.create" },
  { id: "profile", icon: CircleUser, labelKey: "side.profile" },
];

// Views that are NOT in the quick-access bottom nav (shown in the "More" sheet).
// Bible Movies & Videos is reached through Watch (bottom-nav quick slot) —
// no duplicate entry here.
const MOBILE_MORE_VIEWS: { id: View; icon: typeof Search; labelKey: string }[] = [
  { id: "groups", icon: Users, labelKey: "side.groups" },
  { id: "memorials", icon: Flower2, labelKey: "side.memorials" },
  { id: "matrimony", icon: Heart, labelKey: "side.matrimony" },
  { id: "dashboard", icon: Sparkles, labelKey: "side.appHome" },
  { id: "notifications", icon: Bell, labelKey: "side.notifications" },
  { id: "bible", icon: BookOpen, labelKey: "side.bible" },
  { id: "comic", icon: Sparkles, labelKey: "side.comics" },
  { id: "churches", icon: Search, labelKey: "side.churches" },
  { id: "events", icon: Calendar, labelKey: "side.events" },
  { id: "trivia", icon: Award, labelKey: "nav.trivia" },
  { id: "prayer-wall", icon: HeartHandshake, labelKey: "side.prayerWall" },
  { id: "apologetics", icon: ListChecks, labelKey: "side.apologetics" },
  { id: "knowledge", icon: Library, labelKey: "side.knowledge" },
  { id: "shop", icon: Store, labelKey: "side.marketplace" },
  { id: "business-directory", icon: Building2, labelKey: "side.businessDirectory" },
  { id: "blog", icon: FileText, labelKey: "side.blog" },
  { id: "support", icon: HandHeart, labelKey: "side.support" },
  { id: "admin", icon: Shield, labelKey: "nav.admin" },
];

export default function Home() {
  const t = useTranslation();
  const [view, setView] = useState<View>("landing");
  const { isAuthenticated, profileCompleted, isAdmin, username, loading: authLoading } = useSupabaseUser();
  // Bible version for surfaces that READ the saved selection (reading-plan
  // previews). The reader (BibleView) OWNS the selection — this only mirrors
  // it so plans preview through the SAME version the user reads, instead of
  // a hardcoded KJV. Re-read on every view change: switching to "bible-plans"
  // after changing the version in the Bible hub must pick up that selection
  // (same-tab changes do not fire 'storage' events). Cross-tab changes do,
  // so they are mirrored live. YouVersion refs stay intact: dormant/unavailable
  // providers surface the plans' per-reading localized load-failure notice —
  // never a silent English substitution.
  const [bibleVersionRef, setBibleVersionRef] = useState<VersionRef>(DEFAULT_VERSION_REF);
  useEffect(() => {
    try {
      setBibleVersionRef(sanitizeSavedVersionRef(localStorage.getItem(VERSION_STORAGE_KEY)));
    } catch {
      // storage unavailable — keep the default Koino version
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === VERSION_STORAGE_KEY) {
        setBibleVersionRef(sanitizeSavedVersionRef(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [view]);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const lastScrollY = useRef(0);
  // Bible Comics state — data-driven, not hardcoded.
  // comicBookId === null → Comics LIBRARY (default for the sidebar Comics
  // view and ?view=comic deep links); a bookId+chapter → the comic reader.
  const [comicBookId, setComicBookId] = useState<string | null>(null);
  const [comicChapter, setComicChapter] = useState(1);
  // Task 121 Part 1 — comic reader HISTORY integration. Opening a chapter
  // pushes /?comic=<bookId>/<chapter> onto the history stack so the BROWSER
  // back button (not only the in-app "← Comics Library" button) returns to
  // the library. comicPushCount tracks how many entries we pushed for the
  // CURRENT reader session so the in-app button can unwind all of them in
  // one go(-n) (chapter-to-chapter navigation pushes one entry per chapter).
  const comicPushCount = useRef(0);

  const openComicChapter = (bookId: string, chapter: number) => {
    setComicBookId(bookId);
    setComicChapter(chapter);
    setView("comic");
    setHeaderVisible(true);
    setShowMoreSheet(false);
    try {
      window.history.pushState(
        { koinoComic: { bookId, chapter }, koinoSeq: comicPushCount.current + 1 },
        "",
        `/?comic=${encodeURIComponent(bookId)}/${chapter}`
      );
      comicPushCount.current += 1;
    } catch {
      /* history unavailable — state-only navigation still works */
    }
  };

  const closeComicReader = () => {
    setComicBookId(null);
    const pushed = comicPushCount.current;
    comicPushCount.current = 0;
    try {
      if (pushed > 0) {
        // Unwind every pushed chapter entry in one step; popstate lands on
        // the pre-reader entry (library or Bible hub) and syncs the UI.
        window.history.go(-pushed);
      } else if (/comic=/.test(window.location.search)) {
        // Deep-link arrival (?comic=…, nothing pushed): clean the URL.
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      /* ignore */
    }
  };

  // popstate: sync the reader when the user moves through pushed comic
  // entries (browser back/forward). A koinoComic entry opens that chapter;
  // a non-comic entry closes the reader if one is open (library renders).
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const st = e.state as {
        koinoComic?: { bookId: string; chapter: number };
        koinoSeq?: number;
      } | null;
      if (st?.koinoComic) {
        comicPushCount.current = st.koinoSeq ?? comicPushCount.current;
        setComicBookId(st.koinoComic.bookId);
        setComicChapter(st.koinoComic.chapter);
        setView((cur) => (cur === "comic" ? cur : "comic"));
        setHeaderVisible(true);
      } else {
        comicPushCount.current = 0;
        setComicBookId((cur) => (cur !== null ? null : cur));
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // ─── SOCIAL OVERLAYS (Task 50) — render above ANY view ───
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [reelPost, setReelPost] = useState<Post | null>(null);
  const [exploreHashtag, setExploreHashtag] = useState<string | null>(null);
  // Which profile the "profile" view shows — the session user by default,
  // or the ?user= deep-link target.
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  // Task 121: shared event links (?view=events&event=<id>) open that event.
  const [deepLinkedEventId, setDeepLinkedEventId] = useState<string | null>(null);
  const [deepLinkedChurchId, setDeepLinkedChurchId] = useState<string | null>(null);
  // PART 2: /?view=apologetics&question=<id> — deep link into a Q&A modal
  const [deepLinkedQuestionId, setDeepLinkedQuestionId] = useState<string | null>(null);
  // Part 5: Bible reader deep target — ?view=bible&book=genesis&chapter=1
  // lets video pages open the EXISTING reader at a linked passage.
  const [bibleTarget, setBibleTarget] = useState<{ bookId: string; chapter: number; verse?: number | null } | null>(null);
  // Sign-out transition tracking: lets the entry-routing effect distinguish
  // "auth just resolved" from "user signed out" so signed-out visitors keep
  // browsing the public landing page without being bounced.
  const wasAuthenticated = useRef(false);

  // ─── SIDEBAR COLLAPSIBLE CATEGORIES ───
  // Open/closed state persists in localStorage; the category holding the
  // active view always auto-expands so the current page is never hidden.
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("koino.sidebar.open");
      if (saved) setOpenCategories(JSON.parse(saved));
    } catch {}
  }, []);
  const toggleCategory = (label: string) => {
    setOpenCategories((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        window.localStorage.setItem("koino.sidebar.open", JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  useEffect(() => {
    const cat = SIDEBAR_CATEGORIES.find((c) => c.links.some((l) => l.id === view));
    if (cat) setOpenCategories((prev) => (prev[cat.labelKey] ? prev : { ...prev, [cat.labelKey]: true }));
  }, [view]);

  // ─── NOTIFICATIONS UNREAD BADGE ─── lightweight refresh on view change
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetch("/api/social/notifications?unread=1&limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { unreadCount?: number } | null) => {
        if (!cancelled && d && typeof d.unreadCount === "number") setUnreadCount(d.unreadCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [view, isAuthenticated]);

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

  // ─── AUTH-AWARE ENTRY ROUTING (Task 49) ───
  // When auth resolves while the user is sitting on the public landing page,
  // route them straight into the app: incomplete profile → onboarding,
  // complete profile → home feed. This kills the "sign in, then click Enter
  // again" bounce. A sign-out TRANSITION does NOT trigger this — signed-out
  // visitors stay on the public page and can keep browsing.
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && !wasAuthenticated.current) {
      if (view === "landing") {
        navigate(profileCompleted ? "home" : "onboarding");
      }
    }
    wasAuthenticated.current = isAuthenticated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, profileCompleted]);

  // ─── DEEP-LINK ROUTING FROM ?view=<view> QUERY PARAM ───
  // Footer links and shared URLs use /?view=bible, /?view=comic, etc.
  // On mount (and when auth state changes), if the URL has a ?view= param,
  // route the SPA to that view directly — but ONLY if the user is
  // authenticated AND has completed onboarding. For unauthenticated
  // visitors, they land on the public landing page (they can sign in
  // and then click the footer link again, or use Enter App).
  // Supported deep-link views: bible, comic, churches, events, trivia,
  // prayer-wall, apologetics, shop, business-directory.
  // This effect runs ONCE on initial mount — it does not re-run on every
  // navigation (otherwise clicking sidebar items would fight with the URL).
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !profileCompleted) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const deepView = params.get("view");
    const deepPost = params.get("post");
    const deepUser = params.get("user");
    const deepReel = params.get("reel");
    const deepHashtag = params.get("hashtag");
    const deepGroup = params.get("group");

    // Group invite links (community upgrade): /?view=group-detail&group=<id>
    if (deepView === "group-detail" && deepGroup) {
      setSelectedGroupId(deepGroup);
      navigate("group-detail");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }

    // Bible Comics share deep links: /?comic=<bookId>/<chapter>
    // (generated by ComicView's Share action — now actually honored).
    const deepComic = params.get("comic");
    if (deepComic && /^[a-z0-9_]+\/\d+$/.test(deepComic)) {
      const [cBook, cChapter] = deepComic.split("/");
      setComicBookId(cBook);
      setComicChapter(Math.max(1, parseInt(cChapter, 10) || 1));
      navigate("comic");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }

    // Social deep links (Task 50): ?post= ?user= ?reel= ?hashtag=
    if (deepPost) setDetailPostId(deepPost);
    if (deepUser) setProfileUsername(deepUser);
    if (deepHashtag) {
      setExploreHashtag(deepHashtag);
      navigate("explore");
    } else if (deepUser) {
      navigate("profile");
    } else if (deepReel) {
      setDetailPostId(null);
      navigate("reels");
    }
    if (deepPost || deepUser || deepReel || deepHashtag) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
      return;
    }
    if (!deepView) return;

    // Part 5: Bible passage deep links from video pages — and, since Task 121,
    // shared verse links carry an optional &verse= that scrolls to the verse.
    if (deepView === "bible") {
      const book = params.get("book");
      const chapter = params.get("chapter");
      if (book && /^[a-z0-9_]{2,20}$/.test(book)) {
        const ch = chapter ? parseInt(chapter, 10) : 1;
        const vsRaw = params.get("verse");
        const vs = vsRaw ? parseInt(vsRaw, 10) : NaN;
        setBibleTarget({
          bookId: book,
          chapter: Number.isFinite(ch) && ch > 0 ? ch : 1,
          verse: Number.isFinite(vs) && vs > 0 ? vs : null,
        });
      }
    }

    // Task 121: shared event links — ?view=events&event=<id>
    if (deepView === "events") {
      const ev = params.get("event");
      if (ev && /^[a-zA-Z0-9_-]{6,40}$/.test(ev)) {
        setDeepLinkedEventId(ev);
      }
    }

    // PART 2: shared Q&A links — ?view=apologetics&question=<id>
    if (deepView === "apologetics") {
      const qid = params.get("question");
      if (qid && /^[a-zA-Z0-9_-]{6,40}$/.test(qid)) {
        setDeepLinkedQuestionId(qid);
      }
    }

    // Shared church links — ?view=churches&church=<id> opens that listing
    if (deepView === "churches") {
      const cid = params.get("church");
      if (cid && /^[a-zA-Z0-9_-]{6,40}$/.test(cid)) {
        setDeepLinkedChurchId(cid);
      }
    }

    // Prayer-wall discussion deep links (?view=prayer-wall&prayer=<id>, used
    // by notification hrefs): KEEP the prayer param in the URL — PrayerWallView
    // consumes it on mount (opens + scrolls to the request) and then cleans
    // the URL itself. Stripping it here would break those links.
    if (deepView === "prayer-wall") {
      const pid = params.get("prayer");
      if (pid && /^[a-zA-Z0-9_-]{6,40}$/.test(pid)) {
        navigate(deepView);
        window.history.replaceState(
          {}, "",
          `${window.location.pathname}?prayer=${encodeURIComponent(pid)}${window.location.hash}`
        );
        return;
      }
    }

    // Validate that the deep-link view is a known SPA view.
    // Old `?view=videos` deep links redirect to the unified Watch hub —
    // Bible Movies & Videos is now a Watch category, and the /videos route
    // itself keeps working for bookmarks and external links.
    if (deepView === "videos") {
      navigate("watch");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }
    // Church detail deep links (?view=churches&church=<id>): KEEP the church
    // param — ChurchesView consumes it on mount (opens the listing) and then
    // cleans the URL itself. Stripping it here would break share links.
    if (deepView === "churches") {
      const cid = params.get("church");
      if (cid && /^[a-zA-Z0-9_-]{6,40}$/.test(cid)) {
        navigate(deepView);
        window.history.replaceState(
          {}, "",
          `${window.location.pathname}?church=${encodeURIComponent(cid)}${window.location.hash}`
        );
        return;
      }
    }
    const validViews: View[] = [
      "bible", "comic", "churches", "events", "trivia", "watch",
      "prayer-wall", "apologetics", "shop", "business-directory",
      "matrimony",
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
    // authenticated users reach /blog, /support WITHOUT logging
    // out (the public pages use PublicPageLayout, which works for both
    // authenticated and unauthenticated visitors).
    //
    // Fire-and-forget analytics if available, then perform a full route
    // navigation. Mirrors navigate() cleanup so the More sheet closes
    // immediately on mobile.
    if (v === "blog" || v === "support" || v === "memorials" || v === "videos" || v === "knowledge") {
      setShowMoreSheet(false);
      setHeaderVisible(true);
      try {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event:
              v === "blog" ? "blog_nav_click" :
              v === "memorials" ? "memorials_nav_click" :
              v === "videos" ? "videos_nav_click" :
              v === "knowledge" ? "knowledge_nav_click" :
              "support_koino_nav_click",
            source: "sidebar",
          }),
        }).catch(() => {});
      } catch {}
      if (typeof window !== "undefined") {
        window.location.href = v === "memorials" ? "/memorials" : `/${v}`;
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
              src={BRAND.assets.logo}
              alt={BRAND.name}
              width={32}
              height={32}
              className="rounded-lg shrink-0"
              priority
            />
            <h1 className="text-base md:text-lg font-black tracking-tight text-white">{BRAND.name}</h1>
          </button>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={() => goView("notifications")}
              className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
              title={t("side.notifications")}
              aria-label={t("side.notifications")}
            >
              <Bell
                size={18}
                strokeWidth={1.8}
                className={view === "notifications" ? "text-[#7C3AED]" : "text-[#64748B]"}
              />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EC4899] text-[9px] font-black text-white flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <HeaderUserSection onOpenProfile={() => goView("profile")} />
          </div>
          {/* Mobile: minimal right side */}
          <div className="md:hidden flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              onClick={() => goView("notifications")}
              className="relative w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06]"
              aria-label={t("side.notifications")}
            >
              <Bell size={15} className="text-[#94A3B8]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#EC4899] text-[8px] font-black text-white flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <HeaderUserSection mobile onOpenProfile={() => goView("profile")} />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-56 border-r border-white/[0.04] min-h-[calc(100vh-56px)] sticky top-[56px] bg-[#0B1120] px-3 pt-5 pb-6 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Primary navigation — always visible */}
          <nav className="space-y-1">
            {PRIMARY_LINKS.map(({ id, icon: Icon, labelKey }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => goView(id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-[14px] transition-all duration-200 border ${
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
                  {t(labelKey)}
                  {active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Feature dashboard — opens the existing App Home feature grid */}
          <button
            onClick={() => goView("dashboard")}
            className={`mt-4 w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold border transition-all duration-200 ${
              view === "dashboard"
                ? "bg-gradient-to-r from-[#7C3AED]/20 to-[#EC4899]/20 text-white border-[#7C3AED]/40"
                : "bg-gradient-to-r from-[#7C3AED]/10 to-[#EC4899]/10 text-[#C4B5FD] border-[#7C3AED]/20 hover:text-white hover:border-[#7C3AED]/40"
            }`}
          >
            <Sparkles size={16} strokeWidth={1.8} />
            {t("side.exploreAll")}
          </button>

          {/* Secondary features — organised collapsible categories */}
          <div className="mt-4 space-y-0.5">
            {SIDEBAR_CATEGORIES.map((cat) => {
              const links = cat.links.filter(({ id }) => id !== "admin" || isAdmin);
              if (links.length === 0) return null;
              const open = !!openCategories[cat.labelKey];
              const containsActive = links.some(({ id }) => id === view);
              return (
                <div key={cat.labelKey}>
                  <button
                    onClick={() => toggleCategory(cat.labelKey)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider text-[#64748B] hover:text-white hover:bg-white/[0.03] transition-all"
                  >
                    <cat.icon size={13} strokeWidth={2} />
                    <span className="flex-1 text-left">{t(cat.labelKey)}</span>
                    {containsActive && !open && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
                    )}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="mt-0.5 mb-1.5 space-y-0.5">
                      {links.map(({ id, icon: Icon, labelKey }) => {
                        const active = view === id;
                        return (
                          <button
                            key={id}
                            onClick={() => goView(id)}
                            className={`w-full flex items-center gap-2.5 pl-9 pr-3 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 border ${
                              active
                                ? "bg-[#7C3AED]/15 text-white border-[#7C3AED]/30"
                                : "text-[#94A3B8] hover:text-white hover:bg-white/[0.04] border-transparent"
                            }`}
                          >
                            <Icon
                              size={15}
                              strokeWidth={active ? 2.4 : 1.8}
                              className={active ? "text-[#7C3AED]" : ""}
                            />
                            {t(labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 pb-24 md:pb-6 scroll-smooth bg-[#0B1120] min-h-[calc(100vh-56px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {view === "home" && (
                <FeedView
                  onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
                  onHashtag={(tag) => { setExploreHashtag(tag || null); goView("explore"); }}
                  onOpenCreate={() => goView("create")}
                  onOpenEvents={() => goView("events")}
                  deepLinkPostId={detailPostId && view === "home" ? detailPostId : null}
                />
              )}
              {view === "groups" && (
                <GroupsView
                  onOpenGroup={(id) => { setSelectedGroupId(id); goView("group-detail"); }}
                  onBack={() => goView("home")}
                />
              )}
              {view === "group-detail" && selectedGroupId && (
                <GroupDetailView
                  groupId={selectedGroupId}
                  onBack={() => goView("groups")}
                  onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
                  onHashtag={(tag) => { setExploreHashtag(tag || null); goView("explore"); }}
                />
              )}
              {view === "explore" && (
                <ExploreView
                  onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
                  onHashtag={(tag) => setExploreHashtag(tag || null)}
                  initialHashtag={exploreHashtag}
                  onNavigate={(v) => goView(v as View)}
                />
              )}
              {view === "watch" && (
                <WatchView
                  onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
                  onOpenCreate={() => goView("create")}
                  onOpenComics={() => goView("comic")}
                  onHashtag={(tag) => { setExploreHashtag(tag || null); goView("explore"); }}
                />
              )}
              {view === "reels" && (
                <ReelsView
                  onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
                  onClose={() => goView("home")}
                  onOpenPost={(id) => { setDetailPostId(id); }}
                />
              )}
              {view === "notifications" && (
                <NotificationsView
                  onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
                  onOpenPost={(postId) => setDetailPostId(postId)}
                />
              )}
              {view === "create" && (
                <ComposerView onClose={() => goView("home")} onPosted={() => goView("home")} />
              )}
              {view === "edit-profile" && (
                <EditProfileView onDone={() => goView("profile")} />
              )}
              {view === "profile" && !username && !profileUsername && (
                <EditProfileView onDone={() => goView("home")} />
              )}
              {view === "profile" &&
                (username || profileUsername) &&
                (profileUsername || username) && (
                  <SocialProfileView
                    username={profileUsername || username!}
                    onBack={() => goView("home")}
                    onOpenProfile={(u) => setProfileUsername(u)}
                    onHashtag={(tag) => { setExploreHashtag(tag || null); goView("explore"); }}
                    onEditProfile={() => goView("edit-profile")}
                    key={profileUsername || username}
                  />
                )}
              {view === "dashboard" && (
                <AppHomeView
                  onNavigate={(v) => goView(v)}
                />
              )}
              {view === "bible" && (
                <BibleView
                  initialBookId={bibleTarget?.bookId}
                  initialChapter={bibleTarget?.chapter}
                  initialVerse={bibleTarget?.verse ?? null}
                  onOpenComic={(bookId, chapter) => {
                    // Switch from Bible hub → full ComicView for the chosen
                    // chapter (pushes a history entry). popstate's non-comic
                    // branch only clears the reader and never restores the
                    // bible view, so BOTH browser back and the in-app
                    // "Back to Bible Comics" button land on the comics
                    // library; a further browser back returns to the hub.
                    openComicChapter(bookId, chapter);
                  }}
                  // Passage action panel (reader ↔ existing hubs):
                  onOpenTrivia={() => goView("trivia")}
                  onPray={() => goView("prayer-wall")}
                />
              )}
              {view === "bible-plans" && (
                <BiblePlansView
                  versionRef={bibleVersionRef}
                  onOpenChapter={() => goView("bible")}
                />
              )}
              {view === "comic" && !comicBookId && (
                // Comics LIBRARY — the default surface for the sidebar
                // "Bible Comics" item and ?view=comic deep links.
                <ComicLibraryView
                  onOpenComic={(bookId, chapter) => openComicChapter(bookId, chapter)}
                />
              )}
              {view === "comic" && comicBookId && (
                <ComicView
                  bookId={comicBookId}
                  chapter={comicChapter}
                  onBackToLibrary={closeComicReader}
                  onNavigateChapter={(bid, ch) => {
                    // Prev/Next inside the reader pushes its own entry so
                    // browser back walks the chapter history (Task 121).
                    openComicChapter(bid, ch);
                  }}
                  onReadChapter={(bid, ch) => {
                    goView("bible");
                  }}
                  onPray={(prompt) => {
                    goView("prayer-wall");
                  }}
                  onDiscuss={(topic) => {
                    toast(t("bible.discussSoonToast"), { description: topic });
                  }}
                />
              )}
              {view === "churches" && (
                <ChurchesView
                  initialOpenChurchId={deepLinkedChurchId}
                  onListChurch={() => goView("list-church")}
                />
              )}
              {view === "events" && <EventsView initialEventId={deepLinkedEventId} />}
              {view === "trivia" && <TriviaView />}
              {view === "prayer-wall" && <PrayerWallView />}
              {view === "apologetics" && <ApologeticsView deepLinkQuestionId={deepLinkedQuestionId} />}
              {view === "shop" && <ShopView />}
              {view === "list-church" && <ListYourEntity variant="church" />}
              {view === "list-business" && <ListYourEntity variant="business" />}
              {view === "business-directory" && (
                <BusinessDirectoryView onListBusiness={() => goView("list-business")} />
              )}
              {view === "small-groups" && <ComingSoonView title={t("side.smallGroups")} />}
              {view === "matrimony" && (
                <MatrimonyView
                  onBack={() => goView("home")}
                  onOpenAccountSettings={() => goView("edit-profile")}
                />
              )}
              {view === "admin" && isAdmin && <AdminView />}
              {view === "admin" && !isAdmin && (
                <div className="text-center py-20">
                  <Shield size={32} className="mx-auto text-[#EF4444] mb-3" />
                  <p className="text-sm text-[#94A3B8]">{t("side.adminDenied")}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ─── RIGHT DISCOVERY COLUMN — signed-in home only, xl+ screens ───
            Real, data-driven community content (people, verse, events,
            trending). Hidden below xl — the feed's own rails cover tablet,
            and mobile keeps its compact nav + full-width feed. */}
        {view === "home" && (
          <aside className="hidden xl:block w-[300px] shrink-0 border-l border-white/[0.04] bg-[#0B1120] px-4 pt-4 pb-6">
            <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <HomeRightRail
                onOpenProfile={(u) => {
                  setProfileUsername(u);
                  goView("profile");
                }}
                onHashtag={(tag) => {
                  setExploreHashtag(tag || null);
                  goView("explore");
                }}
                onOpenEvents={() => goView("events")}
                onOpenPassage={(bookId, chapter) => {
                  setBibleTarget({ bookId, chapter });
                  goView("bible");
                }}
              />
            </div>
          </aside>
        )}
      </div>

      {/* ─── SOCIAL OVERLAYS — render above ANY view (Task 50) ─── */}
      {detailPostId && (
        <PostDetail
          postId={detailPostId}
          onClose={() => setDetailPostId(null)}
          onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
          onHashtag={(tag) => { setExploreHashtag(tag || null); setDetailPostId(null); goView("explore"); }}
        />
      )}
      {reelPost && (
        <ReelsView
          initialPostId={reelPost.id}
          onClose={() => setReelPost(null)}
          onOpenProfile={(u) => { setProfileUsername(u); goView("profile"); }}
          onOpenPost={(id) => { setReelPost(null); setDetailPostId(id); }}
        />
      )}

      {/* Mobile Bottom Nav — 4 quick slots + "More" button */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50 rounded-[20px] bg-[#111827]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-around h-14 px-1">
          {MOBILE_NAV.map(({ id, icon: Icon, labelKey }) => {
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
                  {t(labelKey)}
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
              {t("side.more")}
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
                  <h2 className="text-lg font-extrabold text-white">{t("side.allSections")}</h2>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{t("side.tapToNavigate")}</p>
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
                {[...MOBILE_NAV, ...MOBILE_MORE_VIEWS].filter(({ id }) => id !== "admin" || isAdmin).map(({ id, icon: Icon, labelKey }) => {
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
                        {t(labelKey)}
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
                  <HomeIcon size={14} /> {t("side.backToHome")}
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
            <a href="/privacy" className="text-[10px] text-[#475569] hover:text-white transition-colors">{t("footer.privacyShort")}</a>
            <span className="text-[#1C1929]">·</span>
            <a href="/terms" className="text-[10px] text-[#475569] hover:text-white transition-colors">{t("footer.termsShort")}</a>
            <span className="text-[#1C1929]">·</span>
            <a href="/help" className="text-[10px] text-[#475569] hover:text-white transition-colors">{t("publicNav.help")}</a>
          </div>
        </footer>
      )}
    </div>
  );
}

function ComingSoonView({ title }: { title: string }) {
  const t = useTranslation();
  return (
    <div className="max-w-[680px] mx-auto px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED]/15 to-[#EC4899]/15 border border-[#7C3AED]/25 mb-4">
        <Sparkles size={28} className="text-[#A78BFA]" />
      </div>
      <h2 className="text-xl font-extrabold text-white mb-2">{title}</h2>
      <p className="text-sm text-[#A09DB1] max-w-sm mx-auto">
        {t("comingSoon.body", { title: title.toLowerCase() })}
      </p>
    </div>
  );
}
