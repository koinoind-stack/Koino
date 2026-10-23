"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft, Flower2, Flag, Pencil, Trash2, UserPlus, Shield,
  Check, X, RotateCcw, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatPartialDate, MEMORIAL_LIMITS } from "@/lib/memorial/shared";
import type { Condolence, MemorialDetail, MemorialUser } from "./types";

/**
 * Part 4 — memorial detail: story, service info, condolences, and manager
 * tools (moderation queue, co-managers, edit, delete). Server responses
 * carry canEdit/canDelete; every action is re-authorized server-side.
 */
export default function MemorialDetailView({
  memorialId,
  onBack,
  onEdit,
}: {
  memorialId: string;
  onBack: () => void;
  onEdit: (m: MemorialDetail) => void;
}) {
  const [memorial, setMemorial] = useState<MemorialDetail | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // condolences
  const [condolences, setCondolences] = useState<Condolence[]>([]);
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);

  // manager tools
  const [showManagers, setShowManagers] = useState(false);
  const [managerUsername, setManagerUsername] = useState("");
  const [busyCondolence, setBusyCondolence] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load the memorial");
      setMemorial(data.memorial);
      setCanEdit(!!data.canEdit);
      setCanDelete(!!data.canDelete);
      setPendingCount(data.pendingCount || 0);

      // Managers load the full moderation queue; everyone else approved-only.
      const cRes = await fetch(
        `/api/memorials/${memorialId}/condolences${data.canEdit ? "?status=pending" : ""}`,
        { cache: "no-store" },
      );
      if (cRes.ok) {
        const cData = await cRes.json();
        setCondolences(cData.condolences || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the memorial");
    } finally {
      setLoading(false);
    }
  }, [memorialId]);

  useEffect(() => {
    load();
  }, [load]);

  const postCondolence = async () => {
    if (!message.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not post the condolence");
      setMessage("");
      const c: Condolence = data.condolence;
      setCondolences((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
      toast.success(
        c.status === "pending"
          ? "Condolence sent — it will appear once the family approves it"
          : "Condolence posted",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post");
    } finally {
      setPosting(false);
    }
  };

  const moderate = async (condolenceId: string, action: "approve" | "reject" | "reopen") => {
    setBusyCondolence(condolenceId);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences/${condolenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      setCondolences((prev) =>
        action === "approve"
          ? prev.filter((c) => c.id !== condolenceId) // approved ones move out of the queue
          : prev.map((c) => (c.id === condolenceId ? { ...c, status: action === "reject" ? "rejected" : "pending" } : c)),
      );
      setPendingCount((n) => (action === "approve" || action === "reject" ? Math.max(0, n - 1) : n));
      toast.success(action === "approve" ? "Condolence approved" : action === "reject" ? "Condolence rejected" : "Moved back to pending");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyCondolence(null);
    }
  };

  const deleteCondolence = async (condolenceId: string) => {
    setBusyCondolence(condolenceId);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences/${condolenceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete");
      }
      setCondolences((prev) => prev.filter((c) => c.id !== condolenceId));
      toast.success("Condolence deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusyCondolence(null);
    }
  };

  const addManager = async () => {
    if (!managerUsername.trim()) return;
    try {
      const res = await fetch(`/api/memorials/${memorialId}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: managerUsername.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add manager");
      setMemorial(data.memorial);
      setManagerUsername("");
      toast.success("Co-manager added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add manager");
    }
  };

  const removeManager = async (userId: string) => {
    try {
      const res = await fetch(`/api/memorials/${memorialId}/managers/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove manager");
      setMemorial(data.memorial);
      toast.success("Manager removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove manager");
    }
  };

  const deleteMemorial = async () => {
    if (!confirm("Delete this memorial and all its condolences? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete");
      }
      toast.success("Memorial deleted");
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  const report = async () => {
    try {
      const res = await fetch("/api/social/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "memorial", targetId: memorialId, reason: "inappropriate" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not report");
      }
      toast.success("Reported to the Koino team — thank you");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not report");
    }
  };

  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-6 space-y-4">
        <div className="h-64 rounded-2xl bg-white/[0.04] animate-pulse" />
        <div className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  if (error || !memorial) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-16 text-center">
        <Flower2 size={32} className="text-[#A78BFA] mx-auto mb-3" />
        <p className="text-[#94A3B8] text-sm mb-4">{error || "Memorial not found"}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-[13px] font-bold hover:bg-white/[0.1] transition-colors"
        >
          Back to In Loving Memory
        </button>
      </div>
    );
  }

  const born = formatPartialDate({ year: memorial.birthYear, month: memorial.birthMonth, day: memorial.birthDay });
  const died = formatPartialDate({ year: memorial.deathYear, month: memorial.deathMonth, day: memorial.deathDay });

  return (
    <div className="max-w-[680px] mx-auto px-4 py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-[#94A3B8] hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> All memorials
      </button>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-b from-[#1C1929] to-[#161320] border border-white/[0.06] p-6 text-center mb-4">
        {memorial.photoUrl ? (
          <Image
            src={memorial.photoUrl}
            alt={memorial.fullName}
            width={96}
            height={96}
            className="w-24 h-24 rounded-2xl object-cover border border-white/[0.1] mx-auto mb-4"
            unoptimized
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#7C3AED]/25 to-[#EC4899]/20 border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <Flower2 size={36} className="text-[#A78BFA]" />
          </div>
        )}
        <h1 className="text-2xl font-black text-white">{memorial.fullName}</h1>
        {memorial.epitaph && (
          <p className="text-[14px] text-[#A09DB1] italic mt-2">“{memorial.epitaph}”</p>
        )}
        <p className="text-[13px] text-[#94A3B8] mt-3">
          {born ? `${born}` : ""}{born && died ? "  ·  " : ""}{died ? `${died}` : ""}
        </p>
        {memorial.visibility !== "public" && (
          <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-[11px] bg-white/[0.05] border border-white/[0.08] text-[#94A3B8]">
            {memorial.visibility === "members" ? "Visible to members" : "Visible to managers only"}
          </span>
        )}

        {/* Manager toolbar */}
        {canEdit && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <button
              onClick={() => onEdit(memorial)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-[12px] font-bold hover:bg-white/[0.1] transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={() => setShowManagers((v) => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-[12px] font-bold hover:bg-white/[0.1] transition-colors"
            >
              <UserPlus size={13} /> Managers ({1 + memorial.managerUsers.length})
            </button>
            {canDelete && (
              <button
                onClick={deleteMemorial}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#F87171] text-[12px] font-bold hover:bg-[#EF4444]/20 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        )}

        <button
          onClick={report}
          className="inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#94A3B8] mt-4 transition-colors"
        >
          <Flag size={11} /> Report this memorial
        </button>
      </div>

      {/* Co-managers panel */}
      {canEdit && showManagers && (
        <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-4 mb-4">
          <h3 className="text-[13px] font-extrabold text-white flex items-center gap-1.5 mb-3">
            <Shield size={14} className="text-[#A78BFA]" /> Managers
          </h3>
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {memorial.creator.image ? (
                  <Image src={memorial.creator.image} alt="" width={30} height={30} className="w-[30px] h-[30px] rounded-full object-cover" unoptimized />
                ) : (
                  <div className="w-[30px] h-[30px] rounded-full bg-[#7C3AED]/25" />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">{memorial.creator.name || memorial.creator.username}</p>
                  <p className="text-[11px] text-[#64748B]">Owner</p>
                </div>
              </div>
            </div>
            {memorial.managerUsers.map((u: MemorialUser) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {u.image ? (
                    <Image src={u.image} alt="" width={30} height={30} className="w-[30px] h-[30px] rounded-full object-cover" unoptimized />
                  ) : (
                    <div className="w-[30px] h-[30px] rounded-full bg-[#7C3AED]/25" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{u.name || u.username}</p>
                    <p className="text-[11px] text-[#64748B]">Co-manager</p>
                  </div>
                </div>
                {(memorial.isOwner || memorial.creator.id !== u.id) && (
                  <button
                    onClick={() => removeManager(u.id)}
                    className="text-[11px] text-[#F87171] hover:text-white px-2 py-1 rounded-lg hover:bg-[#EF4444]/15 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {memorial.isOwner && (
            <div className="flex gap-2">
              <input
                value={managerUsername}
                onChange={(e) => setManagerUsername(e.target.value)}
                placeholder="@username to add as co-manager"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
              />
              <button
                onClick={addManager}
                className="px-4 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[12px] font-bold hover:opacity-90 transition-opacity"
              >
                Add
              </button>
            </div>
          )}
          <p className="text-[11px] text-[#64748B] mt-2">
            Co-managers can edit this memorial and approve condolences — but cannot delete it or remove you.
          </p>
        </div>
      )}

      {/* Story */}
      {memorial.biography && (
        <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-5 mb-4">
          <h3 className="text-[13px] font-extrabold text-white uppercase tracking-wider mb-3">Life story</h3>
          <p className="text-[14px] leading-relaxed text-[#CBD5E1] whitespace-pre-wrap">{memorial.biography}</p>
        </div>
      )}

      {/* Service info */}
      {memorial.serviceInfo && (
        <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-5 mb-4">
          <h3 className="text-[13px] font-extrabold text-white uppercase tracking-wider mb-3">Service details</h3>
          <p className="text-[14px] leading-relaxed text-[#CBD5E1] whitespace-pre-wrap">{memorial.serviceInfo}</p>
        </div>
      )}

      {/* Condolences */}
      <div className="rounded-2xl bg-[#1C1929] border border-white/[0.06] p-5">
        <h3 className="text-[13px] font-extrabold text-white uppercase tracking-wider mb-3">
          Condolences
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#FBBF24] bg-[#FBBF24]/10 border border-[#FBBF24]/25 px-2 py-0.5 rounded-full">
              <Clock size={10} /> {pendingCount} awaiting approval
            </span>
          )}
        </h3>

        {/* Post form */}
        <div className="mb-5">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MEMORIAL_LIMITS.condolenceMessage}
            rows={3}
            placeholder="Write a short condolence or share a memory…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-3 text-[14px] text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50 resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-[#64748B]">{message.length}/{MEMORIAL_LIMITS.condolenceMessage}</span>
            <button
              onClick={postCondolence}
              disabled={posting || !message.trim()}
              className="px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {posting ? "Sending…" : "Send condolence"}
            </button>
          </div>
        </div>

        {/* List */}
        {condolences.length === 0 ? (
          <p className="text-[13px] text-[#64748B] text-center py-6">
            No condolences yet. Be the first to share a memory.
          </p>
        ) : (
          <div className="space-y-3">
            {condolences.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border px-4 py-3 ${
                  c.status === "pending"
                    ? "bg-[#FBBF24]/[0.04] border-[#FBBF24]/20"
                    : c.status === "rejected"
                    ? "bg-[#EF4444]/[0.04] border-[#EF4444]/20"
                    : "bg-white/[0.03] border-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">
                      {c.author.name || c.author.username || "Koino member"}
                      {c.isMine && <span className="text-[10px] text-[#64748B] font-normal ml-1.5">you</span>}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {new Date(c.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      {c.status === "pending" && " · awaiting approval"}
                      {c.status === "rejected" && " · rejected"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && c.status === "pending" && (
                      <>
                        <button
                          onClick={() => moderate(c.id, "approve")}
                          disabled={busyCondolence === c.id}
                          className="p-1.5 rounded-lg bg-[#22C55E]/15 text-[#4ADE80] hover:bg-[#22C55E]/25 disabled:opacity-40 transition-colors"
                          aria-label="Approve condolence"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => moderate(c.id, "reject")}
                          disabled={busyCondolence === c.id}
                          className="p-1.5 rounded-lg bg-[#EF4444]/15 text-[#F87171] hover:bg-[#EF4444]/25 disabled:opacity-40 transition-colors"
                          aria-label="Reject condolence"
                        >
                          <X size={13} />
                        </button>
                      </>
                    )}
                    {canEdit && c.status !== "pending" && (
                      <button
                        onClick={() => moderate(c.id, "reopen")}
                        disabled={busyCondolence === c.id}
                        className="p-1.5 rounded-lg bg-white/[0.06] text-[#94A3B8] hover:text-white disabled:opacity-40 transition-colors"
                        aria-label="Move back to pending"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    {(c.isMine || canEdit) && (
                      <button
                        onClick={() => deleteCondolence(c.id)}
                        disabled={busyCondolence === c.id}
                        className="p-1.5 rounded-lg bg-white/[0.06] text-[#94A3B8] hover:text-[#F87171] disabled:opacity-40 transition-colors"
                        aria-label="Delete condolence"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[14px] leading-relaxed text-[#CBD5E1] whitespace-pre-wrap">{c.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
