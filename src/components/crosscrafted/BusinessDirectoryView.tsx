"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Phone,
  Globe,
  Clock,
  Plus,
  X,
  Star,
  BadgeCheck,
  Building2,
  MessageCircle,
  ExternalLink,
  ImageOff,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  BUSINESSES,
  BUSINESS_CATEGORIES,
  INDIAN_STATES,
  getCitiesForState,
  CHURCH_GRADIENTS,
  type Business,
} from "@/lib/crosscrafted-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type SortOption = "recommended" | "newest" | "name";

type Props = {
  /** Called when the user taps "+ List Your Business". Parent opens the
      existing ListYourEntity variant="business" form. */
  onListBusiness?: () => void;
};

export default function BusinessDirectoryView({ onListBusiness }: Props) {
  const t = useTranslation();
  const [businesses] = useState<Business[]>(BUSINESSES);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [openBusiness, setOpenBusiness] = useState<Business | null>(null);

  // Public directory only shows approved businesses.
  // New listings created via ListYourEntity enter "pending" and don't appear
  // here until admin approves them (matches the spec's moderation requirement).
  const approved = useMemo(() => businesses.filter((b) => b.status === "approved"), [businesses]);

  const filtered = useMemo(() => {
    const list = approved.filter((b) => {
      if (filterCategory && b.category !== filterCategory) return false;
      if (filterState && b.state !== filterState) return false;
      if (filterCity && b.city !== filterCity) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${b.name} ${b.description} ${b.category} ${b.city} ${b.state} ${(b.services || []).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // Sort
    const sorted = [...list];
    if (sortBy === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // "recommended" — featured first, then highest rating (if any), then most reviews
      sorted.sort((a, b) => {
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        const ra = a.rating || 0;
        const rb = b.rating || 0;
        if (rb !== ra) return rb - ra;
        return (b.reviews || 0) - (a.reviews || 0);
      });
    }
    return sorted;
  }, [approved, filterCategory, filterState, filterCity, searchQuery, sortBy]);

  const featured = useMemo(() => filtered.filter((b) => b.featured), [filtered]);

  const activeFilters = [filterCategory, filterState, filterCity, searchQuery].filter(Boolean).length;

  const clearFilters = () => {
    setFilterCategory("");
    setFilterState("");
    setFilterCity("");
    setSearchQuery("");
    setSortBy("recommended");
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-28 md:pb-5">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Business Directory</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Discover Christian businesses, services and professionals.
          </p>
        </div>
        <button
          onClick={() => {
            if (onListBusiness) {
              onListBusiness();
            } else {
              toast("Open 'List Business' to submit your business.");
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold text-white transition-all hover:-translate-y-px"
          style={{ background: "linear-gradient(135deg, #9786E3, #38BDF8)" }}
        >
          <Plus size={13} /> List Your Business
        </button>
      </div>

      {/* ─── SEARCH ─── */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          type="text"
          placeholder="Search Christian businesses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="neo-input text-sm pl-9"
        />
      </div>

      {/* ─── QUICK FILTER ROW (Category + Sort + Filter toggle) ─── */}
      <div className="flex gap-2 mb-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="neo-input text-xs py-2 flex-1"
        >
          <option value="">All Categories</option>
          {BUSINESS_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="neo-input text-xs py-2 w-32"
        >
          <option value="recommended">Recommended</option>
          <option value="newest">Newest</option>
          <option value="name">Name A–Z</option>
        </select>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
            activeFilters > 0
              ? "bg-[#9786E3]/15 border-[#9786E3]/30 text-[#9786E3]"
              : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
          }`}
        >
          <Filter size={12} />
          {activeFilters > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#9786E3] text-white text-[9px] flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* ─── STATE / CITY FILTER ROW ─── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  <MapPin size={10} className="inline mr-0.5" /> State
                </label>
                <select
                  value={filterState}
                  onChange={(e) => {
                    setFilterState(e.target.value);
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
            </div>
            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="mt-3 text-xs text-[#94A3B8] hover:text-white transition-colors"
              >
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FEATURED BUSINESSES ─── */}
      {featured.length > 0 && filterCategory === "" && filterState === "" && filterCity === "" && !searchQuery && (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F39B9B] mb-2">
            Featured Businesses
          </p>
          <div className="space-y-3">
            {featured.map((b, i) => (
              <BusinessCard
                key={b.id}
                business={b}
                index={i}
                onClick={() => setOpenBusiness(b)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── ALL BUSINESSES ─── */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] text-[#94A3B8]">
          {filtered.length} business{filtered.length === 1 ? "" : "es"}
          {filterState && ` in ${filterState}`}
          {filterCity && `, ${filterCity}`}
        </p>
      </div>

      <div className="space-y-3">
        {filtered.map((b, i) => (
          <BusinessCard
            key={b.id}
            business={b}
            index={i}
            onClick={() => setOpenBusiness(b)}
          />
        ))}
      </div>

      {/* ─── EMPTY STATE ─── */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Building2 size={40} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#475569] mb-1">No businesses found.</p>
          <p className="text-[11px] text-[#64748B] mb-4">
            Try another category, city or state.
          </p>
          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #9786E3, #38BDF8)" }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* ─── BUSINESS DETAIL MODAL ─── */}
      <AnimatePresence>
        {openBusiness && (
          <BusinessDetailModal
            business={openBusiness}
            onClose={() => setOpenBusiness(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── BUSINESS CARD ──────────────────────────────────────────────────────────

function BusinessCard({
  business,
  index,
  onClick,
}: {
  business: Business;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      onClick={onClick}
      className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden cursor-pointer hover:border-white/[0.12] transition-all group"
    >
      {/* Cover image — 16:9 with fallback */}
      <div className="relative w-full aspect-[16/9] bg-[#0f0f1a] overflow-hidden">
        {business.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.cover_image}
            alt={business.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = "none";
              const fallback = img.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-1 text-center px-2"
          style={{
            background: CHURCH_GRADIENTS[business.cover_gradient % CHURCH_GRADIENTS.length],
            display: business.cover_image ? "none" : "flex",
          }}
        >
          <Building2 size={28} className="text-white/60" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Koino</p>
          <p className="text-[9px] text-white/40 leading-tight">Image unavailable</p>
        </div>

        {/* Top gradient for legibility */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

        {/* Verified badge */}
        {business.verified && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#22C55E]/90 text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
            <BadgeCheck size={10} /> Verified
          </span>
        )}
        {business.featured && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-[#F59E0B]/90 text-slate-950 text-[9px] font-bold uppercase tracking-wider">
            Featured
          </span>
        )}

        {/* Category badge — bottom-left */}
        <div className="absolute bottom-2 left-2 right-2">
          <span className="inline-block px-2 py-0.5 rounded-md bg-[#9786E3]/90 text-white text-[9px] font-bold uppercase tracking-wider">
            {business.category}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-white leading-tight line-clamp-1">{business.name}</h3>
          {business.rating ? (
            <div className="flex items-center gap-0.5 shrink-0">
              <Star size={11} className="text-[#F59E0B]" fill="currentColor" />
              <span className="text-[10px] font-bold text-white">{business.rating.toFixed(1)}</span>
              {business.reviews ? (
                <span className="text-[9px] text-[#94A3B8]">({business.reviews})</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="text-[11px] text-[#94A3B8] flex items-center gap-1 mb-1.5">
          <MapPin size={10} className="shrink-0" />
          {business.city}{business.city && business.state ? ", " : ""}{business.state}
        </p>

        <p className="text-[11px] text-[#A09DB1] leading-relaxed line-clamp-2 mb-2">
          {business.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {business.whatsapp_number && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#25D366] font-bold">
                <MessageCircle size={10} /> WhatsApp
              </span>
            )}
            {business.website && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#38BDF8] font-bold">
                <Globe size={10} /> Website
              </span>
            )}
            {business.phone && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#94A3B8] font-bold">
                <Phone size={10} /> Call
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-[#9786E3] uppercase tracking-wider">
            View Business →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── BUSINESS DETAIL MODAL ──────────────────────────────────────────────────

function BusinessDetailModal({
  business,
  onClose,
}: {
  business: Business;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60] p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Cover image */}
        <div className="relative w-full aspect-[16/9] bg-[#0f0f1a] overflow-hidden">
          {business.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.cover_image}
              alt={business.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                img.style.display = "none";
                const fallback = img.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-center px-2"
            style={{
              background: CHURCH_GRADIENTS[business.cover_gradient % CHURCH_GRADIENTS.length],
              display: business.cover_image ? "none" : "flex",
            }}
          >
            <Building2 size={32} className="text-white/60" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Koino</p>
            <p className="text-[9px] text-white/40 leading-tight">Image unavailable</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-transparent to-transparent pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <X size={18} />
          </button>

          {/* Title overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-[#9786E3]/90 text-white text-[10px] font-bold uppercase tracking-wider">
                {business.category}
              </span>
              {business.verified && (
                <span className="px-2 py-0.5 rounded-md bg-[#22C55E]/90 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                  <BadgeCheck size={10} /> Verified
                </span>
              )}
              {business.featured && (
                <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/90 text-slate-950 text-[10px] font-bold uppercase tracking-wider">
                  Featured
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-white leading-tight">{business.name}</h2>
            {business.rating ? (
              <div className="flex items-center gap-1 mt-1">
                <Star size={12} className="text-[#F59E0B]" fill="currentColor" />
                <span className="text-[11px] font-bold text-white">{business.rating.toFixed(1)}</span>
                {business.reviews ? (
                  <span className="text-[10px] text-[#94A3B8]">({business.reviews} reviews)</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Location */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Location</p>
            <p className="text-xs text-white flex items-center gap-1">
              <MapPin size={11} /> {business.city}{business.city && business.state ? ", " : ""}{business.state}
            </p>
            {business.address && (
              <p className="text-[10px] text-[#94A3B8] mt-1">{business.address}</p>
            )}
          </div>

          {/* About */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">About</p>
            <p className="text-sm text-[#A09DB1] leading-relaxed">{business.description}</p>
          </div>

          {/* Services */}
          {business.services && business.services.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Services</p>
              <div className="flex flex-wrap gap-1.5">
                {business.services.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-lg bg-[#9786E3]/10 border border-[#9786E3]/20 text-[#9786E3] text-[11px] font-semibold"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hours */}
          {business.hours && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1 flex items-center gap-1">
                <Clock size={10} /> Business Hours
              </p>
              <p className="text-xs text-white">{business.hours}</p>
            </div>
          )}

          {/* Languages */}
          {business.languages.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Languages</p>
              <div className="flex flex-wrap gap-2">
                {business.languages.map((lang) => (
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

          {/* Contact — only render buttons for info the business actually provided */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Contact</p>

            {business.whatsapp_number && (
              <a
                href={`https://wa.me/${business.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `Hi, I found your business "${business.name}" on Koino and I'd like more information.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1FB855] text-white transition-all hover:-translate-y-px"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}

            {business.phone && (
              <a
                href={`tel:${business.phone.replace(/[^0-9+]/g, "")}`}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-[#9786E3]/15 border border-[#9786E3]/30 text-[#9786E3] hover:bg-[#9786E3]/25 transition-all"
              >
                <Phone size={16} /> Call {business.phone}
              </a>
            )}

            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-[#38BDF8]/15 border border-[#38BDF8]/30 text-[#38BDF8] hover:bg-[#38BDF8]/25 transition-all"
              >
                <Globe size={16} /> Visit Website
                <ExternalLink size={12} className="opacity-80" />
              </a>
            )}

            {business.email && (
              <a
                href={`mailto:${business.email}`}
                className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white transition-all"
              >
                {business.email}
              </a>
            )}
          </div>

          {/* Helper text — Koino does NOT verify products/services, only the listing */}
          {business.verified && (
            <p className="text-[10px] text-[#64748B] text-center leading-relaxed">
              <BadgeCheck size={9} className="inline mr-0.5" />
              "Verified" means Koino has reviewed this listing. It does not mean Koino guarantees the business's products or services.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
