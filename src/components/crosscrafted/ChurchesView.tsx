"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Users,
  Plus,
  UserPlus,
  UserMinus,
  Clock,
  X,
  Filter,
  Globe,
  ShieldCheck,
  Search,
  Trash2,
  Phone,
  Heart,
  Building2,
  Share2,
  Navigation,
  CalendarDays,
  Flag,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import {
  INDIAN_STATES,
  LANGUAGES,
  CHURCH_GRADIENTS,
  type Church,
  type ServiceTime,
} from "@/lib/crosscrafted-data";
import ImagePicker from "@/components/crosscrafted/ImagePicker";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { toast } from "sonner";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";

type Props = {
  initialOpenChurchId?: string | null;
  /** Called when user taps "+ List Your Church" — parent navigates to the dedicated listing page. */
  onListChurch?: () => void;
};

type DiscoverTab = "discover" | "my-churches";

export default function ChurchesView({ initialOpenChurchId, onListChurch }: Props) {
  const t = useTranslation();
  const { isAuthenticated } = useSupabaseUser();
  // ─── PUBLISHED CHURCHES (loaded from real DB via /api/churches) ───
  // The CHURCHES mock array is NO LONGER used at runtime — all churches come
  // from the database. status=PUBLISHED only (server-enforced).
  // User-submitted churches are saved with status=PENDING and only appear
  // here after admin approval.
  const [churches, setChurches] = useState<Church[]>([]);
  const [churchesLoading, setChurchesLoading] = useState(true);
  const [churchesError, setChurchesError] = useState<string | null>(null);
  // REAL follow state — hydrated from /api/churches/follows on mount and
  // persisted via POST/DELETE /api/churches/[id]/follow.
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("discover");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterDenomination, setFilterDenomination] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterServiceDay, setFilterServiceDay] = useState("");
  const [sortBy, setSortBy] = useState<"featured" | "name" | "newest">("featured");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openChurch, setOpenChurch] = useState<Church | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  // Share (existing ShareSheet — public directory link + branded card)
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
  // Upcoming events linked to the open church (name match, server-verified)
  const [churchEvents, setChurchEvents] = useState<Array<{ id: string; title: string; when: string; where: string; isOnline: boolean }>>([]);
  const [churchEventsLoading, setChurchEventsLoading] = useState(false);
  // Flag incorrect public information (reuses Report model)
  const [flagFor, setFlagFor] = useState<Church | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetails, setFlagDetails] = useState("");
  // Groups affiliated with the currently-open church (community upgrade).
  const [churchGroups, setChurchGroups] = useState<
    Array<{ id: string; name: string; description: string | null; category: string; coverGradient: number; logoUrl: string | null; city: string | null; state: string | null; churchVerified: boolean; memberCount: number }>
  >([]);
  const [churchGroupsLoading, setChurchGroupsLoading] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    location: string;
    state: string;
    city: string;
    languages: string[];
    denomination: string;
    images: string[];
    whatsapp_number: string;
    service_times: ServiceTime[];
  }>({
    name: "",
    description: "",
    location: "",
    state: "",
    city: "",
    languages: [],
    denomination: "",
    images: [],
    whatsapp_number: "",
    service_times: [{ language: "English", day: "Sunday", time: "" }],
  });

  const addServiceTime = () => {
    setFormData((prev) => ({
      ...prev,
      service_times: [...prev.service_times, { language: "English", day: "Sunday", time: "" }],
    }));
  };

  const removeServiceTime = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      service_times: prev.service_times.filter((_, i) => i !== idx),
    }));
  };

  const updateServiceTime = (idx: number, field: keyof ServiceTime, value: string) => {
    setFormData((prev) => ({
      ...prev,
      service_times: prev.service_times.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  // ─── Fetch published churches from the database ───
  // Public API returns ONLY status=PUBLISHED churches (server-enforced).
  const loadChurches = async () => {
    setChurchesLoading(true);
    setChurchesError(null);
    try {
      const res = await fetch("/api/churches", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("churches.error.load"));
      setChurches(data.churches || []);
    } catch (e: any) {
      setChurchesError(e.message || t("churches.error.load"));
      setChurches([]); // graceful fallback — empty state, not a crash
    } finally {
      setChurchesLoading(false);
    }
  };

  useEffect(() => {
    loadChurches();
  }, []);

  // Hydrate REAL follow state from the DB (auth only).
  useEffect(() => {
    if (!isAuthenticated) {
      setFollowed(new Set());
      return;
    }
    fetch("/api/churches/follows", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { followedChurchIds: [] }))
      .then((d) => setFollowed(new Set(d.followedChurchIds || [])))
      .catch(() => {
        /* non-fatal — follow state just stays empty */
      });
  }, [isAuthenticated]);

  // Deep link: /?view=churches&church=<id> opens that church's detail.
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || churchesLoading || !churches.length) return;
    deepLinkConsumed.current = true;
    const cid = initialOpenChurchId || new URLSearchParams(window.location.search).get("church");
    if (cid) {
      const target = churches.find((c) => c.id === cid);
      if (target) {
        setOpenChurch(target);
        setActiveImageIdx(0);
        setTimeout(
          () => document.getElementById(`church-${cid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
          300
        );
      } else {
        toast(t("churches.deeplink.unavailable"), { description: t("churches.deeplink.unavailableDesc") });
      }
      if (!initialOpenChurchId) {
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }
    }
  }, [churchesLoading, churches, initialOpenChurchId]);

  // Affiliated groups for the open church — public groups only, from the
  // dedicated public endpoint (no private group data ever reaches here).
  useEffect(() => {
    if (!openChurch) {
      setChurchGroups([]);
      return;
    }
    let cancelled = false;
    setChurchGroupsLoading(true);
    fetch(`/api/churches/${openChurch.id}/groups`)
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d) => {
        if (!cancelled) setChurchGroups(d.groups || []);
      })
      .catch(() => {
        if (!cancelled) setChurchGroups([]);
      })
      .finally(() => {
        if (!cancelled) setChurchGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openChurch]);

  // Upcoming events linked to the open church — server matches by name.
  useEffect(() => {
    if (!openChurch) {
      setChurchEvents([]);
      return;
    }
    let cancelled = false;
    setChurchEventsLoading(true);
    fetch(`/api/churches/${openChurch.id}/events`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => {
        if (!cancelled) setChurchEvents(d.events || []);
      })
      .catch(() => {
        if (!cancelled) setChurchEvents([]);
      })
      .finally(() => {
        if (!cancelled) setChurchEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openChurch]);

  const denominations = useMemo(() => {
    const set = new Set<string>();
    churches.forEach((c) => c.denomination && set.add(c.denomination));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [churches]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const cityQ = filterCity.trim().toLowerCase();
    const list = churches.filter((c) => {
      if (filterState && c.state !== filterState) return false;
      if (cityQ && !(c.city || "").toLowerCase().includes(cityQ)) return false;
      if (filterDenomination && c.denomination !== filterDenomination) return false;
      if (filterLanguage && !c.languages.includes(filterLanguage)) return false;
      if (filterServiceDay && !c.service_times.some((s) => s.day === filterServiceDay)) return false;
      if (q) {
        const haystack = `${c.name} ${c.city} ${c.state} ${c.denomination} ${c.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "newest") list.sort((a, b) => b.id.localeCompare(a.id)); // cuid ~ time-ordered
    // "featured" keeps the server order (featured first, then newest, then name)
    return list;
  }, [churches, filterState, filterCity, filterDenomination, filterLanguage, filterServiceDay, searchQuery, sortBy]);

  const activeFilters = [filterState, filterCity, filterDenomination, filterLanguage, filterServiceDay, searchQuery].filter(Boolean).length;

  // ─── REAL follow toggle — server-persisted, optimistic with rollback ───
  const toggleFollow = async (id: string) => {
    if (!isAuthenticated) {
      toast(t("common.signInRequired"), {
        description: t("churches.follow.signInDesc"),
      });
      return;
    }
    if (followBusy === id) return; // double-click guard
    setFollowBusy(id);
    const wasFollowing = followed.has(id);
    // Optimistic update
    setFollowed((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(id);
      else next.add(id);
      return next;
    });
    setChurches((cs) =>
      cs.map((c) =>
        c.id === id ? { ...c, followers_count: Math.max(0, c.followers_count + (wasFollowing ? -1 : 1)) } : c
      )
    );
    try {
      const res = await fetch(`/api/churches/${id}/follow`, {
        method: wasFollowing ? "DELETE" : "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Reconcile with server truth
      setFollowed((prev) => {
        const next = new Set(prev);
        if (data.following) next.add(id);
        else next.delete(id);
        return next;
      });
      setChurches((cs) => cs.map((c) => (c.id === id ? { ...c, followers_count: data.followers } : c)));
      if (data.following && !wasFollowing) {
        toast.success(t("churches.follow.success"), { description: t("churches.follow.successDesc") });
      }
    } catch {
      // Roll back on failure
      setFollowed((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(id);
        else next.delete(id);
        return next;
      });
      setChurches((cs) =>
        cs.map((c) =>
          c.id === id ? { ...c, followers_count: Math.max(0, c.followers_count + (wasFollowing ? 1 : -1)) } : c
        )
      );
      toast.error(t("churches.follow.error"));
    } finally {
      setFollowBusy(null);
    }
  };

  const openChurchShare = (c: Church) => {
    const url = `${window.location.origin}/?view=churches&church=${c.id}`;
    setShareReq({
      heading: t("churches.shareHeading"),
      shareText: `${c.name}${c.denomination ? ` — ${c.denomination}` : ""}\n${[c.city, c.state].filter(Boolean).join(", ")}\n\n${t("churches.shareTextSuffix")}`,
      shareUrl: url,
      cardUrl: `/api/share-card?type=church&id=${c.id}`,
      formats: ["square", "story"],
      fileName: `koino-church-${c.id}.png`,
    });
  };

  const submitFlag = async () => {
    if (!flagFor) return;
    try {
      const res = await fetch(`/api/churches/${flagFor.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: flagReason || "incorrect_information",
          details: flagDetails.trim() || null,
        }),
      });
      if (res.status === 401) {
        toast(t("common.signInRequired"), { description: t("churches.report.signInDesc") });
        return;
      }
      if (!res.ok) throw new Error();
      toast.success(t("churches.report.success"));
      setFlagFor(null);
      setFlagReason("");
      setFlagDetails("");
    } catch {
      toast.error(t("churches.report.error"));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description) {
      toast.error(t("churches.form.errorRequired"));
      return;
    }
    if (!formData.state || !formData.city) {
      toast.error(t("churches.form.errorLocation"));
      return;
    }
    setSubmitting(true);
    try {
      const validServices = formData.service_times.filter((s) => s.time.trim());
      const res = await fetch("/api/churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          denomination: formData.denomination,
          state: formData.state,
          city: formData.city,
          location: formData.location,
          address: formData.location,
          languages: formData.languages,
          images: formData.images,
          cover_image: formData.images[0] || null,
          whatsapp_number: formData.whatsapp_number || null,
          service_times: validServices,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("churches.form.errorHttp", { status: res.status }));
      setShowCreateModal(false);
      setFormData({
        name: "",
        description: "",
        location: "",
        state: "",
        city: "",
        languages: [],
        denomination: "",
        images: [],
        whatsapp_number: "",
        service_times: [{ language: "English", day: "Sunday", time: "" }],
      });
      toast.success(t("churches.submit.success"), {
        description: t("churches.submit.successDesc"),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("churches.submit.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-28 md:pb-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t("churches.title")}</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">{t("churches.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              activeFilters > 0
                ? "bg-[#A855F7]/15 border-[#A855F7]/30 text-[#A855F7]"
                : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
            }`}
          >
            <Filter size={14} />
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#A855F7] text-white text-[9px] flex items-center justify-center font-bold">
                {activeFilters}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              // Primary "List Your Church" CTA — route to the dedicated
              // full-page listing flow (ListYourEntity variant="church")
              // when wired by the parent. Fall back to the in-page modal
              // only if no callback is provided (back-compat).
              if (onListChurch) {
                onListChurch();
              } else {
                setShowCreateModal(true);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, #A855F7, #F97316)" }}
          >
            <Plus size={14} /> {t("churches.listYourChurch")}
          </button>
        </div>
      </div>

      {/* ─── DISCOVER / MY CHURCHES TAB ─── */}
      <div className="mb-5">
        <div className="flex p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
          <button
            onClick={() => setDiscoverTab("discover")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              discoverTab === "discover"
                ? "bg-gradient-to-r from-[#2563EB] to-[#F97316] text-white shadow-lg shadow-[#2563EB]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Search size={13} /> {t("feed.tab.discover")}
          </button>
          <button
            onClick={() => setDiscoverTab("my-churches")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              discoverTab === "my-churches"
                ? "bg-gradient-to-r from-[#2563EB] to-[#F97316] text-white shadow-lg shadow-[#2563EB]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Heart size={13} /> {t("churches.tab.myChurches")}
          </button>
        </div>
      </div>

      {/* Filters + Church Cards — only in Discover tab */}
      {discoverTab === "discover" && (
        <>
      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <Search size={10} className="inline mr-0.5" /> {t("common.search")}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("churches.filter.searchPlaceholder")}
                  className="neo-input text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <MapPin size={10} className="inline mr-0.5" /> State
                </label>
                <select
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value)}
                  className="neo-input text-sm"
                >
                  <option value="">{t("common.allStates")}</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <MapPin size={10} className="inline mr-0.5" /> City
                </label>
                <input
                  type="text"
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  placeholder={t("churches.filter.cityPlaceholder")}
                  className="neo-input text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <Building2 size={10} className="inline mr-0.5" /> {t("churches.denomination")}
                </label>
                <select
                  value={filterDenomination}
                  onChange={(e) => setFilterDenomination(e.target.value)}
                  className="neo-input text-sm"
                >
                  <option value="">{t("churches.filter.allDenominations")}</option>
                  {denominations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <Globe size={10} className="inline mr-0.5" /> {t("common.language")}
                </label>
                <select
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                  className="neo-input text-sm"
                >
                  <option value="">{t("common.allLanguages")}</option>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <Clock size={10} className="inline mr-0.5" /> {t("churches.filter.serviceDay")}
                </label>
                <select
                  value={filterServiceDay}
                  onChange={(e) => setFilterServiceDay(e.target.value)}
                  className="neo-input text-sm"
                >
                  <option value="">{t("churches.filter.anyDay")}</option>
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setFilterState("");
                  setFilterCity("");
                  setFilterDenomination("");
                  setFilterLanguage("");
                  setFilterServiceDay("");
                  setSearchQuery("");
                }}
                className="mt-3 text-xs text-[#94A3B8] hover:text-white transition-colors"
              >
                {t("common.clearFilters")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <ArrowUpDown size={12} className="text-[#64748B]" />
        {([
          ["featured", t("common.featured")],
          ["name", t("common.sort.nameAZ")],
          ["newest", t("common.sort.newest")],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              sortBy === key ? "bg-white/[0.08] text-white" : "text-[#64748B] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Church Cards */}
      <div className="space-y-4">
        {/* Loading state */}
        {churchesLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#2563EB] animate-spin mb-3" />
            <p className="text-xs text-[#94A3B8]">{t("churches.loading")}</p>
          </div>
        )}

        {/* Error state — graceful, no crash */}
        {!churchesLoading && churchesError && (
          <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-2xl p-5 text-center">
            <p className="text-sm font-bold text-[#EF4444] mb-1">{t("churches.error.load")}</p>
            <p className="text-xs text-[#A09DB1] mb-3">{churchesError}</p>
            <button
              onClick={loadChurches}
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {/* Empty state — no published churches yet */}
        {!churchesLoading && !churchesError && churches.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/15 border border-[#2563EB]/25 mb-3">
              <Building2 size={24} className="text-[#60A5FA]" />
            </div>
            <p className="text-sm font-bold text-white mb-1">{t("churches.empty.title")}</p>
            <p className="text-xs text-[#A09DB1] mb-4 max-w-sm mx-auto">
              {t("churches.empty.desc")}
            </p>
            {isAuthenticated ? (
              <button
                onClick={() => (onListChurch ? onListChurch() : setShowCreateModal(true))}
                className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all"
              >
                {t("churches.listYourChurch")}
              </button>
            ) : (
              <a
                href="/api/auth/signin"
                className="inline-block px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all"
              >
                {t("churches.empty.signInCta")}
              </a>
            )}
          </div>
        )}

        {/* Filtered empty state — churches exist but none match the filters */}
        {!churchesLoading && !churchesError && churches.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-[#94A3B8] mb-1">{t("churches.emptyFiltered.title")}</p>
            <p className="text-xs text-[#64748B] mb-4">{t("churches.emptyFiltered.desc")}</p>
            <button
              onClick={() => {
                setFilterState("");
                setFilterCity("");
                setFilterDenomination("");
                setFilterLanguage("");
                setFilterServiceDay("");
                setSearchQuery("");
              }}
              className="px-5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
            >
              {t("common.clearFilters")}
            </button>
          </div>
        )}

        {filtered.map((church, i) => {
          const isFollowing = followed.has(church.id);
          return (
            <motion.div
              key={church.id}
              id={`church-${church.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              onClick={() => {
                setOpenChurch(church);
                setActiveImageIdx(0);
              }}
              className="rounded-2xl overflow-hidden cursor-pointer group border border-white/[0.06] hover:border-white/[0.12] transition-all bg-[#13294A]"
            >
              <div className="relative h-[200px]">
                {church.cover_image ? (
                  <img
                    src={church.cover_image}
                    alt={church.name}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ background: CHURCH_GRADIENTS[church.cover_gradient % CHURCH_GRADIENTS.length] }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/30 to-transparent" />
                {church.featured && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#F5B84A]/90 text-slate-950 text-[9px] font-extrabold uppercase tracking-wider">
                    {t("common.featured")}
                  </span>
                )}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/[0.1]">
                  <Users size={11} className="text-white/80" />
                  <span className="text-[10px] font-semibold text-white/80">
                    {church.followers_count.toLocaleString()}
                  </span>
                </div>
                <div className="absolute bottom-0 inset-x-0 p-4">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-bold text-white leading-tight">{church.name}</h3>
                    {church.verified && (
                      <ShieldCheck
                        size={16}
                        strokeWidth={2.5}
                        className="shrink-0 drop-shadow-lg"
                        style={{ color: "white", fill: "#3B82F6" }}
                        aria-label={t("churches.verifiedAria")}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-white/60" />
                      <span className="text-[12px] text-white/60">
                        {church.city ? `${church.city}, ` : ""}
                        {church.state}
                      </span>
                    </div>
                    {church.languages.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Globe size={11} className="text-white/50" />
                        <span className="text-[11px] text-white/50">
                          {church.languages.slice(0, 2).join(", ")}
                          {church.languages.length > 2 ? ` +${church.languages.length - 2}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4">
                {church.denomination && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/25 text-[#93C5FD] text-[10px] font-bold uppercase tracking-wider mb-2">
                    {church.denomination}
                  </span>
                )}
                {church.service_times.length > 0 && (
                  <div className="flex items-start gap-1.5 mb-2.5">
                    <Clock size={12} className="text-[#A855F7] mt-0.5 shrink-0" />
                    <span className="text-[11px] text-[#94A3B8]">
                      {church.service_times.slice(0, 2).map((s) => `${s.day} ${s.language} ${s.time}`).join(" · ")}
                      {church.service_times.length > 2 ? ` +${church.service_times.length - 2}` : ""}
                    </span>
                  </div>
                )}
                <p className="text-[13px] text-[#94A3B8] leading-[1.5] line-clamp-2 mb-3">
                  {church.description}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollow(church.id);
                    }}
                    disabled={followBusy === church.id}
                    className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-60 ${
                      isFollowing
                        ? "bg-white/[0.06] text-[#94A3B8] border border-white/[0.06]"
                        : "text-white hover:-translate-y-px"
                    }`}
                    style={
                      !isFollowing
                        ? {
                            background: "linear-gradient(135deg, #3B82F6, #A855F7)",
                            boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
                          }
                        : {}
                    }
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus size={13} /> {t("churches.following")}
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} /> {t("churches.follow")}
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenChurch(church);
                      setActiveImageIdx(0);
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-white/[0.04] border border-white/[0.08] text-[#93C5FD] hover:text-white transition-all"
                  >
                    {t("churches.viewChurch")}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
        </>
      )}

      {/* ─── MY CHURCHES TAB ─── */}
      {discoverTab === "my-churches" && (
        <MyChurchesView
          churches={churches}
          followedIds={followed}
          onOpenChurch={(c) => {
            setOpenChurch(c);
            setActiveImageIdx(0);
          }}
          onToggleFollow={toggleFollow}
          isAuthenticated={isAuthenticated}
          onListChurch={onListChurch}
          setShowCreateModal={setShowCreateModal}
        />
      )}

      {/* Church Detail Modal */}
      <AnimatePresence>
        {openChurch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60] p-0 md:p-6"
            onClick={(e) => e.target === e.currentTarget && setOpenChurch(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#13294A] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="relative h-48 md:h-56">
                {(() => {
                  const allImages = openChurch.images && openChurch.images.length > 0
                    ? openChurch.images
                    : openChurch.cover_image
                    ? [openChurch.cover_image]
                    : [];
                  const activeImg = allImages[activeImageIdx] || allImages[0];
                  if (activeImg) {
                    return (
                      <img
                        src={activeImg}
                        alt={openChurch.name}
                        className="w-full h-full object-cover"
                      />
                    );
                  }
                  return (
                    <div
                      className="w-full h-full"
                      style={{ background: CHURCH_GRADIENTS[openChurch.cover_gradient % CHURCH_GRADIENTS.length] }}
                    />
                  );
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-[#13294A] via-transparent to-transparent" />
                <button
                  onClick={() => setOpenChurch(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={18} />
                </button>
                {/* Image counter */}
                {openChurch.images && openChurch.images.length > 1 && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                    {activeImageIdx + 1} / {openChurch.images.length}
                  </span>
                )}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-extrabold text-white">{openChurch.name}</h2>
                    {openChurch.verified && (
                      <ShieldCheck
                        size={20}
                        strokeWidth={2.5}
                        style={{ color: "white", fill: "#3B82F6" }}
                        aria-label={t("churches.verifiedAria")}
                      />
                    )}
                  </div>
                  <p className="text-xs text-white/70">{openChurch.denomination || t("churches.fallbackDenomination")}</p>
                </div>
              </div>

              {/* Thumbnail strip */}
              {openChurch.images && openChurch.images.length > 1 && (
                <div className="px-5 pt-3 flex gap-2 overflow-x-auto pb-1">
                  {openChurch.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        idx === activeImageIdx
                          ? "border-[#A855F7] opacity-100"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("common.location")}</p>
                    <p className="text-xs text-white flex items-center gap-1">
                      <MapPin size={11} /> {openChurch.city}{openChurch.state ? `, ${openChurch.state}` : ""}
                    </p>
                    {(openChurch.address || openChurch.location) && (
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">{openChurch.address || openChurch.location}</p>
                    )}
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("churches.detail.followers")}</p>
                    <p className="text-xs text-white flex items-center gap-1">
                      <Users size={11} /> {openChurch.followers_count.toLocaleString()}
                    </p>
                  </div>
                </div>

                {openChurch.verified && (
                  <div className="bg-[#3B82F6]/8 border border-[#3B82F6]/20 rounded-xl p-3 flex items-start gap-2.5">
                    <ShieldCheck size={15} className="text-[#3B82F6] shrink-0 mt-0.5" style={{ fill: "rgba(59,130,246,0.15)" }} />
                    <p className="text-[11px] text-[#A09DB1] leading-relaxed">
                      <span className="font-bold text-white">{t("churches.verifiedBadge")}</span>{" "}
                      {t("churches.verifiedDesc")}
                    </p>
                  </div>
                )}

                {openChurch.service_times.length > 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-[#A855F7]" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{t("churches.serviceTimes")}</p>
                    </div>
                    <div className="space-y-1.5">
                      {openChurch.service_times.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-white font-bold">{t("churches.serviceLabel", { language: s.language })}</span>
                          <span className="text-[#94A3B8]">{s.day} · {s.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">About</p>
                  <p className="text-sm text-[#A09DB1] leading-relaxed">{openChurch.description}</p>
                  {openChurch.contactName && (
                    <p className="text-[11px] text-[#94A3B8] mt-2">
                      {t("churches.contact")}: <span className="font-bold text-white">{openChurch.contactName}</span>
                    </p>
                  )}
                </div>

                {openChurch.languages.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">{t("churches.languages")}</p>
                    <div className="flex flex-wrap gap-2">
                      {openChurch.languages.map((lang) => (
                        <span
                          key={lang}
                          className="px-3 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] text-[11px] font-semibold"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* GROUPS — real affiliated groups (community upgrade).
                    Display-only: this proves nothing about authorisation —
                    the official badge is the admin-controlled churchVerified
                    flag, and linking never grants church permissions. */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">{t("churches.groupsTitle")}</p>
                  {churchGroupsLoading ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
                      ))}
                    </div>
                  ) : churchGroups.length === 0 ? (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                      <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                        {t("churches.groupsEmpty", { name: openChurch.name })}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {churchGroups.map((g) => (
                        <a
                          key={g.id}
                          href={`/?view=group-detail&group=${g.id}`}
                          className="flex items-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl p-2.5 transition-colors"
                        >
                          {g.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={g.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                          ) : (
                            <span
                              className="w-9 h-9 rounded-lg shrink-0 inline-flex items-center justify-center text-white text-xs font-extrabold"
                              style={{ background: CHURCH_GRADIENTS[Math.abs(g.coverGradient) % CHURCH_GRADIENTS.length] }}
                            >
                              {g.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-white flex items-center gap-1 truncate">
                              {g.name}
                              {g.churchVerified && <ShieldCheck size={11} className="text-[#22D3EE] shrink-0" />}
                            </span>
                            <span className="text-[10px] text-[#94A3B8] block truncate">
                              {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                              {(g.city || g.state) && ` · ${[g.city, g.state].filter(Boolean).join(", ")}`}
                              {" · "}{g.category.replace("-", " ")}
                            </span>
                          </span>
                          <Users size={13} className="text-[#A855F7] shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming events linked to this church — shown only when
                    real event data names this church (server name-match). */}
                {(churchEventsLoading || churchEvents.length > 0) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2 flex items-center gap-1.5">
                      <CalendarDays size={11} /> {t("churches.upcomingEvents")}
                    </p>
                    {churchEventsLoading ? (
                      <div className="space-y-2">
                        {[...Array(2)].map((_, i) => (
                          <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {churchEvents.map((ev) => (
                          <a
                            key={ev.id}
                            href={`/?view=events&event=${ev.id}`}
                            className="flex items-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl p-2.5 transition-colors"
                          >
                            <span className="w-9 h-9 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/25 flex items-center justify-center shrink-0">
                              <CalendarDays size={14} className="text-[#93C5FD]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-white block truncate">{ev.title}</span>
                              <span className="text-[10px] text-[#94A3B8] block truncate">
                                {ev.when}{ev.where ? ` · ${ev.where}` : ""}
                              </span>
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {openChurch.whatsapp_number && (
                  <a
                    href={`https://wa.me/${openChurch.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      t("churches.whatsappPrefill", { name: openChurch.name })
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1FB855] text-white transition-all hover:-translate-y-px"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    {t("churches.contactWhatsApp")}
                  </a>
                )}

                {/* Action row — every button is a real, working action */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => toggleFollow(openChurch.id)}
                    disabled={followBusy === openChurch.id}
                    className={`py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${
                      followed.has(openChurch.id)
                        ? "bg-white/[0.06] text-[#94A3B8] border border-white/[0.06]"
                        : "text-white hover:-translate-y-px"
                    }`}
                    style={
                      !followed.has(openChurch.id)
                        ? {
                            background: "linear-gradient(135deg, #3B82F6, #A855F7)",
                            boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
                          }
                        : {}
                    }
                  >
                    {followed.has(openChurch.id) ? (
                      <span className="flex items-center justify-center gap-2">
                        <UserMinus size={14} /> {t("churches.following")}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <UserPlus size={14} /> {t("churches.followChurch")}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => openChurchShare(openChurch)}
                    className="py-3 rounded-xl text-sm font-bold bg-white/[0.04] border border-white/[0.08] text-[#93C5FD] hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={14} /> {t("churches.shareChurch")}
                  </button>
                </div>

                {/* Directions — Google Maps with the most specific destination
                    available (address > location summary > city, state). */}
                {(openChurch.address || openChurch.location || (openChurch.city && openChurch.state)) && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      [openChurch.address || openChurch.location, openChurch.city, openChurch.state]
                        .filter(Boolean)
                        .join(", ")
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-white transition-all"
                  >
                    <Navigation size={14} /> {t("churches.getDirections")}
                  </a>
                )}

                {openChurch.website && (
                  <a
                    href={/^https?:\/\//i.test(openChurch.website) ? openChurch.website : `https://${openChurch.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} /> {t("churches.visitWebsite")}
                  </a>
                )}

                <button
                  onClick={() => setFlagFor(openChurch)}
                  className="w-full text-center text-[10px] text-[#475569] hover:text-[#EF4444] transition-colors flex items-center justify-center gap-1.5 py-1"
                >
                  <Flag size={10} /> {t("churches.reportLink")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Church Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60]"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#13294A] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold gradient-text bg-gradient-to-r from-[#F97316] to-[#3B82F6] bg-clip-text text-transparent">
                  {t("churches.listYourChurch")}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-[#64748B] hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("churches.form.churchName")}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="neo-input text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      State
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="neo-input text-sm"
                    >
                      <option value="">{t("common.selectState")}</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="neo-input text-sm"
                      placeholder="City"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("churches.form.locationAddress")}
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="neo-input text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t("churches.denomination")}
                    </label>
                    <input
                      type="text"
                      value={formData.denomination}
                      onChange={(e) => setFormData({ ...formData, denomination: e.target.value })}
                      className="neo-input text-sm"
                      placeholder={t("churches.form.denominationPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      <Phone size={10} className="inline mr-0.5" /> {t("common.whatsappNumber")}
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      className="neo-input text-sm"
                      placeholder={t("common.whatsappPlaceholder")}
                    />
                  </div>
                </div>

                <ImagePicker
                  images={formData.images}
                  onChange={(images) => setFormData({ ...formData, images })}
                  max={5}
                  label={t("churches.form.photos")}
                />

                {/* Multi-row service times */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      <Clock size={10} className="inline mr-0.5" /> {t("churches.serviceTimes")}
                    </label>
                    <button
                      type="button"
                      onClick={addServiceTime}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/30 text-[#60A5FA] text-[10px] font-bold hover:bg-[#A855F7]/25 transition-all"
                    >
                      <Plus size={10} /> {t("churches.form.addService")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.service_times.map((svc, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <select
                          value={svc.language}
                          onChange={(e) => updateServiceTime(idx, "language", e.target.value)}
                          className="neo-input text-xs w-28 py-2"
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                        <select
                          value={svc.day}
                          onChange={(e) => updateServiceTime(idx, "day", e.target.value)}
                          className="neo-input text-xs w-28 py-2"
                        >
                          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={svc.time}
                          onChange={(e) => updateServiceTime(idx, "time", e.target.value)}
                          className="neo-input text-xs flex-1 py-2"
                          placeholder={t("churches.form.serviceTimePlaceholder")}
                        />
                        {formData.service_times.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeServiceTime(idx)}
                            className="p-2 text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-1.5">
                    {t("churches.form.serviceHint")}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("churches.form.languagesMulti")}
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                    {LANGUAGES.map((lang) => {
                      const selected = formData.languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              languages: selected
                                ? prev.languages.filter((l) => l !== lang)
                                : [...prev.languages, lang],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            selected
                              ? "bg-[#A855F7] text-white"
                              : "bg-white/[0.04] text-[#94A3B8] hover:text-white"
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="neo-input h-20 resize-none text-sm"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#F97316] hover:bg-[#EA580C] transition-all hover:-translate-y-px disabled:opacity-60"
                  >
                    {submitting ? t("common.submitting") : t("churches.form.submit")}
                  </button>
                  <p className="text-[10px] text-[#64748B] text-center leading-relaxed">
                    {t("churches.form.reviewNote")}
                  </p>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flag / report modal — incorrect public information */}
      <AnimatePresence>
        {flagFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-end md:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && setFlagFor(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#13294A] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-md p-5"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-white">{t("churches.report.title")}</h3>
                <button onClick={() => setFlagFor(null)} className="text-[#64748B] hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-[#A09DB1] mb-3">
                {t("churches.report.desc", { name: flagFor.name })}
              </p>
              <select
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="neo-input text-sm mb-2"
              >
                <option value="">{t("churches.report.optionPlaceholder")}</option>
                <option value="wrong_address">{t("churches.report.wrongAddress")}</option>
                <option value="wrong_times">{t("churches.report.wrongTimes")}</option>
                <option value="closed">{t("churches.report.closed")}</option>
                <option value="duplicate">{t("churches.report.duplicate")}</option>
                <option value="other">{t("churches.report.other")}</option>
              </select>
              <textarea
                value={flagDetails}
                onChange={(e) => setFlagDetails(e.target.value)}
                placeholder={t("churches.report.detailsPlaceholder")}
                className="neo-input h-20 resize-none text-sm mb-3"
                maxLength={1000}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setFlagFor(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={submitFlag}
                  className="px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold"
                >
                  {t("churches.report.submit")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share sheet — public directory link + branded card */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />
    </div>
  );
}

// ─── MY CHURCHES VIEW ────────────────────────────────────────────────────────
// Shows only the churches the current user is following. Auth-gated:
// unauthenticated users see a prompt to sign in.

function MyChurchesView({
  churches,
  followedIds,
  onOpenChurch,
  onToggleFollow,
  isAuthenticated,
  onListChurch,
  setShowCreateModal,
}: {
  churches: Church[];
  followedIds: Set<string>;
  onOpenChurch: (c: Church) => void;
  onToggleFollow: (id: string) => void;
  isAuthenticated: boolean;
  onListChurch?: () => void;
  setShowCreateModal: (v: boolean) => void;
}) {
  const t = useTranslation();
  const myChurches = churches.filter((c) => followedIds.has(c.id));

  // Auth gate — unauthenticated users can't have follows yet
  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <Heart size={32} className="mx-auto text-[#475569] mb-3" />
        <p className="text-sm text-[#94A3B8] mb-1">{t("churches.my.signInPrompt")}</p>
        <p className="text-[11px] text-[#64748B] mb-4">{t("churches.my.signInHint")}</p>
        <a
          href="/api/auth/signin"
          className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #A855F7, #F97316)" }}
        >
          {t("signin.submit.signin")}
        </a>
      </div>
    );
  }

  if (myChurches.length === 0) {
    return (
      <div className="text-center py-16">
        <Heart size={32} className="mx-auto text-[#475569] mb-3" />
        <p className="text-sm text-[#94A3B8] mb-1">{t("churches.my.empty")}</p>
        <p className="text-[11px] text-[#64748B] mb-4">{t("churches.my.emptyHint")}</p>
        <button
          onClick={() => onListChurch ? onListChurch() : setShowCreateModal(true)}
          className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #A855F7, #F97316)" }}
        >
          {t("churches.listYourChurch")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[#94A3B8]">
        {t("churches.my.count", { count: myChurches.length })}
      </p>
      {myChurches.map((church) => (
        <motion.div
          key={church.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onOpenChurch(church)}
          className="rounded-2xl overflow-hidden cursor-pointer group border border-white/[0.06] hover:border-white/[0.12] transition-all bg-[#13294A]"
        >
          <div className="flex gap-3 p-3">
            {/* Thumbnail */}
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#0f0f1a]">
              {church.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={church.cover_image}
                  alt={church.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ background: CHURCH_GRADIENTS[church.cover_gradient % CHURCH_GRADIENTS.length] }}
                />
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight truncate">{church.name}</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
                {church.city ? `${church.city}, ` : ""}{church.state}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                <Users size={11} className="text-[#94A3B8]" />
                <span className="text-[10px] text-[#94A3B8]">{t("churches.followers", { count: church.followers_count.toLocaleString() })}</span>
              </div>
            </div>
            {/* Following badge */}
            <div className="flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFollow(church.id);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/[0.06] text-[#94A3B8] border border-white/[0.06] hover:bg-white/[0.1] transition-all"
              >
                <span className="flex items-center gap-1">
                  <UserMinus size={11} /> {t("churches.following")}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
