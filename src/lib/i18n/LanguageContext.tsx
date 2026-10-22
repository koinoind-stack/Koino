"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

export type LanguageCode =
  | "en"  // English (default)
  | "hi"  // Hindi
  | "bn"  // Bengali
  | "te"  // Telugu
  | "mr"  // Marathi
  | "ta"  // Tamil
  | "gu"  // Gujarati
  | "ur"  // Urdu
  | "kn"  // Kannada
  | "or"  // Odia
  | "ml"  // Malayalam
  | "pa"  // Punjabi
  | "as"; // Assamese

export const LANGUAGES: { code: LanguageCode; name: string; nativeName: string; flag: string }[] = [
  { code: "en", name: "English",     nativeName: "English",     flag: "🇬🇧" },
  { code: "hi", name: "Hindi",       nativeName: "हिन्दी",       flag: "🇮🇳" },
  { code: "bn", name: "Bengali",     nativeName: "বাংলা",        flag: "🇮🇳" },
  { code: "te", name: "Telugu",      nativeName: "తెలుగు",       flag: "🇮🇳" },
  { code: "mr", name: "Marathi",     nativeName: "मराठी",         flag: "🇮🇳" },
  { code: "ta", name: "Tamil",       nativeName: "தமிழ்",         flag: "🇮🇳" },
  { code: "gu", name: "Gujarati",    nativeName: "ગુજરાતી",       flag: "🇮🇳" },
  { code: "ur", name: "Urdu",        nativeName: "اردو",          flag: "🇮🇳" },
  { code: "kn", name: "Kannada",     nativeName: "ಕನ್ನಡ",         flag: "🇮🇳" },
  { code: "or", name: "Odia",        nativeName: "ଓଡ଼ିଆ",         flag: "🇮🇳" },
  { code: "ml", name: "Malayalam",   nativeName: "മലയാളം",        flag: "🇮🇳" },
  { code: "pa", name: "Punjabi",     nativeName: "ਪੰਜਾਬੀ",         flag: "🇮🇳" },
  { code: "as", name: "Assamese",    nativeName: "অসমীয়া",       flag: "🇮🇳" },
];

const COOKIE_NAME = "believ_lang";
const DEFAULT_LANG: LanguageCode = "en";

type LanguageContextValue = {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
});

// Lazy-loaded translation modules. Each language file exports a flat
// dictionary of key → translated string.
const translationLoaders: Record<LanguageCode, () => Promise<Record<string, string>>> = {
  en: () => import("./en").then((m) => m.default),
  hi: () => import("./hi").then((m) => m.default),
  bn: () => import("./bn").then((m) => m.default),
  te: () => import("./te").then((m) => m.default),
  mr: () => import("./mr").then((m) => m.default),
  ta: () => import("./ta").then((m) => m.default),
  gu: () => import("./gu").then((m) => m.default),
  ur: () => import("./ur").then((m) => m.default),
  kn: () => import("./kn").then((m) => m.default),
  or: () => import("./or").then((m) => m.default),
  ml: () => import("./ml").then((m) => m.default),
  pa: () => import("./pa").then((m) => m.default),
  as: () => import("./as").then((m) => m.default),
};

// Cache loaded translations in memory so we don't re-fetch on every render.
const translationCache: Partial<Record<LanguageCode, Record<string, string>>> = {
  en: undefined, // loaded eagerly on first use
};

/** Detect the user's preferred language from cookie or browser. */
function detectLanguage(): LanguageCode {
  // 1. Cookie (set by LanguageSwitcher)
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
    if (match) {
      const code = match[1] as LanguageCode;
      if (translationLoaders[code]) return code;
    }
  }
  // 2. Browser language
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language.split("-")[0].toLowerCase() as LanguageCode;
    if (translationLoaders[browserLang]) return browserLang;
  }
  // 3. Default
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANG);
  const [dict, setDict] = useState<Record<string, string>>({});

  // Initial load — detect language + load its translation file
  useEffect(() => {
    const detected = detectLanguage();
    setLangState(detected);
  }, []);

  // Load translation file whenever lang changes
  useEffect(() => {
    let cancelled = false;
    if (translationCache[lang]) {
      setDict(translationCache[lang]!);
      return;
    }
    translationLoaders[lang]().then((loaded) => {
      if (cancelled) return;
      translationCache[lang] = loaded;
      setDict(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    // Persist for 1 year
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  /** Translate a key. Supports {var} interpolation. */
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let str = dict[key] ?? translationCache.en?.[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return str;
    },
    [dict]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  return useContext(LanguageContext).t;
}
