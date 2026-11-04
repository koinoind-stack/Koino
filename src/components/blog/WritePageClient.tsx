"use client";

/**
 * WritePageClient (Task 73) — auth-gated member writing page: the article
 * editor plus the author's own submission list with status tracking.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn, PenLine } from "lucide-react";
import ArticleEditor, { type ArticleEditorInitial } from "./ArticleEditor";
import MyArticles, { type MyArticle } from "./MyArticles";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { useTranslation } from "@/lib/i18n/LanguageContext";

function toEditorInitial(a: MyArticle): ArticleEditorInitial {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(a.tags || "[]");
    if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === "string");
  } catch {
    /* legacy CSV */
  }
  return {
    id: a.id,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    tags,
    coverImageUrl: a.featuredImage,
    status: a.status,
  };
}

export default function WritePageClient() {
  const t = useTranslation();
  const { isAuthenticated, loading: userLoading } = useSupabaseUser();
  const [editing, setEditing] = useState<MyArticle | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="py-12 px-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A09DB1] hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={13} /> {t("blog.write.back")}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 flex items-center gap-2.5">
          <PenLine size={24} className="text-[#F39B9B]" />
          {editing ? t("blog.write.editTitle") : t("blog.write.writeTitle")}
        </h1>
        <p className="text-sm text-[#A09DB1] leading-relaxed">
          {t("blog.write.subtitle")}
        </p>
      </div>

      {userLoading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-8 text-center text-sm text-[#A09DB1]">
          {t("blog.write.checking")}
        </div>
      ) : !isAuthenticated ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-8 text-center">
          <LogIn size={22} className="mx-auto mb-3 text-[#F39B9B]" />
          <p className="text-sm font-bold text-white mb-1.5">{t("blog.write.signinTitle")}</p>
          <p className="text-xs text-[#A09DB1] mb-5 leading-relaxed">
            {t("blog.write.signinBody")}
          </p>
          <Link
            href="/auth/signin"
            className="inline-block rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] px-6 py-3 text-xs font-extrabold text-slate-950 uppercase tracking-wider transition-colors"
          >
            {t("blog.write.signinCta")}
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/[0.06] bg-[#131020] p-5 sm:p-6 mb-8">
            <ArticleEditor
              key={editing?.id ?? "new"}
              initial={editing ? toEditorInitial(editing) : undefined}
              onCancel={
                editing
                  ? () => setEditing(null)
                  : undefined
              }
              onSaved={bump}
              onSubmitted={() => {
                setEditing(null);
                bump();
              }}
            />
          </div>
          <MyArticles
            refreshKey={refreshKey}
            onEdit={(a) => {
              setEditing(a);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}
    </div>
  );
}
