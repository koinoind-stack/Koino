"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useTranslation } from "@/lib/i18n/LanguageContext";

// Public footer for the Koino website.
// Used on the LandingHero + all public pages (about, contact, blog, etc.)
//
// NAVIGATION CONTRACT:
// - Public App Router pages use real routes: /about, /blog, /contact, etc.
// - Authenticated SPA views use /?view=<view> — page.tsx reads the `view`
//   query param on mount and routes the SPA to that view directly.
//   If the visitor is not authenticated, they land on the public landing
//   page and can sign in; after auth, they will NOT auto-route to the
//   originally requested view (acceptable trade-off — they can click
//   the footer link again, or use the sidebar).

// Footer groups (§10): Koino · Faith and Community · Discover · Support ·
// Legal. Only links to routes that exist — App Router pages use real paths,
// SPA views use /?view= deep links. No duplicates, no dead ends.
// Labels are i18n keys (labelKey) resolved via t() at render time — never
// translated at module scope. The brand section header intentionally stays
// the literal brand name.
const FOOTER_SECTIONS: {
  titleKey?: string;
  title?: string;
  links: { labelKey: string; href: string }[];
}[] = [
  {
    title: BRAND.name,
    links: [
      { labelKey: "footer.aboutBrand", href: "/about" },
      { labelKey: "footer.meetFounder", href: "/founder" },
      { labelKey: "footer.blog", href: "/blog" },
      { labelKey: "footer.partner", href: "/partner" },
    ],
  },
  {
    titleKey: "footer.section.faith",
    links: [
      { labelKey: "footer.bible", href: "/?view=bible" },
      { labelKey: "footer.comics", href: "/?view=comic" },
      { labelKey: "footer.videos", href: "/videos" },
      { labelKey: "footer.trivia", href: "/?view=trivia" },
      { labelKey: "footer.prayerWall", href: "/?view=prayer-wall" },
      { labelKey: "footer.churches", href: "/?view=churches" },
      { labelKey: "footer.events", href: "/?view=events" },
      { labelKey: "footer.memorials", href: "/memorials" },
    ],
  },
  {
    titleKey: "footer.section.discover",
    links: [
      { labelKey: "footer.marketplace", href: "/?view=shop" },
      { labelKey: "footer.businessDirectory", href: "/?view=business-directory" },
    ],
  },
  {
    titleKey: "footer.section.support",
    links: [
      { labelKey: "footer.contact", href: "/contact" },
      { labelKey: "footer.supportBrand", href: "/support" },
    ],
  },
  {
    titleKey: "footer.section.legal",
    links: [
      { labelKey: "footer.terms", href: "/terms" },
      { labelKey: "footer.privacy", href: "/privacy" },
      { labelKey: "footer.cookies", href: "/cookies" },
    ],
  },
];

export default function KoinoFooter() {
  const t = useTranslation();
  const [whatsappUrl, setWhatsappUrl] = useState("https://whatsapp.com/channel/0029Vb96qSoBFLgTRTxI5v2q");
  const year = new Date().getFullYear();

  useEffect(() => {
    fetch("/api/config/whatsapp-channel")
      .then((r) => r.json())
      .then((data) => { if (data.url) setWhatsappUrl(data.url); })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-[#0A0913] border-t border-white/[0.04] mt-12">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Brand + description */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-8">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Image
                src="/koino-logo.png"
                alt={BRAND.name + ""}
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-sm font-black text-white">{BRAND.name}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F39B9B] mb-2">
              {t("brand.tagline")}
            </p>
            <p className="text-[11px] text-[#726E88] leading-relaxed">
              {t("footer.description")}
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-[#25D366] hover:opacity-80 transition-opacity"
              >
                <MessageCircle size={14} /> {t("common.whatsappLabel")}
              </a>
            </div>
          </div>

          {/* Link sections */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.titleKey ?? section.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                {section.titleKey ? t(section.titleKey) : section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-[11px] text-[#726E88] hover:text-white transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Support banner */}
        <div className="bg-gradient-to-r from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/15 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-[#F39B9B]" />
            <div>
              <p className="text-xs font-bold text-white">{t("footer.freeToUse")}</p>
              <p className="text-[10px] text-[#94A3B8]">{t("footer.supportHelps")}</p>
            </div>
          </div>
          <Link
            href="/support"
            className="px-4 py-2 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 text-[10px] font-extrabold uppercase tracking-wider transition-all hover:-translate-y-px shrink-0"
          >
            {t("footer.supportCta")}
          </Link>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-white/[0.04]">
          <p className="text-[10px] text-[#475569]">
            {t("footer.copyright", { year })} · {t("brand.tagline")}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-[10px] text-[#475569] hover:text-white transition-colors">{t("footer.termsShort")}</Link>
            <Link href="/privacy" className="text-[10px] text-[#475569] hover:text-white transition-colors">{t("footer.privacyShort")}</Link>
            <Link href="/cookies" className="text-[10px] text-[#475569] hover:text-white transition-colors">{t("footer.cookiesShort")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
