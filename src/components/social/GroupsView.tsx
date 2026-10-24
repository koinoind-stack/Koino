"use client";

/**
 * Groups discovery — browse, search, and create faith communities
 * (Youth Fellowship, Bible Study, Prayer Partners, Worship Teams,
 * Christian Entrepreneurs, Church Communities…).
 *
 * Reads /api/social/groups and degrades to the normal empty state while the
 * Round-2 tables are not created yet.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "./types";
import EmojiPickerButton, { insertAtCursor } from "./EmojiPicker";

type Group = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  visibility: "public" | "private" | string;
  coverGradient: number;
  memberCount: number;
  createdByName: string | null;
  myMembership: string | null;
  myRole: string | null;
};

type Props = {
  onOpenGroup: (id: string) => void;
  onBack: () => void;
};

const CATEGORIES = [
  { id: "All", label: "All" },
  { id: "fellowship", label: "Fellowship" },
  { id: "youth", label: "Youth" },
  { id: "bible-study", label: "Bible Study" },
  { id: "prayer", label: "Prayer" },
  { id: "worship", label: "Worship" },
  { id: "entrepreneurs", label: "Business" },
  { id: "church", label: "Church" },
];

const GRADIENTS = [
  "from-purple-600 to-pink-500",
  "from-indigo-600 to-purple-500",
  "from-fuchsia-600 to-pink-500",
  "from-violet-600 to-indigo-500",
  "from-rose-500 to-orange-400",
  "from-blue-600 to-violet-500",
  "from-pink-500 to-rose-400",
  "from-purple-500 to-cyan-400",
];

export default function GroupsView({ onOpenGroup, onBack }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "fellowship", visibility: "public" });
  const groupDescRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "All") params.set("category", category);
      if (q.trim()) params.set("q", q.trim());
      const qs = params.toString();
      const [all, mine] = await Promise.all([
        api<{ groups: Group[] }>(`/api/social/groups${qs ? `?${qs}` : ""}`),
        api<{ groups: Group[] }>("/api/social/groups?mine=1"),
      ]);
      const mineAll = mine.groups || [];
      // Discover list must not repeat groups already shown in "Your groups"
      setGroups((all.groups || []).filter((g) => !mineAll.some((m) => m.id === g.id)));
      setMyGroups(mineAll.filter((g) => g.myMembership === "active" || g.myRole === "owner"));
    } catch (err) {
      toast.error((err as Error).message || "Could not load groups");
    } finally {
      setLoading(false);
    }
  }, [category, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0); // debounce search typing
    return () => clearTimeout(t);
  }, [load, q]);

  async function createGroup() {
    if (form.name.trim().length < 3 || creating) return;
    setCreating(true);
    try {
      const d = await api<{ group: { id: string } }>("/api/social/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast.success("Group created — welcome your first members!");
      setShowForm(false);
      setForm({ name: "", description: "", category: "fellowship", visibility: "public" });
      onOpenGroup(d.group.id);
    } catch (err) {
      toast.error((err as Error).message || "Could not create the group");
    } finally {
      setCreating(false);
    }
  }

  function GroupCard({ g }: { g: Group }) {
    const grad = GRADIENTS[Math.abs(g.coverGradient ?? 0) % GRADIENTS.length];
    return (
      <button
        onClick={() => onOpenGroup(g.id)}
        className="w-full text-left rounded-2xl overflow-hidden bg-[#111827]/60 border border-white/[0.05] hover:border-[#7C3AED]/40 transition-colors"
      >
        <div className={`relative h-16 bg-gradient-to-br ${grad} flex items-center px-3`}>
          <span className="w-9 h-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-extrabold">
            {g.name.charAt(0).toUpperCase()}
          </span>
          {g.visibility === "private" && (
            <Lock size={12} className="absolute top-2 right-2 text-white/80" />
          )}
        </div>
        <div className="p-3">
          <h3 className="text-sm font-bold text-white truncate">{g.name}</h3>
          <p className="text-[11px] text-[#94A3B8] line-clamp-2 mt-0.5 min-h-[2em]">
            {g.description || "No description yet."}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-bold text-[#64748B] inline-flex items-center gap-1">
              <Users size={10} /> {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
            </span>
            {g.myMembership === "active" ? (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.myRole === "owner" ? "bg-amber-500/15 text-amber-300" : "bg-[#7C3AED]/20 text-[#C4B5FD]"}`}>
                {g.myRole === "owner" ? "Owner" : "Joined"}
              </span>
            ) : g.myMembership === "pending" ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-[#94A3B8]">Requested</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-[#94A3B8] capitalize">{g.category.replace("-", " ")}</span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white" aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-extrabold text-white">Groups &amp; Fellowship</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9]"
        >
          <Plus size={14} /> Create
        </button>
      </div>

      {showForm && (
        <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4 mb-4 space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={60}
            placeholder="Group name (e.g. Youth Fellowship Bengaluru)"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
          />
          <textarea
            ref={groupDescRef}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={500}
            rows={2}
            placeholder="What is this group about?"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none resize-none focus:border-[#7C3AED]/50"
          />
          <div className="flex items-center">
            <EmojiPickerButton
              align="left"
              onPick={(e) =>
                insertAtCursor(groupDescRef.current, e, (v) => setForm((f) => ({ ...f, description: v })), 500)
              }
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.filter((c) => c.id !== "All").map((c) => (
              <button
                key={c.id}
                onClick={() => setForm({ ...form, category: c.id })}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                  form.category === c.id
                    ? "bg-[#7C3AED]/20 border-[#7C3AED]/60 text-[#C4B5FD]"
                    : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setForm({ ...form, visibility: form.visibility === "public" ? "private" : "public" })}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#94A3B8] hover:text-white"
            >
              <Lock size={12} />
              {form.visibility === "public" ? "Public — anyone can join" : "Private — owner approves members"}
            </button>
            <button
              onClick={createGroup}
              disabled={form.name.trim().length < 3 || creating}
              className="px-5 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create group"}
            </button>
          </div>
        </div>
      )}

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search groups…"
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#7C3AED]/50"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
              category === c.id
                ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                : "bg-white/[0.03] border-white/[0.06] text-[#94A3B8] hover:text-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {myGroups.length > 0 && category === "All" && !q && (
        <div className="mb-5">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">Your groups</h2>
          <div className="grid grid-cols-2 gap-3">
            {myGroups.map((g) => <GroupCard key={g.id} g={g} />)}
          </div>
        </div>
      )}

      <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">
        {q ? "Search results" : "Discover groups"}
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-[#111827]/60 border border-white/[0.05] animate-pulse">
              <div className="h-16 bg-white/5" />
              <div className="p-3 space-y-2">
                <div className="w-2/3 h-3 bg-white/10 rounded" />
                <div className="w-full h-2.5 bg-white/5 rounded" />
                <div className="w-1/3 h-2 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-[#94A3B8] text-sm mb-4">
            {q || category !== "All"
              ? "No groups match — try another search."
              : "No groups yet. Create the first fellowship community!"}
          </p>
          {!q && category === "All" && (
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7C3AED] text-white text-sm font-bold">
              <Plus size={16} /> Start a group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {groups.map((g) => <GroupCard key={g.id} g={g} />)}
        </div>
      )}
    </div>
  );
}
