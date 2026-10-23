"use client";

/**
 * Individual memorial page (Part 4 — In Loving Memory).
 * Auth-aware: fetches /api/memorials/[id], which enforces the memorial's
 * visibility. Renders the peaceful header, life story, gallery, verse,
 * condolences/memories, moderation tools for managers, share and report.
 */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flower2, MapPin, Share2, Flag, Trash2, EyeOff, Eye,
  Pencil, Send, Loader2, ShieldAlert, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/social/format";
import { useSupabaseUser } from "@/lib/supabase/use-user";

type Condolence = {
  id: string;
  authorId: string;
  authorName: string;
  kind: string; // "condolence" | "memory"
  body: string;
  hidden: boolean;
  createdAt: string;
};

type MemorialData = {
  memorial: {
    id: string; fullName: string; photoUrl: string | null; gallery: string[];
    dob: string | null; dod: string | null; city: string | null; state: string | null;
    tribute: string | null; lifeStory: string | null; milestones: string | null;
    qualities: string | null; verse: string | null; verseRef: string | null;
    visibility: string; status: string;
    creatorName: string; creatorRelation: string; createdAt: string; publishedAt: string | null;
  };
  viewer: { role: "owner" | "manager" | null; isAdmin: boolean; userId: string | null };
  managers: { userId: string; name: string; username: string | null; image: string | null; role: string }[];
  condolences: Condolence[];
};

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "";

