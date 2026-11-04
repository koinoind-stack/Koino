import type { Metadata } from "next";
import Image from "next/image";
import { HeartHandshake } from "lucide-react";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { T } from "@/components/crosscrafted/T";
import DonationCard from "@/components/founder/DonationCard";
import WhatsAppIcon from "@/components/founder/WhatsAppIcon";
import { FOUNDER, FOUNDER_WHATSAPP } from "@/lib/founder";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Meet Josh Govada — Founder of Koino.in",
  description:
    "Meet Josh Govada, founder of Koino.in, a Christian community platform built around faith, fellowship, and belonging. Discover the mission and learn how to support Koino's continued development.",
  openGraph: {
    title: "Meet Josh Govada — Founder of Koino.in",
    description:
      "Meet Josh Govada, founder of Koino.in — a Christian community platform built around faith, fellowship, and belonging.",
    siteName: BRAND.name,
    type: "website",
    images: [
      {
        url: FOUNDER.image,
        width: 922,
        height: 1600,
        alt: FOUNDER.imageAlt,
      },
    ],
  },
};

const TAGLINES = ["about.pillar.faith.title", "about.pillar.fellowship.title", "about.pillar.belong.title"];

export default function FounderPage() {
  return (
    <PublicPageLayout>
      {/* ─── SECTION 1: MEET THE FOUNDER ─────────────────────────── */}
      <section className="py-12 sm:py-16 px-6" aria-labelledby="founder-heading">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F97316]/10 border border-[#F97316]/20 text-[#F97316] text-xs font-bold uppercase tracking-wider mb-5">
              <HeartHandshake size={12} /> Meet the Founder
            </div>
            <h1
              id="founder-heading"
              className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3"
            >
              Meet the Founder
            </h1>
            <p className="text-sm text-[#A09DB1]">
              <T k="founderPage.sub" />
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Founder photo — swap /public/images/founder.jpg to update */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none order-1">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-2xl shadow-black/40 bg-[#13294A]">
                <Image
                  src={FOUNDER.image}
                  alt={FOUNDER.imageAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, (min-width: 640px) 60vw, 92vw"
                  className="object-cover object-[50%_18%]"
                />
              </div>
              <div className="absolute bottom-4 left-4 rounded-2xl bg-[#071120]/85 backdrop-blur-md border border-white/10 px-4 py-2.5">
                <p className="text-sm font-black text-white leading-tight">
                  {FOUNDER.name}
                </p>
                <p className="text-[11px] text-[#A09DB1]">{FOUNDER.role}</p>
              </div>
            </div>

            {/* Founder story */}
            <div className="order-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {FOUNDER.name}
              </h2>
              <p className="text-sm font-bold text-[#F97316] mt-1">
                {FOUNDER.role}
              </p>
              <div className="flex items-center gap-2 mt-3 mb-6">
                {TAGLINES.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full bg-[#F5B84A]/10 border border-[#F5B84A]/25 text-[#F5B84A] text-[11px] font-bold"
                  >
                    <T k={t} />
                  </span>
                ))}
              </div>

              <div className="space-y-4 text-sm text-[#C9C5DA] leading-relaxed">
                <p>
                  Every meaningful community begins with a vision — a vision to
                  bring people together, build meaningful relationships, and
                  create a place where everyone feels they belong.
                </p>
                <p>
                  Koino was born from my vision to bring Christians across
                  India closer together through faith, fellowship, and
                  community.
                </p>
                <p>
                  I wanted to create more than just another social networking
                  platform. I wanted to build a digital home where believers
                  could connect with fellow Christians, encourage one another,
                  grow spiritually, explore the Bible, discover Christian
                  businesses, participate in community activities, and share
                  their journeys of faith.
                </p>
                <p>With that vision, Koino.in was created.</p>
                <p>
                  Our mission is to help Christians connect beyond church walls
                  and geographical boundaries, making it easier to build
                  meaningful relationships and stronger communities across
                  India.
                </p>
                <p>
                  From Bible reading and faith-based discussions to Christian
                  businesses, marketplace discovery, and community connections,
                  Koino brings different aspects of Christian life together in
                  one place.
                </p>
                <p>
                  I believe technology can do more than connect people online.
                  It can help build genuine relationships, strengthen
                  fellowship, and create opportunities for people to support
                  one another.
                </p>
                <p>
                  Koino is more than a platform. It is a vision for a connected
                  community built on faith, fellowship, and belonging.
                </p>
                <p className="text-white font-bold"><T k="founderPage.welcome" /></p>
                <p className="text-[#F5B84A] font-bold">
                  Faith. Fellowship. Belong.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-white/[0.08]">
                <p className="text-sm font-black text-white"><T k="founderPage.signature" /></p>
                <p className="text-xs text-[#A09DB1] mt-0.5">
                  <T k="founderPage.role" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: LET'S CONNECT ────────────────────────────── */}
      <section className="py-12 px-6" aria-labelledby="connect-heading">
        <div className="max-w-3xl mx-auto text-center rounded-3xl bg-[#13294A]/60 border border-white/[0.06] p-8 sm:p-10">
          <h2
            id="connect-heading"
            className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3"
          >
            <T k="founderPage.connect.title" />
          </h2>
          <p className="text-sm font-bold text-[#C9C5DA] mb-2">
            <T k="founderPage.connect.q" />
          </p>
          <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xl mx-auto mb-7">
            I&rsquo;d love to hear from you. Whether you have feedback about
            Koino, want to collaborate, or simply want to share your thoughts,
            feel free to reach out.
          </p>
          <a
            href={FOUNDER_WHATSAPP.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact Josh on WhatsApp (opens in a new tab)"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1FB855] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px"
          >
            <WhatsAppIcon className="h-5 w-5" />
            <T k="founderPage.connect.whatsapp" />
          </a>
          <p className="text-[11px] text-[#726E88] mt-3.5 leading-relaxed">
            Opens WhatsApp with a pre-filled message — the app on mobile, or
            WhatsApp Web on desktop. · {FOUNDER_WHATSAPP.displayNumber}
          </p>
        </div>
      </section>

      {/* ─── SECTIONS 3 + 4: DONATION MESSAGE & UPI CARD ─────────── */}
      <section className="py-12 sm:py-16 px-6" aria-labelledby="donation-heading">
        <div className="max-w-3xl mx-auto text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F5B84A]/10 border border-[#F5B84A]/25 text-[#F5B84A] text-xs font-bold uppercase tracking-wider mb-5">
            <HeartHandshake size={12} /> <T k="founderPage.missionBadge" />
          </div>
          <h2
            id="donation-heading"
            className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3"
          >
            Help Keep Koino Free
          </h2>
          <p className="text-sm font-bold text-[#C9C5DA]">
            A community built on faith. Sustained by people who believe in its
            mission.
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-4 text-sm text-[#C9C5DA] leading-relaxed text-center">
          <p>
            Koino was created with a simple dream: to bring Christians across
            India together through faith, fellowship, and meaningful
            connections.
          </p>
          <p>
            We believe that connecting with fellow believers, exploring the
            Bible, sharing encouragement, discovering Christian businesses, and
            finding a community should not depend on someone&rsquo;s ability to
            pay.
          </p>
          <p className="text-white font-bold">
            That&rsquo;s why Koino is free to use. And with your support, we
            hope to keep it that way.
          </p>
          <p>
            But running a digital platform takes real work. Hosting, security,
            maintenance, and developing new features all come with costs.
          </p>
          <p>
            Behind every connection is an effort to keep this community
            growing.
          </p>
          <p>
            If Koino has encouraged you, helped you discover something
            meaningful, or made you feel more connected to fellow believers,
            would you consider supporting our mission?
          </p>
          <p>
            Your contribution, whether small or large, can help us maintain the
            platform, improve the user experience, and make room for more
            people to join.
          </p>
          <p>
            Every contribution is appreciated. There is no obligation to
            donate, and you can continue using Koino for free whether you give
            or not.
          </p>

          <div className="pt-5">
            <p className="text-xl font-black text-[#F5B84A]">
              Together, we can help this community grow.
            </p>
            <p className="mt-3">
              Let&rsquo;s build a place where faith connects people, fellowship
              brings us closer, and everyone has a place to belong.
            </p>
            <p className="mt-3">Thank you for being part of Koino.</p>
            <p className="mt-4 text-xs text-[#94A3B8]">With gratitude,</p>
            <p className="text-sm font-black text-white mt-1">Josh Govada</p>
            <p className="text-xs text-[#A09DB1]">Founder, Koino.in</p>
          </div>
        </div>

        {/* Interactive donation card (Google Pay / UPI intent) */}
        <DonationCard />
      </section>
    </PublicPageLayout>
  );
}
