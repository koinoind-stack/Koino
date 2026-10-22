"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import {
  Shield,
  LayoutDashboard,
  Building2,
  Calendar,
  Store,
  HeartHandshake,
  HelpCircle,
  Trophy,
  Megaphone,
  BarChart3,
  Lock,
  X,
  Check,
  Trash2,
  Plus,
  TrendingUp,
  Users,
  Eye,
  Clock,
  Gift,
  LogIn,
  Tag,
  Palette,
  Package,
  Mail,
  Truck,
  CheckCircle,
  BookOpen,
  AlertCircle,
  BadgeCheck,
  Loader2,
  HandHeart,
  Handshake,
  UserCheck,
  FileText,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  CHURCHES,
  EVENTS,
  PRODUCTS,
  PRAYERS,
  APOLOGETICS_QUESTIONS,
  TRIVIA_COMPETITIONS,
  INDIAN_STATES,
  type Church,
  type EventItem,
  type Product,
  type PrayerPost,
  type TriviaGift,
} from "@/lib/crosscrafted-data";
import ImagePicker from "@/components/crosscrafted/ImagePicker";
import BibleComicsAdmin from "@/components/crosscrafted/BibleComicsAdmin";
import DonationSettingsTab from "@/components/crosscrafted/admin/DonationSettingsTab";
import ContactMessagesTab from "@/components/crosscrafted/admin/ContactMessagesTab";
import PartnerInquiriesTab from "@/components/crosscrafted/admin/PartnerInquiriesTab";
import ContributorApplicationsTab from "@/components/crosscrafted/admin/ContributorApplicationsTab";
import BlogTab from "@/components/crosscrafted/admin/BlogTab";
import ApologeticsTab from "@/components/crosscrafted/admin/ApologeticsTab";
import QuestionsTab from "@/components/crosscrafted/admin/QuestionsTab";

type AdminTab =
  | "dashboard"
  | "members"
  | "churches"
  | "events"
  | "marketplace"
  | "prayers"
  | "apologetics"
  | "competitions"
  | "announcements"
  | "redemptions"
  | "donations"
  | "contact-messages"
  | "partner-inquiries"
  | "contributors"
  | "blog"
  | "analytics"
  | "bible-comics";

const TABS: { id: AdminTab; icon: typeof Shield; labelKey: string }[] = [
  { id: "dashboard",    icon: LayoutDashboard, labelKey: "admin.tab.dashboard" },
  { id: "members",      icon: Users,             labelKey: "admin.tab.members" },
  { id: "churches",     icon: Building2,        labelKey: "admin.tab.churches" },
  { id: "events",       icon: Calendar,         labelKey: "admin.tab.events" },
  { id: "marketplace",  icon: Store,             labelKey: "admin.tab.marketplace" },
  { id: "prayers",      icon: HeartHandshake,   labelKey: "admin.tab.prayers" },
  { id: "apologetics",  icon: HelpCircle,       labelKey: "admin.tab.apologetics" },
  { id: "competitions", icon: Trophy,            labelKey: "admin.tab.competitions" },
  { id: "announcements",icon: Megaphone,         labelKey: "admin.tab.announcements" },
  { id: "redemptions",  icon: Package,           labelKey: "admin.tab.redemptions" },
  { id: "donations",    icon: HandHeart,         labelKey: "admin.tab.donations" },
  { id: "contact-messages", icon: Mail,          labelKey: "admin.tab.contactMessages" },
  { id: "partner-inquiries", icon: Handshake,    labelKey: "admin.tab.partnerInquiries" },
  { id: "contributors", icon: UserCheck,         labelKey: "admin.tab.contributors" },
  { id: "blog",         icon: FileText,          labelKey: "admin.tab.blog" },
  { id: "analytics",    icon: BarChart3,         labelKey: "admin.tab.analytics" },
  { id: "bible-comics", icon: BookOpen,          labelKey: "admin.tab.bibleComics" },
];

