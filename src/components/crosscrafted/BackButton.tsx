"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

// In-page back navigation for the public App Router pages (e.g. /knowledge).
// The HomeApp SPA surfaces have their own nav; these standalone pages had no
// way back except the logo (→ home). router.back() returns to the exact
// previous view; the fallbackHref covers direct visits with no history.
export default function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  const t = useTranslation();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED]/15 text-[#A78BFA] text-xs font-bold px-3 py-1.5 hover:bg-[#7C3AED]/25 transition-colors"
      aria-label={t("knowledge.back")}
    >
      <ArrowLeft size={13} />
      {t("knowledge.back")}
    </button>
  );
}
