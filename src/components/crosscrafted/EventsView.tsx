"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Clock,
  Filter,
  Globe,
  Search,
  Heart,
  Share2,
  Video,
  Radio,
  Bookmark,
  BookmarkCheck,
  Ticket,
  X,
  Music,
  BookOpen,
  Flame,
  TrendingUp,
  HandHelping,
  Sparkles,
  ImageOff,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  EVENT_CATEGORIES,
  EVENT_DATE_FILTERS,
  CHURCH_GRADIENTS,
  INDIAN_STATES,
  INDIAN_CITIES_BY_STATE,
  getCitiesForState,
  LANGUAGES,
  type EventItem,
} from "@/lib/crosscrafted-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import LordsbookCommunityCard from "@/components/crosscrafted/LordsbookCommunityCard";
import { MessageCircle, ExternalLink, Info } from "lucide-react";
const CATEGORY_ICONS: Record<string, typeof Music> = {
  worship: Music,
  "bible-study": BookOpen,
  conference: Sparkles,
  retreat: Flame,
  youth: TrendingUp,
  outreach: HandHelping,
  fellowship: Users,
  concert: Music,
  prayer: Heart,
  seminar: BookOpen,
  livestream: Radio,
  workshop: Filter,
};

const getCategoryMeta = (cat: string) => EVENT_CATEGORIES.find((c) => c.value === cat) || EVENT_CATEGORIES[0];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    weekday: d.toLocaleString("en-US", { weekday: "short" }).toUpperCase(),
    time: d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
};

const formatRelative = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "Ended";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
};