// ─── Apologetics admin wrapper ─────────────────────────────────────────────
// Sub-tab switcher between the Apologetics Article CMS (existing) and the
// Q&A moderation interface (new). The article CMS is unchanged — this wrapper
// just adds a toggle above it.
function ApologeticsAdminWrapper() {
  const [subTab, setSubTab] = useState<"articles" | "qa">("articles");
  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl w-fit">
        <button
          onClick={() => setSubTab("articles")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            subTab === "articles"
              ? "bg-[#7C3AED] text-white"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <FileText size={12} /> Articles
        </button>
        <button
          onClick={() => setSubTab("qa")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            subTab === "qa"
              ? "bg-[#7C3AED] text-white"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <HelpCircle size={12} /> Q&amp;A
        </button>
      </div>
      {subTab === "articles" && <ApologeticsTab />}
      {subTab === "qa" && <QuestionsTab />}
    </div>
  );
}

export default function AdminView() {
  const { user, isAuthenticated, isAdmin, loading } = useSupabaseUser();
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
      </div>
    );
  }

  // Not signed in — show login prompt
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-3xl p-8"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 mb-4">
              <Shield size={28} className="text-[#A78BFA]" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">{t('admin.access.title')}</h1>
            <p className="text-sm text-[#A09DB1] mt-1">Sign in with an admin account</p>
          </div>

          <a
            href="/auth/signin"
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}
          >
            <LogIn size={16} /> Sign In
          </a>

          <div className="mt-6 p-3 rounded-xl bg-[#38BDF8]/8 border border-[#38BDF8]/20">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] mb-1">Admin Access</p>
            <p className="text-[11px] text-[#A09DB1] leading-relaxed">
              Admin authorization is verified server-side via your authenticated session role.
              Only users with the <span className="font-bold text-white">admin</span> role in the database
              can access this panel.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Signed in but NOT admin
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#EF4444]/20 rounded-3xl p-8 text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 mb-4">
            <Lock size={28} className="text-[#EF4444]" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2">{t('admin.accessDenied.title')}</h1>
          <p className="text-sm text-[#A09DB1] mb-4">
            You're signed in as <span className="font-bold text-white">{user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email}</span>,
            but your account doesn't have admin privileges.
          </p>
          <p className="text-[11px] text-[#64748B]">
            Admin access is granted by setting <code className="text-[#A78BFA]">role = "admin"</code> in the
            database User table. Contact the site administrator if you believe this is an error.
          </p>
        </motion.div>
      </div>
    );
  }

  // Admin dashboard — user is authenticated AND has admin role
  return (
    <div className="max-w-[1100px] mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-center">
            <Shield size={16} className="text-[#A78BFA]" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">{t('admin.title')}</h1>
            <p className="text-[10px] text-[#94A3B8]">{t('admin.signedInAs', { name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email })}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl mb-5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/25"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <tab.icon size={12} />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} />}
          {activeTab === "members" && <MembersTab />}
          {activeTab === "churches" && <ChurchesTab />}
          {activeTab === "events" && <EventsTab />}
          {activeTab === "marketplace" && <MarketplaceTab />}
          {activeTab === "prayers" && <PrayersTab />}
          {activeTab === "apologetics" && <ApologeticsAdminWrapper />}
          {activeTab === "competitions" && <CompetitionsTab />}
          {activeTab === "announcements" && <AnnouncementsTab />}
          {activeTab === "redemptions" && <RedemptionsTab />}
          {activeTab === "donations" && <DonationSettingsTab />}
          {activeTab === "contact-messages" && <ContactMessagesTab />}
          {activeTab === "partner-inquiries" && <PartnerInquiriesTab />}
          {activeTab === "contributors" && <ContributorApplicationsTab />}
          {activeTab === "blog" && <BlogTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "bible-comics" && <BibleComicsAdmin />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────

function DashboardTab({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  // Overview cards — each navigates to its admin section.
  // HONEST NOTE: Churches/Events/Products/Prayers/Questions/Competitions are
  // currently backed by mock data (crosscrafted-data.ts arrays), NOT Prisma
  // models. The counts below reflect the mock dataset. Approve/reject actions
  // in those tabs update local React state only — they do NOT persist to a
  // database. See the "Preview Mode" banner on each tab for details.
  // The ONLY fully DB-backed admin section is Bible Comics (ComicChapter /
  // ComicPanel Prisma models + 14 admin API routes).
  const stats: { label: string; value: number; pending: number; icon: typeof Shield; color: string; tab: AdminTab }[] = [
    { label: "Churches", value: CHURCHES.length, pending: CHURCHES.filter((c) => c.status === "pending").length, icon: Building2, color: "#A855F7", tab: "churches" },
    { label: "Events", value: EVENTS.length, pending: 0, icon: Calendar, color: "#EC4899", tab: "events" },
    { label: "Products", value: PRODUCTS.length, pending: 0, icon: Store, color: "#9786E3", tab: "marketplace" },
    { label: "Prayers", value: PRAYERS.length, pending: 0, icon: HeartHandshake, color: "#F59E0B", tab: "prayers" },
    { label: "Questions", value: APOLOGETICS_QUESTIONS.length, pending: APOLOGETICS_QUESTIONS.filter((q) => q.status === "open").length, icon: HelpCircle, color: "#38BDF8", tab: "apologetics" },
    { label: "Competitions", value: TRIVIA_COMPETITIONS.length, pending: TRIVIA_COMPETITIONS.filter((c) => c.status === "upcoming").length, icon: Trophy, color: "#22C55E", tab: "competitions" },
  ];

  // Quick Actions — each wired to navigate to the correct admin section.
  // These are REAL navigation actions (not dead buttons).
  const quickActions: { label: string; color: string; tab: AdminTab; icon: typeof Shield }[] = [
    { label: "Review Churches", color: "#A855F7", tab: "churches", icon: Building2 },
    { label: "Moderate Prayers", color: "#F59E0B", tab: "prayers", icon: HeartHandshake },
    { label: "Answer Questions", color: "#38BDF8", tab: "apologetics", icon: HelpCircle },
    { label: "Host Competition", color: "#22C55E", tab: "competitions", icon: Trophy },
    { label: "Post Announcement", color: "#EC4899", tab: "announcements", icon: Megaphone },
    { label: "View Analytics", color: "#9786E3", tab: "analytics", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-white mb-3">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((s) => (
            <button
              key={s.label}
              onClick={() => onNavigate(s.tab)}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 text-left hover:border-white/[0.15] hover:bg-[#22202F] transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${s.color}15`, border: `1px solid ${s.color}30` }}
                >
                  <s.icon size={16} style={{ color: s.color }} />
                </div>
                {s.pending > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] text-[9px] font-bold uppercase tracking-wider">
                    {s.pending} pending
                  </span>
                )}
              </div>
              <p className="text-2xl font-extrabold text-white">{s.value}</p>
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-0.5">{s.label}</p>
              <p className="text-[9px] text-[#475569] mt-1 group-hover:text-[#64748B] transition-colors">
                Open {s.label} admin →
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-bold text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => onNavigate(a.tab)}
              className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all text-center group"
            >
              <div className="flex items-center justify-center mb-1">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${a.color}15`, border: `1px solid ${a.color}30` }}
                >
                  <a.icon size={13} style={{ color: a.color }} />
                </div>
              </div>
              <p className="text-xs font-bold text-white">{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Honest architecture status — tells the admin which sections are DB-backed vs. preview */}
      <div className="bg-[#1C1929] border border-[#F59E0B]/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={14} className="text-[#F59E0B]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">Architecture Status</p>
        </div>
        <div className="space-y-1.5 text-[11px] text-[#A09DB1] leading-relaxed">
          <p>
            <span className="text-[#22C55E] font-bold">● DB-backed:</span> Bible Comics (ComicChapter/ComicPanel Prisma models + 14 admin API routes), Trivia Questions (800+ in DB), Gifts & Redemptions.
          </p>
          <p>
            <span className="text-[#F59E0B] font-bold">● Preview mode:</span> Churches, Events, Marketplace, Prayers, Apologetics, Competitions, Announcements, Analytics — these sections use mock data arrays. Approve/reject/edit actions update local state only and do NOT persist to a database yet. A future task needs Prisma models + admin APIs for each.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone size={14} className="text-[#A78BFA]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">Admin Tip</p>
        </div>
        <p className="text-xs text-[#A09DB1] leading-relaxed">
          New church submissions need approval before they appear in the public directory.
          Check the Churches tab to review pending submissions. Same goes for marketplace products
          and prayer requests — keep the community safe and authentic.
        </p>
      </div>
    </div>
  );
}

// ─── MEMBERS ────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  "CAN_WRITE_ARTICLES", "CAN_WRITE_BLOG", "CAN_WRITE_APOLOGETICS",
  "CAN_ANSWER_QUESTIONS", "CAN_WRITE_BIBLE_STUDIES", "CAN_WRITE_DEVOTIONALS",
  "CAN_UPLOAD_IMAGES", "CAN_EDIT_OWN_DRAFTS", "CAN_SUBMIT_FOR_REVIEW",
  "CAN_PUBLISH_CONTENT",
];

const CONTRIBUTOR_TYPES = [
  "Pastor", "Elder", "Bible Teacher", "Apologist", "Evangelist",
  "Christian Author", "Theologian", "Ministry Leader", "Worship Leader",
  "Christian Counselor", "Other",
];

const MODERATION_REASONS = [
  "Fake profile", "Spam", "Harassment", "Fraud/scam",
  "Inappropriate content", "Multiple accounts", "Other",
];

function MembersTab() {
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterVerified, setFilterVerified] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberDetail, setMemberDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (search) params.set("search", search);
      if (filterState) params.set("state", filterState);
      if (filterStatus) params.set("profileCompleted", filterStatus);
      const res = await fetch(`/api/admin/members?${params}`);
      const data = await res.json();
      setMembers(data.members || []);
      setTotal(data.total || 0);
    } catch { setMembers([]); }
    finally { setLoading(false); }
  }, [search, filterState, filterStatus, page]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/members?stats=true");
      const data = await res.json();
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { loadMembers(); loadStats(); }, [loadMembers, loadStats]);

  const openMember = async (id: string) => {
    setSelectedMember(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${id}`);
      const data = await res.json();
      setMemberDetail(data.member);
    } catch {}
    finally { setDetailLoading(false); }
  };

  const updateMember = async (updates: any) => {
    if (!memberDetail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberDetail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemberDetail(data.member);
      toast.success("Member updated");
      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally { setSaving(false); }
  };

  const togglePermission = (perm: string) => {
    if (!memberDetail) return;
    const current: string[] = JSON.parse(memberDetail.permissions || "[]");
    const next = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
    updateMember({ permissions: next });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
            <p className="text-xl font-extrabold text-white">{stats.totalMembers}</p>
            <p className="text-[9px] text-[#94A3B8] uppercase">Total Members</p>
          </div>
          <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
            <p className="text-xl font-extrabold text-[#22C55E]">{stats.newToday}</p>
            <p className="text-[9px] text-[#94A3B8] uppercase">New Today</p>
          </div>
          <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
            <p className="text-xl font-extrabold text-[#38BDF8]">{stats.newThisWeek}</p>
            <p className="text-[9px] text-[#94A3B8] uppercase">This Week</p>
          </div>
          <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
            <p className="text-xl font-extrabold text-[#A855F7]">{stats.newThisMonth}</p>
            <p className="text-[9px] text-[#94A3B8] uppercase">This Month</p>
          </div>
        </div>
      )}

      {/* Recent signups */}
      {stats?.recentSignups?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B] mb-2">Recent Signups</p>
          <div className="space-y-1.5">
            {stats.recentSignups.slice(0, 5).map((m: any) => (
              <button key={m.id} onClick={() => openMember(m.id)} className="w-full flex items-center gap-3 p-2 rounded-xl bg-[#1C1929] border border-white/[0.06] hover:border-white/[0.15] transition-all text-left">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#F39B9B] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                  {m.image ? <img src={m.image} alt="" className="w-full h-full object-cover" /> : (m.username || m.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{m.username || m.name || m.email}</p>
                  <p className="text-[9px] text-[#94A3B8]">{m.city ? `${m.city}, ` : ""}{m.state || ""} · {m.signupMethod || "email"}</p>
                </div>
                <span className="text-[8px] text-[#64748B] shrink-0">{new Date(m.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2">
        <input type="text" placeholder="Search username, email, name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="neo-input text-xs flex-1 min-w-[150px]" />
        <select value={filterState} onChange={(e) => { setFilterState(e.target.value); setPage(0); }} className="neo-input text-xs w-32">
          <option value="">All States</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className="neo-input text-xs w-36">
          <option value="">All Profiles</option>
          <option value="true">Completed</option>
          <option value="false">Incomplete</option>
        </select>
      </div>

      {/* Members list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="text-[#F39B9B] animate-spin" /></div>
      ) : members.length === 0 ? (
        <EmptyState text="No members found." />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <button key={m.id} onClick={() => openMember(m.id)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1C1929] border border-white/[0.06] hover:border-white/[0.15] transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#F39B9B] flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
                {m.image ? <img src={m.image} alt="" className="w-full h-full object-cover" /> : (m.username || m.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-white truncate">{m.username || m.name || m.email}</p>
                  {m.verified && <BadgeCheck size={12} className="text-[#38BDF8] shrink-0" />}
                </div>
                <p className="text-[9px] text-[#94A3B8]">{m.email} · {m.city || "—"}, {m.state || "—"}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[8px] font-bold uppercase ${m.profileCompleted ? "text-[#22C55E]" : "text-[#F59E0B]"}`}>
                  {m.profileCompleted ? "Complete" : "Incomplete"}
                </span>
                <p className="text-[8px] text-[#64748B]">{m.signupMethod || "email"}</p>
              </div>
            </button>
          ))}
          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] text-xs font-bold disabled:opacity-30">Prev</button>
            <span className="text-[10px] text-[#64748B]">{page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] text-xs font-bold disabled:opacity-30">Next</button>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-4" onClick={(e) => e.target === e.currentTarget && setSelectedMember(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[#1C1929] z-10 flex justify-between items-center p-5 pb-3 border-b border-white/[0.04]">
                <h2 className="text-base font-bold text-white">Member Details</h2>
                <button onClick={() => setSelectedMember(null)} className="text-[#64748B] hover:text-white"><X size={18} /></button>
              </div>

              {detailLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="text-[#F39B9B] animate-spin" /></div>
              ) : memberDetail ? (
                <div className="p-5 space-y-4">
                  {/* Profile */}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#F39B9B] flex items-center justify-center text-white text-xl font-bold shrink-0 overflow-hidden">
                      {memberDetail.image ? <img src={memberDetail.image} alt="" className="w-full h-full object-cover" /> : (memberDetail.username || memberDetail.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-white">{memberDetail.username || memberDetail.name || "—"}</p>
                        {memberDetail.verified && <BadgeCheck size={14} className="text-[#38BDF8]" />}
                      </div>
                      <p className="text-[10px] text-[#94A3B8]">{memberDetail.email}</p>
                      <p className="text-[9px] text-[#64748B]">Joined {new Date(memberDetail.createdAt).toLocaleDateString()} · {memberDetail.signupMethod || "email"}</p>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><p className="text-[#64748B]">Mobile</p><p className="text-white">{memberDetail.mobileNumber || "Not provided"}</p></div>
                    <div><p className="text-[#64748B]">Gender</p><p className="text-white">{memberDetail.gender || "Not provided"}</p></div>
                    <div><p className="text-[#64748B]">State</p><p className="text-white">{memberDetail.state || "Not provided"}</p></div>
                    <div><p className="text-[#64748B]">City</p><p className="text-white">{memberDetail.city || "Not provided"}</p></div>
                    <div><p className="text-[#64748B]">Faith Status</p><p className="text-white">{memberDetail.faithStatus?.replace(/_/g, " ") || "Not provided"}</p></div>
                    <div><p className="text-[#64748B]">Faith Journey</p><p className="text-white">{memberDetail.faithJourney?.replace(/_/g, " ") || "Not provided"}</p></div>
                    <div><p className="text-[#64748B]">Account Status</p><p className="text-white capitalize">{memberDetail.accountStatus}</p></div>
                    <div><p className="text-[#64748B]">Profile</p><p className="text-white">{memberDetail.profileCompleted ? "Complete" : "Incomplete"}</p></div>
                  </div>

                  {/* Verification */}
                  <div className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BadgeCheck size={16} className={memberDetail.verified ? "text-[#38BDF8]" : "text-[#475569]"} />
                        <div>
                          <p className="text-xs font-bold text-white">Koino Verified</p>
                          <p className="text-[9px] text-[#64748B]">{memberDetail.verified ? `Verified ${memberDetail.verifiedAt ? new Date(memberDetail.verifiedAt).toLocaleDateString() : ""}` : "Not verified"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateMember({ verified: !memberDetail.verified })}
                        disabled={saving}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${memberDetail.verified ? "bg-[#EF4444]/15 text-[#EF4444]" : "bg-[#38BDF8]/15 text-[#38BDF8]"}`}
                      >
                        {memberDetail.verified ? "Unverify" : "Verify"}
                      </button>
                    </div>
                  </div>

                  {/* Contributor Type */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">Contributor Type</p>
                    <select
                      value={memberDetail.contributorType || ""}
                      onChange={(e) => updateMember({ contributorType: e.target.value || null })}
                      disabled={saving}
                      className="neo-input text-sm"
                    >
                      <option value="">None</option>
                      {CONTRIBUTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Permissions */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">Content Permissions</p>
                    <div className="space-y-1.5">
                      {ALL_PERMISSIONS.map((perm) => {
                        const current: string[] = JSON.parse(memberDetail.permissions || "[]");
                        const enabled = current.includes(perm);
                        return (
                          <label key={perm} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] cursor-pointer hover:bg-white/[0.04] transition-all">
                            <input type="checkbox" checked={enabled} onChange={() => togglePermission(perm)} className="accent-[#7C3AED]" />
                            <span className={`text-[11px] font-bold ${enabled ? "text-white" : "text-[#64748B]"}`}>{perm.replace(/_/g, " ").toLowerCase().replace(/\w/g, c => c.toUpperCase())}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Account Status */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">Account Status</p>
                    <div className="flex gap-2">
                      {["active", "blocked", "suspended", "deactivated"].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateMember({ accountStatus: s })}
                          disabled={saving}
                          className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${memberDetail.accountStatus === s ? "bg-[#7C3AED] text-white" : "bg-white/[0.04] text-[#94A3B8] hover:text-white hover:bg-white/[0.08]"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {memberDetail.moderationReason && <p className="text-[9px] text-[#EF4444] mt-1">Reason: {memberDetail.moderationReason}</p>}
                  </div>

                  <p className="text-[9px] text-[#475569] text-center">Mobile and DOB are private — visible only to authorized admins.</p>
                </div>
              ) : (
                <EmptyState text="Member not found." />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CHURCHES ─────────────────────────────────────────────────────────────
// REAL DATABASE-BACKED CHURCHES — no longer mock data.
// User-submitted churches arrive with status=PENDING. Admin can:
//   Approve (PENDING → PUBLISHED), Reject (PENDING → REJECTED),
//   Cancel (PUBLISHED → CANCELLED), Reopen (any → PENDING),
//   Feature/Unfeature, Delete (permanent).
// Public /api/churches only returns PUBLISHED churches.

type AdminChurch = Omit<Church, "status"> & {
  status: "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED";
};

function ChurchesTab() {
  const [churches, setChurches] = useState<AdminChurch[]>([]);
  const [counts, setCounts] = useState<{ all: number; PENDING: number; PUBLISHED: number; REJECTED: number; CANCELLED: number }>({ all: 0, PENDING: 0, PUBLISHED: 0, REJECTED: 0, CANCELLED: 0 });
  const [statusFilter, setStatusFilter] = useState<"all" | "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadChurches = async (status: "all" | "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED" = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const url = status === "all" ? "/api/admin/churches" : `/api/admin/churches?status=${status}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        const apiError = data?.error || `Failed to load churches (HTTP ${res.status})`;
        const prismaCode = data?.prismaCode || data?.code;
        const detail = data?.detail;
        const fullError = prismaCode
          ? `${apiError} (Prisma code: ${prismaCode}${detail ? ` — ${detail}` : ""})`
          : apiError;
        throw new Error(fullError);
      }
      setChurches(data.churches || []);
      if (data.counts) setCounts(data.counts);
    } catch (e: any) {
      setError(e.message || "Failed to load churches");
      setChurches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChurches("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/admin/churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} church`);
      toast.success(`Church ${action}d`, {
        description: action === "approve" ? "Now visible publicly" : action === "reject" ? "Removed from public directory" : undefined,
      });
      await loadChurches();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} church`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this church? This cannot be undone. For moderation, prefer Reject or Cancel.")) return;
    try {
      const res = await fetch(`/api/admin/churches/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete church");
      toast.success("Church deleted");
      await loadChurches();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete church");
    }
  };

  const confirmReject = async (id: string) => {
    await handleAction(id, "reject", { rejectionReason: rejectReason || null });
    setRejectingId(null);
    setRejectReason("");
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return churches;
    const q = searchQuery.toLowerCase();
    return churches.filter((c) =>
      `${c.name} ${c.description} ${c.city} ${c.state} ${c.denomination} ${c.createdByEmail || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [churches, searchQuery]);

  const statusChips: { id: typeof statusFilter; label: string; color: string; count: number }[] = [
    { id: "all", label: "All", color: "#94A3B8", count: counts.all },
    { id: "PENDING", label: "Pending", color: "#F59E0B", count: counts.PENDING },
    { id: "PUBLISHED", label: "Published", color: "#22C55E", count: counts.PUBLISHED },
    { id: "REJECTED", label: "Rejected", color: "#EF4444", count: counts.REJECTED },
    { id: "CANCELLED", label: "Cancelled", color: "#64748B", count: counts.CANCELLED },
  ];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "#F59E0B",
      PUBLISHED: "#22C55E",
      REJECTED: "#EF4444",
      CANCELLED: "#64748B",
    };
    return { color: colors[status] || "#94A3B8", label: status };
  };

  return (
    <div className="space-y-3">
      {/* Status filter chips */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-x-auto">
        {statusChips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => {
              setStatusFilter(chip.id);
              loadChurches(chip.id);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === chip.id
                ? "bg-[#7C3AED] text-white"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {chip.label}
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ backgroundColor: `${chip.color}25`, color: chip.color }}
            >
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by name, city, denomination, submitter email…"
        className="neo-input text-sm"
      />

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
          <p className="text-xs text-[#94A3B8] mt-2">Loading churches…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-xl p-4">
          <p className="text-sm font-bold text-[#EF4444] mb-1">Failed to load churches</p>
          <p className="text-xs text-[#A09DB1] mb-3 leading-relaxed break-words">{error}</p>
          {/migration|table|relation|P2021|P2022|P1003/i.test(error) && (
            <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-lg p-3 mt-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B] mb-1">
                Action required — apply Prisma migration
              </p>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed mb-2">
                The <code className="text-[#A78BFA]">Church</code> table does not exist in the production database yet.
                Run this SQL in the Supabase SQL Editor (the migration file is at <code className="text-[#A78BFA]">prisma/migrations/20261008000000_add_churches_table/</code>):
              </p>
              <pre className="text-[10px] text-[#22C55E] bg-black/40 rounded-lg p-2 overflow-x-auto">
{`-- Open Supabase Dashboard → SQL Editor → paste the contents of
-- prisma/migrations/20261008000000_add_churches_table/migration.sql
-- and click Run.`}
              </pre>
            </div>
          )}
          <button onClick={() => loadChurches()} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold">
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState text={statusFilter === "all" ? "No churches submitted yet." : `No ${statusFilter.toLowerCase()} churches.`} />
      )}

      {/* Churches list */}
      {!loading && !error && filtered.map((c) => {
        const badge = statusBadge(c.status);
        return (
          <AdminCard
            key={c.id}
            title={c.name}
            subtitle={`${c.city || "—"}, ${c.state || "—"}${c.denomination ? ` · ${c.denomination}` : ""}${c.createdByEmail ? ` · by ${c.createdByEmail}` : ""}`}
            description={c.description}
            image={c.cover_image}
            badge={badge.label}
            badgeColor={badge.color}
            actions={
              <div className="flex flex-wrap gap-1.5">
                {c.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => handleAction(c.id, "approve")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/25 text-[11px] font-bold transition-all"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectingId(c.id); setRejectReason(""); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25 text-[11px] font-bold transition-all"
                    >
                      <X size={12} /> Reject
                    </button>
                  </>
                )}
                {c.status === "PUBLISHED" && (
                  <>
                    {c.featured ? (
                      <button
                        onClick={() => handleAction(c.id, "unfeature")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/30 text-[#A855F7] hover:bg-[#A855F7]/25 text-[11px] font-bold transition-all"
                      >
                        <Star size={12} fill="currentColor" /> Unfeature
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(c.id, "feature")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-[#A855F7] text-[11px] font-bold transition-all"
                      >
                        <Star size={12} /> Feature
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(c.id, "cancel")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#64748B]/15 border border-[#64748B]/30 text-[#94A3B8] hover:bg-[#64748B]/25 text-[11px] font-bold transition-all"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {(c.status === "REJECTED" || c.status === "CANCELLED") && (
                  <button
                    onClick={() => handleAction(c.id, "reopen")}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/25 text-[11px] font-bold transition-all"
                  >
                    Reopen
                  </button>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25 text-[11px] font-bold transition-all"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            }
          />
        );
      })}

      {/* Reject modal */}
      <AnimatePresence>
        {rejectingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setRejectingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full"
            >
              <h3 className="text-base font-bold text-white mb-2">Reject Church</h3>
              <p className="text-xs text-[#A09DB1] mb-3">
                The church will be marked as REJECTED and will not appear publicly. The submitter will not be automatically notified.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional: rejection reason (internal note, not shown to submitter)"
                className="neo-input text-sm h-24 resize-none mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setRejectingId(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmReject(rejectingId)}
                  className="px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold"
                >
                  Reject Church
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EVENTS ──────────────────────────────────────────────────────────────
// REAL DATABASE-BACKED EVENTS — no longer mock data.
// User-submitted events arrive with status=PENDING. Admin can:
//   Approve (PENDING → PUBLISHED), Reject (PENDING → REJECTED),
//   Cancel (PUBLISHED → CANCELLED), Reopen (any → PENDING),
//   Feature/Unfeature, Delete (permanent).
// Public /api/events only returns PUBLISHED events.

type AdminEvent = Omit<EventItem, "status"> & {
  status: "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED";
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdById?: string | null;
  createdByEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function EventsTab() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [counts, setCounts] = useState<{ all: number; PENDING: number; PUBLISHED: number; REJECTED: number; CANCELLED: number }>({ all: 0, PENDING: 0, PUBLISHED: 0, REJECTED: 0, CANCELLED: 0 });
  const [statusFilter, setStatusFilter] = useState<"all" | "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadEvents = async (status: "all" | "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED" = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const url = status === "all" ? "/api/admin/events" : `/api/admin/events?status=${status}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        // Surface the actual API error message — includes Prisma error codes
        // (P2021/P2022/P1003 = table/relation does not exist) so the admin
        // can diagnose "migration not applied" vs other errors.
        const apiError = data?.error || `Failed to load events (HTTP ${res.status})`;
        const prismaCode = data?.prismaCode || data?.code;
        const detail = data?.detail;
        const fullError = prismaCode
          ? `${apiError} (Prisma code: ${prismaCode}${detail ? ` — ${detail}` : ""})`
          : apiError;
        throw new Error(fullError);
      }
      setEvents(data.events || []);
      if (data.counts) setCounts(data.counts);
    } catch (e: any) {
      setError(e.message || "Failed to load events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} event`);
      toast.success(`Event ${action}d`, {
        description: action === "approve" ? "Now visible publicly" : action === "reject" ? "Removed from public view" : undefined,
      });
      // Refresh the list — counts may have changed
      await loadEvents();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} event`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this event? This cannot be undone. For moderation, prefer Reject or Cancel.")) return;
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete event");
      toast.success("Event deleted");
      await loadEvents();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete event");
    }
  };

  const confirmReject = async (id: string) => {
    await handleAction(id, "reject", { rejectionReason: rejectReason || null });
    setRejectingId(null);
    setRejectReason("");
  };

  // Client-side search filter (in addition to server-side status filter)
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((e) =>
      `${e.title} ${e.description} ${e.city} ${e.state} ${e.church} ${e.category} ${e.organizerName || ""} ${e.createdByEmail || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [events, searchQuery]);

  const statusChips: { id: typeof statusFilter; label: string; color: string; count: number }[] = [
    { id: "all", label: "All", color: "#94A3B8", count: counts.all },
    { id: "PENDING", label: "Pending", color: "#F59E0B", count: counts.PENDING },
    { id: "PUBLISHED", label: "Published", color: "#22C55E", count: counts.PUBLISHED },
    { id: "REJECTED", label: "Rejected", color: "#EF4444", count: counts.REJECTED },
    { id: "CANCELLED", label: "Cancelled", color: "#64748B", count: counts.CANCELLED },
  ];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "#F59E0B",
      PUBLISHED: "#22C55E",
      REJECTED: "#EF4444",
      CANCELLED: "#64748B",
    };
    return { color: colors[status] || "#94A3B8", label: status };
  };

  return (
    <div className="space-y-3">
      {/* Status filter chips */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-x-auto">
        {statusChips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => {
              setStatusFilter(chip.id);
              loadEvents(chip.id);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === chip.id
                ? "bg-[#7C3AED] text-white"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            {chip.label}
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ backgroundColor: `${chip.color}25`, color: chip.color }}
            >
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by title, city, organizer, submitter email…"
        className="neo-input text-sm"
      />

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
          <p className="text-xs text-[#94A3B8] mt-2">Loading events…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-xl p-4">
          <p className="text-sm font-bold text-[#EF4444] mb-1">Failed to load events</p>
          <p className="text-xs text-[#A09DB1] mb-3 leading-relaxed break-words">{error}</p>
          {/* If this is a "table not found" / migration error, show actionable guidance */}
          {/migration|table|relation|P2021|P2022|P1003/i.test(error) && (
            <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-lg p-3 mt-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B] mb-1">
                Action required — apply Prisma migration
              </p>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed mb-2">
                The <code className="text-[#A78BFA]">Event</code> table does not exist in the production database yet.
                The migration file exists in the repo (<code className="text-[#A78BFA]">prisma/migrations/20261007120000_add_events_table/</code>)
                but has not been applied to Supabase. Run this command locally with your production <code className="text-[#A78BFA]">DATABASE_URL</code>:
              </p>
              <pre className="text-[10px] text-[#22C55E] bg-black/40 rounded-lg p-2 overflow-x-auto">
{`# Set production DATABASE_URL in .env first, then:
npx prisma migrate deploy

# OR (faster, applies schema directly):
npx prisma db push`}
              </pre>
              <p className="text-[10px] text-[#64748B] mt-2">
                After the migration succeeds, click "Try again" — the table will exist and the API will return an empty list.
              </p>
            </div>
          )}
          <button onClick={() => loadEvents()} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold">
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState text={statusFilter === "all" ? "No events submitted yet." : `No ${statusFilter.toLowerCase()} events.`} />
      )}

      {/* Events list */}
      {!loading && !error && filtered.map((e) => {
        const badge = statusBadge(e.status);
        return (
          <AdminCard
            key={e.id}
            title={e.title}
            subtitle={`${new Date(e.date).toLocaleDateString()}${e.startTime ? ` ${e.startTime}` : ""} · ${e.city || "Online"}${e.church ? ` · ${e.church}` : ""}${e.createdByEmail ? ` · by ${e.createdByEmail}` : ""}`}
            description={e.description}
            image={e.cover_image}
            badge={badge.label}
            badgeColor={badge.color}
            actions={
              <div className="flex flex-wrap gap-1.5">
                {/* PENDING actions */}
                {e.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => handleAction(e.id, "approve")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/25 text-[11px] font-bold transition-all"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectingId(e.id); setRejectReason(""); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25 text-[11px] font-bold transition-all"
                    >
                      <X size={12} /> Reject
                    </button>
                  </>
                )}
                {/* PUBLISHED actions */}
                {e.status === "PUBLISHED" && (
                  <>
                    {e.featured ? (
                      <button
                        onClick={() => handleAction(e.id, "unfeature")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/30 text-[#A855F7] hover:bg-[#A855F7]/25 text-[11px] font-bold transition-all"
                      >
                        <Star size={12} fill="currentColor" /> Unfeature
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(e.id, "feature")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-[#A855F7] text-[11px] font-bold transition-all"
                      >
                        <Star size={12} /> Feature
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(e.id, "cancel")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#64748B]/15 border border-[#64748B]/30 text-[#94A3B8] hover:bg-[#64748B]/25 text-[11px] font-bold transition-all"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {/* REJECTED / CANCELLED actions */}
                {(e.status === "REJECTED" || e.status === "CANCELLED") && (
                  <button
                    onClick={() => handleAction(e.id, "reopen")}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/25 text-[11px] font-bold transition-all"
                  >
                    Reopen
                  </button>
                )}
                {/* Delete — always available (permanent) */}
                <button
                  onClick={() => handleDelete(e.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25 text-[11px] font-bold transition-all"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            }
          />
        );
      })}

      {/* Reject modal — collects optional rejection reason */}
      <AnimatePresence>
        {rejectingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setRejectingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full"
            >
              <h3 className="text-base font-bold text-white mb-2">Reject Event</h3>
              <p className="text-xs text-[#A09DB1] mb-3">
                The event will be marked as REJECTED and will not appear publicly. The submitter will not be automatically notified.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional: rejection reason (internal note, not shown to user)"
                className="neo-input text-sm h-24 resize-none mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setRejectingId(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmReject(rejectingId)}
                  className="px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold"
                >
                  Reject Event
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MARKETPLACE ─────────────────────────────────────────────────────────

function MarketplaceTab() {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);

  const remove = (id: string) => {
    setProducts((ps) => ps.filter((p) => p.id !== id));
    toast("Product removed");
  };

  const toggleStock = (id: string) => {
    setProducts((ps) =>
      ps.map((p) => (p.id === id ? { ...p, in_stock: !p.in_stock } : p))
    );
    toast("Stock updated");
  };

  return (
    <div className="space-y-3">
      <PreviewModeBanner section="Marketplace" />
      <AdminSectionHeader title="All Products" count={products.length} color="#9786E3" />
      {products.map((p) => (
        <AdminCard
          key={p.id}
          title={p.name}
          subtitle={`₹${p.price} · ${p.vendor} · ${p.city}`}
          description={p.description}
          image={p.cover_image}
          badge={p.in_stock ? "In Stock" : "Out"}
          badgeColor={p.in_stock ? "#22C55E" : "#EF4444"}
          actions={
            <>
              <button
                onClick={() => toggleStock(p.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
              >
                {p.in_stock ? "Mark Out" : "Mark In"}
              </button>
              <button
                onClick={() => remove(p.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs font-bold hover:bg-[#EF4444]/25 transition-all"
              >
                <Trash2 size={12} /> Remove
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

// ─── PRAYERS ─────────────────────────────────────────────────────────────

function PrayersTab() {
  const [prayers, setPrayers] = useState<PrayerPost[]>(PRAYERS);

  const remove = (id: string) => {
    setPrayers((ps) => ps.filter((p) => p.id !== id));
    toast("Prayer removed", { description: "Inappropriate content moderated." });
  };

  return (
    <div className="space-y-3">
      <PreviewModeBanner section="Prayers" />
      <AdminSectionHeader title="Prayer Requests" count={prayers.length} color="#F59E0B" />
      <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-3 mb-3">
        <p className="text-[11px] text-[#A09DB1] leading-relaxed">
          Review prayer requests for spam, abuse, or inappropriate content. Remove anything that
          violates community guidelines. Legitimate prayers stay up to encourage the community.
        </p>
      </div>
      {prayers.map((p) => (
        <AdminCard
          key={p.id}
          title={p.title}
          subtitle={`${p.author} · ${p.category} · ${p.pray_count} praying`}
          description={p.content}
          actions={
            <button
              onClick={() => remove(p.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs font-bold hover:bg-[#EF4444]/25 transition-all"
            >
              <Trash2 size={12} /> Remove
            </button>
          }
        />
      ))}
    </div>
  );
}

// ─── COMPETITIONS ────────────────────────────────────────────────────────

function CompetitionsTab() {
  const [competitions, setCompetitions] = useState(TRIVIA_COMPETITIONS);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    prize: "",
    duration: "7",
    organizer: "Koino",
  });

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.prize.trim()) {
      toast.error("Please fill in title and prize");
      return;
    }
    toast.success("Competition created!", {
      description: "It's now visible in the Trivia > Compete tab.",
    });
    setForm({ title: "", description: "", prize: "", duration: "7", organizer: "Koino" });
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <PreviewModeBanner section="Competitions" />
      <div className="flex items-center justify-between">
        <AdminSectionHeader title="Trivia Competitions" count={competitions.length} color="#22C55E" />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition-all"
        >
          <Plus size={12} /> Host New
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={create}
            className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 space-y-3 overflow-hidden"
          >
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Competition Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="neo-input text-sm"
                placeholder="e.g. Christmas Bible Quiz 2025"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="neo-input text-sm h-20 resize-none"
                placeholder="What's the competition about? Rules, who can join, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Prize *
                </label>
                <input
                  type="text"
                  value={form.prize}
                  onChange={(e) => setForm({ ...form, prize: e.target.value })}
                  className="neo-input text-sm"
                  placeholder="₹10,000 + Trophy"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Duration (days)
                </label>
                <input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="neo-input text-sm"
                  min="1"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #22C55E, #3B82F6)" }}
              >
                Create Competition
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Existing competitions */}
      <div className="space-y-2">
        {competitions.map((c) => (
          <div key={c.id} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  c.status === "live"
                    ? "bg-[#EF4444]/15 text-[#EF4444]"
                    : c.status === "upcoming"
                    ? "bg-[#38BDF8]/15 text-[#38BDF8]"
                    : "bg-white/[0.06] text-[#94A3B8]"
                }`}
              >
                {c.status}
              </span>
              <span className="text-[10px] text-[#94A3B8]">{c.participants.length} churches</span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">{c.title}</h3>
            <p className="text-[11px] text-[#A09DB1] line-clamp-2 mb-2">{c.description}</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-[#F59E0B] font-bold">
                <Gift size={10} /> {c.prize}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Gifts management */}
      <GiftsManagement />
    </div>
  );
}

// ─── GIFTS MANAGEMENT ────────────────────────────────────────────────────

function GiftsManagement() {
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    images: string[];
    points_required: string;
    tier: "bronze" | "silver" | "gold" | "platinum";
    stock: string;
    variations: { name: string; options: string[] }[];
    attributes: { label: string; value: string }[];
  }>({
    title: "",
    description: "",
    images: [],
    points_required: "",
    tier: "bronze",
    stock: "10",
    variations: [],
    attributes: [],
  });

  const fetchGifts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gifts");
      const data = await res.json();
      const mapped = (data.gifts || []).map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        image_url: g.imageUrl,
        points_required: g.pointsRequired,
        tier: g.tier,
        stock: g.stock,
        isAdmin: g.isAdmin,
        variations: Array.isArray(g.variations) ? g.variations : [],
        attributes: Array.isArray(g.attributes) ? g.attributes : [],
      }));
      setGifts(mapped);
    } catch {
      toast.error("Failed to load gifts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      images: [],
      points_required: "",
      tier: "bronze",
      stock: "10",
      variations: [],
      attributes: [],
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.points_required || form.images.length === 0) {
      toast.error("Please fill in title, points, and add at least 1 image");
      return;
    }
    if (form.variations.some((v) => v.name.trim() && v.options.length === 0)) {
      toast.error("Add at least 1 option for each variation name");
      return;
    }

    const giftData = {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.images[0],
      pointsRequired: Number(form.points_required),
      tier: form.tier,
      stock: Number(form.stock) || 0,
      variations: form.variations.filter((v) => v.name.trim() && v.options.length > 0),
      attributes: form.attributes.filter((a) => a.label.trim() && a.value.trim()),
    };

    try {
      if (editingId) {
        const res = await fetch("/api/admin/gifts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ giftId: editingId, ...giftData }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Gift updated!", { description: "Changes are live in Trivia > Rewards." });
      } else {
        const res = await fetch("/api/admin/gifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(giftData),
        });
        if (!res.ok) throw new Error("Failed to add");
        toast.success("Gift added!", {
          description: "It's now visible in Trivia > Rewards for players to redeem.",
        });
      }
      fetchGifts();
      resetForm();
    } catch {
      toast.error("Failed to save gift");
    }
  };

  const handleEdit = (gift: any) => {
    if (!gift.isAdmin) {
      toast("Default gifts can't be edited", {
        description: "Only gifts you've added from the admin panel can be modified.",
      });
      return;
    }
    setEditingId(gift.id);
    setForm({
      title: gift.title,
      description: gift.description,
      images: [gift.image_url],
      points_required: String(gift.points_required),
      tier: gift.tier,
      stock: String(gift.stock),
      variations: Array.isArray(gift.variations) && gift.variations.length > 0
        ? gift.variations.map((v: any) => ({
            name: v.name || "",
            options: Array.isArray(v.options) ? v.options : [],
          }))
        : [],
      attributes: Array.isArray(gift.attributes) && gift.attributes.length > 0
        ? gift.attributes.map((a: any) => ({
            label: a.label || "",
            value: a.value || "",
          }))
        : [],
    });
    setShowAddForm(true);
    setTimeout(() => {
      document.getElementById("gift-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleRemove = async (id: string) => {
    const gift = gifts.find((g) => g.id === id);
    if (!gift?.isAdmin) {
      toast("Default gifts can't be removed", {
        description: "Only gifts you've added from the admin panel can be deleted.",
      });
      return;
    }
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast("Gift removed", { description: "Players can no longer redeem this gift." });
      fetchGifts();
    } catch {
      toast.error("Failed to remove gift");
    }
  };

  const handleStockChange = async (id: string, delta: number) => {
    const gift = gifts.find((g) => g.id === id);
    if (!gift?.isAdmin) return;
    const newStock = Math.max(0, gift.stock + delta);
    try {
      await fetch("/api/admin/gifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: id, stock: newStock }),
      });
      fetchGifts();
    } catch {
      toast.error("Failed to update stock");
    }
  };

  const tierColors: Record<string, string> = {
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    platinum: "#E5E4E2",
  };

  const adminCount = gifts.filter((g) => g.isAdmin).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F59E0B] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <AdminSectionHeader title="Reward Gifts" count={gifts.length} color="#F59E0B" />
        <button
          onClick={() => {
            if (showAddForm) {
              resetForm();
            } else {
              setShowAddForm(true);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#E59E0B] text-slate-950 text-xs font-bold transition-all"
        >
          {showAddForm ? <X size={12} /> : <Plus size={12} />}
          {showAddForm ? "Cancel" : "Add Gift"}
        </button>
      </div>

      {adminCount > 0 && (
        <p className="text-[10px] text-[#64748B] px-1">
          {adminCount} admin-added · {gifts.length - adminCount} default gifts
        </p>
      )}

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            id="gift-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-[#1C1929] border border-[#F59E0B]/20 rounded-2xl p-4 space-y-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Gift size={14} className="text-[#F59E0B]" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B]">
                {editingId ? "Edit Gift" : "Add New Reward Gift"}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Gift Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="neo-input text-sm"
                placeholder="e.g. Koino Hoodie"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="neo-input text-sm h-16 resize-none"
                placeholder="What's the gift? Sizes, colors, what's included..."
              />
            </div>

            <ImagePicker
              images={form.images}
              onChange={(images) => setForm({ ...form, images })}
              max={3}
              label="Gift Photos *"
            />

            {/* Variations (sizes, colors, etc.) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Tag size={11} /> Variations
                  <span className="text-[9px] text-[#475569] normal-case tracking-normal">(sizes, colors...)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      variations: [...form.variations, { name: "", options: [] }],
                    })
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-bold hover:bg-[#F59E0B]/25 transition-all"
                >
                  <Plus size={10} /> Add
                </button>
              </div>

              {form.variations.length === 0 && (
                <p className="text-[10px] text-[#475569] px-1 py-1.5 italic">
                  No variations. Add a "Size" or "Color" so users can pick when claiming.
                </p>
              )}

              {form.variations.map((v, vIdx) => (
                <div
                  key={vIdx}
                  className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        const next = [...form.variations];
                        next[vIdx] = { ...next[vIdx], name: e.target.value };
                        setForm({ ...form, variations: next });
                      }}
                      className="neo-input text-xs flex-1"
                      placeholder="Variation name (e.g. Size, Color)"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          variations: form.variations.filter((_, i) => i !== vIdx),
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/25"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {v.options.map((opt, oIdx) => (
                      <span
                        key={oIdx}
                        className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[10px] font-semibold text-[#F59E0B]"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...form.variations];
                            next[vIdx].options = next[vIdx].options.filter((_, i) => i !== oIdx);
                            setForm({ ...form, variations: next });
                          }}
                          className="w-4 h-4 rounded-full bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 flex items-center justify-center"
                        >
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder="Add option + Enter"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const target = e.target as HTMLInputElement;
                          const val = target.value.trim();
                          if (!val) return;
                          const next = [...form.variations];
                          next[vIdx] = {
                            ...next[vIdx],
                            options: [...next[vIdx].options, val],
                          };
                          setForm({ ...form, variations: next });
                          target.value = "";
                        }
                      }}
                      className="bg-transparent border border-dashed border-white/[0.12] rounded-md px-2 py-1 text-[10px] text-white outline-none focus:border-[#F59E0B]/50 flex-1 min-w-[100px]"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Attributes (material, fit, weight, etc.) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Palette size={11} /> Attributes
                  <span className="text-[9px] text-[#475569] normal-case tracking-normal">(material, weight...)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      attributes: [...form.attributes, { label: "", value: "" }],
                    })
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#9786E3]/15 text-[#9786E3] text-[10px] font-bold hover:bg-[#9786E3]/25 transition-all"
                >
                  <Plus size={10} /> Add
                </button>
              </div>

              {form.attributes.length === 0 && (
                <p className="text-[10px] text-[#475569] px-1 py-1.5 italic">
                  No attributes. Add specs like "Material: 100% Cotton".
                </p>
              )}

              {form.attributes.map((a, aIdx) => (
                <div key={aIdx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={a.label}
                    onChange={(e) => {
                      const next = [...form.attributes];
                      next[aIdx] = { ...next[aIdx], label: e.target.value };
                      setForm({ ...form, attributes: next });
                    }}
                    className="neo-input text-xs w-[40%]"
                    placeholder="Label (e.g. Material)"
                  />
                  <input
                    type="text"
                    value={a.value}
                    onChange={(e) => {
                      const next = [...form.attributes];
                      next[aIdx] = { ...next[aIdx], value: e.target.value };
                      setForm({ ...form, attributes: next });
                    }}
                    className="neo-input text-xs flex-1"
                    placeholder="Value (e.g. 100% Cotton)"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        attributes: form.attributes.filter((_, i) => i !== aIdx),
                      })
                    }
                    className="w-7 h-7 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/25 shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Points Required *
                </label>
                <input
                  type="number"
                  value={form.points_required}
                  onChange={(e) => setForm({ ...form, points_required: e.target.value })}
                  className="neo-input text-sm"
                  placeholder="500"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Tier
                </label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as any })}
                  className="neo-input text-sm"
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Stock
                </label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="neo-input text-sm"
                  placeholder="10"
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span
                className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${tierColors[form.tier]}25`, color: tierColors[form.tier] }}
              >
                {form.tier}
              </span>
              <span className="text-[10px] text-[#94A3B8]">
                {form.points_required || "0"} pts to unlock · {form.stock || "0"} in stock
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#F59E0B] hover:bg-[#E59E0B] transition-all"
              >
                {editingId ? "Update Gift" : "Add Gift"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {gifts.map((g) => {
          const admin = g.isAdmin;
          return (
            <div
              key={g.id}
              className={`bg-[#1C1929] border rounded-xl p-3 ${
                admin ? "border-[#F59E0B]/30" : "border-white/[0.06]"
              }`}
            >
              <div className="relative w-full h-24 rounded-lg overflow-hidden mb-2">
                <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" />
                <span
                  className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${tierColors[g.tier]}E6`, color: "#0A0A0A" }}
                >
                  {g.tier}
                </span>
                {admin && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-[#F59E0B] text-slate-950 text-[8px] font-bold uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-white line-clamp-1">{g.title}</p>
              <p className="text-[9px] text-[#A09DB1] line-clamp-2 mt-0.5 mb-1">{g.description}</p>

              {((g.variations?.length || 0) > 0 || (g.attributes?.length || 0) > 0) && (
                <div className="flex flex-wrap gap-0.5 mb-1.5">
                  {g.variations?.map((v: any, vIdx: number) => (
                    <span
                      key={`v-${vIdx}`}
                      className="px-1 py-0.5 rounded-md bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] font-bold uppercase tracking-wide"
                      title={`${v.name}: ${v.options?.length || 0} options`}
                    >
                      {v.name}: {(v.options || []).length}
                    </span>
                  ))}
                  {g.attributes?.map((a: any, aIdx: number) => (
                    <span
                      key={`a-${aIdx}`}
                      className="px-1 py-0.5 rounded-md bg-[#9786E3]/10 text-[#9786E3] text-[8px] font-bold uppercase tracking-wide"
                      title={`${a.label}: ${a.value}`}
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#F59E0B]">{g.points_required.toLocaleString()} pts</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStockChange(g.id, -1)}
                    disabled={!admin}
                    className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      admin ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                    }`}
                  >
                    −
                  </button>
                  <span className="text-[10px] font-bold text-white tabular-nums w-6 text-center">{g.stock}</span>
                  <button
                    onClick={() => handleStockChange(g.id, 1)}
                    disabled={!admin}
                    className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      admin ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                    }`}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(g)}
                  disabled={!admin}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    admin
                      ? "bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white"
                      : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleRemove(g.id)}
                  disabled={!admin}
                  className={`flex items-center justify-center px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    admin
                      ? "bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25"
                      : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                  }`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-3">
        <p className="text-[10px] text-[#A09DB1] leading-relaxed">
          <span className="font-bold text-[#F59E0B]">Tip:</span> Gifts you add appear instantly in the
          Trivia → Rewards tab for players to redeem. Default gifts (without the "Admin" badge) are
          seeded examples and can't be edited or removed — only gifts you add here can be modified.
          When a player redeems a gift, contact them on WhatsApp to arrange delivery.
        </p>
      </div>
    </div>
  );
}

// ─── ANNOUNCEMENTS ───────────────────────────────────────────────────────

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<{ id: string; text: string; type: string; date: string }[]>([
    { id: "a1", text: "Welcome to Koino! Explore churches, play trivia, and grow in faith.", type: "info", date: "2025-01-20" },
  ]);
  const [text, setText] = useState("");
  const [type, setType] = useState("info");

  const post = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Please enter announcement text");
      return;
    }
    setAnnouncements((prev) => [
      { id: `a${Date.now()}`, text: text.trim(), type, date: new Date().toISOString().split("T")[0] },
      ...prev,
    ]);
    setText("");
    toast.success("Announcement posted!", { description: "It will show as a banner across the app." });
  };

  const remove = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    toast("Announcement removed");
  };

  const typeColors: Record<string, string> = {
    info: "#38BDF8",
    success: "#22C55E",
    warning: "#F59E0B",
    urgent: "#EF4444",
  };

  return (
    <div className="space-y-4">
      <PreviewModeBanner section="Announcements" />
      <AdminSectionHeader title="Site Announcements" count={announcements.length} color="#EC4899" />
      <form onSubmit={post} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            <Megaphone size={10} className="inline mr-0.5" /> Announcement Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="neo-input text-sm h-20 resize-none"
            placeholder="e.g. New Bible Reading Challenge starts Dec 1! Join the 30-day plan."
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Type
          </label>
          <div className="flex gap-2">
            {["info", "success", "warning", "urgent"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                  type === t ? "text-white" : "bg-white/[0.04] text-[#94A3B8] border-white/[0.06]"
                }`}
                style={type === t ? { backgroundColor: `${typeColors[t]}25`, borderColor: `${typeColors[t]}80` } : {}}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #EC4899, #F59E0B)" }}
        >
          Post Announcement
        </button>
      </form>

      <div className="space-y-2">
        {announcements.map((a) => (
          <div key={a.id} className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-3 flex items-start gap-3">
            <div
              className="w-2 h-12 rounded-full shrink-0"
              style={{ background: typeColors[a.type] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white">{a.text}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: typeColors[a.type] }}>
                  {a.type}
                </span>
                <span className="text-[9px] text-[#64748B]">· {a.date}</span>
              </div>
            </div>
            <button
              onClick={() => remove(a.id)}
              className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const stats = [
    { label: "Total Churches", value: CHURCHES.length, change: "+2 this week", icon: Building2, color: "#A855F7" },
    { label: "Total Events", value: EVENTS.length, change: "+1 this week", icon: Calendar, color: "#EC4899" },
    { label: "Total Products", value: PRODUCTS.length, change: "+3 this week", icon: Store, color: "#9786E3" },
    { label: "Prayer Requests", value: PRAYERS.length, change: "+5 this week", icon: HeartHandshake, color: "#F59E0B" },
    { label: "Apologetics Qs", value: APOLOGETICS_QUESTIONS.length, change: "+2 open", icon: HelpCircle, color: "#38BDF8" },
    { label: "Active Competitions", value: TRIVIA_COMPETITIONS.filter((c) => c.status === "live").length, change: "1 live now", icon: Trophy, color: "#22C55E" },
  ];

  // Mock engagement chart data
  const engagement = [12, 19, 15, 25, 30, 28, 35, 42, 38, 45, 50, 48];
  const maxEng = Math.max(...engagement);

  return (
    <div className="space-y-4">
      <PreviewModeBanner section="Analytics" />
      <div>
        <h2 className="text-base font-bold text-white mb-3">Platform Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <s.icon size={16} style={{ color: s.color }} />
                <span className="text-[9px] font-bold text-[#22C55E]">{s.change}</span>
              </div>
              <p className="text-2xl font-extrabold text-white">{s.value}</p>
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement chart */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-[#A78BFA]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">Weekly Engagement</p>
        </div>
        <div className="flex items-end justify-between h-32 gap-1">
          {engagement.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(v / maxEng) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="w-full rounded-t-md bg-gradient-to-t from-[#7C3AED] to-[#EC4899] min-h-[4px]"
                style={{ height: `${(v / maxEng) * 100}%` }}
              />
              <span className="text-[8px] text-[#64748B]">W{i + 1}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#94A3B8] mt-2 text-center">Daily active users over 12 weeks</p>
      </div>

      {/* Top churches by followers */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-[#A78BFA]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">Top Churches by Followers</p>
        </div>
        <div className="space-y-2">
          {[...CHURCHES].sort((a, b) => b.followers_count - a.followers_count).slice(0, 5).map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#64748B] w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{c.name}</p>
                <p className="text-[9px] text-[#94A3B8]">{c.city}, {c.state}</p>
              </div>
              <span className="text-xs font-bold text-[#A78BFA]">{c.followers_count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top trivia players */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={14} className="text-[#F59E0B]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">Top Trivia Players</p>
        </div>
        <div className="space-y-2">
          {[
            { name: "Rebecca Thomas", points: 8420 },
            { name: "Philip Cherian", points: 6150 },
            { name: "Grace Sharma", points: 4320 },
          ].map((p, i) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#64748B] w-4">{i + 1}</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-white">{p.name}</p>
              </div>
              <span className="text-xs font-bold text-[#F59E0B]">{p.points.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── REDEMPTIONS (claimed gifts fulfilment dashboard) ──────────────────────

const REDEMPTION_STATUSES = [
  { id: "pending",   label: "Pending",   color: "#F59E0B", icon: Clock },
  { id: "contacted", label: "Contacted",  color: "#38BDF8", icon: Mail },
  { id: "shipped",   label: "Shipped",    color: "#9786E3", icon: Truck },
  { id: "delivered", label: "Delivered",  color: "#22C55E", icon: CheckCircle },
] as const;

function RedemptionsTab() {
  const t = useTranslation();
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, contacted: 0, shipped: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const url = filter === "all" ? "/api/admin/redemptions" : `/api/admin/redemptions?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setRedemptions(data.redemptions || []);
      setCounts(data.counts || { total: 0, pending: 0, contacted: 0, shipped: 0, delivered: 0 });
    } catch {
      toast.error("Failed to load redemptions");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const updateStatus = async (redemptionId: string, status: string) => {
    setUpdating(redemptionId);
    try {
      const res = await fetch("/api/admin/redemptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redemptionId, status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`Marked as ${status}`);
      load();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  const formatTimeAgo = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const stats = [
    { label: "Total", value: counts.total, color: "#A855F7", icon: Package },
    { label: "Pending", value: counts.pending, color: "#F59E0B", icon: Clock },
    { label: "Contacted", value: counts.contacted, color: "#38BDF8", icon: Mail },
    { label: "Shipped", value: counts.shipped, color: "#9786E3", icon: Truck },
    { label: "Delivered", value: counts.delivered, color: "#22C55E", icon: CheckCircle },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F59E0B] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AdminSectionHeader title={t('admin.redemptions.title')} count={counts.total} color="#F59E0B" />

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-[#1C1929] border border-white/[0.06] rounded-xl p-2 text-center"
          >
            <s.icon size={12} className="mx-auto mb-1" style={{ color: s.color }} />
            <p className="text-base font-extrabold text-white">{s.value}</p>
            <p className="text-[8px] text-[#94A3B8] uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {["all", ...REDEMPTION_STATUSES.map((s) => s.id)].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              filter === f
                ? "bg-[#F59E0B] text-slate-950"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
          >
            {f}
            {f !== "all" && (
              <span className="ml-1 opacity-70">
                {(counts as any)[f] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Redemptions list */}
      {redemptions.length === 0 ? (
        <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
          <Package size={28} className="mx-auto text-[#475569] mb-2" />
          <p className="text-sm text-[#94A3B8]">{t('admin.redemptions.empty')}</p>
          <p className="text-[10px] text-[#64748B] mt-1">
            {t('admin.redemptions.emptyDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {redemptions.map((r) => {
            const statusInfo = REDEMPTION_STATUSES.find((s) => s.id === r.status) || REDEMPTION_STATUSES[0];
            const StatusIcon = statusInfo.icon;
            return (
              <div
                key={r.id}
                className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3 flex gap-3"
              >
                {/* Gift image */}
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/[0.06]">
                  {r.giftImage ? (
                    <img src={r.giftImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
                      <Gift size={20} className="text-[#475569]" />
                    </div>
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white line-clamp-1">{r.giftTitle}</h3>
                      <p className="text-[10px] text-[#94A3B8] truncate">
                        {r.userName} · {r.userEmail || "no email"}
                      </p>
                    </div>
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                      style={{ backgroundColor: `${statusInfo.color}25`, color: statusInfo.color }}
                    >
                      <StatusIcon size={9} /> {statusInfo.label}
                    </span>
                  </div>

                  {/* Selected variations */}
                  {Array.isArray(r.selectedVariations) && r.selectedVariations.length > 0 ? (
                    <div className="flex flex-wrap gap-1 my-1.5">
                      {r.selectedVariations.map((v: any, vIdx: number) => (
                        <span
                          key={vIdx}
                          className="px-1.5 py-0.5 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-[9px] font-bold"
                        >
                          {v.name}: <span className="text-white">{v.value}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-[#64748B] italic my-1">No variations selected</p>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] text-[#64748B]">
                      {formatTimeAgo(r.createdAt)} · {r.pointsSpent.toLocaleString()} FP spent
                    </p>

                    {/* Status update buttons */}
                    <div className="flex gap-0.5">
                      {REDEMPTION_STATUSES.map((s) => {
                        const SIcon = s.icon;
                        const isCurrent = r.status === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => updateStatus(r.id, s.id)}
                            disabled={isCurrent || updating === r.id}
                            title={`Mark as ${s.label}`}
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all border ${
                              isCurrent
                                ? "opacity-40 cursor-default"
                                : "hover:bg-white/[0.08] border-white/[0.06]"
                            }`}
                            style={
                              isCurrent
                                ? { backgroundColor: `${s.color}25`, color: s.color, borderColor: `${s.color}40` }
                                : { color: s.color, borderColor: `${s.color}30`, backgroundColor: `${s.color}10` }
                            }
                          >
                            {updating === r.id ? (
                              <div className="w-3 h-3 rounded-full border border-transparent border-t-current animate-spin" />
                            ) : (
                              <SIcon size={11} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help footer */}
      <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-3">
        <p className="text-[10px] text-[#A09DB1] leading-relaxed">
          {t('admin.redemptions.workflow')}
        </p>
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────

function AdminSectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-5 rounded-full" style={{ background: color }} />
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${color}20`, color }}>
        {count}
      </span>
    </div>
  );
}

function AdminCard({
  title,
  subtitle,
  description,
  image,
  badge,
  badgeColor,
  actions,
}: {
  title: string;
  subtitle: string;
  description: string;
  image?: string;
  badge?: string;
  badgeColor?: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-3 flex gap-3">
      {image && (
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/[0.06]">
          <img src={image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-white line-clamp-1">{title}</h3>
          {badge && badgeColor && (
            <span
              className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0"
              style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="text-[10px] text-[#94A3B8] mb-1">{subtitle}</p>
        <p className="text-[11px] text-[#A09DB1] line-clamp-2 mb-2">{description}</p>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-[#1C1929] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center">
      <Check size={28} className="mx-auto text-[#22C55E] mb-2" />
      <p className="text-sm text-[#94A3B8]">{text}</p>
    </div>
  );
}

// ─── PREVIEW MODE BANNER ────────────────────────────────────────────────────
// Honest UX: tells the admin that this section uses mock data and actions
// don't persist to a database yet. Shown on all admin tabs that are NOT
// backed by real Prisma models + admin APIs.
// The ONLY tab that does NOT show this is "bible-comics" (BibleComicsAdmin)
// because it has real ComicChapter/ComicPanel Prisma models + 14 admin API routes.

function PreviewModeBanner({ section }: { section: string }) {
  return (
    <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-3 mb-4">
      <div className="flex items-start gap-2">
        <AlertCircle size={14} className="text-[#F59E0B] mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B] mb-0.5">
            Preview Mode — {section}
          </p>
          <p className="text-[10px] text-[#A09DB1] leading-relaxed">
            This section uses mock data. Approve/reject/edit/delete actions update local state only
            and do NOT persist to a database. To make this section production-ready, a Prisma model
            + admin API routes need to be created. The only fully DB-backed admin section is
            Bible Comics.
          </p>
        </div>
      </div>
    </div>
  );
}
