"use client";

/**
 * Admin — Marketplace Listings / Koino Store / Business Directory / Trivia
 * Rewards. Real database-backed tabs replacing the preview-mode mock.
 * Conventions follow the existing admin tabs (fetch + no-store, toast,
 * busyId, confirm() for destructive actions, neo-input filters).
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check, X, Star, Trash2, Pencil, Search, Archive, Package, Gift, Users, Send,
} from "lucide-react";
import { MARKETPLACE_CATEGORIES, BUSINESS_CATEGORIES, CHURCH_GRADIENTS } from "@/lib/crosscrafted-data";
import ImagePicker from "@/components/crosscrafted/ImagePicker";

const listStatusChip = (s: string) => {
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-500/15 text-emerald-300",
    PENDING: "bg-sky-500/15 text-sky-300",
    REJECTED: "bg-red-500/15 text-red-300",
    SOLD: "bg-violet-500/15 text-violet-300",
    ARCHIVED: "bg-white/[0.06] text-[#94A3B8]",
  };
  return `text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${map[s] || map.ARCHIVED}`;
};

function AdminHeader({ title, count, color }: { title: string; count?: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
      <h3 className="text-sm font-black text-white tracking-tight">{title}</h3>
      {count != null && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
          {count}
        </span>
      )}
    </div>
  );
}

function RejectBox({ onConfirm, onCancel, label }: { onConfirm: (reason: string) => void; onCancel: () => void; label: string }) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder={`Reason for the ${label}...`}
        className="neo-input text-xs w-full"
      />
      <div className="flex gap-2">
        <button onClick={() => (reason.trim() ? onConfirm(reason.trim()) : toast.error("Please give a short reason"))} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/15 text-red-300">
          Confirm reject
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#94A3B8] bg-white/[0.04]">Cancel</button>
      </div>
    </div>
  );
}

/* ─── 1. MARKETPLACE LISTINGS (member listing moderation) ─────────────────── */

type AdminListing = {
  id: string; title: string; description: string; price: number; mrp: number | null;
  category: string; images: string; state: string | null; city: string | null;
  sellerName: string; whatsappNumber: string | null; inStock: boolean;
  status: string; rejectionReason: string | null; featured: boolean;
  createdAt: string; seller: { username: string | null; name: string | null; email: string | null } | null;
};

