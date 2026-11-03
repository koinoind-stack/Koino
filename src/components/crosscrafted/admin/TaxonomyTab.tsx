"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Taxonomy panel (Articles & Knowledge Phase 2 — Plan v2 §2.3/§2.4/§5.3)
// ─────────────────────────────────────────────────────────────────────────────
// Manages the DB-backed Category and Topic tables: create, edit, deactivate
// (soft — the default path), reorder (batch sortOrder), and hard-delete for
// unused rows (server rejects with 409 when a row is still referenced).
// All privileged actions hit the /api/admin/taxonomy/* APIs, which enforce
// admin-only access server-side — this component is convenience, not the gate.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Tags,
  Trash2,
  X,
} from "lucide-react";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconKey: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { topics: number; articles: number };
};

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  legacyKey: string | null;
  description: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
  parentCategory: { id: string; name: string; slug: string };
  _count: { articles: number };
};

type Section = "categories" | "topics";

export default function TaxonomyTab() {
  const [section, setSection] = useState<Section>("categories");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Create form state (one row at a time, per section)
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newParent, setNewParent] = useState("");
  const [newColor, setNewColor] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([
        fetch("/api/admin/taxonomy/categories").then((r) => r.json()),
        fetch("/api/admin/taxonomy/topics").then((r) => r.json()),
      ]);
      if (c.categories) setCategories(c.categories);
      if (t.topics) setTopics(t.topics);
    } catch {
      toast.error("Failed to load taxonomy.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (row: CategoryRow | TopicRow) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditSlug(row.slug);
    setEditDesc(row.description ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditSlug("");
    setEditDesc("");
  };

  const saveEdit = async (kind: Section, id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/taxonomy/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          slug: editSlug.trim() || undefined,
          description: editDesc.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Update failed.");
        return;
      }
      toast.success("Saved.");
      cancelEdit();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (kind: Section, row: CategoryRow | TopicRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/taxonomy/${kind}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Update failed.");
        return;
      }
      toast.success(row.isActive ? "Deactivated — pickers hide it, links survive." : "Activated.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (kind: Section, row: CategoryRow | TopicRow) => {
    if (!window.confirm(`Delete "${row.name}" permanently? Unused rows only — the server blocks rows still in use.`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/taxonomy/${kind}/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Delete blocked.");
        return;
      }
      toast.success("Deleted.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const move = async (kind: Section, list: (CategoryRow | TopicRow)[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((r) => r.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusyId(ids[index]);
    try {
      const res = await fetch(`/api/admin/taxonomy/${kind}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Reorder failed.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    if (!newName.trim()) {
      toast.error("Name is required.");
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { name: newName.trim() };
      if (newSlug.trim()) payload.slug = newSlug.trim();
      if (section === "topics") {
        if (!newParent) {
          toast.error("Pick a parent category.");
          return;
        }
        payload.parentCategoryId = newParent;
        if (newColor.trim()) payload.color = newColor.trim();
      }
      const res = await fetch(`/api/admin/taxonomy/${section}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Create failed.");
        return;
      }
      toast.success("Created.");
      setNewName("");
      setNewSlug("");
      setNewColor("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const activeCategories = categories.filter((c) => c.isActive);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-1 h-5 rounded-full bg-[#7C3AED]" />
        <h2 className="text-sm font-bold text-white">Taxonomy — Categories &amp; Topics</h2>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C3AED]/15 text-[#A78BFA]">
          DB-managed
        </span>
        <div className="ml-auto flex gap-1.5">
          {(["categories", "topics"] as Section[]).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 transition-all capitalize ${
                section === s
                  ? "bg-[#7C3AED] text-white"
                  : "text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#94A3B8]">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Create row */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Plus size={12} className="text-[#A78BFA]" />
              <span className="text-[11px] font-bold text-white capitalize">
                New {section === "categories" ? "category" : "topic"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name *"
                className="neo-input text-xs flex-1 min-w-[140px]"
              />
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="slug (optional)"
                className="neo-input text-xs w-40"
              />
              {section === "topics" && (
                <>
                  <select
                    value={newParent}
                    onChange={(e) => setNewParent(e.target.value)}
                    className="neo-input text-xs w-44"
                  >
                    <option value="">Parent category *</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="#RRGGBB (optional)"
                    className="neo-input text-xs w-36"
                  />
                </>
              )}
              <button
                onClick={create}
                disabled={creating}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Create
              </button>
            </div>
          </div>

          {/* List */}
          {section === "categories" ? (
            <div className="space-y-2">
              {categories.length === 0 && (
                <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center text-xs text-[#94A3B8]">
                  No categories yet — create the first one above (run the seed script to load the six canonical sections).
                </div>
              )}
              {categories.map((c, i) => (
                <div
                  key={c.id}
                  className={`rounded-xl border p-3 ${
                    c.isActive
                      ? "border-white/[0.08] bg-white/[0.03]"
                      : "border-white/[0.05] bg-white/[0.015] opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-[#64748B] w-5">#{i + 1}</span>
                    {editingId === c.id ? (
                      <div className="flex-1 space-y-1.5">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          className="neo-input text-xs w-full"
                        />
                        <input
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                          placeholder="slug"
                          className="neo-input text-xs w-full"
                        />
                        <textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                          rows={2}
                          className="neo-input text-xs w-full"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{c.name}</span>
                          <code className="text-[10px] text-[#94A3B8]">/{c.slug}</code>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#7C3AED]/15 text-[#A78BFA]">
                            {c._count.topics} topics
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3B82F6]/15 text-[#93C5FD]">
                            {c._count.articles} articles
                          </span>
                          {!c.isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B]/15 text-[#F59E0B]">
                              inactive
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-1">{c.description}</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => move("categories", categories, i, -1)}
                        disabled={i === 0 || busyId === c.id}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => move("categories", categories, i, 1)}
                        disabled={i === categories.length - 1 || busyId === c.id}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown size={12} />
                      </button>
                      {editingId === c.id ? (
                        <>
                          <button
                            onClick={() => saveEdit("categories", c.id)}
                            disabled={busyId === c.id}
                            className="p-1.5 rounded-lg text-[#22C55E] hover:bg-[#22C55E]/10 disabled:opacity-50"
                            title="Save"
                          >
                            {busyId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(c)}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
                            title="Edit"
                          >
                            <Save size={12} />
                          </button>
                          <button
                            onClick={() => toggleActive("categories", c)}
                            disabled={busyId === c.id}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] disabled:opacity-50"
                            title={c.isActive ? "Deactivate" : "Activate"}
                          >
                            {c.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            onClick={() => remove("categories", c)}
                            disabled={busyId === c.id}
                            className="p-1.5 rounded-lg text-[#EF4444]/70 hover:text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-50"
                            title="Delete (unused rows only)"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {topics.length === 0 && (
                <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center text-xs text-[#94A3B8]">
                  No topics yet — run the seed script or create the first one above.
                </div>
              )}
              {topics.map((t, i) => (
                <div
                  key={t.id}
                  className={`rounded-xl border p-3 ${
                    t.isActive
                      ? "border-white/[0.08] bg-white/[0.03]"
                      : "border-white/[0.05] bg-white/[0.015] opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-[#64748B] w-5">#{i + 1}</span>
                    {editingId === t.id ? (
                      <div className="flex-1 space-y-1.5">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          className="neo-input text-xs w-full"
                        />
                        <input
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                          placeholder="slug"
                          className="neo-input text-xs w-full"
                        />
                        <textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                          rows={2}
                          className="neo-input text-xs w-full"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.color && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: t.color }}
                            />
                          )}
                          <span className="text-xs font-bold text-white">{t.name}</span>
                          <code className="text-[10px] text-[#94A3B8]">/{t.slug}</code>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B]/15 text-[#F59E0B]">
                            {t.parentCategory.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3B82F6]/15 text-[#93C5FD]">
                            {t._count.articles} articles
                          </span>
                          {t.legacyKey && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#22C55E]/15 text-[#22C55E]"
                              title="Preserved SPA topic id — the Q&A pipeline resolves this"
                            >
                              <Tags size={9} className="inline mr-0.5 -mt-0.5" />
                              {t.legacyKey}
                            </span>
                          )}
                          {!t.isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B]/15 text-[#F59E0B]">
                              inactive
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-1">{t.description}</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => move("topics", topics, i, -1)}
                        disabled={i === 0 || busyId === t.id}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => move("topics", topics, i, 1)}
                        disabled={i === topics.length - 1 || busyId === t.id}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown size={12} />
                      </button>
                      {editingId === t.id ? (
                        <>
                          <button
                            onClick={() => saveEdit("topics", t.id)}
                            disabled={busyId === t.id}
                            className="p-1.5 rounded-lg text-[#22C55E] hover:bg-[#22C55E]/10 disabled:opacity-50"
                            title="Save"
                          >
                            {busyId === t.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
                            title="Edit"
                          >
                            <Save size={12} />
                          </button>
                          <button
                            onClick={() => toggleActive("topics", t)}
                            disabled={busyId === t.id}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] disabled:opacity-50"
                            title={t.isActive ? "Deactivate" : "Activate"}
                          >
                            {t.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            onClick={() => remove("topics", t)}
                            disabled={busyId === t.id}
                            className="p-1.5 rounded-lg text-[#EF4444]/70 hover:text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-50"
                            title="Delete (unused, non-legacy rows only)"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
