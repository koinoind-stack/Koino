"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageContext";

/**
 * App providers wrapper.
 *
 * Currently wraps the app with:
 *   - LanguageProvider (i18n context — auto-detects browser language,
 *     persists user's choice in a cookie, exposes useTranslation() hook)
 *
 * Add any future client-side providers (themes, toasts) here.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
