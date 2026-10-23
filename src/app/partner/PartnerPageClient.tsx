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

// ─── Static data ────────────────────────────────────────────────────────────

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
  { icon: User, title: "Pastors", desc: "Shepherd God's people and share pastoral wisdom with the Koino community." },
  { icon: Church, title: "Church Leaders", desc: "Lead congregations and bring your church into the wider Christian community." },
  { icon: BookOpen, title: "Bible Teachers", desc: "Teach the Scriptures faithfully and equip believers to grow in the Word." },
  { icon: Shield, title: "Apologists", desc: "Defend the faith with clarity, gentleness, and sound reasoning." },
  { icon: Megaphone, title: "Evangelists", desc: "Proclaim the Gospel and equip others to share their faith boldly." },
  { icon: PenTool, title: "Christian Authors", desc: "Write books, articles, and devotionals that build up the church." },
  { icon: GraduationCap, title: "Theologians", desc: "Help believers think deeply and biblically about God, life, and culture." },
  { icon: Users, title: "Ministry Leaders", desc: "Lead parachurch ministries and disciple believers across India." },
  { icon: Music, title: "Worship Leaders", desc: "Lead God's people in worship and point them to Christ." },
  { icon: Video, title: "Christian Content Creators", desc: "Create videos, audio, and digital content for the next generation." },
];

const CONTRIBUTION_AREAS = [
  { icon: PenTool, title: "Blog Articles", desc: "Thoughtful, Christ-centered writing on life, faith, and culture." },
  { icon: Shield, title: "Apologetics", desc: "Reasoned defenses of the Christian faith and answers to tough questions." },
  { icon: BookOpen, title: "Bible Studies", desc: "Verse-by-verse and topical studies that help believers understand Scripture." },
  { icon: HeartHandshake, title: "Devotionals", desc: "Short, daily readings that encourage believers to walk closely with Jesus." },
  { icon: ListChecks, title: "Christian Questions & Answers", desc: "Answer real questions from believers seeking biblical guidance." },
  { icon: GraduationCap, title: "Teaching Content", desc: "Long-form teaching, courses, and explainers on doctrine and Christian living." },
];

const WORKFLOW = [
  {
    icon: ClipboardList,
    step: "1",
    title: "Submit Application",
    desc: "Fill out the contributor application below. Tell us who you are, where you serve, and what you would like to write.",
  },
  {
    icon: Eye,
    step: "2",
    title: "Admin Review",
    desc: "The Koino team reviews your application. Your application status moves from PENDING to UNDER_REVIEW during this stage.",
  },
  {
    icon: BadgeCheck,
    step: "3",
    title: "Approval",
    desc: "If approved, you become a Koino Contributor. A contributor profile is created and you are notified by email.",
  },
  {
    icon: KeyRound,
    step: "4",
    title: "Receive Permissions",
    desc: "An admin grants you specific permissions such as CAN_WRITE_ARTICLES, CAN_WRITE_BLOG, CAN_WRITE_APOLOGETICS, CAN_WRITE_BIBLE_STUDIES, CAN_WRITE_DEVOTIONALS, or CAN_ANSWER_QUESTIONS.",
  },
  {
    icon: Sparkles,
    step: "5",
    title: "Publish",
    desc: "Submit draft articles, devotionals, or answers. Drafts go through a light admin review before they are published on Koino.",
  },
];

