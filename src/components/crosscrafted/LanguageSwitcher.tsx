"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useLanguage, LANGUAGES, type LanguageCode } from "@/lib/i18n/LanguageContext";

/**
 * Language switcher dropdown — shown in the app header.
 *
 * - Compact globe icon when collapsed
 * - Click to open dropdown with all 13 supported languages (en + 12 Indian)
 * - Each option shows the language's native name (e.g. हिन्दी, தமிழ்)
 * - Selected language is persisted in a cookie (max-age 1 year)
 * - Auto-detects browser language on first visit
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (code: LanguageCode) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white hover:bg-white/[0.08] transition-all text-xs font-semibold"
        title={current.name}
        aria-label="Switch language"
        aria-expanded={open}
      >
        <Globe size={13} />
        {!compact && (
          <span className="hidden md:inline max-w-[80px] truncate">
            {current.nativeName}
          </span>
        )}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 max-h-96 overflow-y-auto bg-[#1C1929] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 z-50 py-1">
          <div className="px-3 py-2 border-b border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
              Choose your language
            </p>
          </div>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors ${
                l.code === lang ? "bg-[#9786E3]/10" : ""
              }`}
            >
              <span className="text-base shrink-0">{l.flag}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${l.code === lang ? "text-[#9786E3]" : "text-white"}`}>
                  {l.nativeName}
                </p>
                <p className="text-[9px] text-[#64748B] truncate">{l.name}</p>
              </div>
              {l.code === lang && <Check size={12} className="text-[#9786E3] shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
