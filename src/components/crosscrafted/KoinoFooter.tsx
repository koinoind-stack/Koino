"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
} from "lucide-react";

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
// - The "Global Christian Community" item uses /community (public page).

const FOOTER_SECTIONS = [
  {
    title: "Koino",
    links: [
      { label: "About Koino", href: "/about" },
      { label: "Bible", href: "/?view=bible" },
      { label: "Bible Comics", href: "/?view=comic" },
      { label: "Churches", href: "/?view=churches" },
      { label: "Events", href: "/?view=events" },
      { label: "Bible Trivia", href: "/?view=trivia" },
      { label: "Prayer Wall", href: "/?view=prayer-wall" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Global Christian Community", href: "/community" },
      { label: "Business Directory", href: "/?view=business-directory" },
      { label: "Marketplace", href: "/?view=shop" },
      { label: "Partner With Koino", href: "/partner" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact Us", href: "/contact" },
      { label: "Support Koino", href: "/support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
];

export default function KoinoFooter() {
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Image
                src="/koino-logo.png"
                alt="Koino"
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-sm font-black text-white">Koino</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F39B9B] mb-2">
              Faith. Fellowship. Belong.
            </p>
            <p className="text-[11px] text-[#726E88] leading-relaxed">
              Koino is a free Christian community platform built to help people discover Scripture,
              connect with churches and Christian communities, find events, pray together, learn,
              and grow in faith.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-[#25D366] hover:opacity-80 transition-opacity"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          </div>

          {/* Link sections */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[11px] text-[#726E88] hover:text-white transition-colors"
                    >
                      {link.label}
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
              <p className="text-xs font-bold text-white">Koino is free to use.</p>
              <p className="text-[10px] text-[#94A3B8]">Your support helps keep it that way.</p>
            </div>
          </div>
          <Link
            href="/support"
            className="px-4 py-2 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 text-[10px] font-extrabold uppercase tracking-wider transition-all hover:-translate-y-px shrink-0"
          >
            Support Koino
          </Link>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-white/[0.04]">
          <p className="text-[10px] text-[#475569]">
            © {year} Koino. All rights reserved. · Faith. Fellowship. Belong.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-[10px] text-[#475569] hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="text-[10px] text-[#475569] hover:text-white transition-colors">Privacy</Link>
            <Link href="/cookies" className="text-[10px] text-[#475569] hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
