"use client";

import { useState } from "react";
import {
  Send,
  Loader2,
  Check,
  User,
  Church,
  BookOpen,
  Shield,
  Megaphone,
  PenTool,
  GraduationCap,
  Users,
  Music,
  Video,
  BadgeCheck,
  FileText,
  ListChecks,
  HeartHandshake,
  ClipboardList,
  Eye,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";

// ─── Static data ────────────────────────────────────────────────────────────

// Option VALUES are stored in the DB as-is (some legacy rows already store
// i18n keys from an earlier wiring); labels are translated via these maps.
const PARTNER_TYPE_KEYS: Record<string, string> = {
  "Church": "partner.type.church",
  "Ministry": "partner.type.ministry",
  "Christian Business": "partner.type.christianBusiness",
  "Event Partner": "partner.type.eventPartner",
  "Content Partner": "partner.type.contentPartner",
  "Sponsor": "partner.type.sponsor",
  "Technology Partner": "partner.type.technologyPartner",
  "Other": "partner.type.other",
};

const PARTNER_TYPES = [
  "Church",
  "Ministry",
  "Christian Business",
  "Event Partner",
  "Content Partner",
  "Sponsor",
  "Technology Partner",
  "Other",
];

const PARTNER_KINDS = [
  { icon: User, title: "partner.who.pastors.t", desc: "partner.who.pastors.d" },
  { icon: Church, title: "partner.who.leaders.t", desc: "partner.who.leaders.d" },
  { icon: BookOpen, title: "partner.who.teachers.t", desc: "partner.who.teachers.d" },
  { icon: Shield, title: "partner.who.apologists.t", desc: "partner.who.apologists.d" },
  { icon: Megaphone, title: "partner.who.evangelists.t", desc: "partner.who.evangelists.d" },
  { icon: PenTool, title: "partner.who.authors.t", desc: "partner.who.authors.d" },
  { icon: GraduationCap, title: "partner.who.theologians.t", desc: "partner.who.theologians.d" },
  { icon: Users, title: "partner.who.ministry.t", desc: "partner.who.ministry.d" },
  { icon: Music, title: "partner.who.worship.t", desc: "partner.who.worship.d" },
  { icon: Video, title: "partner.who.creators.t", desc: "partner.who.creators.d" },
];

const CONTRIBUTION_AREAS = [
  { icon: PenTool, title: "partner.area.blog.t", desc: "partner.area.blog.d" },
  { icon: Shield, title: "partner.area.apologetics.t", desc: "partner.area.apologetics.d" },
  { icon: BookOpen, title: "partner.area.studies.t", desc: "partner.area.studies.d" },
  { icon: HeartHandshake, title: "partner.area.devotionals.t", desc: "partner.area.devotionals.d" },
  { icon: ListChecks, title: "partner.area.qa.t", desc: "partner.area.qa.d" },
  { icon: GraduationCap, title: "partner.area.teaching.t", desc: "partner.area.teaching.d" },
];

const WORKFLOW = [
  {
    icon: ClipboardList,
    step: "1",
    title: "partner.step1.t",
    desc: "partner.step1.d",
  },
  {
    icon: Eye,
    step: "2",
    title: "partner.step2.t",
    desc: "partner.step2.d",
  },
  {
    icon: BadgeCheck,
    step: "3",
    title: "partner.step3.t",
    desc: "partner.step3.d",
  },
  {
    icon: KeyRound,
    step: "4",
    title: "partner.step4.t",
    desc: "partner.step4.d",
  },
  {
    icon: Sparkles,
    step: "5",
    title: "partner.step5.t",
    desc: "partner.step5.d",
  },
];

const EXPERTISE_KEYS: Record<string, string> = {
  "Bible Exposition": "partner.expertise.bibleExposition",
  "partner.area.apologetics.t": "partner.area.apologetics.t",
  "Theology": "partner.expertise.theology",
  "Church History": "partner.expertise.churchHistory",
  "Pastoral Care": "partner.expertise.pastoralCare",
  "Evangelism": "partner.expertise.evangelism",
  "Discipleship": "partner.expertise.discipleship",
  "Marriage & Family": "partner.expertise.marriageFamily",
  "Youth & Children": "partner.expertise.youthChildren",
  "Worship & Liturgy": "partner.expertise.worshipLiturgy",
  "Missions": "partner.expertise.missions",
  "Christian Living": "partner.expertise.christianLiving",
};

const EXPERTISE_OPTIONS = [
  "Bible Exposition",
  "partner.area.apologetics.t",
  "Theology",
  "Church History",
  "Pastoral Care",
  "Evangelism",
  "Discipleship",
  "Marriage & Family",
  "Youth & Children",
  "Worship & Liturgy",
  "Missions",
  "Christian Living",
];

const CONTENT_INTEREST_KEYS: Record<string, string> = {
  "partner.area.blog.t": "partner.area.blog.t",
  "partner.area.apologetics.t": "partner.area.apologetics.t",
  "partner.area.studies.t": "partner.area.studies.t",
  "partner.area.devotionals.t": "partner.area.devotionals.t",
  "Christian Q&A": "partner.content.qa",
  "partner.area.teaching.t": "partner.area.teaching.t",
};

const CONTENT_INTEREST_OPTIONS = [
  "partner.area.blog.t",
  "partner.area.apologetics.t",
  "partner.area.studies.t",
  "partner.area.devotionals.t",
  "Christian Q&A",
  "partner.area.teaching.t",
];

type TabId = "inquiry" | "contributor";

// ─── Component ──────────────────────────────────────────────────────────────

export default function PartnerPageClient() {
  const t = useTranslation();
  const [tab, setTab] = useState<TabId>("inquiry");

  return (
    <>
      {/* Hero */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-6">
          <BadgeCheck size={12} />{t("partner.badge")}</div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
          {t("page.partner.helpTitle")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F39B9B] to-[#9786E3]">
            {t("partner.tagline")}
          </span>
        </h1>
        <p className="text-base text-[#A09DB1] leading-relaxed max-w-2xl mx-auto mb-8">
          Koino welcomes Christian leaders, teachers, and content creators to contribute to a platform
          built for faith, fellowship, and belonging. Whether you pastor a church, teach the Bible, defend
          the faith, write devotionals, or create Christian content — there is a place for you here.
        </p>
      </section>

      {/* Who Can Partner? */}
      <section className="py-12 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t("partner.whoTitle")}</h2>
          <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto">
            Koino is open to a wide range of Christian leaders, teachers, and creators who want to serve
            the broader body of Christ through their gifts and calling.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {PARTNER_KINDS.map((p) => (
            <div
              key={t(p.title)}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-[#F39B9B]/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F39B9B]/20 to-[#7C3AED]/20 border border-white/[0.08] flex items-center justify-center mb-3">
                <p.icon size={18} className="text-[#F39B9B]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{t(p.title)}</h3>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">{t(p.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contribution Areas */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA] text-[10px] font-bold uppercase tracking-wider mb-3">
            <FileText size={11} />{t("partner.areasTitle")}</div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t("partner.areasSub")}</h2>
          <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto">
            Contributors can write across a range of formats. Pick the areas where God has gifted you and
            where you feel called to serve the body of Christ.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONTRIBUTION_AREAS.map((c) => (
            <div key={t(c.title)} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex items-center justify-center mb-3">
                <c.icon size={18} className="text-[#A78BFA]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{t(c.title)}</h3>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">{t(c.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-[10px] font-bold uppercase tracking-wider mb-3">
            <ListChecks size={11} />{t("partner.howTitle")}</div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t("partner.howSub")}</h2>
          <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto">
            Becoming a Koino Contributor is a simple, transparent process. Every application is reviewed
            by a real person before permissions are granted.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {WORKFLOW.map((w) => (
            <div
              key={w.step}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 relative"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F39B9B]/20 to-[#7C3AED]/20 border border-white/[0.08] flex items-center justify-center">
                  <w.icon size={16} className="text-[#F39B9B]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Step {w.step}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">{w.title}</h3>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Verified Contributor callout */}
      <section className="py-8 px-6 max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#F39B9B]/20 rounded-3xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F39B9B]/15 border border-[#F39B9B]/25 flex items-center justify-center shrink-0">
              <BadgeCheck size={22} className="text-[#F39B9B]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F39B9B]">
                  {t("partner.verifiedBadge")}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">{t("partner.verifyTitle")}</h3>
              <p className="text-xs text-[#A09DB1] leading-relaxed">
                {t("partner.verifyA1")} <span className="text-white font-semibold">&quot;Koino Verified Contributor&quot;</span> {t("partner.verifyA2")}
              </p>
              <p className="text-xs text-[#A09DB1] leading-relaxed mt-2">
                {t("partner.verifyB1")} <span className="text-white font-semibold">{t("partner.verifyNot")}</span> {t("partner.verifyB2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs + Forms */}
      <section className="py-12 px-6 max-w-2xl mx-auto">
        {/* Tab switcher */}
        <div className="flex p-1 mb-8 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          <button
            type="button"
            onClick={() => setTab("inquiry")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "inquiry"
                ? "bg-[#F39B9B] text-slate-950"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >{t("partner.inquiryTitle")}</button>
          <button
            type="button"
            onClick={() => setTab("contributor")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "contributor"
                ? "bg-[#F39B9B] text-slate-950"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >{t("partner.contributorTitle")}</button>
        </div>

        {tab === "inquiry" ? <PartnershipInquiryForm /> : <ContributorApplicationForm />}
      </section>
    </>
  );
}

// ─── Partnership Inquiry form (existing flow, posts to /api/partner) ────────

function PartnershipInquiryForm() {
  const t = useTranslation();
  const [form, setForm] = useState({
    name: "",
    organization: "",
    email: "",
    phone: "",
    website: "",
    partnershipType: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.partnershipType || !form.message) {
      toast.error(t("partner.toast.fillRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (e: any) {
      toast.error(e.message || t("partner.toast.submitFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-black text-white mb-1">{t("partner.inquiryTitle")}</h2>
        <p className="text-xs text-[#A09DB1]">
          For churches, ministries, Christian businesses, sponsors, and organizations interested in
          partnering with Koino.
        </p>
      </div>

      {sent ? (
        <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-2xl p-6 text-center">
          <Check size={32} className="mx-auto text-[#22C55E] mb-3" />
          <p className="text-sm font-bold text-white mb-1">{t("partner.thanks")}</p>
          <p className="text-xs text-[#94A3B8]">
            {t("partner.inquiryDone")}
          </p>
          <button
            onClick={() => {
              setSent(false);
              setForm({
                name: "",
                organization: "",
                email: "",
                phone: "",
                website: "",
                partnershipType: "",
                message: "",
              });
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
          >{t("partner.anotherInquiry")}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.name")}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="neo-input text-sm w-full"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.org")}</label>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.email")}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="neo-input text-sm w-full"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.phone")}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="neo-input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.website")}</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="neo-input text-sm w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.ptype")}</label>
            <select
              value={form.partnershipType}
              onChange={(e) => setForm({ ...form, partnershipType: e.target.value })}
              className="neo-input text-sm w-full"
              required
            >
              <option value="">{t("partner.selectType")}</option>
              {PARTNER_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t(PARTNER_TYPE_KEYS[pt] ?? pt)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.message")}</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="neo-input text-sm h-28 resize-none w-full"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : (
              <>
                <Send size={16} />{t("partner.submitInquiry")}</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Contributor Application form (posts to /api/contributor/apply) ─────────

function ContributorApplicationForm() {
  const t = useTranslation();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    church: "",
    churchRole: "",
    city: "",
    state: "",
    country: "India",
    bio: "",
    expertise: [] as string[],
    website: "",
    socialLinks: "",
    whyContribute: "",
    contentInterests: [] as string[],
    sampleUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const toggleArrayValue = (key: "expertise" | "contentInterests", value: string) => {
    setForm((prev) => {
      const arr = prev[key];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.whyContribute) {
      toast.error(t("partner.toast.fillRequired"));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        church: form.church || undefined,
        churchRole: form.churchRole || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        bio: form.bio || undefined,
        expertise: form.expertise,
        website: form.website || undefined,
        socialLinks: form.socialLinks
          ? form.socialLinks.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        whyContribute: form.whyContribute,
        contentInterests: form.contentInterests,
        sampleUrl: form.sampleUrl || undefined,
      };
      const res = await fetch("/api/contributor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (e: any) {
      toast.error(e.message || t("partner.toast.submitFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white mb-1">{t("partner.contributorTitle")}</h2>
          <p className="text-xs text-[#A09DB1]">{t("partner.appReceived")}</p>
        </div>
        <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-2xl p-6 text-center">
          <Check size={32} className="mx-auto text-[#22C55E] mb-3" />
          <p className="text-sm font-bold text-white mb-1">{t("partner.appSubmitted")}</p>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Thank you for applying to become a Koino Contributor. Our team will review your application
            and respond by email. You can track your status (PENDING → UNDER_REVIEW → APPROVED) once your
            contributor profile is created.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setForm({
                fullName: "",
                email: "",
                church: "",
                churchRole: "",
                city: "",
                state: "",
                country: "India",
                bio: "",
                expertise: [],
                website: "",
                socialLinks: "",
                whyContribute: "",
                contentInterests: [],
                sampleUrl: "",
              });
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
          >{t("partner.anotherApp")}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-black text-white mb-1">{t("partner.contributorTitle")}</h2>
        <p className="text-xs text-[#A09DB1]">
          Apply to write blog articles, devotionals, apologetics, Bible studies, Q&amp;A, and teaching
          content for the Koino community.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.fullName")}</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="neo-input text-sm w-full"
            required
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.email")}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="neo-input text-sm w-full"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.churchMinistry")}</label>
            <input
              type="text"
              value={form.church}
              onChange={(e) => setForm({ ...form, church: e.target.value })}
              placeholder={t("partner.ph.church")}
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.churchRole")}</label>
            <input
              type="text"
              value={form.churchRole}
              onChange={(e) => setForm({ ...form, churchRole: e.target.value })}
              placeholder={t("partner.ph.role")}
              className="neo-input text-sm w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.city")}</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.state")}</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.country")}</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.shortBio")}</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder={t("partner.ph.bio")}
            className="neo-input text-sm h-20 resize-none w-full"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">{t("partner.expertise")}</label>
          <div className="flex flex-wrap gap-1.5">
            {EXPERTISE_OPTIONS.map((opt) => {
              const selected = form.expertise.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleArrayValue("expertise", opt)}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md border transition-all ${
                    selected
                      ? "bg-[#F39B9B]/15 border-[#F39B9B]/40 text-[#F39B9B]"
                      : "bg-white/[0.03] border-white/[0.06] text-[#A09DB1] hover:text-white"
                  }`}
                >
                  {t(EXPERTISE_KEYS[opt] ?? opt)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.website")}</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.socialLinks")}</label>
            <input
              type="text"
              value={form.socialLinks}
              onChange={(e) => setForm({ ...form, socialLinks: e.target.value })}
              placeholder={t("partner.ph.social")}
              className="neo-input text-sm w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.whyContribute")}</label>
          <textarea
            value={form.whyContribute}
            onChange={(e) => setForm({ ...form, whyContribute: e.target.value })}
            placeholder={t("partner.ph.why")}
            className="neo-input text-sm h-24 resize-none w-full"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
            {t("partner.contentToCreate")}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_INTEREST_OPTIONS.map((opt) => {
              const selected = form.contentInterests.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleArrayValue("contentInterests", opt)}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md border transition-all ${
                    selected
                      ? "bg-[#7C3AED]/15 border-[#7C3AED]/40 text-[#A78BFA]"
                      : "bg-white/[0.03] border-white/[0.06] text-[#A09DB1] hover:text-white"
                  }`}
                >
                  {t(CONTENT_INTEREST_KEYS[opt] ?? opt)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("partner.sampleUrl")}</label>
          <input
            type="url"
            value={form.sampleUrl}
            onChange={(e) => setForm({ ...form, sampleUrl: e.target.value })}
            placeholder={t("partner.ph.sample")}
            className="neo-input text-sm w-full"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:opacity-30 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Send size={16} />{t("partner.submitApp")}</>
          )}
        </button>
      </form>
    </div>
  );
}
