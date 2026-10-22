"use client";

import { Globe, ArrowRight, ExternalLink } from "lucide-react";

type Variant = "default" | "compact" | "feature" | "inline" | "result" | "conversion";

type Props = {
  title?: string;
  description?: string;
  buttonText?: string;
  /** Secondary (less-dominant) CTA label, e.g. "I already have a Lordsbook account". */
  secondaryButtonText?: string;
  /** Short microcopy shown under the primary CTA on the conversion variant. */
  microcopy?: string;
  context?: string;
  variant?: Variant;
};

// Default destination: Lordsbook homepage (general exploration).
// The conversion variant uses the Lordsbook signin/account page so the user
// can either CREATE ACCOUNT or SIGN IN — see LORDSBOOK_SIGNIN_URL below.
const LORDSBOOK_URL = "https://www.lordsbook.com/";
const LORDSBOOK_SIGNIN_URL = "https://lordsbook.com/signin";

/**
 * Reusable Lordsbook community CTA card.
 * Modular — can be removed without affecting any Koino feature.
 *
 * Phase 3 (conversion): adds a `conversion` variant with a primary
 * ("JOIN THE GLOBAL CHRISTIAN COMMUNITY") + secondary ("I ALREADY HAVE A
 * LORDSBOOK ACCOUNT") CTA. Both open https://lordsbook.com/signin in a new
 * tab with safe `noopener noreferrer`. The Lordsbook signin page lets the
 * user CREATE ACCOUNT or SIGN IN — Koino does NOT collect Lordsbook
 * credentials and does NOT implement SSO.
 */
export default function LordsbookCommunityCard({
  title = "Meet Christians Around the World",
  description = "Connect with Christians around the world, share your faith, join conversations and build meaningful Christian friendships on Lordsbook.",
  buttonText = "Meet Christians on Lordsbook",
  secondaryButtonText = "I already have a Lordsbook account",
  microcopy = "Create your free Lordsbook account and start connecting with Christians around the world.",
  context = "home",
  variant = "default",
}: Props) {
  // Standard single-CTA click handler — opens Lordsbook homepage in a new tab.
  const handleClick = () => {
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "lordsbook_cta_click", source: context, variant }),
      }).catch(() => {});
    } catch {}
    window.open(LORDSBOOK_URL, "_blank", "noopener,noreferrer");
  };

  // Conversion variant click handler — opens Lordsbook signin/account page.
  // source disambiguates the primary vs secondary CTA for analytics.
  const handleConversionClick = (which: "primary" | "secondary") => {
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lordsbook_cta_click",
          source: which === "primary" ? `${context}_join` : `${context}_signin`,
          variant,
        }),
      }).catch(() => {});
    } catch {}
    window.open(LORDSBOOK_SIGNIN_URL, "_blank", "noopener,noreferrer");
  };

  if (variant === "compact" || variant === "inline") {
    return (
      <div className="bg-gradient-to-br from-[#0D1A2E] to-[#1C1929] border border-[#38BDF8]/15 rounded-xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#38BDF8] to-[#7C3AED] flex items-center justify-center shrink-0">
          <Globe size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-white truncate">{title}</p>
          <p className="text-[9px] text-[#94A3B8] line-clamp-2">{description}</p>
        </div>
        <button
          onClick={handleClick}
          aria-label={`${buttonText} — opens Lordsbook in a new tab`}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#7C3AED] text-white text-[9px] font-bold uppercase tracking-wider shrink-0 hover:opacity-90 transition-opacity flex items-center gap-1"
        >
          {buttonText} <ArrowRight size={10} />
        </button>
      </div>
    );
  }

  if (variant === "result") {
    return (
      <div className="bg-gradient-to-br from-[#0D1A2E] via-[#1C1929] to-[#1A0D2E] border border-[#38BDF8]/15 rounded-2xl p-4 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-[#38BDF8] to-[#7C3AED] flex items-center justify-center">
          <Globe size={18} className="text-white" />
        </div>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#38BDF8] mb-1">Meet Christians Around the World</p>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed mb-3">{description}</p>
        <button
          onClick={handleClick}
          aria-label={`${buttonText} — opens Lordsbook in a new tab`}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#7C3AED] text-white text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
        >
          {buttonText} <ArrowRight size={12} />
        </button>
      </div>
    );
  }

  if (variant === "feature") {
    return (
      <div className="bg-gradient-to-br from-[#1C1929] to-[#0D1A2E] border border-[#38BDF8]/15 rounded-2xl p-5 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#38BDF8] to-[#7C3AED] flex items-center justify-center">
          <Globe size={22} className="text-white" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed mb-3">{description}</p>
        <button
          onClick={handleClick}
          aria-label={`${buttonText} — opens Lordsbook in a new tab`}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#7C3AED] text-white text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
        >
          {buttonText} <ArrowRight size={12} />
        </button>
      </div>
    );
  }

  if (variant === "conversion") {
    // Phase 3 conversion variant — strong dual-CTO block.
    // Primary: gradient-filled, large, dominant.
    // Secondary: outline / subtle, smaller, but clearly visible.
    // Both open LORDSBOOK_SIGNIN_URL in a new tab with safe rel attributes.
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Primary CTA — visually dominant */}
        <button
          onClick={() => handleConversionClick("primary")}
          aria-label={`${buttonText} — opens Lordsbook in a new tab`}
          className="w-full sm:w-auto px-7 sm:px-8 py-4 rounded-2xl bg-gradient-to-r from-[#38BDF8] to-[#7C3AED] text-white text-sm sm:text-base font-extrabold uppercase tracking-wider shadow-lg shadow-[#38BDF8]/25 inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity min-h-[52px]"
        >
          {buttonText} <ArrowRight size={18} strokeWidth={2.5} />
        </button>

        {/* Microcopy — reassuring, no payment mention */}
        {microcopy && (
          <p className="text-[11px] sm:text-xs text-[#94A3B8] text-center max-w-md leading-relaxed">
            {microcopy}
          </p>
        )}

        {/* Secondary CTA — clearly visible but less dominant */}
        <button
          onClick={() => handleConversionClick("secondary")}
          aria-label={`${secondaryButtonText} — opens Lordsbook in a new tab`}
          className="w-full sm:w-auto mt-1 px-5 py-3 rounded-2xl border border-white/[0.12] bg-white/[0.03] text-[#A09DB1] hover:text-white hover:bg-white/[0.06] text-xs sm:text-sm font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1.5 min-h-[44px]"
        >
          {secondaryButtonText} <ExternalLink size={14} />
        </button>
      </div>
    );
  }

  // Default: full-width promotional card
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1A2E] via-[#1C1929] to-[#1A0D2E] border border-[#38BDF8]/15 p-5">
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#38BDF8]/8 blur-2xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-[#7C3AED]/8 blur-2xl rounded-full pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#38BDF8] to-[#7C3AED] flex items-center justify-center shrink-0 shadow-lg shadow-[#38BDF8]/20">
          <Globe size={24} className="text-white" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#38BDF8] mb-1">🌍 Meet Christians Around the World</p>
          <h3 className="text-base font-bold text-white mb-1">{title}</h3>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed max-w-md">{description}</p>
          <p className="text-[9px] text-[#475569] mt-1">Global Christian Community</p>
        </div>
        <button
          onClick={handleClick}
          aria-label={`${buttonText} — opens Lordsbook in a new tab`}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider hover:opacity-90 transition-opacity shrink-0 flex items-center gap-2 shadow-lg shadow-[#38BDF8]/20"
        >
          {buttonText} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
