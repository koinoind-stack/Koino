"use client";

/**
 * <T k="key" vars={{ n: 1 }} /> — a tiny client-side translation node for
 * SERVER-rendered static pages (no hooks allowed there). Renders nothing but
 * the translated string; hydration-stable because LanguageContext seeds the
 * English dictionary synchronously (same text on server and first client
 * render). See src/lib/i18n/LanguageContext.tsx.
 */

import { useTranslation } from "@/lib/i18n/LanguageContext";

export function T({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  const t = useTranslation();
  return <>{t(k, vars)}</>;
}
