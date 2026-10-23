"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  Loader2,
  Search,
  X,
  Save,
  Trash2,
  MailOpen,
  Reply,
  CheckCircle2,
  RotateCcw,
  Phone,
  Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Counts = {
  total: number;
  new: number;
  read: number;
  replied: number;
  closed: number;
};

type StatusMeta = { id: string; label: string; color: string };

// Chip + badge colors per the task spec.
// new=blue, read=gray, replied=green, closed=amber
const STATUS_META: StatusMeta[] = [
  { id: "new", label: "New", color: "#38BDF8" },
  { id: "read", label: "Read", color: "#94A3B8" },
  { id: "replied", label: "Replied", color: "#22C55E" },
  { id: "closed", label: "Closed", color: "#F59E0B" },
];

const ACTION_LABELS: Record<string, string> = {
  mark_read: "Mark Read",
  mark_replied: "Mark Replied",
  close: "Close",
  reopen: "Reopen",
};

// Status actions per current status — disables nonsensical transitions.
const STATUS_ACTIONS: Record<string, string[]> = {
  new: ["mark_read", "mark_replied", "close"],
  read: ["mark_replied", "close", "reopen"],
  replied: ["close", "reopen"],
  closed: ["reopen"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function statusMeta(status: string): StatusMeta {
  return STATUS_META.find((s) => s.id === status) || STATUS_META[0];
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ContactMessagesTab() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    new: 0,
    read: 0,
    replied: 0,
    closed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const url =
        filter === "all"
          ? "/api/admin/contact-messages"
          : `/api/admin/contact-messages?status=${filter}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { messages: ContactMessage[]; counts: Counts };
      setMessages(data.messages || []);
      setCounts(data.counts || { total: 0, new: 0, read: 0, replied: 0, closed: 0 });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load contact messages");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Client-side search across name/email/subject.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) =>
      [m.name, m.email, m.subject].some((s) => s.toLowerCase().includes(q))
    );
  }, [messages, search]);

  const openMessage = (msg: ContactMessage) => {
    setSelected(msg);
    setAdminNotesDraft(msg.adminNotes ?? "");
  };

  const closeMessage = () => {
    setSelected(null);
    setAdminNotesDraft("");
    setUpdatingAction(null);
    setDeleting(false);
  };

  const runAction = async (action: string) => {
    if (!selected) return;
    setUpdatingAction(action);
    try {
      const res = await fetch("/api/admin/contact-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { message: ContactMessage };
      toast.success(`${ACTION_LABELS[action]} ✓`);
      setSelected(data.message);
      // Refresh list (counts may have changed).
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    } finally {
      setUpdatingAction(null);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/contact-messages/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: adminNotesDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { message: ContactMessage };
      setSelected(data.message);
      // Keep local list in sync (adminNotes is admin-only — we don't expose
      // it elsewhere, but the row's updatedAt changes).
      setMessages((prev) =>
        prev.map((m) => (m.id === data.message.id ? data.message : m))
      );
      toast.success("Notes saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const removeMessage = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/contact-messages/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Message deleted");
      closeMessage();
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-[#7C3AED]" />
        <h2 className="text-sm font-bold text-white">Contact Messages</h2>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C3AED]/15 text-[#A78BFA]">
          {counts.total}
        </span>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={counts.total}
        />
        {STATUS_META.map((s) => (
          <FilterChip
            key={s.id}
            active={filter === s.id}
            onClick={() => setFilter(s.id)}
            label={s.label}
            count={(counts as any)[s.id] || 0}
          />
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or subject…"
          className="neo-input text-sm pl-9"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <Mail size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">
            {search ? "No messages match your search." : "No contact messages yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const meta = statusMeta(m.status);
            return (
              <button
                key={m.id}
                onClick={() => openMessage(m)}
                className="w-full text-left bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.15] transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{m.subject}</h3>
                    <p className="text-[11px] text-[#94A3B8] truncate">
                      {m.name} · {m.email}
                    </p>
                  </div>
                  <StatusBadge color={meta.color} label={meta.label} />
                </div>
                <p className="text-[11px] text-[#A09DB1] line-clamp-2 mb-1.5">
                  {m.message}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} /> {formatTimeAgo(m.createdAt)}
                  </span>
                  {m.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone size={9} /> {m.phone}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <DetailModal onClose={closeMessage}>
          <DetailHeader
            title={selected.subject}
            subtitle={`${selected.name} · ${selected.email}`}
            status={selected.status}
          />

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
            <Meta label="Phone" value={selected.phone || "—"} />
            <Meta label="Submitted" value={formatDateTime(selected.createdAt)} />
            <Meta label="Reviewed By" value={selected.reviewedBy || "—"} />
            <Meta label="Reviewed At" value={formatDateTime(selected.reviewedAt) || "—"} />
          </div>

          {/* Message body */}
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Message
            </p>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-[12px] text-[#A09DB1] whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto">
              {selected.message}
            </div>
          </div>

          {/* Admin notes — NEVER exposed outside the admin panel */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Admin Notes <span className="text-[#F59E0B] normal-case font-normal">(internal)</span>
              </p>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1 disabled:opacity-50"
              >
                {savingNotes ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                Save Notes
              </button>
            </div>
            <textarea
              value={adminNotesDraft}
              onChange={(e) => setAdminNotesDraft(e.target.value)}
              placeholder="Internal notes — not visible to the user…"
              className="neo-input text-sm h-20 resize-none"
            />
          </div>

          {/* Status actions */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(STATUS_ACTIONS[selected.status] || []).map((action) => (
              <button
                key={action}
                onClick={() => runAction(action)}
                disabled={updatingAction !== null}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1 disabled:opacity-50"
              >
                {updatingAction === action ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ActionIcon action={action} />
                )}
                {ACTION_LABELS[action]}
              </button>
            ))}
            {updatingAction && updatingAction !== "" && !STATUS_ACTIONS[selected.status]?.includes(updatingAction) && (
              <span className="text-[10px] text-[#94A3B8] self-center flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Updating…
              </span>
            )}
          </div>

          {/* Delete */}
          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={removeMessage}
              disabled={deleting}
              className="text-[#EF4444] hover:bg-[#EF4444]/10 text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete message (admin cleanup)
            </button>
          </div>
        </DetailModal>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all ${
        active ? "bg-[#7C3AED] text-white border-[#7C3AED]" : "text-[#94A3B8] hover:text-white"
      }`}
    >
      {label}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-md ${
          active ? "bg-white/20" : "bg-white/[0.06] text-[#94A3B8]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0"
      style={{ backgroundColor: `${color}25`, color }}
    >
      {label}
    </span>
  );
}

function DetailModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Close on Escape + click outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1929] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#94A3B8] hover:text-white"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailHeader({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle: string;
  status: string;
}) {
  const meta = statusMeta(status);
  return (
    <div className="mb-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h2 className="text-base font-extrabold text-white flex-1">{title}</h2>
        <StatusBadge color={meta.color} label={meta.label} />
      </div>
      <p className="text-[11px] text-[#94A3B8]">{subtitle}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">{label}</p>
      <p className="text-[11px] text-white truncate">{value}</p>
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case "mark_read":
      return <MailOpen size={12} />;
    case "mark_replied":
      return <Reply size={12} />;
    case "close":
      return <CheckCircle2 size={12} />;
    case "reopen":
      return <RotateCcw size={12} />;
    default:
      return null;
  }
}