export default function MemorialView({ memorialId }: { memorialId: string }) {
  const { isAuthenticated } = useSupabaseUser();
  const [data, setData] = useState<MemorialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"story" | "gallery" | "tributes">("story");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<"condolence" | "memory">("condolence");
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "This memorial is not available.");
        setData(null);
      } else {
        setData(body);
      }
    } catch {
      setError("Could not load this memorial. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [memorialId]);

  useEffect(() => { load(); }, [load]);

  async function postCondolence() {
    if (posting || msg.trim().length < 2) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msg.trim(), kind }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not post your message");
      setMsg("");
      toast.success(kind === "memory" ? "Memory shared" : "Condolence sent");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function moderate(cid: string, action: "hide" | "unhide" | "delete") {
    if (busyId) return;
    if (action === "delete" && !confirm("Remove this message permanently?")) return;
    setBusyId(cid);
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/memorials/${memorialId}/condolences/${cid}`, { method: "DELETE" })
          : await fetch(`/api/memorials/${memorialId}/condolences/${cid}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hidden: action === "hide" }),
            });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Action failed");
      }
      toast.success(action === "delete" ? "Message removed" : action === "hide" ? "Message hidden" : "Message visible again");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOwn(cid: string) {
    if (busyId) return;
    if (!confirm("Delete your message?")) return;
    setBusyId(cid);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/condolences/${cid}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete your message");
      toast.success("Your message was deleted");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reportMessage(cid: string) {
    try {
      const res = await fetch("/api/social/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "memorial", targetId: memorialId, reason: "condolence", details: `Message ${cid}` }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Could not report");
      }
      toast.success("Report submitted. Thank you.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function reportMemorial() {
    const reason = prompt(
      "Why are you reporting this memorial?\n\n- false information or impersonation\n- offensive or inappropriate content\n- shared without family permission\n\nDescribe briefly:",
    );
    if (!reason?.trim()) return;
    try {
      const res = await fetch("/api/social/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "memorial", targetId: memorialId, reason: "inappropriate", details: reason.trim().slice(0, 1000) }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Could not report");
      }
      toast.success("Report submitted for admin review. Thank you.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: `In loving memory of ${data?.memorial.fullName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied — you can paste it in a message");
      }
    } catch {
      // user cancelled the share sheet — not an error
    }
  }

  async function shareToFeed() {
    if (sharing) return;
    if (!confirm("Share a respectful announcement of this memorial in the Koino feed?")) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/memorials/${memorialId}/share-feed`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not share");
      toast.success("Announcement shared in the feed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  async function publishNow() {
    try {
      const res = await fetch(`/api/memorials/${memorialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Could not publish");
      }
      toast.success("Memorial published");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ─── states ───
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <Flower2 size={30} className="mx-auto text-[#475569] mb-4" />
        <h1 className="text-lg font-bold text-white mb-2">Memorial not available</h1>
        <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">{error}</p>
        <Link href="/memorials" className="inline-flex items-center px-5 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm font-bold text-white hover:bg-white/10">
          <Flower2 size={14} className="mr-2" /> Visit In Loving Memory
        </Link>
      </div>
    );
  }

  const m = data.memorial;
  const isManager = !!data.viewer.role;
  const isAdmin = data.viewer.isAdmin;
  const isDraft = m.status === "draft";
  const isUnpublished = m.status === "unpublished";
  const dates = [fmtDate(m.dob), fmtDate(m.dod)].filter(Boolean);

  return (
    <div className="max-w-[680px] mx-auto px-4 pt-8 pb-24">
      {/* ─── status banners (managers only) ─── */}
      {(isDraft || isUnpublished) && isManager && (
        <div className={`rounded-xl border px-4 py-3 mb-5 flex items-center gap-2.5 ${isDraft ? "bg-amber-500/[0.06] border-amber-500/25" : "bg-red-500/[0.06] border-red-500/25"}`}>
          {isDraft ? <Pencil size={14} className="text-amber-300 shrink-0" /> : <EyeOff size={14} className="text-red-300 shrink-0" />}
          <p className="text-xs text-[#94A3B8] flex-1 leading-relaxed">
            {isDraft
              ? "This memorial is a draft — only the managers can see it. Publish it when you are ready."
              : "This memorial is unpublished — only the managers and Koino admins can see it."}
          </p>
          {isDraft && (
            <button onClick={publishNow} className="px-3 py-1.5 rounded-full bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] shrink-0">
              Publish
            </button>
          )}
        </div>
      )}

      {/* ─── peaceful header ─── */}
      <header className="text-center mb-8">
        {m.photoUrl ? (
          <Image
            src={m.photoUrl}
            alt={m.fullName}
            width={112}
            height={112}
            className="w-28 h-28 rounded-full object-cover mx-auto border-2 border-white/10"
            unoptimized
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#7C3AED]/25 to-[#1C1929] flex items-center justify-center mx-auto border border-white/10">
            <Flower2 size={36} className="text-[#C4B5FD]" />
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-5">{m.fullName}</h1>
        {dates.length > 0 && (
          <p className="text-sm text-[#94A3B8] mt-2">{dates.join("  ·  ")}</p>
        )}
        {(m.city || m.state) && (
          <p className="text-xs text-[#64748B] mt-1.5 inline-flex items-center gap-1">
            <MapPin size={11} /> {[m.city, m.state].filter(Boolean).join(", ")}
          </p>
        )}
        <p className="text-xs text-[#64748B] mt-3">
          Remembered by {m.creatorName} · {m.creatorRelation}
        </p>

        {/* actions row */}
        <div className="flex items-center justify-center flex-wrap gap-2 mt-5">
          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10"
          >
            <Share2 size={13} /> Share
          </button>
          {isManager && m.status === "published" && m.visibility === "public" && (
            <button
              onClick={shareToFeed}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#7C3AED] text-xs font-bold text-white hover:bg-[#6D28D9] disabled:opacity-40"
            >
              {sharing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Share to feed
            </button>
          )}
          {isManager && (
            <Link
              href={`/memorials/${m.id}/manage`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-white hover:bg-white/10"
            >
              <Pencil size={13} /> Manage
            </Link>
          )}
          {!isManager && (
            <button
              onClick={reportMemorial}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.03] text-[11px] font-bold text-[#64748B] hover:text-white"
            >
              <Flag size={12} /> Report
            </button>
          )}
        </div>
      </header>

      {/* ─── verse ─── */}
      {m.verse && (
        <div className="text-center px-6 py-6 mb-8 rounded-2xl bg-[#7C3AED]/[0.05] border border-[#7C3AED]/15">
          <p className="text-[15px] italic text-[#C4B5FD] leading-relaxed">“{m.verse}”</p>
          {m.verseRef && <p className="text-[11px] font-bold text-[#64748B] mt-2 uppercase tracking-wider">{m.verseRef}</p>}
        </div>
      )}

      {/* ─── tabs ─── */}
      <div className="flex gap-1.5 mb-5 border-b border-white/[0.05] pb-3">
        {([
          { id: "story", label: "Life story" },
          { id: "gallery", label: `Gallery${m.gallery.length ? ` (${m.gallery.length})` : ""}` },
          { id: "tributes", label: "Tributes & condolences" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              tab === t.id ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── story tab ─── */}
      {tab === "story" && (
        <div className="space-y-5">
          {m.tribute && (
            <p className="text-[15px] text-[#E2E8F0] leading-relaxed font-medium">{m.tribute}</p>
          )}
          {m.lifeStory ? (
            <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{m.lifeStory}</div>
          ) : (
            !m.tribute && (
              <p className="text-sm text-[#64748B] italic">The life story will be added by the family.</p>
            )
          )}
          {m.milestones && (
            <section>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Family background & milestones</h2>
              <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{m.milestones}</div>
            </section>
          )}
          {m.qualities && (
            <section>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Qualities, achievements & memories</h2>
              <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{m.qualities}</div>
            </section>
          )}
          {!m.tribute && !m.lifeStory && !m.milestones && !m.qualities && (
            <p className="text-sm text-[#64748B] italic text-center py-6">
              The family has not added the story yet — please check again soon.
            </p>
          )}
        </div>
      )}

      {/* ─── gallery tab ─── */}
      {tab === "gallery" && (
        m.gallery.length === 0 ? (
          <p className="text-sm text-[#64748B] italic text-center py-10">No additional photographs yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {m.gallery.map((g) => (
              <a key={g} href={g} target="_blank" rel="noreferrer" className="block">
                <Image src={g} alt="" width={220} height={220} className="w-full aspect-square object-cover rounded-xl border border-white/[0.06]" unoptimized />
              </a>
            ))}
          </div>
        )
      )}

      {/* ─── tributes tab ─── */}
      {tab === "tributes" && (
        <div className="space-y-4">
          {/* composer */}
          {isAuthenticated && !isDraft ? (
            <div className="rounded-2xl bg-[#111827]/60 border border-white/[0.05] p-4">
              <div className="flex gap-1.5 mb-2.5">
                <button
                  onClick={() => setKind("condolence")}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${kind === "condolence" ? "bg-[#7C3AED] text-white" : "bg-white/[0.04] text-[#94A3B8]"}`}
                >
                  Condolence
                </button>
                <button
                  onClick={() => setKind("memory")}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${kind === "memory" ? "bg-[#7C3AED] text-white" : "bg-white/[0.04] text-[#94A3B8]"}`}
                >
                  Memory or tribute
                </button>
              </div>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={kind === "condolence" ? "Write a few words of comfort for the family…" : "Share a memory or tribute…"}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={postCondolence}
                  disabled={posting || msg.trim().length < 2}
                  className="px-4 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
                >
                  {posting ? "Sending…" : kind === "condolence" ? "Send condolence" : "Share memory"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#64748B] text-center py-3">
              <Link href="/auth/signin" className="text-[#C4B5FD] font-bold hover:text-white">Sign in</Link>
              {" "}to leave a condolence or share a memory.
            </p>
          )}

          {/* list */}
          {data.condolences.length === 0 ? (
            <p className="text-sm text-[#64748B] italic text-center py-8">
              No messages yet — your words of comfort will mean a lot to the family.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.condolences.map((c) => {
                const own = data.viewer.userId === c.authorId;
                const canModerate = isManager || isAdmin;
                return (
                  <li
                    key={c.id}
                    className={`rounded-2xl border px-4 py-3.5 ${
                      c.hidden ? "bg-[#111827]/30 border-red-500/10 opacity-70" : "bg-[#111827]/60 border-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-white">{c.authorName}</span>
                      {c.kind === "memory" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7C3AED]/15 text-[#C4B5FD]">Memory</span>
                      )}
                      <span className="text-[10px] text-[#64748B]">{timeAgo(c.createdAt)}</span>
                      {c.hidden && <span className="text-[9px] font-bold text-red-300 uppercase">Hidden</span>}
                    </div>
                    <p className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{c.body}</p>
                    <div className="flex items-center gap-3 mt-2.5">
                      {own && (
                        <button onClick={() => deleteOwn(c.id)} disabled={busyId === c.id} className="text-[10px] font-bold text-[#64748B] hover:text-red-300 inline-flex items-center gap-1">
                          <Trash2 size={10} /> Delete
                        </button>
                      )}
                      {canModerate && !own && (
                        <>
                          <button onClick={() => moderate(c.id, c.hidden ? "unhide" : "hide")} disabled={busyId === c.id} className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1">
                            {c.hidden ? <><Eye size={10} /> Unhide</> : <><EyeOff size={10} /> Hide</>}
                          </button>
                          <button onClick={() => moderate(c.id, "delete")} disabled={busyId === c.id} className="text-[10px] font-bold text-[#64748B] hover:text-red-300 inline-flex items-center gap-1">
                            <Trash2 size={10} /> Remove
                          </button>
                        </>
                      )}
                      {!own && !canModerate && (
                        <button onClick={() => reportMessage(c.id)} className="text-[10px] font-bold text-[#64748B] hover:text-white inline-flex items-center gap-1">
                          <Flag size={10} /> Report
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ─── managers footer ─── */}
      {data.managers.length > 0 && (
        <div className="mt-10 pt-5 border-t border-white/[0.05] text-center">
          <p className="text-[11px] text-[#64748B]">
            {isManager ? "Managed by" : "This memorial is cared for by"}{" "}
            {data.managers.map((mm, i) => (
              <span key={mm.userId}>
                {i > 0 && ", "}
                <span className="text-[#94A3B8] font-semibold">{mm.name}</span>
                {mm.role === "owner" && " (owner)"}
              </span>
            ))}
          </p>
          {!isManager && (
            <p className="text-[10px] text-[#475569] mt-1.5 inline-flex items-center gap-1 justify-center">
              <Lock size={9} /> Managed with respect — report anything inappropriate using the button above.
            </p>
          )}
        </div>
      )}

      {isAdmin && !isManager && (
        <div className="mt-4 rounded-xl bg-red-500/[0.05] border border-red-500/20 px-4 py-2.5 flex items-center gap-2">
          <ShieldAlert size={13} className="text-red-300" />
          <p className="text-[11px] text-[#94A3B8]">You are viewing this memorial as a Koino administrator.</p>
        </div>
      )}

      <div className="text-center mt-8">
        <Link href="/memorials" className="text-[11px] text-[#64748B] hover:text-white">
          ← All memorials
        </Link>
      </div>
    </div>
  );
}
