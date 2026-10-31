"use client";

/**
 * ─── MATRIMONY DISCOVER (Task 74 Stage C) ───────────────────────────────────
 *
 * View-only browse of ACTIVE matrimony profiles for eligible members.
 * Pattern: Memorials directory (debounced search 350ms + keyset cursor +
 * skeleton grid + "Show more"), card content mirrors the Stage B preview
 * contract EXACTLY — age (never DOB), gender, state/city, languages,
 * intention/timeline chips, aboutMe, education/profession/height. No name,
 * no contact details, no actions yet (interest & messaging = Stage D).
 *
 * Photos: the API includes one ONLY when the owner chose "Eligible members";
 * the <img> still goes through the authorized photo route, which re-checks
 * eligibility server-side on every single view. CONNECTIONS_ONLY profiles
 * show an honest lock placeholder instead.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, MapPin, Languages, Heart, Lock, GraduationCap, Briefcase,
  Ruler, RotateCcw, SearchX,
} from "lucide-react";

import { INDIAN_STATES, INDIAN_CITIES_BY_STATE } from "@/lib/crosscrafted-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import {
  MATRIMONY_DISCOVERY_LIMITS,
  MATRIMONY_INTENTIONS,
  MATRIMONY_LANGUAGES,
  MATRIMONY_TIMELINES,
} from "@/lib/matrimony";

type DiscoverCard = {
  id: string;
  age: number;
  gender: string | null;
  state: string | null;
  city: string | null;
  languages: string[];
  intention: string | null;
  timeline: string | null;
  denomination: string | null;
  education: string | null;
  profession: string | null;
  aboutMe: string | null;
  heightCm: number | null;
  photoVisibility: string;
  photo: { id: string; url: string; width: number | null; height: number | null } | null;
  updatedAt: string;
};

const AGE_CHOICES = Array.from(
  { length: MATRIMONY_DISCOVERY_LIMITS.filterAgeMax - MATRIMONY_DISCOVERY_LIMITS.filterAgeMin + 1 },
  (_, i) => MATRIMONY_DISCOVERY_LIMITS.filterAgeMin + i
);

const selectCls =
  "bg-white/[0.04] border border-white/[0.06] rounded-xl px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-[#7C3AED]/50 disabled:opacity-40 [&>option]:bg-[#1C1929] min-w-0";

export default function MatrimonyDiscover() {
  const t = useTranslation();
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");

  const [items, setItems] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const nextCursor = useRef<string | null>(null);
  const reqSeq = useRef(0);

  const cities = state ? INDIAN_CITIES_BY_STATE[state] || [] : [];

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const seq = ++reqSeq.current;
      append ? setLoadingMore(true) : setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (gender) params.set("gender", gender);
        if (state) params.set("state", state);
        if (city) params.set("city", city);
        if (language) params.set("language", language);
        if (ageMin) params.set("ageMin", ageMin);
        if (ageMax) params.set("ageMax", ageMax);
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/matrimony/discover?${params.toString()}`, {
          cache: "no-store",
        });
        if (seq !== reqSeq.current) return; // a newer request superseded this one
        if (!res.ok) {
          setError(true);
          if (!append) setItems([]);
          return;
        }
        const data = await res.json();
        const cards: DiscoverCard[] = Array.isArray(data.profiles) ? data.profiles : [];
        setItems((prev) => (append ? [...prev, ...cards] : cards));
        nextCursor.current = data.nextCursor || null;
      } catch {
        if (seq !== reqSeq.current) return;
        setError(true);
        if (!append) setItems([]);
      } finally {
        if (seq === reqSeq.current) {
          setLoading(false);
          setLoadingMore(false);
          setLoaded(true);
        }
      }
    },
    [q, gender, state, city, language, ageMin, ageMax]
  );

  // Debounced reload when any filter changes (350ms, like the memorials
  // directory — fast typers never fire a request per keystroke).
  useEffect(() => {
    const t = setTimeout(() => load(), q ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const hasFilters = Boolean(
    q.trim() || gender || state || city || language || ageMin || ageMax
  );

  const resetFilters = () => {
    setQ(""); setGender(""); setState(""); setCity(""); setLanguage("");
    setAgeMin(""); setAgeMax("");
  };

  return (
    <div>
      {/* ─── search ─── */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={MATRIMONY_DISCOVERY_LIMITS.qMax}
          placeholder={t("matrimony.discover.searchPlaceholder")}
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-full pl-11 pr-4 py-3 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
        />
      </div>

      {/* ─── filters ─── */}
      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
          <option value="">{t("matrimony.discover.allMembers")}</option>
          <option value="male">{t("matrimony.discover.men")}</option>
          <option value="female">{t("matrimony.discover.women")}</option>
        </select>
        <select value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={selectCls}>
          <option value="">{t("matrimony.discover.minAge")}</option>
          {AGE_CHOICES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={selectCls}>
          <option value="">{t("matrimony.discover.maxAge")}</option>
          {AGE_CHOICES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={state}
          onChange={(e) => { setState(e.target.value); setCity(""); }}
          className={selectCls}
        >
          <option value="">{t("common.allStates")}</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={!state}
          className={selectCls}
        >
          <option value="">{t("common.allCities")}</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls}>
          <option value="">{t("common.allLanguages")}</option>
          {MATRIMONY_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {hasFilters && (
        <button
          onClick={resetFilters}
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#94A3B8] hover:text-white transition-colors"
        >
          <RotateCcw size={11} /> {t("common.clearFilters")}
        </button>
      )}

      {/* ─── results ─── */}
      <div className="mt-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-[#1C1929] border border-white/[0.06] overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-white/[0.04]" />
                <div className="p-4 space-y-2.5">
                  <div className="w-1/3 h-4 bg-white/10 rounded" />
                  <div className="w-1/2 h-2.5 bg-white/5 rounded" />
                  <div className="w-full h-2.5 bg-white/5 rounded" />
                  <div className="w-2/3 h-2.5 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-14">
            <SearchX size={28} className="mx-auto text-[#475569] mb-3" />
            <p className="text-sm text-[#94A3B8] font-semibold">{t("matrimony.discover.errorTitle")}</p>
            <p className="text-xs text-[#64748B] mt-1">{t("common.error.checkConnection")}</p>
            <button
              onClick={() => load()}
              className="mt-4 px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14">
            <Heart size={28} className="mx-auto text-[#475569] mb-3" />
            <p className="text-sm text-[#94A3B8] font-semibold">
              {hasFilters ? t("matrimony.discover.emptyFiltered") : t("matrimony.discover.empty")}
            </p>
            <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto leading-relaxed">
              {hasFilters
                ? t("matrimony.discover.emptyFilteredHint")
                : t("matrimony.discover.emptyHint")}
            </p>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
              >
                {t("common.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((c) => <DiscoverCardView key={c.id} card={c} />)}
            </div>
            {nextCursor.current && (
              <div className="text-center mt-5">
                <button
                  onClick={() => load(nextCursor.current!, true)}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.06] text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
                >
                  {loadingMore ? t("common.loadingShort") : t("common.showMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-[11px] text-[#64748B] text-center leading-relaxed">
        {t("matrimony.discover.footerNote")}
      </p>
    </div>
  );
}

// ─── Card (mirrors the owner preview — nothing more is shared) ──────────────

function DiscoverCardView({ card }: { card: DiscoverCard }) {
  const t = useTranslation();
  const intention = MATRIMONY_INTENTIONS.find((i) => i.value === card.intention);
  const timeline = MATRIMONY_TIMELINES.find((t) => t.value === card.timeline);
  const connectionsOnly = card.photoVisibility === "CONNECTIONS_ONLY";

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#2B254E]/40 to-[#1C1929] border border-white/[0.06] overflow-hidden">
      {/* Photo / placeholder */}
      <div className="relative aspect-[4/3] bg-white/[0.03]">
        {card.photo ? (
          <img
            src={card.photo.url}
            alt={t("matrimony.discover.photoAlt")}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
            <Heart size={34} className="text-white/10" strokeWidth={1.4} />
            {connectionsOnly && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#64748B]">
                <Lock size={10} /> {t("matrimony.discover.photoLocked")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body — same fields as the owner's preview, nothing more */}
      <div className="p-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-black text-white">{card.age}</span>
          <span className="text-[13px] text-[#94A3B8]">
            {card.gender === "male" ? t("matrimony.gender.man") : card.gender === "female" ? t("matrimony.gender.woman") : t("matrimony.gender.member")}
          </span>
        </div>

        {(card.state || card.city) && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#B7C0D0]">
            <MapPin size={13} className="text-[#7C3AED] shrink-0" />
            <span className="truncate">{[card.city, card.state].filter(Boolean).join(", ")}</span>
          </p>
        )}

        {card.languages.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-[#B7C0D0]">
            <Languages size={13} className="text-[#7C3AED] mt-0.5 shrink-0" />
            <span className="line-clamp-2">{card.languages.join(" · ")}</span>
          </p>
        )}

        {(intention || timeline) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {intention && (
              <span className="px-2.5 py-1 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[11px] font-bold text-[#F39B9B]">
                {intention.label}
              </span>
            )}
            {timeline && (
              <span className="px-2.5 py-1 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[11px] font-bold text-[#C4B5FD]">
                {timeline.label}
              </span>
            )}
          </div>
        )}

        {card.aboutMe && (
          <p className="mt-2.5 text-[13px] text-[#B7C0D0] leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">
            {card.aboutMe}
          </p>
        )}

        {(card.education || card.profession || card.heightCm || card.denomination) && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5">
            {card.denomination && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#94A3B8] truncate">
                <Heart size={12} className="text-[#64748B] shrink-0" /> {card.denomination}
              </p>
            )}
            {card.education && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#94A3B8] truncate">
                <GraduationCap size={12} className="text-[#64748B] shrink-0" /> {card.education}
              </p>
            )}
            {card.profession && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#94A3B8] truncate">
                <Briefcase size={12} className="text-[#64748B] shrink-0" /> {card.profession}
              </p>
            )}
            {card.heightCm && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#94A3B8]">
                <Ruler size={12} className="text-[#64748B] shrink-0" /> {card.heightCm} cm
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