export default function EventsView() {
  const t = useTranslation();
  // ─── PUBLISHED EVENTS (loaded from real DB via /api/events) ───
  // The EVENTS mock array is NO LONGER used at runtime — all events come
  // from the database. status=PUBLISHED only (server-enforced).
  // User-submitted events are saved with status=PENDING and only appear
  // here after admin approval.
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  // Quick filter row: "near-you" | "all-india" | "online"
  // - "near-you" applies the user's selected state+city (if any)
  // - "all-india" clears all location filters
  // - "online" filters to events where eventType is "online" or "hybrid"
  const [quickFilter, setQuickFilter] = useState<"near-you" | "all-india" | "online">("all-india");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openEvent, setOpenEvent] = useState<EventItem | null>(null);
  const [eventForm, setEventForm] = useState({
    title: "", description: "", category: "",
    startDate: "", startTime: "", endDate: "", endTime: "", allDay: false,
    eventType: "in-person" as "in-person" | "online" | "hybrid",
    venueName: "", address: "", city: "", state: "", onlineUrl: "",
    registrationType: "free" as string,
    ticketUrl: "", whatsappNumber: "",
    organizerName: "", organizerEmail: "", organizerPhone: "", organizerWebsite: "",
    coverImage: "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);

  // ─── Fetch published events from the database ───
  // Public API returns ONLY status=PUBLISHED events (server-enforced).
  // Re-fetch after a user submits an event (so the list stays fresh if
  // admin approves quickly) — though the user's own event will still be
  // PENDING and won't appear here until approved.
  const loadEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load events");
      setEvents(data.events || []);
    } catch (e: any) {
      setEventsError(e.message || "Failed to load events");
      setEvents([]); // graceful fallback — empty state, not a crash
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      // Quick filter row
      if (quickFilter === "online") {
        // Online quick filter — only online + hybrid events
        if (e.eventType !== "online" && e.eventType !== "hybrid") return false;
      }
      // "near-you" applies the user's selected state+city (if any).
      // We don't silently assume a location — if no state is set, "near-you"
      // falls through to showing all events (with a banner prompting the user
      // to select their location).
      if (quickFilter === "near-you" && filterState) {
        if (e.state !== filterState) return false;
        if (filterCity && e.city !== filterCity) return false;
      }

      // Manual filter row (works in combination with quick filter)
      if (filterState && e.state !== filterState) return false;
      if (filterCity && e.city !== filterCity) return false;
      if (filterLanguage && !e.languages.includes(filterLanguage)) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${e.title} ${e.description} ${e.city} ${e.state} ${e.church} ${e.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      const now = new Date();
      const ed = new Date(e.date);
      if (dateFilter === "today" && ed.toDateString() !== now.toDateString()) return false;
      if (dateFilter === "tomorrow") {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        if (ed.toDateString() !== tomorrow.toDateString()) return false;
      }
      if (dateFilter === "weekend") {
        // Find upcoming Saturday (or today if today is Sat/Sun)
        const day = now.getDay(); // 0=Sun, 6=Sat
        const sat = new Date(now);
        sat.setDate(now.getDate() + ((6 - day + 7) % 7));
        const sun = new Date(sat);
        sun.setDate(sat.getDate() + 1);
        const eventDay = ed.toDateString();
        if (eventDay !== sat.toDateString() && eventDay !== sun.toDateString()) return false;
        if (ed < now) return false;
      }
      if (dateFilter === "week") {
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + 7);
        if (ed < now || ed > weekEnd) return false;
      }
      if (dateFilter === "month") {
        const monthEnd = new Date(now);
        monthEnd.setMonth(now.getMonth() + 1);
        if (ed < now || ed > monthEnd) return false;
      }
      return true;
    });
  }, [events, filterState, filterCity, filterLanguage, filterCategory, searchQuery, dateFilter, quickFilter]);

  // Split into Featured + Upcoming for the default landing experience.
  // Featured = explicitly marked featured. Upcoming = everything else that
  // hasn't ended. Cancelled events show with a CANCELLED badge.
  const featured = useMemo(() => filtered.filter((e) => e.featured), [filtered]);
  const upcoming = useMemo(
    () => filtered.filter((e) => !e.featured).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [filtered]
  );

  const activeFilters = [filterState, filterCity, filterLanguage, filterCategory, searchQuery, dateFilter !== "all" ? dateFilter : ""].filter(Boolean).length;

  // ─── IMAGE UPLOAD ───
  const eventImgInputRef = useRef<HTMLInputElement>(null);
  const handleEventImageUpload = async (file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) { toast.error("Please upload a JPG, PNG or WEBP image."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Please choose an image smaller than 5 MB."); return; }
    setImageUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/events/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setEventForm(f => ({ ...f, coverImage: data.url }));
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setImageUploading(false); if (eventImgInputRef.current) eventImgInputRef.current.value = ""; }
  };

  // ─── EVENT SUBMIT (real DB insert via POST /api/events) ───
  // The API creates the event with status=PENDING. Admin must approve it
  // before it appears publicly. Auth required (server-side check).
  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.description || !eventForm.startDate || !eventForm.category) {
      toast.error("Please fill in all required fields."); return;
    }
    if (!eventForm.allDay && !eventForm.startTime) { toast.error("Start time is required (or check 'All Day')."); return; }
    if (eventForm.eventType === "online" && !eventForm.onlineUrl) { toast.error("Online event link is required for online events."); return; }
    if ((eventForm.eventType === "in-person" || eventForm.eventType === "hybrid") && (!eventForm.city || !eventForm.state)) { toast.error("City and State are required for in-person/hybrid events."); return; }

    setSubmittingEvent(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventForm.title,
          description: eventForm.description,
          category: eventForm.category,
          startDate: eventForm.startDate,
          startTime: eventForm.allDay ? null : eventForm.startTime,
          endDate: eventForm.endDate || null,
          endTime: eventForm.allDay ? null : eventForm.endTime,
          allDay: eventForm.allDay,
          eventType: eventForm.eventType,
          venueName: eventForm.venueName,
          address: eventForm.address,
          city: eventForm.city,
          state: eventForm.state,
          country: "India",
          onlineUrl: eventForm.onlineUrl,
          registrationType: eventForm.registrationType,
          ticketUrl: eventForm.ticketUrl,
          whatsappNumber: eventForm.whatsappNumber,
          organizerName: eventForm.organizerName,
          organizerEmail: eventForm.organizerEmail,
          organizerPhone: eventForm.organizerPhone,
          organizerWebsite: eventForm.organizerWebsite,
          coverImage: eventForm.coverImage,
          coverGradient: Math.floor(Math.random() * 8),
          languages: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit event");
      }
      // Success — event created with status=PENDING
      setShowCreateModal(false);
      toast.success("Event submitted!", {
        description: "Your event will appear once approved by our team.",
      });
      setEventForm({
        title: "", description: "", category: "",
        startDate: "", startTime: "", endDate: "", endTime: "", allDay: false,
        eventType: "in-person", venueName: "", address: "", city: "", state: "", onlineUrl: "",
        registrationType: "free", ticketUrl: "", whatsappNumber: "",
        organizerName: "", organizerEmail: "", organizerPhone: "", organizerWebsite: "",
        coverImage: "",
      });
      // Refresh the published events list (in case admin approves quickly,
      // or to show the user that their submission was received server-side).
      // Note: the user's own event will still be PENDING and won't appear
      // here until admin approval — that's the correct moderation flow.
      loadEvents();
    } catch (err: any) {
      // Real error — do NOT pretend the event was created.
      console.error("[EventsView submitEvent] Error:", err);
      toast.error(err.message || "Failed to submit event. Please try again.");
    } finally {
      setSubmittingEvent(false);
    }
  };

  const toggleSave = (id: string) => {
    setSavedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast("Removed from saved", { description: "Event no longer in your list" });
      } else {
        next.add(id);
        toast.success("Saved!", { description: "Event added to your wishlist" });
      }
      return next;
    });
  };

  const shareEvent = (e: EventItem) => {
    const text = `Check out "${e.title}" on Koino — ${formatDate(e.date).weekday} ${e.date} at ${e.location}, ${e.city}!`;
    navigator.clipboard.writeText(text);
    toast.success("Event link copied!");
  };

  const rsvp = (e: EventItem) => {
    toast.success(`RSVP'd for "${e.title}"!`, {
      description: `See you on ${formatDate(e.date).weekday}. Add it to your calendar.`,
    });
    setOpenEvent(null);
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-28 md:pb-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t("events.title")}</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">{t("events.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              activeFilters > 0
                ? "bg-[#EC4899]/15 border-[#EC4899]/30 text-[#EC4899]"
                : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
            }`}
          >
            <Filter size={14} />
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#EC4899] text-white text-[9px] flex items-center justify-center font-bold">
                {activeFilters}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, #EC4899, #F59E0B)" }}
          >
            <Plus size={14} /> List Your Event
          </button>
        </div>
      </div>

      {/* ─── QUICK FILTER ROW: Near You / All India / Online ─── */}
      <div className="mb-3">
        <div className="flex p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
          <button
            onClick={() => setQuickFilter("near-you")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              quickFilter === "near-you"
                ? "bg-gradient-to-r from-[#EC4899] to-[#F59E0B] text-white shadow-lg shadow-[#EC4899]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <MapPin size={12} /> Near You
          </button>
          <button
            onClick={() => {
              setQuickFilter("all-india");
              // Don't clear state/city — let user keep them as manual filters
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              quickFilter === "all-india"
                ? "bg-gradient-to-r from-[#EC4899] to-[#F59E0B] text-white shadow-lg shadow-[#EC4899]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Globe size={12} /> All India
          </button>
          <button
            onClick={() => setQuickFilter("online")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              quickFilter === "online"
                ? "bg-gradient-to-r from-[#EC4899] to-[#F59E0B] text-white shadow-lg shadow-[#EC4899]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Video size={12} /> Online
          </button>
        </div>
      </div>

      {/* Near You banner — prompt user to select location if they tapped Near You without a state set */}
      {quickFilter === "near-you" && !filterState && (
        <div className="mb-3 bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3 flex items-start gap-2">
          <Info size={14} className="text-[#38BDF8] mt-0.5 shrink-0" />
          <p className="text-[11px] text-[#A09DB1] leading-relaxed">
            <span className="font-bold text-[#38BDF8]">Select your location.</span>{" "}
            We don't use precise GPS — pick your State (and optionally City) below to see events near you.
          </p>
        </div>
      )}

      {/* Date Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3">
        {EVENT_DATE_FILTERS.map((d) => (
          <button
            key={d.v}
            onClick={() => setDateFilter(d.v)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              dateFilter === d.v
                ? "bg-[#EC4899] text-white"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
          >
            {d.l}
          </button>
        ))}
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <Search size={10} className="inline mr-0.5" /> Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Title, city, host..."
                  className="neo-input text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <MapPin size={10} className="inline mr-0.5" /> State
                </label>
                <select
                  value={filterState}
                  onChange={(e) => {
                    setFilterState(e.target.value);
                    // Reset city when state changes — city list is state-dependent
                    setFilterCity("");
                  }}
                  className="neo-input text-sm"
                >
                  <option value="">All States</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <MapPin size={10} className="inline mr-0.5" /> City
                </label>
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  disabled={!filterState}
                  className="neo-input text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{filterState ? "All Cities" : "Select state first"}</option>
                  {filterState && getCitiesForState(filterState).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <Globe size={10} className="inline mr-0.5" /> Language
                </label>
                <select value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)} className="neo-input text-sm">
                  <option value="">All Languages</option>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Category</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterCategory("")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    !filterCategory ? "bg-white text-slate-950" : "bg-white/[0.04] text-[#94A3B8]"
                  }`}
                >
                  All
                </button>
                {EVENT_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFilterCategory(c.value)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      filterCategory === c.value ? "text-slate-950" : "text-[#94A3B8] hover:text-white"
                    }`}
                    style={filterCategory === c.value ? { background: c.color } : {}}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setFilterState("");
                  setFilterCity("");
                  setFilterLanguage("");
                  setFilterCategory("");
                  setSearchQuery("");
                }}
                className="mt-3 text-xs text-[#94A3B8] hover:text-white transition-colors"
              >
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events */}
      <div className="space-y-3">
        {/* Loading state */}
        {eventsLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin mb-3" />
            <p className="text-xs text-[#94A3B8]">Loading events…</p>
          </div>
        )}

        {/* Error state — graceful, no crash */}
        {!eventsLoading && eventsError && (
          <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-2xl p-5 text-center">
            <p className="text-sm font-bold text-[#EF4444] mb-1">Failed to load events</p>
            <p className="text-xs text-[#A09DB1] mb-3">{eventsError}</p>
            <button
              onClick={loadEvents}
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state — no published events yet */}
        {!eventsLoading && !eventsError && events.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 mb-3">
              <Calendar size={24} className="text-[#A78BFA]" />
            </div>
            <p className="text-sm font-bold text-white mb-1">No events published yet</p>
            <p className="text-xs text-[#A09DB1] mb-4 max-w-sm mx-auto">
              Be the first to share a Christian event with the Koino community. Submitted events appear here after admin approval.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all"
            >
              Submit an Event
            </button>
          </div>
        )}

        {/* Filtered empty state — events exist but none match the filters */}
        {!eventsLoading && !eventsError && events.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-[#94A3B8] mb-1">No events match your filters.</p>
            <p className="text-xs text-[#64748B]">Try clearing filters or widening your search.</p>
          </div>
        )}

        {filtered.map((event, i) => {
          const cat = getCategoryMeta(event.category);
          const Icon = CATEGORY_ICONS[event.category] || Music;
          const date = formatDate(event.date);
          const isSaved = savedEvents.has(event.id);
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setOpenEvent(event)}
              className="rounded-2xl overflow-hidden cursor-pointer border border-white/[0.06] hover:border-white/[0.12] transition-all bg-[#1C1929]"
            >
              <div className="flex">
                {/* Date block */}
                <div
                  className="w-20 shrink-0 flex flex-col items-center justify-center p-3"
                  style={{ background: `${cat.color}25` }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>
                    {date.month}
                  </p>
                  <p className="text-2xl font-extrabold text-white leading-none my-0.5">{date.day}</p>
                  <p className="text-[10px] text-white/60">{date.weekday}</p>
                </div>

                <div className="flex-1 p-3 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <Icon size={9} className="inline mr-0.5" />
                      {cat.label}
                    </span>
                    {/* Event type badge */}
                    {event.eventType === "online" && (
                      <span className="px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                        <Globe size={9} /> Online
                      </span>
                    )}
                    {event.eventType === "hybrid" && (
                      <span className="px-2 py-0.5 rounded-full bg-[#A855F7]/15 text-[#A855F7] text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                        <Radio size={9} /> Hybrid
                      </span>
                    )}
                    {event.status === "cancelled" && (
                      <span className="px-2 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] text-[9px] font-bold uppercase tracking-wider">
                        Cancelled
                      </span>
                    )}
                    {event.featured && (
                      <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                        <Flame size={9} /> Featured
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">{event.title}</h3>
                  <p className="text-[11px] text-[#94A3B8] line-clamp-1 mb-2">{event.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-[#94A3B8] flex-wrap">
                    {/* Location: city/state for in-person+hybrid; 🌐 Online for online-only */}
                    {event.eventType === "online" ? (
                      <span className="flex items-center gap-1 text-[#38BDF8]">
                        <Globe size={10} /> Online Event
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {event.city}{event.city && event.state ? ", " : ""}{event.state}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {date.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={10} /> {event.attendees}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between p-3 border-l border-white/[0.04]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSave(event.id);
                    }}
                    className="text-[#94A3B8] hover:text-white p-1"
                  >
                    {isSaved ? <BookmarkCheck size={16} className="text-[#EC4899]" /> : <Bookmark size={16} />}
                  </button>
                  <span className="text-[10px] font-bold text-[#94A3B8]">{formatRelative(event.date)}</span>
                </div>
              </div>

              <div className="px-3 py-2.5 bg-white/[0.02] border-t border-white/[0.04] flex items-center justify-between">
                <div className="text-[10px] text-[#94A3B8]">
                  by <span className="text-white font-bold">{event.church}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {event.is_free ? (
                    <span className="px-2 py-0.5 rounded-md bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold">
                      FREE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-bold flex items-center gap-1">
                      <Ticket size={9} /> ₹{event.price}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Calendar size={40} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#475569] mb-3">No events found for these filters.</p>
          <button
            onClick={() => {
              setFilterState("");
              setFilterCity("");
              setFilterLanguage("");
              setFilterCategory("");
              setSearchQuery("");
              setDateFilter("all");
              setQuickFilter("all-india");
            }}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #EC4899, #F59E0B)" }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Event Detail Modal */}
      <AnimatePresence>
        {openEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60] p-0 md:p-6"
            onClick={(e) => e.target === e.currentTarget && setOpenEvent(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="relative h-44">
                {openEvent.cover_image ? (
                  <img
                    src={openEvent.cover_image}
                    alt={openEvent.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ background: CHURCH_GRADIENTS[openEvent.cover_gradient % CHURCH_GRADIENTS.length] }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-transparent to-transparent" />
                <button
                  onClick={() => setOpenEvent(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={18} />
                </button>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-2">
                    {openEvent.is_online && (
                      <span className="px-2 py-0.5 rounded-full bg-[#EF4444]/80 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Video size={10} /> Live Stream
                      </span>
                    )}
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${getCategoryMeta(openEvent.category).color}80`,
                        color: "white",
                      }}
                    >
                      {getCategoryMeta(openEvent.category).label}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white">{openEvent.title}</h2>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">When</p>
                    <p className="text-xs text-white">
                      {new Date(openEvent.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">{formatDate(openEvent.date).time}</p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Where</p>
                    {openEvent.eventType === "online" ? (
                      <>
                        <p className="text-xs text-[#38BDF8] flex items-center gap-1 font-bold">
                          <Globe size={11} /> Online Event
                        </p>
                        {openEvent.onlineUrl && (
                          <a
                            href={openEvent.onlineUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#94A3B8] hover:text-white truncate block mt-1"
                          >
                            {openEvent.onlineUrl}
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-white">{openEvent.city}{openEvent.city && openEvent.state ? ", " : ""}{openEvent.state}</p>
                        {openEvent.address && (
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">{openEvent.address}</p>
                        )}
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">{openEvent.location}</p>
                        {openEvent.eventType === "hybrid" && (
                          <p className="text-[10px] text-[#A855F7] flex items-center gap-1 mt-1 font-bold">
                            <Globe size={10} /> Also available online
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Attendees</p>
                    <p className="text-xs text-white flex items-center gap-1">
                      <Users size={11} /> {openEvent.attendees} going
                    </p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Cost</p>
                    <p className="text-xs font-bold text-white">
                      {openEvent.is_free ? "FREE" : `₹${openEvent.price}`}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">About</p>
                  <p className="text-sm text-[#A09DB1] leading-relaxed">{openEvent.description}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Hosted by</p>
                  <p className="text-sm font-bold text-white">{openEvent.church}</p>
                </div>

                {openEvent.languages.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Languages</p>
                    <div className="flex flex-wrap gap-2">
                      {openEvent.languages.map((lang) => (
                        <span
                          key={lang}
                          className="px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#38BDF8] text-[11px] font-semibold"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => toggleSave(openEvent.id)}
                    className="px-4 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white flex items-center justify-center"
                  >
                    {savedEvents.has(openEvent.id) ? (
                      <BookmarkCheck size={18} className="text-[#EC4899]" />
                    ) : (
                      <Bookmark size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => shareEvent(openEvent)}
                    className="px-4 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white flex items-center justify-center"
                  >
                    <Share2 size={18} />
                  </button>
                  {openEvent.whatsapp_number && (
                    <a
                      href={`https://wa.me/${openEvent.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        `Hi, I found your event "${openEvent.title}" on Koino and would like more information.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 rounded-xl bg-[#25D366] hover:bg-[#1FB855] text-white flex items-center justify-center transition-all"
                      title="WhatsApp organizer"
                    >
                      <MessageCircle size={18} />
                    </a>
                  )}
                  {openEvent.ticketUrl ? (
                    <a
                      href={openEvent.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #EC4899, #F59E0B)" }}
                    >
                      <Ticket size={16} /> Get Tickets
                      <ExternalLink size={12} className="opacity-80" />
                    </a>
                  ) : openEvent.eventType === "online" && openEvent.onlineUrl ? (
                    <a
                      href={openEvent.onlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #38BDF8, #A855F7)" }}
                    >
                      <Video size={16} /> Join Online
                    </a>
                  ) : (
                    <button
                      onClick={() => rsvp(openEvent)}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px"
                      style={{ background: "linear-gradient(135deg, #EC4899, #F59E0B)" }}
                    >
                      {openEvent.is_free ? "RSVP Now" : "Get Tickets"}
                    </button>
                  )}
                </div>

                {/* Helper text — Koino does NOT process payments */}
                {openEvent.ticketUrl && (
                  <p className="text-[10px] text-[#64748B] text-center leading-relaxed">
                    <Info size={9} className="inline mr-0.5" />
                    Tickets and registration are handled by the event organizer.
                    Koino does not process payments.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal (upgraded) */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60] p-0 md:p-4"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-[#1C1929] z-10 flex justify-between items-center p-5 pb-3 border-b border-white/[0.04]">
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#EC4899] to-[#F59E0B] bg-clip-text text-transparent">
                  Add an Event
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#64748B] hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={submitEvent} className="p-5 space-y-4">
                {/* ─── EVENT FLYER ─── */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Event Flyer
                  </label>
                  <p className="text-[9px] text-[#64748B] mb-2">Portrait/vertical poster. 1080 × 1350 px recommended.</p>
                  {eventForm.coverImage ? (
                    <div className="relative">
                      <div className="w-full max-w-[200px] mx-auto aspect-[4/5] rounded-xl overflow-hidden bg-[#0f0f1a] border border-white/[0.08]">
                        <img src={eventForm.coverImage} alt="Event flyer" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex gap-2 mt-2 justify-center">
                        <button type="button" onClick={() => eventImgInputRef.current?.click()} disabled={imageUploading} className="px-3 py-1.5 rounded-lg bg-[#EC4899]/15 border border-[#EC4899]/30 text-[#EC4899] text-[10px] font-bold hover:bg-[#EC4899]/25 transition-all disabled:opacity-50">
                          {imageUploading ? <Loader2 size={11} className="animate-spin" /> : "Replace"}
                        </button>
                        <button type="button" onClick={() => setEventForm(f => ({ ...f, coverImage: "" }))} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#EF4444] hover:bg-[#EF4444]/10 transition-all">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => eventImgInputRef.current?.click()} disabled={imageUploading} className="w-full py-8 rounded-xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] hover:border-[#EC4899]/30 hover:bg-[#EC4899]/5 transition-all flex flex-col items-center gap-2 text-[#64748B] disabled:opacity-50">
                      {imageUploading ? <Loader2 size={20} className="animate-spin text-[#EC4899]" /> : <Upload size={20} />}
                      <span className="text-[10px] font-bold uppercase tracking-wider">Upload Event Flyer</span>
                      <span className="text-[8px] text-[#475569]">JPG, PNG, WEBP · Max 5MB · Portrait preferred</span>
                    </button>
                  )}
                  <input ref={eventImgInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEventImageUpload(f); }} className="hidden" />
                </div>

                {/* ─── BASIC INFORMATION ─── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">Basic Information</p>
                  <input type="text" placeholder="Event title *" value={eventForm.title} onChange={(e) => setEventForm(f => ({ ...f, title: e.target.value }))} className="neo-input text-sm" required />
                  <textarea placeholder="Event description *" value={eventForm.description} onChange={(e) => setEventForm(f => ({ ...f, description: e.target.value }))} className="neo-input h-24 resize-none text-sm" required />
                  <select value={eventForm.category} onChange={(e) => setEventForm(f => ({ ...f, category: e.target.value }))} className="neo-input text-sm" required>
                    <option value="">Select category *</option>
                    {EVENT_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                  </select>
                </div>

                {/* ─── DATE & TIME ─── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">Date & Time</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[9px] text-[#64748B]">Start Date *</label><input type="date" value={eventForm.startDate} onChange={(e) => setEventForm(f => ({ ...f, startDate: e.target.value }))} className="neo-input text-sm" required /></div>
                    <div><label className="text-[9px] text-[#64748B]">Start Time {!eventForm.allDay ? "*" : "(all day)"}</label><input type="time" value={eventForm.startTime} onChange={(e) => setEventForm(f => ({ ...f, startTime: e.target.value }))} className="neo-input text-sm" disabled={eventForm.allDay} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[9px] text-[#64748B]">End Date (optional)</label><input type="date" value={eventForm.endDate} onChange={(e) => setEventForm(f => ({ ...f, endDate: e.target.value }))} className="neo-input text-sm" /></div>
                    <div><label className="text-[9px] text-[#64748B]">End Time (optional)</label><input type="time" value={eventForm.endTime} onChange={(e) => setEventForm(f => ({ ...f, endTime: e.target.value }))} className="neo-input text-sm" disabled={eventForm.allDay} /></div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-[#94A3B8] cursor-pointer">
                    <input type="checkbox" checked={eventForm.allDay} onChange={(e) => setEventForm(f => ({ ...f, allDay: e.target.checked }))} className="accent-[#EC4899]" />
                    All Day Event
                  </label>
                </div>

                {/* ─── LOCATION ─── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">Location</p>
                  <select value={eventForm.eventType} onChange={(e) => setEventForm(f => ({ ...f, eventType: e.target.value as any }))} className="neo-input text-sm" required>
                    <option value="in-person">In Person</option>
                    <option value="online">Online</option>
                    <option value="hybrid">Hybrid</option>
                  </select>

                  {(eventForm.eventType === "in-person" || eventForm.eventType === "hybrid") && (
                    <>
                      <input type="text" placeholder="Venue name" value={eventForm.venueName} onChange={(e) => setEventForm(f => ({ ...f, venueName: e.target.value }))} className="neo-input text-sm" />
                      <input type="text" placeholder="Location address" value={eventForm.address} onChange={(e) => setEventForm(f => ({ ...f, address: e.target.value }))} className="neo-input text-sm" />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="City *" value={eventForm.city} onChange={(e) => setEventForm(f => ({ ...f, city: e.target.value }))} className="neo-input text-sm" required />
                        <select value={eventForm.state} onChange={(e) => setEventForm(f => ({ ...f, state: e.target.value }))} className="neo-input text-sm" required>
                          <option value="">State *</option>
                          {INDIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </div>
                    </>
                  )}

                  {(eventForm.eventType === "online" || eventForm.eventType === "hybrid") && (
                    <input type="url" placeholder="Online event link (Zoom, YouTube, etc.) *" value={eventForm.onlineUrl} onChange={(e) => setEventForm(f => ({ ...f, onlineUrl: e.target.value }))} className="neo-input text-sm" required={eventForm.eventType === "online"} />
                  )}
                </div>

                {/* ─── REGISTRATION ─── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">Registration</p>
                  <select value={eventForm.registrationType} onChange={(e) => setEventForm(f => ({ ...f, registrationType: e.target.value }))} className="neo-input text-sm">
                    <option value="free">Free Event</option>
                    <option value="paid">Paid Event</option>
                    <option value="registration_required">Registration Required</option>
                    <option value="no_registration">No Registration Required</option>
                  </select>
                  <input type="url" placeholder="Ticket / Registration URL (Eventbrite, church website, etc.)" value={eventForm.ticketUrl} onChange={(e) => setEventForm(f => ({ ...f, ticketUrl: e.target.value }))} className="neo-input text-sm" />
                  <p className="text-[9px] text-[#64748B]">Koino does not process ticket payments. Link to your external registration page.</p>
                </div>

                {/* ─── CONTACT ─── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">Contact</p>
                  <input type="text" placeholder="Organizer name" value={eventForm.organizerName} onChange={(e) => setEventForm(f => ({ ...f, organizerName: e.target.value }))} className="neo-input text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="tel" placeholder="WhatsApp number" value={eventForm.whatsappNumber} onChange={(e) => setEventForm(f => ({ ...f, whatsappNumber: e.target.value }))} className="neo-input text-sm" />
                    <input type="tel" placeholder="Contact phone" value={eventForm.organizerPhone} onChange={(e) => setEventForm(f => ({ ...f, organizerPhone: e.target.value }))} className="neo-input text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="email" placeholder="Contact email" value={eventForm.organizerEmail} onChange={(e) => setEventForm(f => ({ ...f, organizerEmail: e.target.value }))} className="neo-input text-sm" />
                    <input type="url" placeholder="Website / social link" value={eventForm.organizerWebsite} onChange={(e) => setEventForm(f => ({ ...f, organizerWebsite: e.target.value }))} className="neo-input text-sm" />
                  </div>
                </div>

                <button type="submit" disabled={submittingEvent || imageUploading} className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #EC4899, #F59E0B)" }}>
                  {submittingEvent ? <Loader2 size={16} className="animate-spin" /> : "Submit Event"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lordsbook CTA */}
      <div className="mt-4">
        <LordsbookCommunityCard
          title="Connect with Other Global Christians"
          description="Discover Christian conversations and community on Lordsbook."
          buttonText="Join the Global Christian Community"
          context="events"
          variant="compact"
        />
      </div>
    </div>
  );
}
