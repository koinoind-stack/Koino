"use client";

/**
 * In Loving Memory — public directory (Part 4).
 * Search by name, browse by state/city, recently added first.
 * Only published + public memorials are returned by the API, so nothing
 * private is ever exposed here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flower2, Search, MapPin, MessageCircle, ArrowLeft, Flame, Clock } from "lucide-react";
import { INDIAN_STATES, INDIAN_CITIES_BY_STATE } from "@/lib/crosscrafted-data";
import { useSupabaseUser } from "@/lib/supabase/use-user";

type MemorialCard = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  dob: string | null;
  dod: string | null;
  city: string | null;
  state: string | null;
  tribute: string | null;
  creatorName: string;
  condolenceCount: number;
  candleCount: number;
};

type MyMemorial = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  status: string;
  visibility: string;
  rejectionReason: string | null;
  updatedAt: string;
};

const yr = (iso: string | null): string => (iso ? String(new Date(iso).getFullYear()) : "");

function lifespan(m: MemorialCard): string {
  const b = yr(m.dob);
  const d = yr(m.dod);
  if (b && d) return `${b} – ${d}`;
  if (d) return `Remembered since ${d}`;
  return "";
}

export default function MemorialsDirectory() {
  const { isAuthenticated } = useSupabaseUser();
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [items, setItems] = useState<MemorialCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [mine, setMine] = useState<MyMemorial[]>([]);
  const nextCursor = useRef<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (state) params.set("state", state);
        if (city) params.set("city", city);
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/memorials?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        setItems((prev) => (cursor ? [...prev, ...(data.memorials || [])] : data.memorials || []));
        nextCursor.current = data.nextCursor || null;
      } catch {
        // network hiccup — keep whatever we already have
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [q, state, city],
  );

  // Debounced reload on filter change.
  useEffect(() => {
    const t = setTimeout(() => load(), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Signed-in members: recover drafts and follow review outcomes.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/memorials/mine", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { memorials: [] }))
      .then((b) => setMine(b.memorials || []))
      .catch(() => {});
  }, [isAuthenticated]);

  const cities = state ? INDIAN_CITIES_BY_STATE[state] || [] : [];

  return (
    <div className="max-w-[680px] mx-auto px-4 pt-8 pb-24">
      {/* ─── heading ─── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 mb-4">
          <Flower2 size={26} className="text-[#C4B5FD]" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">In Loving Memory</h1>
        <p className="text-sm text-[#94A3B8] mt-2 max-w-md mx-auto leading-relaxed">
          Remembering lives, celebrating faith, keeping their stories alive.
        </p>
        <Link
          href="/memorials/new"
          className="inline-flex items-center gap-2 px-6 py-3 mt-5 rounded-full bg-[#7C3AED] text-white text-sm font-bold hover:bg-[#6D28D9] shadow-lg shadow-[#7C3AED]/20"
        >
          <Flower2 size={15} /> Create a Memorial
        </Link>
      </div>

      {/* ─── your memorials (drafts / in review / rejected) ─── */}
      {isAuthenticated && mine.length > 0 && (
        <div className="mb-7">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-3">Your memorials</h2>
          <ul className="space-y-2">
            {mine.map((mm) => (
              <li key={mm.id}>
                <Link
                  href={`/memorials/${mm.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-[#111827]/60 border border-white/[0.05] hover:border-[#7C3AED]/30 transition-colors px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{mm.fullName}</p>
                    <p className="text-[10px] text-[#64748B] mt-0.5 flex items-center gap-1">
                      <Clock size={9} /> updated {new Date(mm.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${
                    mm.status === "published" ? "bg-emerald-500/15 text-emerald-300"
                    : mm.status === "pending" ? "bg-sky-500/15 text-sky-300"
                    : mm.status === "rejected" ? "bg-red-500/15 text-red-300"
                    : mm.status === "draft" ? "bg-amber-500/15 text-amber-300"
                    : "bg-white/[0.06] text-[#94A3B8]"
                  }`}>
                    {mm.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── search + location browse ─── */}
      <div className="space-y-2.5 mb-6">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-full pl-11 pr-4 py-3 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
          />
        </div>
        <div className="flex gap-2.5">
          <select
            value={state}
            onChange={(e) => { setState(e.target.value); setCity(""); }}
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#7C3AED]/50 [&>option]:bg-[#1C1929]"
          >
            <option value="">All states</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!state}
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#7C3AED]/50 disabled:opacity-40 [&>option]:bg-[#1C1929]"
          >
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ─── results ─── */}
      <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-3">
        {q ? "Search results" : state || city ? "Browsing by location" : "Recently added"}
      </h2>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-14 h-14 rounded-full bg-white/5" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="w-2/3 h-3.5 bg-white/10 rounded" />
                  <div className="w-1/3 h-2.5 bg-white/5 rounded" />
                </div>
              </div>
              <div className="w-full h-2.5 bg-white/5 rounded mt-3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Flower2 size={30} className="mx-auto text-[#475569] mb-4" />
          <p className="text-[#94A3B8] text-sm mb-1 font-semibold">
            {q || state || city ? "No memorials match your search." : "No memorials yet."}
          </p>
          <p className="text-[#64748B] text-xs mb-6 max-w-xs mx-auto leading-relaxed">
            {q || state || city
              ? "Try a different name or location."
              : "Their love remains. Their stories live on — when a loved one passes away, family and friends can create a memorial here to honour their life."}
          </p>
          <Link
            href="/memorials/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7C3AED] text-white text-sm font-bold hover:bg-[#6D28D9]"
          >
            <Flower2 size={15} /> Create a memorial
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((m) => (
              <Link
                key={m.id}
                href={`/memorials/${m.id}`}
                className="block rounded-2xl bg-[#111827]/60 border border-white/[0.05] hover:border-[#7C3AED]/30 transition-colors p-4"
              >
                <div className="flex gap-3.5">
                  {m.photoUrl ? (
                    <Image
                      src={m.photoUrl}
                      alt={m.fullName}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover border border-white/10"
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7C3AED]/40 to-[#1C1929] flex items-center justify-center shrink-0">
                      <Flower2 size={20} className="text-[#C4B5FD]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-white truncate">{m.fullName}</h3>
                    <p className="text-[11px] text-[#94A3B8]">{lifespan(m) || " "}</p>
                    {(m.city || m.state) && (
                      <p className="text-[11px] text-[#64748B] mt-0.5 inline-flex items-center gap-1">
                        <MapPin size={9} /> {[m.city, m.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                {m.tribute && (
                  <p className="text-xs text-[#94A3B8] line-clamp-2 mt-3 leading-relaxed">{m.tribute}</p>
                )}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.04]">
                  <span className="text-[10px] text-[#64748B]">Remembered by {m.creatorName}</span>
                  <span className="text-[10px] font-bold text-[#64748B] inline-flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1" aria-label={`${m.candleCount} candles lit`}>
                      <Flame size={10} className={m.candleCount > 0 ? "text-amber-300/80" : ""} /> {m.candleCount}
                    </span>
                    <span className="inline-flex items-center gap-1" aria-label={`${m.condolenceCount} tributes`}>
                      <MessageCircle size={10} /> {m.condolenceCount}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {nextCursor.current && (
            <div className="text-center mt-6">
              <button
                onClick={() => load(nextCursor.current!)}
                disabled={loading}
                className="px-5 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.06] text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
              >
                {loading ? "Loading…" : "Show more"}
              </button>
            </div>
          )}
          <div className="text-center mt-8">
            <Link href="/memorials/new" className="text-xs font-bold text-[#C4B5FD] hover:text-white inline-flex items-center gap-1.5">
              <Flower2 size={13} /> Create a memorial for a loved one
            </Link>
          </div>
        </>
      )}

      {/* Back link for direct visitors */}
      <div className="text-center mt-10">
        <Link href="/" className="text-[11px] text-[#64748B] hover:text-white inline-flex items-center gap-1">
          <ArrowLeft size={11} /> Back to Koino
        </Link>
      </div>
    </div>
  );
}
