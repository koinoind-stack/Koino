"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  UserCheck,
  Loader2,
  Search,
  X,
  Save,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  PauseCircle,
  RotateCcw,
  Globe,
  MapPin,
  Church,
  Link2,
  BadgeCheck,
  Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

type Contributor = {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  verified: boolean;
  status: string;
  applicationId: string | null;
};

type ContributorApplication = {
  id: string;
  fullName: string;
  email: string;
  userId: string | null;
  profilePhoto: string | null;
  church: string | null;
  churchRole: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bio: string | null;
  expertise: any[];
  website: string | null;
  socialLinks: any[];
  whyContribute: string | null;
  contentInterests: any[];
  sampleUrl: string | null;
  status: string;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contributor: Contributor | null;
};

type Counts = {
  total: number;
  pending: number;
  under_review: number;
  approved: number;
  rejected: number;
  suspended: number;
};

type StatusMeta = { id: string; label: string; color: string };

// Status colors:
// pending=amber, under_review=blue, approved=green, rejected=red, suspended=gray
const STATUS_META: StatusMeta[] = [
  { id: "pending", label: "Pending", color: "#F59E0B" },
  { id: "under_review", label: "Under Review", color: "#38BDF8" },
  { id: "approved", label: "Approved", color: "#22C55E" },
  { id: "rejected", label: "Rejected", color: "#EF4444" },
  { id: "suspended", label: "Suspended", color: "#94A3B8" },
];

const ACTION_LABELS: Record<string, string> = {
  start_review: "Start Review",
  approve: "Approve",
  reject: "Reject",
  suspend: "Suspend",
  reopen: "Reopen",
};

