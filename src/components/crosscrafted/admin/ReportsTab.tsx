"use client";

/**
 * Admin tab: reports queue. Lists reported posts / comments / users / stories
 * with previews, lets admins mark them reviewed or dismissed, and switch
 * between pending / reviewed / dismissed queues.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { toast } from "sonner";

type Report = {
  id: string;
  targetType: "post" | "comment" | "user" | "story" | string;
  targetId: string;
  reason: string | null;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { name: string | null; username: string | null; image: string | null } | null;
  preview: string | null;
  targetAuthor: string | null;
  targetGone: boolean;
};

const QUEUE_COLORS: Record<string, string> = {
  pending: "#F5B84A",
  reviewed: "#22D3EE",
  dismissed: "#64748B",
};

const TYPE_LABEL: Record<string, string> = {
  post: "Post",
  comment: "Comment",
  user: "User",
  story: "Story",
  memorial: "Memorial",
  video: "Video",
  memorial_condolence: "Memorial tribute",
  memorial_video: "Memorial video",
};

export default function ReportsTab() {
  const [queue, setQueue] = useState<"pending" | "reviewed" | "dismissed">("pending");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<{ pending: number; reviewed: number; dismissed: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?status=${queue}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load reports");
      const d = await res.json();
      setReports(d.reports || []);
      if (counts === null) {
        // First load: fetch the other queues for the switcher badges
        const others = await Promise.all(
          (["pending", "reviewed", "dismissed"] as const)
            .filter((s) => s !== queue)
            .map(async (s) => {
              const r = await fetch(`/api/admin/reports?status=${s}`);
              const j = r.ok ? await r.json() : { reports: [] };
              return [s, (j.reports || []).length] as const;
            }),
        );
        setCounts({
          pending: queue === "pending" ? (d.reports || []).length : Number(others.find(([s]) => s === "pending")?.[1] ?? 0),
          reviewed: queue === "reviewed" ? (d.reports || []).length : Number(others.find(([s]) => s === "reviewed")?.[1] ?? 0),
          dismissed: queue === "dismissed" ? (d.reports || []).length : Number(others.find(([s]) => s === "dismissed")?.[1] ?? 0),
        });
      } else {
        setCounts((c) => ({ ...c!, [queue]: (d.reports || []).length }) as typeof counts);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: "reviewed" | "dismissed") {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed");
      setReports((prev) => prev.filter((r) => r.id !== id));
      setCounts((c) => (c ? { ...c, [queue]: Math.max(0, c[queue] - 1), [status]: c[status] + 1 } : c));
      toast.success(status === "reviewed" ? "Marked reviewed" : "Dismissed");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-extrabold text-white">Reports &amp; Moderation</h2>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${QUEUE_COLORS[queue]}22`, color: QUEUE_COLORS[queue] }}
        >
          {loading ? "…" : reports.length} {queue}
        </span>
      </div>
      <p className="text-[11px] text-[#94A3B8] mb-3">
        Review what the community reported. &quot;Reviewed&quot; = handled (action taken or warning sent). &quot;Dismissed&quot; = no violation.
      </p>

      <div className="flex gap-1.5 mb-4">
        {(["pending", "reviewed", "dismissed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setQueue(s)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-all capitalize ${
              queue === s
                ? "bg-[#2563EB]/20 border-[#2563EB]/60 text-[#93C5FD]"
                : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8] hover:text-white"
            }`}
          >
            {s}{counts && counts[s] > 0 ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-10 text-sm text-[#94A3B8]">
          {queue === "pending" ? "Queue is clear — nothing reported right now." : `No ${queue} reports.`}
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#2563EB]/20 text-[#93C5FD]">
                  {TYPE_LABEL[r.targetType] || r.targetType}
                </span>
                {r.reason && (
                  <span className="text-[10px] font-bold text-amber-300 inline-flex items-center gap-1">
                    <AlertCircle size={10} /> {r.reason}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-[#64748B]">
                  {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {r.reporter ? ` · by ${r.reporter.name || r.reporter.username || "?"}` : ""}
                </span>
              </div>
              <p className="text-xs text-[#CBD5E1] line-clamp-2">
                {r.targetGone ? (
                  <span className="text-[#64748B] italic">Target no longer exists (deleted)</span>
                ) : (
                  <>
                    {r.targetAuthor && <span className="font-bold text-white">@{r.targetAuthor}: </span>}
                    {r.preview || "(no text content)"}
                  </>
                )}
              </p>
              {r.details && <p className="text-[10px] text-[#94A3B8] mt-1">Reporter note: {r.details}</p>}
              {queue === "pending" && (
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => setStatus(r.id, "reviewed")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-[11px] font-bold hover:bg-[#1D4ED8]"
                  >
                    <Check size={12} /> Reviewed
                  </button>
                  <button
                    onClick={() => setStatus(r.id, "dismissed")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[#94A3B8] text-[11px] font-bold hover:text-white"
                  >
                    <X size={12} /> Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
