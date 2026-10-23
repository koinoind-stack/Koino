"use client";

/**
 * Admin — In Loving Memory tab (Part 4).
 * Search ALL memorials, see pending reports per memorial, and unpublish /
 * restore. Administrators never edit memorial content — moderation is
 * limited to unpublish/restore so every action stays accountable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Flower2, Search, EyeOff, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type AdminMemorial = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  city: string | null;
  state: string | null;
  visibility: string;
  status: string;
  creatorName: string;
  createdAt: string;
  creator: { username: string | null; name: string | null; accountStatus: string } | null;
  _count: { condolences: number };
  pendingReports: number;
};

export default function MemorialsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminMemorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/memorials?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load memorials");
      setItems(body.memorials || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, firstLoad.current ? 0 : 300);
    firstLoad.current = false;
    return () => clearTimeout(t);
  }, [load]);

  async function setStatusFor(id: string, next: "published" | "unpublished") {
    if (busyId) return;
    const label = next === "unpublished" ? "Unpublish (hide) this memorial?" : "Restore (publish) this memorial?";
    if (!confirm(label)) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/memorials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success(next === "unpublished" ? "Memorial unpublished" : "Memorial restored");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search memorials by name…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-[#1C1929]"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="unpublished">Unpublished</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Flower2 size={26} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#94A3B8]">No memorials found.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((m) => (
            <li key={m.id} className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] px-4 py-3.5">
              <div className="flex items-start gap-3">
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
                    <Flower2 size={15} className="text-[#C4B5FD]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/memorials/${m.id}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-white hover:underline inline-flex items-center gap-1">
                      {m.fullName} <ExternalLink size={10} className="text-[#64748B]" />
                    </a>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      m.status === "published" ? "bg-emerald-500/15 text-emerald-300"
                      : m.status === "draft" ? "bg-amber-500/15 text-amber-300"
                      : "bg-red-500/15 text-red-300"
                    }`}>
                      {m.status}
                    </span>
                    {m.visibility !== "public" && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[#94A3B8]">{m.visibility}</span>
                    )}
                    {m.pendingReports > 0 && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">
                        {m.pendingReports} pending report{m.pendingReports === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    {[m.city, m.state].filter(Boolean).join(", ") || "No location"} · by {m.creatorName}
                    {m.creator?.username ? ` (@${m.creator.username})` : ""}
                    {m.creator?.accountStatus && m.creator.accountStatus !== "active" ? ` · account ${m.creator.accountStatus}` : ""}
                    {" "}{m._count.condolences} condolence{m._count.condolences === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="shrink-0">
                  {m.status === "unpublished" ? (
                    <button
                      onClick={() => setStatusFor(m.id, "published")}
                      disabled={busyId === m.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      <RotateCcw size={11} /> Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatusFor(m.id, "unpublished")}
                      disabled={busyId === m.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      <EyeOff size={11} /> Unpublish
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