// Status actions per current status — disables nonsensical transitions.
const STATUS_ACTIONS: Record<string, string[]> = {
  pending: ["start_review", "approve", "reject"],
  under_review: ["approve", "reject", "reopen"],
  approved: ["suspend"],
  rejected: ["reopen"],
  suspended: ["reopen"],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function joinLocation(app: ContributorApplication): string {
  return [app.city, app.state, app.country].filter(Boolean).join(", ") || "—";
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ContributorApplicationsTab() {
  const [applications, setApplications] = useState<ContributorApplication[]>([]);
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContributorApplication | null>(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [togglingVerified, setTogglingVerified] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const url =
        filter === "all"
          ? "/api/admin/contributor-applications"
          : `/api/admin/contributor-applications?status=${filter}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        applications: ContributorApplication[];
        counts: Counts;
      };
      setApplications(data.applications || []);
      setCounts(
        data.counts || {
          total: 0,
          pending: 0,
          under_review: 0,
          approved: 0,
          rejected: 0,
          suspended: 0,
        }
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to load contributor applications");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Client-side search across name/email/churchRole/church.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter((a) =>
      [a.fullName, a.email, a.churchRole || "", a.church || ""].some((s) =>
        s.toLowerCase().includes(q)
      )
    );
  }, [applications, search]);

  const openApp = (app: ContributorApplication) => {
    setSelected(app);
    setAdminNotesDraft(app.adminNotes ?? "");
  };

  const closeApp = () => {
    setSelected(null);
    setAdminNotesDraft("");
    setUpdatingAction(null);
    setTogglingVerified(false);
    setDeleting(false);
  };

  const runAction = async (action: string) => {
    if (!selected) return;
    setUpdatingAction(action);
    try {
      const res = await fetch("/api/admin/contributor-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        success: boolean;
        status: string;
        contributor: Contributor | null;
      };
      toast.success(`${ACTION_LABELS[action]} ✓`);
      // Patch the selected row locally so the modal reflects the new state
      // immediately, then refresh the full list for chip counts.
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              status: data.status,
              contributor: data.contributor || prev.contributor,
            }
          : prev
      );
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
      const res = await fetch(`/api/admin/contributor-applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: adminNotesDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { application: Partial<ContributorApplication> };
      setSelected((prev) =>
        prev
          ? { ...prev, adminNotes: data.application.adminNotes ?? prev.adminNotes }
          : prev
      );
      setApplications((prev) =>
        prev.map((a) =>
          a.id === selected.id
            ? { ...a, adminNotes: data.application.adminNotes ?? a.adminNotes }
            : a
        )
      );
      toast.success("Notes saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleVerified = async (next: boolean) => {
    if (!selected) return;
    setTogglingVerified(true);
    try {
      const res = await fetch(`/api/admin/contributor-applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        application: { contributor: { verified: boolean } | null };
      };
      const verified = data.application.contributor?.verified ?? false;
      setSelected((prev) =>
        prev && prev.contributor
          ? { ...prev, contributor: { ...prev.contributor, verified } }
          : prev
      );
      setApplications((prev) =>
        prev.map((a) =>
          a.id === selected.id && a.contributor
            ? { ...a, contributor: { ...a.contributor, verified } }
            : a
        )
      );
      toast.success(verified ? "Contributor verified ✓" : "Verification removed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to toggle verified");
    } finally {
      setTogglingVerified(false);
    }
  };

  const removeApp = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/contributor-applications/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Application deleted");
      closeApp();
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
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#A855F7] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-[#A855F7]" />
        <h2 className="text-sm font-bold text-white">Contributor Applications</h2>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#A855F7]/15 text-[#C4B5FD]">
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
          placeholder="Search by name, email, church role, or church…"
          className="neo-input text-sm pl-9"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <UserCheck size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">
            {search ? "No applications match your search." : "No contributor applications yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const meta = statusMeta(a.status);
            const location = joinLocation(a);
            return (
              <button
                key={a.id}
                onClick={() => openApp(a)}
                className="w-full text-left bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.15] transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white truncate">{a.fullName}</h3>
                      {a.contributor?.verified && (
                        <BadgeCheck size={12} className="text-[#22C55E] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#94A3B8] truncate">
                      {a.churchRole || "Contributor"} · {a.email}
                    </p>
                  </div>
                  <StatusBadge color={meta.color} label={meta.label} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {(a.contentInterests || []).slice(0, 3).map((c: any, i: number) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded-md bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#C4B5FD] text-[9px] font-bold"
                    >
                      {typeof c === "string" ? c : c?.label || c?.name || "—"}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} /> {formatTimeAgo(a.createdAt)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MapPin size={9} /> {location}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <DetailModal onClose={closeApp}>
          <DetailHeader
            title={selected.fullName}
            subtitle={`${selected.churchRole || "Contributor"} · ${selected.email}`}
            status={selected.status}
            profilePhoto={selected.profilePhoto}
            verified={selected.contributor?.verified}
          />

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
            <Meta label="Church" value={selected.church || "—"} icon={<Church size={10} />} />
            <Meta label="Church Role" value={selected.churchRole || "—"} />
            <Meta
              label="Location"
              value={joinLocation(selected)}
              icon={<MapPin size={10} />}
            />
            <Meta label="Submitted" value={formatDateTime(selected.createdAt)} icon={<Clock size={10} />} />
            {selected.website && (
              <Meta
                label="Website"
                value={selected.website}
                icon={<Globe size={10} />}
                href={selected.website}
              />
            )}
            {selected.sampleUrl && (
              <Meta
                label="Sample Work"
                value={selected.sampleUrl}
                icon={<Link2 size={10} />}
                href={selected.sampleUrl}
              />
            )}
            <Meta label="Reviewed By" value={selected.reviewedBy || "—"} />
            <Meta label="Reviewed At" value={formatDateTime(selected.reviewedAt) || "—"} />
          </div>

          {/* Expertise + content interests */}
          {(selected.expertise.length > 0 || selected.contentInterests.length > 0) && (
            <div className="mb-3 space-y-2">
              {selected.expertise.length > 0 && (
                <TagBlock label="Expertise" items={selected.expertise} color="#38BDF8" />
              )}
              {selected.contentInterests.length > 0 && (
                <TagBlock label="Content Interests" items={selected.contentInterests} color="#7C3AED" />
              )}
            </div>
          )}

          {/* Bio */}
          {selected.bio && (
            <DetailBlock label="Bio">
              <p className="text-[12px] text-[#A09DB1] leading-relaxed whitespace-pre-wrap">
                {selected.bio}
              </p>
            </DetailBlock>
          )}

          {/* Why contribute */}
          {selected.whyContribute && (
            <DetailBlock label="Why They Want to Contribute">
              <p className="text-[12px] text-[#A09DB1] leading-relaxed whitespace-pre-wrap">
                {selected.whyContribute}
              </p>
            </DetailBlock>
          )}

          {/* Social links */}
          {selected.socialLinks.length > 0 && (
            <DetailBlock label="Social Links">
              <div className="flex flex-wrap gap-1.5">
                {selected.socialLinks.map((s: any, i: number) => {
                  const label = s?.label || s?.platform || "Link";
                  const href = s?.url || (typeof s === "string" ? s : "#");
                  return (
                    <a
                      key={i}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-[#38BDF8] hover:underline"
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            </DetailBlock>
          )}

          {/* Linked contributor info */}
          {selected.contributor && (
            <div className="bg-[#22C55E]/8 border border-[#22C55E]/20 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E] mb-1">
                Linked Contributor
              </p>
              <p className="text-[11px] text-white">
                slug: <code className="font-mono text-[#C4B5FD]">{selected.contributor.slug}</code>
              </p>
            </div>
          )}

          {/* Verified toggle (only if approved + linked) */}
          {selected.status === "approved" && selected.contributor && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold text-white flex items-center gap-1.5">
                    <BadgeCheck size={14} className="text-[#22C55E]" />
                    Verified Contributor
                  </p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">
                    Adds the ✓ badge on their public contributor page.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selected.contributor.verified}
                  onClick={() => toggleVerified(!selected.contributor!.verified)}
                  disabled={togglingVerified}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                    selected.contributor.verified ? "bg-[#22C55E]" : "bg-white/[0.1]"
                  } ${togglingVerified ? "opacity-50" : ""}`}
                >
                  {togglingVerified ? (
                    <Loader2
                      size={12}
                      className="absolute top-1 left-1/2 -translate-x-1/2 text-white animate-spin"
                    />
                  ) : (
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        selected.contributor.verified ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
          )}

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
              placeholder="Internal notes — not visible to the applicant…"
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
                className={`text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1 disabled:opacity-50 ${
                  action === "reject"
                    ? "bg-[#EF4444] hover:bg-[#DC2626]"
                    : action === "suspend"
                    ? "bg-[#F59E0B] hover:bg-[#D97706] text-slate-950"
                    : "bg-[#7C3AED] hover:bg-[#6D28D9]"
                }`}
              >
                {updatingAction === action ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ActionIcon action={action} />
                )}
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>

          {/* Delete */}
          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={removeApp}
              disabled={deleting}
              className="text-[#EF4444] hover:bg-[#EF4444]/10 text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete application (admin cleanup — does NOT delete linked contributor)
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
  profilePhoto,
  verified,
}: {
  title: string;
  subtitle: string;
  status: string;
  profilePhoto: string | null;
  verified?: boolean;
}) {
  const meta = statusMeta(status);
  return (
    <div className="mb-3 flex items-start gap-3">
      {profilePhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profilePhoto}
          alt={title}
          className="w-12 h-12 rounded-full object-cover border border-white/[0.08] shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-center shrink-0">
          <UserCheck size={20} className="text-[#A78BFA]" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-base font-extrabold text-white flex items-center gap-1.5 truncate">
            {title}
            {verified && <BadgeCheck size={14} className="text-[#22C55E] shrink-0" />}
          </h2>
          <StatusBadge color={meta.color} label={meta.label} />
        </div>
        <p className="text-[11px] text-[#94A3B8] truncate">{subtitle}</p>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
        {icon}
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] text-[#38BDF8] hover:underline truncate block"
        >
          {value}
        </a>
      ) : (
        <p className="text-[11px] text-white truncate">{value}</p>
      )}
    </div>
  );
}

function TagBlock({ label, items, color }: { label: string; items: any[]; color: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => {
          const text = typeof item === "string" ? item : item?.label || item?.name || "—";
          return (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold"
              style={{ backgroundColor: `${color}1A`, color, border: `1px solid ${color}30` }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{label}</p>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 max-h-[220px] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case "start_review":
      return <Eye size={12} />;
    case "approve":
      return <CheckCircle2 size={12} />;
    case "reject":
      return <XCircle size={12} />;
    case "suspend":
      return <PauseCircle size={12} />;
    case "reopen":
      return <RotateCcw size={12} />;
    default:
      return null;
  }
}