export function MarketplaceListingsTab() {
  const [items, setItems] = useState<AdminListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminListing | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/marketplace?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load listings");
      setItems(body.listings || []);
      setTotal(body.total || 0);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const action = async (m: AdminListing, act: string, extra?: Record<string, unknown>) => {
    if (busyId) return;
    setBusyId(m.id);
    try {
      const res = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, action: act, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success(act === "approve" ? `Approved "${m.title}"` : `Updated "${m.title}"`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  };

  const remove = async (m: AdminListing) => {
    if (busyId || !confirm(`Permanently delete "${m.title}"? This cannot be undone.`)) return;
    setBusyId(m.id);
    try {
      const res = await fetch(`/api/admin/marketplace?id=${m.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");
      toast.success("Listing deleted");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async () => {
    if (!editing || busyId) return;
    setBusyId(editing.id);
    try {
      const res = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, action: "edit", edit: { title: editing.title, description: editing.description, price: editing.price } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Edit failed");
      toast.success("Listing updated");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-5">
      <AdminHeader title="Member Listings" count={total} color="#9786E3" />
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings or sellers..." className="neo-input text-sm w-full pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="neo-input text-sm">
          <option value="">All statuses</option>
          <option value="PENDING">Pending review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="SOLD">Sold</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <p className="text-sm text-[#94A3B8]">No listings match. New member submissions appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const images = (() => { try { return JSON.parse(m.images || "[]") as string[]; } catch { return []; } })();
            return (
              <div key={m.id} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#0f0f1a] shrink-0 flex items-center justify-center">
                    {images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[0]} alt={m.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" style={{ background: CHURCH_GRADIENTS[0] }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`statusChip ${listStatusChip(m.status)}`}>{m.status}</span>
                      {m.featured && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">FEATURED</span>}
                      {!m.inStock && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300">OUT OF STOCK</span>}
                    </div>
                    <p className="text-sm font-bold text-white truncate mt-1">{m.title}</p>
                    <p className="text-[11px] text-[#94A3B8]">
                      ₹{m.price.toLocaleString("en-IN")}{m.mrp ? ` · MRP ₹${m.mrp.toLocaleString("en-IN")}` : ""} · {m.category}
                      {m.city ? ` · ${m.city}` : ""}{m.state ? `, ${m.state}` : ""}
                    </p>
                    <p className="text-[10px] text-[#64748B] truncate">
                      Seller: {m.sellerName}{m.seller?.email ? ` (${m.seller.email})` : ""} · WhatsApp: {m.whatsappNumber || "—"}
                    </p>
                  </div>
                </div>

                {m.status === "REJECTED" && m.rejectionReason && (
                  <p className="text-[10px] text-red-300/80 mt-2">Reason: {m.rejectionReason}</p>
                )}

                {rejecting === m.id ? (
                  <RejectBox label="seller" onConfirm={(reason) => action(m, "reject", { rejectionReason: reason })} onCancel={() => setRejecting(null)} />
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {m.status === "PENDING" && (
                      <button disabled={busyId === m.id} onClick={() => action(m, "approve")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                        <Check size={11} /> Approve
                      </button>
                    )}
                    {m.status !== "REJECTED" && m.status !== "ARCHIVED" && (
                      <button disabled={busyId === m.id} onClick={() => setRejecting(m.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/15 text-red-300 flex items-center gap-1">
                        <X size={11} /> Reject
                      </button>
                    )}
                    <button disabled={busyId === m.id} onClick={() => action(m, m.featured ? "unfeature" : "feature")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#F59E0B]/10 text-[#F59E0B] flex items-center gap-1">
                      <Star size={11} /> {m.featured ? "Unfeature" : "Feature"}
                    </button>
                    {m.status !== "ARCHIVED" && (
                      <button disabled={busyId === m.id} onClick={() => action(m, "archive")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8] flex items-center gap-1">
                        <Archive size={11} /> Archive
                      </button>
                    )}
                    <button disabled={busyId === m.id} onClick={() => setEditing({ ...m })} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8] flex items-center gap-1">
                      <Pencil size={11} /> Edit
                    </button>
                    <button disabled={busyId === m.id} onClick={() => remove(m)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-300 flex items-center gap-1">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="bg-[#1C1929] border border-white/[0.08] rounded-2xl p-4 w-full max-w-md space-y-3">
            <AdminHeader title="Edit listing" color="#9786E3" />
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="neo-input text-sm w-full" placeholder="Title" />
            <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={4} className="neo-input text-sm w-full" placeholder="Description" />
            <input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="neo-input text-sm w-full" placeholder="Price ₹" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] bg-white/[0.04]">Cancel</button>
              <button disabled={busyId === editing.id} onClick={saveEdit} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[#7C3AED]">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 2. KOINO STORE (admin-managed inventory) ────────────────────────────── */

type StoreRow = {
  id: string; name: string; description: string; price: number; mrp: number | null;
  category: string; images: string; stockQuantity: number; inStock: boolean;
  featured: boolean; active: boolean; buyUrl: string | null; contactWhatsapp: string | null;
  variations: string; attributes: string;
};

const emptyStoreForm = {
  id: "", name: "", description: "", price: "", mrp: "", category: MARKETPLACE_CATEGORIES[0] as string,
  images: [] as string[], stockQuantity: "0", inStock: true, featured: false,
  active: true, buyUrl: "", contactWhatsapp: "",
};

export function StoreAdminTab() {
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyStoreForm);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<StoreRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/store", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load store products");
      setRows(body.products || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (busyId) return;
    if (!form.name || !form.description || !form.price) {
      toast.error("Name, description and price are required");
      return;
    }
    setBusyId(form.id || "new");
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        name: form.name, description: form.description,
        price: Number(form.price), mrp: form.mrp ? Number(form.mrp) : null,
        category: form.category, images: form.images,
        stockQuantity: Number(form.stockQuantity) || 0,
        inStock: form.inStock, featured: form.featured, active: form.active,
        buyUrl: form.buyUrl || null, contactWhatsapp: form.contactWhatsapp || null,
      };
      const res = await fetch("/api/admin/store", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Save failed");
      toast.success(form.id ? "Product updated" : "Product created");
      setForm(emptyStoreForm);
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const quickUpdate = async (r: StoreRow, data: Record<string, unknown>) => {
    if (busyId) return;
    setBusyId(r.id);
    try {
      const res = await fetch("/api/admin/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, ...data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Update failed");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: StoreRow) => {
    if (busyId || !confirm(`Permanently delete "${r.name}" from the Koino Store?`)) return;
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/admin/store?id=${r.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");
      toast.success("Product deleted");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (r: StoreRow) => {
    const images = (() => { try { return JSON.parse(r.images || "[]") as string[]; } catch { return []; } })();
    setForm({
      id: r.id, name: r.name, description: r.description, price: String(r.price),
      mrp: r.mrp ? String(r.mrp) : "", category: r.category, images,
      stockQuantity: String(r.stockQuantity), inStock: r.inStock, featured: r.featured,
      active: r.active, buyUrl: r.buyUrl || "", contactWhatsapp: r.contactWhatsapp || "",
    });
    setShowForm(true);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-5">
      <AdminHeader title="Koino Store Inventory" count={rows.length} color="#38BDF8" />
      <p className="text-[11px] text-[#64748B] mb-3">
        Official Koino inventory — members can never edit these. Active products appear under the Koino Store filter on the public Marketplace.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setForm(emptyStoreForm); setShowForm(true); }}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
          style={{ background: "linear-gradient(135deg, #9786E3, #38BDF8)" }}
        >
          <Package size={13} /> Add product
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1C1929] border border-white/[0.08] rounded-2xl p-4 mb-5 space-y-3">
          <AdminHeader title={form.id ? "Edit product" : "New store product"} color="#38BDF8" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="neo-input text-sm w-full" placeholder="Product name *" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="neo-input text-sm w-full" placeholder="Description (min 10 characters) *" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="neo-input text-sm" placeholder="Selling price ₹ *" />
            <input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} className="neo-input text-sm" placeholder="MRP ₹ (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="neo-input text-sm">
              {MARKETPLACE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} className="neo-input text-sm" placeholder="Stock quantity" />
          </div>
          <input value={form.contactWhatsapp} onChange={(e) => setForm({ ...form, contactWhatsapp: e.target.value })} className="neo-input text-sm w-full" placeholder="Store WhatsApp number (for the order button, optional)" />
          <input value={form.buyUrl} onChange={(e) => setForm({ ...form, buyUrl: e.target.value })} className="neo-input text-sm w-full" placeholder="External buy URL (optional — https://)" />
          <ImagePicker images={form.images} onChange={(images) => setForm({ ...form, images })} max={5} label="Product images" />
          <div className="flex flex-wrap gap-4 text-[11px] text-[#94A3B8]">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.inStock} onChange={(e) => setForm({ ...form, inStock: e.target.checked })} /> In stock</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (visible publicly)</label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setForm(emptyStoreForm); }} className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] bg-white/[0.04]">Cancel</button>
            <button disabled={!!busyId} onClick={save} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[#7C3AED] disabled:opacity-50">
              {busyId ? "Saving..." : form.id ? "Save changes" : "Create product"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-14"><div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <p className="text-sm text-[#94A3B8]">No store products yet. Create the first Koino Store item above.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const images = (() => { try { return JSON.parse(r.images || "[]") as string[]; } catch { return []; } })();
            return (
              <div key={r.id} className={`bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3 ${!r.active ? "opacity-60" : ""}`}>
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#0f0f1a] shrink-0 flex items-center justify-center">
                    {images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[0]} alt={r.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={16} className="text-[#475569]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.featured && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">FEATURED</span>}
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${r.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-[#94A3B8]"}`}>
                        {r.active ? "Active" : "Archived"}
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${r.stockQuantity > 0 && r.inStock ? "bg-sky-500/15 text-sky-300" : "bg-red-500/15 text-red-300"}`}>
                        {r.stockQuantity > 0 ? `Stock ${r.stockQuantity}` : "Out of stock"}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white truncate mt-0.5">{r.name}</p>
                    <p className="text-[11px] text-[#94A3B8]">₹{r.price.toLocaleString("en-IN")}{r.mrp ? ` · MRP ₹${r.mrp.toLocaleString("en-IN")}` : ""} · {r.category}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <button disabled={!!busyId} onClick={() => quickUpdate(r, { featured: !r.featured })} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#F59E0B]/10 text-[#F59E0B] flex items-center gap-1">
                    <Star size={11} /> {r.featured ? "Unfeature" : "Feature"}
                  </button>
                  <button disabled={!!busyId} onClick={() => quickUpdate(r, { active: !r.active })} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8] flex items-center gap-1">
                    <Archive size={11} /> {r.active ? "Archive" : "Restore"}
                  </button>
                  <button onClick={() => setPreview(r)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-500/10 text-sky-300">Preview card</button>
                  <button onClick={() => openEdit(r)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8] flex items-center gap-1">
                    <Pencil size={11} /> Edit
                  </button>
                  <button disabled={!!busyId} onClick={() => remove(r)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-300 flex items-center gap-1">
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div className="w-full max-w-[300px]">
            <p className="text-[10px] text-[#64748B] mb-2 text-center">Public product card preview</p>
            <div className="bg-[#1C1929] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="relative w-full aspect-square bg-[#0f0f1a]">
                {(() => {
                  const images = (() => { try { return JSON.parse(preview.images || "[]") as string[]; } catch { return []; } })();
                  return images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images[0]} alt={preview.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ background: CHURCH_GRADIENTS[preview.id.length % CHURCH_GRADIENTS.length] }} />
                  );
                })()}
              </div>
              <div className="p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#9786E3]">{preview.category}</p>
                <p className="text-xs font-bold text-white line-clamp-2 mt-0.5">{preview.name}</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-base font-extrabold text-white">₹{preview.price.toLocaleString("en-IN")}</span>
                  {preview.mrp && <span className="text-[10px] text-[#64748B] line-through">₹{preview.mrp.toLocaleString("en-IN")}</span>}
                </div>
                <span className="inline-block mt-1.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">Koino Store</span>
              </div>
            </div>
            <button onClick={() => setPreview(null)} className="w-full mt-3 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] bg-white/[0.04]">Close preview</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 3. BUSINESS DIRECTORY (admin moderation) ────────────────────────────── */

type AdminBusiness = {
  id: string; name: string; description: string; category: string;
  state: string | null; city: string | null; images: string;
  whatsappNumber: string | null; phone: string | null; email: string | null;
  website: string | null; status: string; rejectionReason: string | null;
  verified: boolean; featured: boolean; ownerName: string; createdAt: string;
  owner: { username: string | null; name: string | null; email: string | null } | null;
};

export function BusinessAdminTab() {
  const [items, setItems] = useState<AdminBusiness[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/businesses?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load businesses");
      setItems(body.businesses || []);
      setTotal(body.total || 0);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const action = async (b: AdminBusiness, act: string, extra?: Record<string, unknown>) => {
    if (busyId) return;
    setBusyId(b.id);
    try {
      const res = await fetch("/api/admin/businesses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, action: act, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast.success(`Updated "${b.name}"`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  };

  const remove = async (b: AdminBusiness) => {
    if (busyId || !confirm(`Permanently delete "${b.name}"? This cannot be undone.`)) return;
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/admin/businesses?id=${b.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");
      toast.success("Business deleted");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-5">
      <AdminHeader title="Business Directory" count={total} color="#A855F7" />
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search businesses or owners..." className="neo-input text-sm w-full pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="neo-input text-sm">
          <option value="">All statuses</option>
          <option value="PENDING">Pending review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <p className="text-sm text-[#94A3B8]">No businesses match. Member submissions appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((b) => {
            const images = (() => { try { return JSON.parse(b.images || "[]") as string[]; } catch { return []; } })();
            return (
              <div key={b.id} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#0f0f1a] shrink-0 flex items-center justify-center">
                    {images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[0]} alt={b.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" style={{ background: CHURCH_GRADIENTS[1] }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${listStatusChip(b.status)}`}>{b.status}</span>
                      {b.verified && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">VERIFIED</span>}
                      {b.featured && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">FEATURED</span>}
                    </div>
                    <p className="text-sm font-bold text-white truncate mt-1">{b.name}</p>
                    <p className="text-[11px] text-[#94A3B8]">{b.category}{b.city ? ` · ${b.city}` : ""}{b.state ? `, ${b.state}` : ""}</p>
                    <p className="text-[10px] text-[#64748B] truncate">
                      Owner: {b.ownerName}{b.owner?.email ? ` (${b.owner.email})` : ""} · {b.whatsappNumber || b.phone || "no contact"}
                    </p>
                  </div>
                </div>

                {b.status === "REJECTED" && b.rejectionReason && (
                  <p className="text-[10px] text-red-300/80 mt-2">Reason: {b.rejectionReason}</p>
                )}

                {rejecting === b.id ? (
                  <RejectBox label="owner" onConfirm={(reason) => action(b, "reject", { rejectionReason: reason })} onCancel={() => setRejecting(null)} />
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {b.status === "PENDING" && (
                      <button disabled={busyId === b.id} onClick={() => action(b, "approve")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                        <Check size={11} /> Approve
                      </button>
                    )}
                    {b.status !== "REJECTED" && b.status !== "ARCHIVED" && (
                      <button disabled={busyId === b.id} onClick={() => setRejecting(b.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/15 text-red-300 flex items-center gap-1">
                        <X size={11} /> Reject
                      </button>
                    )}
                    <button disabled={busyId === b.id} onClick={() => action(b, b.verified ? "unverify" : "verify")} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${b.verified ? "bg-white/[0.04] text-[#94A3B8]" : "bg-emerald-500/10 text-emerald-300"}`}>
                      <span className="text-[10px]">✓</span> {b.verified ? "Unverify" : "Verify"}
                    </button>
                    <button disabled={busyId === b.id} onClick={() => action(b, b.featured ? "unfeature" : "feature")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#F59E0B]/10 text-[#F59E0B] flex items-center gap-1">
                      <Star size={11} /> {b.featured ? "Unfeature" : "Feature"}
                    </button>
                    {b.status !== "ARCHIVED" && (
                      <button disabled={busyId === b.id} onClick={() => action(b, "archive")} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8] flex items-center gap-1">
                        <Archive size={11} /> Archive
                      </button>
                    )}
                    <button disabled={busyId === b.id} onClick={() => remove(b)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-300 flex items-center gap-1">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── 4. TRIVIA REWARDS (items / assign / winners) ────────────────────────── */

type GiftRow = {
  id: string; giftId: string; title: string; description: string; imageUrl: string;
  pointsRequired: number; tier: string; stock: number; isActive: boolean;
  deliveryType: string; eligibilityType: string; eligibilityValue: number | null;
  isAdmin: boolean;
};

type WinnerRow = {
  id: string; status: string; adminNotes: string | null;
  user: { email: string | null; username: string | null } | null;
  competition: { title: string } | null;
  prize: { name: string } | null;
  rank: number; score: number; createdAt: string;
};

const WINNER_STATUSES = [
  "pending_verification", "phone_verified", "contacted", "address_pending",
  "address_verified", "processing", "shipped", "delivered", "claimed",
  "cancelled", "disqualified", "expired",
];

export function RewardsAdminTab() {
  const [section, setSection] = useState<"items" | "assign" | "winners">("items");
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignGiftId, setAssignGiftId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, wRes] = await Promise.all([
        fetch("/api/admin/gifts", { cache: "no-store" }),
        fetch("/api/admin/trivia/winners", { cache: "no-store" }),
      ]);
      const g = await gRes.json();
      const w = await wRes.json();
      setGifts(g.gifts || []);
      setWinners(w.winners || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateGift = async (g: GiftRow, data: Record<string, unknown>) => {
    if (busyId) return;
    setBusyId(g.giftId);
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: g.giftId, ...data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Update failed");
      toast.success(`Updated "${g.title}"`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const assign = async () => {
    if (busyId) return;
    if (!assignUserId.trim() || !assignGiftId) {
      toast.error("Member user ID and reward are required");
      return;
    }
    setBusyId("assign");
    try {
      const res = await fetch("/api/admin/trivia/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignUserId.trim(), giftId: assignGiftId, adminNotes: assignNotes || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Assignment failed");
      toast.success("Reward assigned", { description: `Gift ${assignGiftId} → member ${body.member?.email || assignUserId}` });
      setAssignUserId("");
      setAssignNotes("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const setWinnerStatus = async (w: WinnerRow, status: string) => {
    if (busyId) return;
    setBusyId(w.id);
    try {
      const res = await fetch("/api/admin/trivia/winners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: w.id, status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Update failed");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-5">
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl mb-5">
        {([
          { id: "items" as const, label: "Reward items", icon: Gift },
          { id: "assign" as const, label: "Assign reward", icon: Send },
          { id: "winners" as const, label: "Competition winners", icon: Users },
        ]).map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${section === s.id ? "bg-[#7C3AED] text-white" : "text-[#94A3B8] hover:text-white"}`}
          >
            <s.icon size={12} /> {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" /></div>
      ) : section === "items" ? (
        <div className="space-y-3">
          <AdminHeader title="Reward items (Bible Trivia gifts)" count={gifts.length} color="#F59E0B" />
          <p className="text-[11px] text-[#64748B]">Manage rewards, stock, reward type and eligibility. Claims are fulfilled in the Redemptions tab.</p>
          {gifts.map((g) => (
            <div key={g.id} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${g.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-[#94A3B8]"}`}>
                  {g.isActive ? "Enabled" : "Disabled"}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300">{g.tier}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300">{g.deliveryType}</span>
                {g.eligibilityType !== "points" && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">
                    {g.eligibilityType === "competition_winner" ? "Winners only" : `Top ${g.eligibilityValue ?? 10}`}
                  </span>
                )}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${g.stock > 0 ? "bg-white/[0.06] text-[#94A3B8]" : "bg-red-500/15 text-red-300"}`}>
                  Stock {g.stock}
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-1.5">{g.title}</p>
              <p className="text-[11px] text-[#94A3B8]">{g.pointsRequired.toLocaleString("en-IN")} FP required · {g.description?.slice(0, 80)}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <button disabled={busyId === g.giftId} onClick={() => updateGift(g, { isActive: !g.isActive })} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8]">
                  {g.isActive ? "Disable" : "Enable"}
                </button>
                <button disabled={busyId === g.giftId} onClick={() => updateGift(g, { stock: g.stock + 1 })} className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8]">Stock +1</button>
                <button disabled={busyId === g.giftId} onClick={() => updateGift(g, { stock: Math.max(g.stock - 1, 0) })} className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-white/[0.04] text-[#94A3B8]">−1</button>
                <select
                  value={g.deliveryType}
                  disabled={busyId === g.giftId}
                  onChange={(e) => updateGift(g, { deliveryType: e.target.value })}
                  className="neo-input text-[11px] py-1.5"
                >
                  <option value="physical">Physical gift</option>
                  <option value="merchandise">Merchandise</option>
                  <option value="voucher">Voucher</option>
                </select>
                <select
                  value={g.eligibilityType}
                  disabled={busyId === g.giftId}
                  onChange={(e) => updateGift(g, { eligibilityType: e.target.value, eligibilityValue: e.target.value === "leaderboard_top" ? (g.eligibilityValue ?? 10) : null })}
                  className="neo-input text-[11px] py-1.5"
                >
                  <option value="points">Points eligibility</option>
                  <option value="competition_winner">Competition winners only</option>
                  <option value="leaderboard_top">Leaderboard top N</option>
                </select>
                {g.eligibilityType === "leaderboard_top" && (
                  <input
                    type="number"
                    defaultValue={g.eligibilityValue ?? 10}
                    min={1}
                    disabled={busyId === g.giftId}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isInteger(v) && v >= 1 && v !== g.eligibilityValue) updateGift(g, { eligibilityValue: v });
                    }}
                    className="neo-input text-[11px] py-1.5 w-20"
                    title="Top N players"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : section === "assign" ? (
        <div className="max-w-md space-y-3">
          <AdminHeader title="Manually assign a reward" color="#F59E0B" />
          <p className="text-[11px] text-[#64748B]">
            Assign any reward to a member without spending their points. Duplicate assignments are blocked automatically. Find the member&apos;s user ID in the Members tab.
          </p>
          <input value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="neo-input text-sm w-full" placeholder="Member user ID (from Members tab) *" />
          <select value={assignGiftId} onChange={(e) => setAssignGiftId(e.target.value)} className="neo-input text-sm w-full">
            <option value="">Choose reward *</option>
            {gifts.filter((g) => g.isActive).map((g) => (
              <option key={g.id} value={g.giftId}>{g.title} ({g.deliveryType}, stock {g.stock})</option>
            ))}
          </select>
          <textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} rows={2} className="neo-input text-sm w-full" placeholder="Reason / notes (optional)" />
          <button disabled={!!busyId} onClick={assign} className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#7C3AED] disabled:opacity-50">
            {busyId === "assign" ? "Assigning..." : "Assign reward"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AdminHeader title="Competition winners" count={winners.length} color="#F59E0B" />
          <p className="text-[11px] text-[#64748B]">Track fulfilment for competition winners. Winners are created automatically when a competition is finalized.</p>
          {winners.length === 0 ? (
            <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
              <p className="text-sm text-[#94A3B8]">No competition winners yet.</p>
            </div>
          ) : (
            winners.map((w) => (
              <div key={w.id} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {w.user?.username || w.user?.email || "Member"} · #{w.rank} · {w.score} pts
                    </p>
                    <p className="text-[11px] text-[#94A3B8] truncate">
                      {w.competition?.title || "Competition"}{w.prize ? ` · Prize: ${w.prize.name}` : ""}
                    </p>
                    {w.adminNotes && <p className="text-[10px] text-[#64748B] truncate">Notes: {w.adminNotes}</p>}
                  </div>
                  <select
                    value={w.status}
                    disabled={busyId === w.id}
                    onChange={(e) => setWinnerStatus(w, e.target.value)}
                    className="neo-input text-[11px] py-1.5"
                  >
                    {WINNER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
