"use client";

import Link from "next/link";
import { Heart, HeartHandshake, Library, BookOpen, Church, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { CONTENT_TYPES, CONTENT_TYPE_ROUTES } from "@/lib/content-taxonomy";
import { KNOWLEDGE_TYPE_KEYS } from "./knowledge-i18n";
import BackButton from "./BackButton";

// Localized UI chrome for the /knowledge hub — the server page (DB-backed,
// English metadata) passes the taxonomy data down; every visible string is
// rendered through the i18n dictionaries so Telugu users get a Telugu page.

export type HubCategory = {
  id: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  topics: { id: string; name: string; color: string | null }[];
};

// Small icon registry for seeded iconKey values (lucide names). Categories
// created later with an unknown iconKey fall back to the Library glyph.
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ShieldCheck,
  BookOpen,
  Heart,
  Church,
  Users,
  HeartHandshake,
};

export default function KnowledgeHubContent({ categories }: { categories: HubCategory[] }) {
  const t = useTranslation();

  return (
    <>
      {/* Back navigation — the page previously had no way back except the logo */}
      <div className="mb-6">
        <BackButton fallbackHref="/" />
      </div>

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED]/15 text-[#A78BFA] text-xs font-bold px-3 py-1 mb-4">
          <Library size={13} />
          {t("knowledge.badge")}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          {t("knowledge.title")}
        </h1>
        <p className="text-sm sm:text-base text-[#94A3B8] max-w-2xl mx-auto">
          {t("knowledge.subtitle")}
        </p>
      </div>

      {/* Content-type navigation — the six unified types. Every type has a
         REAL destination (see CONTENT_TYPE_ROUTES in content-taxonomy.ts):
         Blog and Apologetics keep their dedicated listings; the other four
         open the read-only /knowledge/browse listing. */}
      <section aria-label={t("knowledge.aria.contentTypes")} className="mb-12">
        <h2 className="text-sm font-bold text-white mb-3">{t("knowledge.byType")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CONTENT_TYPES.map((type) => (
            <Link
              key={type}
              href={CONTENT_TYPE_ROUTES[type]}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#7C3AED]/40 p-4 flex flex-col gap-1 transition-all"
            >
              <span className="text-sm font-bold text-white">
                {t(KNOWLEDGE_TYPE_KEYS[type].label)}
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                {t(KNOWLEDGE_TYPE_KEYS[type].desc)}
              </span>
              <span className="text-[11px] font-bold text-[#A78BFA]">{t("knowledge.browse")}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Category → topic navigation — DB-managed taxonomy */}
      <section aria-label={t("knowledge.aria.categories")}>
        <h2 className="text-sm font-bold text-white mb-3">{t("knowledge.byCategory")}</h2>
        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] p-10 text-center">
            <p className="text-sm font-bold text-white mb-1">{t("knowledge.warmingTitle")}</p>
            <p className="text-xs text-[#94A3B8]">{t("knowledge.warmingBody")}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {categories.map((c) => {
              const Icon = (c.iconKey && CATEGORY_ICONS[c.iconKey]) || Library;
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded-lg bg-[#7C3AED]/15 text-[#A78BFA] flex items-center justify-center shrink-0">
                      <Icon size={14} />
                    </span>
                    <h3 className="text-sm font-bold text-white">{c.name}</h3>
                  </div>
                  {c.description && (
                    <p className="text-[11px] text-[#94A3B8] mb-2">{c.description}</p>
                  )}
                  {c.topics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {c.topics.map((topic) => (
                        <span
                          key={topic.id}
                          className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#CBD5E1]"
                        >
                          {topic.color && (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: topic.color }}
                            />
                          )}
                          {topic.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#64748B]">{t("knowledge.noTopics")}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
