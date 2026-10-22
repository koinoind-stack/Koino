import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import DonationMethods from "@/components/crosscrafted/DonationMethods";
import { Heart, Server, BookOpen, Trophy, Users, ShieldCheck, Code } from "lucide-react";
import Link from "next/link";

const db = new PrismaClient();

export const metadata: Metadata = {
  title: "Support Koino — Help Keep Koino Free",
  description: "Koino is free to use. Your support helps keep it that way. Give via UPI, QR code, or direct bank transfer.",
  openGraph: {
    title: "Support Koino — Help Keep Koino Free",
    description: "Koino is free to use. Your support helps keep it that way.",
    siteName: "Koino",
  },
};

export const dynamic = "force-dynamic";

const SUPPORT_AREAS = [
  { icon: Server, title: "Technology & Hosting", desc: "Servers, databases, storage, security and infrastructure." },
  { icon: BookOpen, title: "Bible & Christian Content", desc: "Bible resources, educational content and Christian experiences." },
  { icon: Trophy, title: "Bible Trivia & Prizes", desc: "Prizes and competitions that encourage people to learn Scripture." },
  { icon: Users, title: "Community Development", desc: "Churches, events, prayer and Christian community features." },
  { icon: ShieldCheck, title: "Safety & Moderation", desc: "Helping keep Koino a welcoming and safe community." },
  { icon: Code, title: "Future Development", desc: "New features, mobile improvements and continued development." },
];

export default async function SupportPage() {
  // Server-side fetch of the donation settings singleton.
  // Falls back to a fully-null payload (acceptingDonations=true) if the row
  // is missing — the DonationMethods client component handles the empty state.
  const row = await db.donationSettings.findUnique({
    where: { id: "default" },
  });

  const settings = {
    upiId: row?.upiId ?? null,
    qrCodeUrl: row?.qrCodeUrl ?? null,
    accountName: row?.accountName ?? null,
    accountNumber: row?.accountNumber ?? null,
    ifsc: row?.ifsc ?? null,
    bankName: row?.bankName ?? null,
    branch: row?.branch ?? null,
    donationMessage: row?.donationMessage ?? null,
    acceptingDonations: row?.acceptingDonations ?? true,
  };

  return (
    <PublicPageLayout>
      {/* Hero */}
      <section className="py-16 px-6 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-6">
          <Heart size={12} fill="currentColor" /> Support Koino
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-4">Help Keep Koino Free</h1>
        <p className="text-base text-[#A09DB1] leading-relaxed mb-4">
          Koino is built to be a free Christian community platform for people everywhere.
          Your support helps us keep the platform running, build new features, support Christian
          communities, create Bible content, provide prizes and continue improving Koino for everyone.
        </p>
        <p className="text-sm font-bold text-[#F39B9B] mb-8">
          Koino is free to use. Your support helps keep it that way.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="#give"
            className="px-8 py-3.5 bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all hover:-translate-y-px flex items-center gap-2"
          >
            <Heart size={16} /> Give to Koino
          </Link>
          <Link
            href="/partner"
            className="px-8 py-3.5 border border-white/[0.08] hover:border-white/[0.15] text-[#A09DB1] hover:text-white font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all bg-white/[0.02]"
          >
            Become a Partner
          </Link>
        </div>
      </section>

      {/* Support areas */}
      <section className="py-8 px-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUPPORT_AREAS.map((a) => (
            <div key={a.title} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex items-center justify-center mb-3">
                <a.icon size={18} className="text-[#A78BFA]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{a.title}</h3>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Give to Koino — donation methods */}
      <section id="give" className="py-8 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-base font-bold text-white mb-2">GIVE TO KOINO</h2>
          <p className="text-xs text-[#A09DB1]">
            Choose a method below to give directly. Every gift helps keep Koino free.
          </p>
        </div>

        {/* Optional admin-set callout / thank-you message */}
        {settings.acceptingDonations && settings.donationMessage && (
          <div className="mb-5 rounded-2xl border border-[#F39B9B]/20 bg-[#F39B9B]/8 px-4 py-3 text-center">
            <p className="text-xs text-white leading-relaxed whitespace-pre-line">
              {settings.donationMessage}
            </p>
          </div>
        )}

        {settings.acceptingDonations ? (
          <DonationMethods settings={settings} />
        ) : (
          <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-6 text-center">
            <p className="text-sm text-[#A09DB1]">
              Donations are temporarily paused. Please check back later.
            </p>
          </div>
        )}

        {/* Thank-you footer */}
        {settings.acceptingDonations && (
          <p className="text-center text-sm font-semibold text-white mt-6">
            Thank you for considering a gift to Koino.
          </p>
        )}
      </section>

      {/* Payment honesty note — Koino does NOT process online payments */}
      <section className="pb-16 pt-4 px-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/8 p-4">
          <p className="text-[11px] text-[#A09DB1] leading-relaxed text-center">
            <span className="text-[#F59E0B] font-bold">Note:</span> Koino does
            not process online payments. The methods above are for direct
            transfers. We do not collect card details or bank credentials.
          </p>
        </div>
      </section>
    </PublicPageLayout>
  );
}