const EXPERTISE_OPTIONS = [
  "Bible Exposition",
  "Apologetics",
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

const CONTENT_INTEREST_OPTIONS = [
  "Blog Articles",
  "Apologetics",
  "Bible Studies",
  "Devotionals",
  "Christian Q&A",
  "Teaching Content",
];

type TabId = "inquiry" | "contributor";

// ─── Component ──────────────────────────────────────────────────────────────

export default function PartnerPageClient() {
  const [tab, setTab] = useState<TabId>("inquiry");

  return (
    <>
      {/* Hero */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-6">
          <BadgeCheck size={12} /> Partner With Koino
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
          Help Christians Grow in Faith Through Your{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F39B9B] to-[#9786E3]">
            Teaching, Experience and Biblical Knowledge
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
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Who Can Partner?</h2>
          <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto">
            Koino is open to a wide range of Christian leaders, teachers, and creators who want to serve
            the broader body of Christ through their gifts and calling.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {PARTNER_KINDS.map((p) => (
            <div
              key={p.title}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-[#F39B9B]/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F39B9B]/20 to-[#7C3AED]/20 border border-white/[0.08] flex items-center justify-center mb-3">
                <p.icon size={18} className="text-[#F39B9B]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{p.title}</h3>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contribution Areas */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA] text-[10px] font-bold uppercase tracking-wider mb-3">
            <FileText size={11} /> Contribution Areas
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">What You Can Write</h2>
          <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto">
            Contributors can write across a range of formats. Pick the areas where God has gifted you and
            where you feel called to serve the body of Christ.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONTRIBUTION_AREAS.map((c) => (
            <div key={c.title} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex items-center justify-center mb-3">
                <c.icon size={18} className="text-[#A78BFA]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{c.title}</h3>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-[10px] font-bold uppercase tracking-wider mb-3">
            <ListChecks size={11} /> How It Works
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">From Application to Publish</h2>
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
                  ✓ Koino Verified Contributor
                </span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">What verification means</h3>
              <p className="text-xs text-[#A09DB1] leading-relaxed">
                A <span className="text-white font-semibold">&quot;Koino Verified Contributor&quot;</span> badge
                means that Koino has reviewed and approved the contributor&apos;s application — including their
                identity, church or ministry affiliation, and the areas in which they wish to write. It
                signals that the contributor is a real person serving in a recognized capacity.
              </p>
              <p className="text-xs text-[#A09DB1] leading-relaxed mt-2">
                It does <span className="text-white font-semibold">not</span> mean that Koino endorses every
                theological statement, opinion, or interpretation a contributor may publish. Readers are
                encouraged to test everything against the Scriptures, just as the Bereans did (Acts 17:11).
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
          >
            Partnership Inquiry
          </button>
          <button
            type="button"
            onClick={() => setTab("contributor")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              tab === "contributor"
                ? "bg-[#F39B9B] text-slate-950"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            Become a Contributor
          </button>
        </div>

        {tab === "inquiry" ? <PartnershipInquiryForm /> : <ContributorApplicationForm />}
      </section>
    </>
  );
}

// ─── Partnership Inquiry form (existing flow, posts to /api/partner) ────────

function PartnershipInquiryForm() {
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
      toast.error("Please fill in all required fields.");
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
      toast.error(e.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-black text-white mb-1">Partnership Inquiry</h2>
        <p className="text-xs text-[#A09DB1]">
          For churches, ministries, Christian businesses, sponsors, and organizations interested in
          partnering with Koino.
        </p>
      </div>

      {sent ? (
        <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-2xl p-6 text-center">
          <Check size={32} className="mx-auto text-[#22C55E] mb-3" />
          <p className="text-sm font-bold text-white mb-1">Thank you!</p>
          <p className="text-xs text-[#94A3B8]">
            Your partnership inquiry has been received. We&apos;ll be in touch soon.
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
          >
            Submit Another Inquiry
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="neo-input text-sm w-full"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Organization
            </label>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Email *
            </label>
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="neo-input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Website
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="neo-input text-sm w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Partnership Type *
            </label>
            <select
              value={form.partnershipType}
              onChange={(e) => setForm({ ...form, partnershipType: e.target.value })}
              className="neo-input text-sm w-full"
              required
            >
              <option value="">Select type</option>
              {PARTNER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Message *
            </label>
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
                <Send size={16} /> Submit Inquiry
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Contributor Application form (posts to /api/contributor/apply) ─────────

function ContributorApplicationForm() {
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
      toast.error("Please fill in all required fields.");
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
      toast.error(e.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white mb-1">Become a Contributor</h2>
          <p className="text-xs text-[#A09DB1]">Your application has been received.</p>
        </div>
        <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-2xl p-6 text-center">
          <Check size={32} className="mx-auto text-[#22C55E] mb-3" />
          <p className="text-sm font-bold text-white mb-1">Application Submitted</p>
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
          >
            Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-black text-white mb-1">Become a Contributor</h2>
        <p className="text-xs text-[#A09DB1]">
          Apply to write blog articles, devotionals, apologetics, Bible studies, Q&amp;A, and teaching
          content for the Koino community.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
            Full Name *
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="neo-input text-sm w-full"
            required
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
            Email *
          </label>
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
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Church / Ministry
            </label>
            <input
              type="text"
              value={form.church}
              onChange={(e) => setForm({ ...form, church: e.target.value })}
              placeholder="e.g. Grace Community Church"
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Church Role
            </label>
            <input
              type="text"
              value={form.churchRole}
              onChange={(e) => setForm({ ...form, churchRole: e.target.value })}
              placeholder="e.g. Pastor, Elder, Worship Leader"
              className="neo-input text-sm w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              City
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              State
            </label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Country
            </label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="neo-input text-sm w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
            Short Bio
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Tell us briefly about yourself, your faith journey, and your ministry."
            className="neo-input text-sm h-20 resize-none w-full"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
            Areas of Expertise
          </label>
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
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Website
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
              className="neo-input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
              Social Links
            </label>
            <input
              type="text"
              value={form.socialLinks}
              onChange={(e) => setForm({ ...form, socialLinks: e.target.value })}
              placeholder="Comma-separated URLs (YouTube, X, Instagram)"
              className="neo-input text-sm w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
            Why do you want to contribute? *
          </label>
          <textarea
            value={form.whyContribute}
            onChange={(e) => setForm({ ...form, whyContribute: e.target.value })}
            placeholder="Share your heart for serving the Koino community through your writing."
            className="neo-input text-sm h-24 resize-none w-full"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
            Content You&apos;d Like to Create
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
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
            Sample URL
          </label>
          <input
            type="url"
            value={form.sampleUrl}
            onChange={(e) => setForm({ ...form, sampleUrl: e.target.value })}
            placeholder="A link to something you've written or taught"
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
              <Send size={16} /> Submit Application
            </>
          )}
        </button>
      </form>
    </div>
  );
}
