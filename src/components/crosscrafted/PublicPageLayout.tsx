"use client";

import Image from "next/image";
import Link from "next/link";
import KoinoFooter from "@/components/crosscrafted/KoinoFooter";
import LanguageSwitcher from "@/components/crosscrafted/LanguageSwitcher";

// Shared layout for public pages (about, contact, partner, support, help, blog)
// Includes the Koino header + footer so all public pages feel like one platform.
export default function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#12101A] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#12101A]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/koino-logo.png"
              alt="Koino"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            <h1 className="text-base font-black tracking-tight text-white">Koino</h1>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#94A3B8]">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/help" className="hover:text-white transition-colors">Help</Link>
            <Link href="/partner" className="hover:text-white transition-colors">Partner</Link>
            <Link href="/support" className="hover:text-white transition-colors">Support</Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/"
              className="px-5 py-2.5 bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all hover:-translate-y-px"
            >
              Enter Koino
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <KoinoFooter />
    </div>
  );
}
