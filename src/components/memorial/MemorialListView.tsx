"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Flower2, Search, Plus, ChevronRight } from "lucide-react";
import { formatPartialDate } from "@/lib/memorial/shared";
import type { MemorialSummary } from "./types";

/**
 * Part 4 — In Loving Memory list: search + card grid.
 * Mobile-first (single column), 2 cols ≥ sm, 3 cols ≥ lg. Matches the app's
 * dark design tokens. "Create memorial" opens the form view.
 */
export default function MemorialListView({
  onOpenMemorial,
  onCreate,
}: {
  onOpenMemorial: (id: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MemorialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, cursor: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/memorials?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load memorials");
    return res.json() as Promise<{ memorials: MemorialSummary[]; nextCursor: string | null }>;
  }, []);

  const initial = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await load(q, null);
      setItems(data.memorials);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Could not load memorials. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    initial("");
  }, [initial]);

  const onSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      initial(value);
    }, 350);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await load(query, nextCursor);
      setItems((prev) => [...prev, ...data.memorials]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Could not load more memorials.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-[680px] lg:max-w-[900px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <Flower2 size={22} className="text-[#A78BFA]" />
            In Loving Memory
          </h1>
          <p className="text-[13px] text-[#94A3B8] mt-1">
            Remembering the loved ones of the Koino family. Light a memory, share a condolence.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white text-[13px] font-bold shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:opacity-90 transition-opacity"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden xs:inline sm:inline">Create</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name…"
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[14px] text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50 transition-colors"
          aria-label="Search memorials by name"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-14">
          <p className="text-[#94A3B8] text-sm mb-3">{error}</p>
          <button
            onClick={() => initial(query)}
            className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-[13px] font-bold hover:bg-white/[0.1] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED]/15 to-[#EC4899]/15 border border-[#7C3AED]/25 mb-4">
            <Flower2 size={28} className="text-[#A78BFA]" />
          </div>
          <h2 className="text-lg font-extrabold text-white mb-2">
            {query ? "No memorials match your search" : "No memorials yet"}
          </h2>
          <p className="text-sm text-[#A09DB1] max-w-sm mx-auto">
            {query
              ? "Try a different name, or create the memorial if it doesn't exist yet."
              : "Honor a loved one with a memorial page — their story, dates, and a place for friends and family to leave condolences."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((m) => (
              <button
                key={m.id}
                onClick={() => onOpenMemorial(m.id)}
                className="text-left rounded-2xl bg-[#1C1929] border border-white/[0.06] hover:border-[#7C3AED]/40 p-4 transition-all group"
              >
                <div className="flex items-start gap-3">
                  {m.photoUrl ? (
                    <Image
                      src={m.photoUrl}
                      alt={m.fullName}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-xl object-cover border border-white/[0.08]"
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#7C3AED]/25 to-[#EC4899]/20 border border-white/[0.08] flex items-center justify-center shrink-0">
                      <Flower2 size={22} className="text-[#A78BFA]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-extrabold text-white leading-snug truncate">
                      {m.fullName}
                    </h3>
                    <p className="text-[12px] text-[#94A3B8] mt-0.5">
                      {formatPartialDate({
                        year: m.deathYear, month: m.deathMonth, day: m.deathDay,
                      }) || "In God's care"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[#475569] group-hover:text-[#A78BFA] transition-colors shrink-0 mt-1" />
                </div>
                {m.epitaph && (
                  <p className="text-[12px] text-[#A09DB1] italic mt-3 line-clamp-2">
                    “{m.epitaph}”
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3 text-[11px] text-[#64748B]">
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.06]">
                    {m.visibility === "public" ? "Public" : m.visibility === "members" ? "Members" : "Managers"}
                  </span>
                  {m.isManager && (
                    <span className="px-2 py-0.5 rounded-full bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA]">
                      You manage
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {nextCursor && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-[13px] font-bold hover:bg-white/[0.09] disabled:opacity-50 transition-all"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
