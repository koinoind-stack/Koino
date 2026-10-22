import type { Metadata } from "next";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import LordsbookCommunityCard from "@/components/crosscrafted/LordsbookCommunityCard";
import {
  Globe,
  Users,
  MessageCircle,
  Heart,
  Handshake,
  Cross,
  Check,
  BookOpen,
  Calendar,
  Award,
  Store,
  Building2,
  Plus,
} from "lucide-react";

// ─── SEO ───
// Title and description stay focused on the conversion goal: meeting Christians
// around the world. Koino is the publisher; Lordsbook is the destination.
export const metadata: Metadata = {
  title: "Meet Christians Around the World | Koino",
  description:
    "Meet Christians around the world, build Christian friendships, share your faith, and join global Christian conversations through Lordsbook.",
  openGraph: {
    title: "Meet Christians Around the World | Koino",
    description:
      "Meet Christians around the world, build Christian friendships, share your faith, and join global Christian conversations through Lordsbook.",
    siteName: "Koino",
  },
};

// ─── Four feature cards ───
// Icons use Lucide (no emoji in code). The spec shows emojis as visual cues;
// we mirror the meaning with reliable icon rendering.
const FEATURES = [
  {
    icon: Handshake,
    title: "Build Christian Friendships",
    desc: "Meet believers from different backgrounds and countries and build meaningful Christian friendships.",
  },
  {
    icon: Globe,
    title: "Meet Believers Worldwide",
    desc: "Discover a global Christian community and connect with people beyond your local church and city.",
  },
  {
    icon: MessageCircle,
    title: "Join Christian Conversations",
    desc: "Share your thoughts, encourage others, discuss faith, and take part in meaningful conversations.",
  },
  {
    icon: Cross,
    title: "Share Your Faith",
    desc: "Encourage others, share your Christian journey, and be part of a community centered on faith.",
  },
];

// ─── "Why connect on Lordsbook?" checklist ───
const WHY_CHECKLIST = [
  "Meet Christians globally",
  "Build Christian friendships",
  "Share your faith",
  "Join Christian conversations",
  "Discover Christian communities",
  "Encourage and be encouraged",
];

// ─── Koino side of the two-column comparison ───
const KOINO_POINTS = [
  { icon: BookOpen, label: "Read Scripture" },
  { icon: Heart, label: "Pray" },
  { icon: Globe, label: "Discover churches" },
  { icon: Calendar, label: "Discover events" },
  { icon: Award, label: "Learn & grow" },
  { icon: Store, label: "Support Christian businesses" },
];

