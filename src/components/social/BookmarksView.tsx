"use client";

/**
 * Bookmarks — the viewer's saved posts (sidebar "Bookmarks" destination).
 *
 * Real data only: GET /api/social/bookmarks (auth required, keyset cursor on
 * the bookmark row) returns the same serialized Post shape as the feed, so
 * rendering reuses the existing PostCard + PostDetail overlays unchanged.
 * An empty state is shown when nothing is saved yet; a section with an error
 * offers a retry. Nothing is fabricated.
 */

import { useCallback, useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import PostCard from "./PostCard";
import PostDetail from "./PostDetail";
import type { Post } from "./types";
import { api } from "./types";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Props = {
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
};

export default function BookmarksView({ onOpenProfile, onHashtag }: Props) {
  const t = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api<{ posts: Post[]; nextCursor: string | null }>(
        `/api/social/bookmarks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function refreshAll() {
    load();
  }

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-5 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#2563EB]/15 border border-[#2563EB]/25 flex items-center justify-center">
          <Bookmark size={17} className="text-[#60A5FA]" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-white leading-tight">{t("side.bookmarks")}</h1>
          <p className="text-[11px] text-[#64748B]">{t("bookmarks.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#0F2038]/60 border border-white/[0.05] rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3 items-center mb-4">
                <div className="w-9 h-9 rounded-full bg-white/10" />
                <div className="space-y-1.5">
                  <div className="w-28 h-3 bg-white/10 rounded" />
                  <div className="w-16 h-2 bg-white/5 rounded" />
                </div>
              </div>
              <div className="w-full h-40 bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-sm text-[#94A3B8] mb-3">{error}</p>
          <button onClick={() => load()} className="text-xs font-bold text-[#60A5FA]">
            {t("common.retry")}
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-4">
            <Bookmark size={24} className="text-[#64748B]" />
          </div>
          <p className="text-sm text-[#94A3B8] max-w-xs mx-auto">{t("bookmarks.empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onOpenDetail={(p) => setDetailId(p.id)}
              onOpenProfile={onOpenProfile}
              onHashtag={onHashtag}
              onChanged={refreshAll}
            />
          ))}
          {nextCursor && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => load(nextCursor)}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-[#94A3B8] hover:text-white hover:bg-white/[0.07] transition-all disabled:opacity-50"
              >
                {loadingMore ? t("common.loading") : t("common.loadMore")}
              </button>
            </div>
          )}
        </div>
      )}

      {detailId && (
        <PostDetail
          postId={detailId}
          onClose={() => setDetailId(null)}
          onOpenProfile={onOpenProfile}
          onHashtag={onHashtag}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
}
