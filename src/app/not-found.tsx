"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

// Branded 404 for every unmatched URL. Next.js renders this inside the root
// layout, so the LanguageProvider is present and the copy follows the
// visitor's language (English / Telugu) like the rest of the app.
export default function NotFound() {
  const t = useTranslation();
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 bg-[#0B1120]">
      <div className="text-center max-w-md py-16">
        <p className="text-6xl font-black text-[#A78BFA] mb-4" aria-hidden="true">
          404
        </p>
        <h1 className="text-xl font-bold text-white mb-2">{t("notFound.title")}</h1>
        <p className="text-sm text-slate-400 mb-6">{t("notFound.desc")}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold px-4 py-2 hover:bg-[#7C3AED]/85 transition-colors"
        >
          <Home size={13} />
          {t("notFound.home")}
        </Link>
      </div>
    </main>
  );
}