export default function CommunityPage() {
  return (
    <PublicPageLayout>
      {/* ───────────────────────────────────────────────────────────────────
          HERO — strong conversion-focused
          ─────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 sm:py-20 px-6">
        {/* Background glow accents — Koino design language */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-[#38BDF8]/8 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-[#7C3AED]/8 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center space-y-5">
          {/* Small label */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-xs font-bold uppercase tracking-wider">
            <Globe size={12} /> Global Christian Community
          </div>

          {/* Main headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Meet Christians{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] to-[#7C3AED]">
              Around the World
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-white font-bold leading-relaxed">
            Your faith journey is better together.
          </p>

          {/* Body */}
          <p className="text-sm sm:text-base text-[#A09DB1] leading-relaxed max-w-2xl mx-auto">
            Connect with Christians from different countries, build meaningful friendships,
            share your faith, join conversations, and discover a global Christian community on Lordsbook.
          </p>

          {/* Dual CTA — primary + secondary.
              Both open https://lordsbook.com/signin (Lordsbook account page)
              where the user can CREATE ACCOUNT or SIGN IN.
              Koino does NOT collect Lordsbook credentials. */}
          <div className="pt-3">
            <LordsbookCommunityCard
              variant="conversion"
              buttonText="Join the Global Christian Community"
              secondaryButtonText="I already have a Lordsbook account"
              microcopy="Create your free Lordsbook account and start connecting with Christians around the world."
              context="community_hero"
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          FOUR FEATURE CARDS
          ─────────────────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5 flex items-start gap-4 hover:border-[#38BDF8]/25 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#38BDF8]/15 to-[#7C3AED]/15 border border-[#38BDF8]/25 flex items-center justify-center shrink-0">
                <f.icon size={20} className="text-[#38BDF8]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
                <p className="text-xs text-[#A09DB1] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          WHY LORDSBOOK? — checklist section
          ─────────────────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-[#0D1A2E] via-[#1C1929] to-[#1A0D2E] border border-[#38BDF8]/15 rounded-3xl p-8 sm:p-10">
          <div className="text-center mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#38BDF8] mb-2">
              Why Connect on Lordsbook?
            </p>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Faith is Better Together.
            </h2>
            <p className="text-sm text-[#A09DB1] mt-3 max-w-xl mx-auto leading-relaxed">
              Koino gives you tools to grow in your faith.
              <br />
              Lordsbook gives you a place to connect with Christians around the world.
            </p>
          </div>

          {/* Checklist — no fake stats, just benefit statements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {WHY_CHECKLIST.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3"
              >
                <div className="w-5 h-5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-[#22C55E]" strokeWidth={3} />
                </div>
                <span className="text-sm text-white font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          KOINO + LORDSBOOK — two-column explanation
          ─────────────────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-stretch">
          {/* LEFT: Koino */}
          <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#F39B9B]/20 rounded-3xl p-6 sm:p-8 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-[10px] font-bold uppercase tracking-wider mb-3">
              Koino
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F39B9B] mb-3">
              Faith. Fellowship. Belong.
            </p>
            <p className="text-sm text-[#A09DB1] leading-relaxed mb-5">
              Grow in faith, explore Scripture, pray, discover churches and events, learn,
              and support Christian businesses.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {KOINO_POINTS.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-2"
                >
                  <p.icon size={13} className="text-[#F39B9B] shrink-0" />
                  <span className="text-[10px] text-[#94A3B8] font-semibold leading-tight">{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MIDDLE: + / AND */}
          <div className="flex md:flex-col items-center justify-center gap-2 py-2 md:py-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F39B9B]/15 to-[#38BDF8]/15 border border-white/[0.12] flex items-center justify-center">
              <Plus size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#94A3B8]">And</span>
          </div>

          {/* RIGHT: Lordsbook */}
          <div className="bg-gradient-to-br from-[#0D1A2E] to-[#1A0D2E] border border-[#38BDF8]/20 rounded-3xl p-6 sm:p-8 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-[10px] font-bold uppercase tracking-wider mb-3">
              Lordsbook
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#38BDF8] mb-3">
              Meet Christians Around the World
            </p>
            <p className="text-sm text-[#A09DB1] leading-relaxed mb-5">
              Connect with Christians globally, build friendships, share your faith,
              and join Christian conversations.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Globe, label: "Meet Christians globally" },
                { icon: Users, label: "Build friendships" },
                { icon: MessageCircle, label: "Join conversations" },
                { icon: Heart, label: "Share your faith" },
              ].map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-2"
                >
                  <p.icon size={13} className="text-[#38BDF8] shrink-0" />
                  <span className="text-[10px] text-[#94A3B8] font-semibold leading-tight">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Below summary line */}
        <p className="text-center text-sm text-[#A09DB1] mt-8 leading-relaxed">
          Use Koino to grow in your faith.
          <br className="sm:hidden" />{" "}
          <span className="text-white font-semibold">Use Lordsbook to connect with the global Christian community.</span>
        </p>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          STRONG FINAL CTA
          ─────────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 max-w-3xl mx-auto">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0D1A2E] via-[#1C1929] to-[#1A0D2E] border border-[#38BDF8]/20 rounded-3xl p-8 sm:p-12 text-center">
          {/* Glow accents */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#38BDF8]/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#7C3AED]/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#38BDF8]">
              Ready to Connect?
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Meet Christians Around the World
            </h2>
            <p className="text-sm sm:text-base text-[#A09DB1] leading-relaxed max-w-xl mx-auto">
              Your faith was never meant to be lived alone.
              <br />
              Join Christians from around the world, make new friendships, share your faith,
              and be part of a global Christian community.
            </p>

            {/* Dual CTA */}
            <div className="pt-3">
              <LordsbookCommunityCard
                variant="conversion"
                buttonText="Join the Global Christian Community"
                secondaryButtonText="Sign in to Lordsbook"
                microcopy=""
                context="community_final"
              />
            </div>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
