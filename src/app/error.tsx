"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

// Route-level error boundary. Without this file an uncaught render/data error
// in any route shows Next.js's plain default error page; this keeps the
// branded shell and gives the visitor a one-click retry (reset re-renders
// the route segment server components).
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslation();
  useEffect(() => {
    console.error("[app-error-boundary]", error);
  }, [error]);
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 bg-[#0B1120]">
      <div className="text-center max-w-md py-16">
        <p className="text-4xl mb-4" aria-hidden="true">
          ⚠️
        </p>
        <h1 className="text-xl font-bold text-white mb-2">{t("error.title")}</h1>
        <p className="text-sm text-slate-400 mb-6">{t("error.desc")}</p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold px-4 py-2 hover:bg-[#7C3AED]/85 transition-colors"
        >
          <RefreshCw size={13} />
          {t("error.retry")}
        </button>
      </div>
    </main>
  );
}
