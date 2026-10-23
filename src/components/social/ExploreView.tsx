"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search, X, Play } from "lucide-react";
import type { Post, SocialUser } from "./types";
import { api } from "./types";
import PostCard from "./PostCard";
import PostDetail from "./PostDetail";
import { formatCount } from "@/lib/social/format";

type Props = {
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  initialHashtag?: string | null;
};

type SearchResults = {
  users: Array<SocialUser & { bio?: string | null; followers?: number }>;
  hashtags: Array<{ tag: string; count: number }>;
  posts: Post[];
};

/** Explore: search + hashtag grid + post grid + people suggestions. */
export default function ExploreView({ onOpenProfile, onHashtag, initialHashtag }: Props) {
  const [query, setQuery] = useState(initialHashtag ? `#${initialHashtag}` : "");
  const [results, setResults] = useState<SearchResults>({ users: [], hashtags: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(initialHashtag ?? null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const runSearch = useCallback(async (q: string, tag?: string | null) => {
    setLoading(true);
    try {
      let url: string;
      if (tag) {
        url = `/api/social/posts?hashtag=${encodeURIComponent(tag)}&limit=30`;
        const data = await api<{ posts: Post[] }>(url);
        setResults({ users: [], hashtags: [], posts: data.posts });
      } else if (!q.trim()) {
        setResults(await api<SearchResults>("/api/social/search"));
      } else {
        setResults(await api<SearchResults>(`/api/social/search?q=${encodeURIComponent(q)}`));
      }
    } catch {
      setResults({ users: [], hashtags: [], posts: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(query, activeHashtag);
  }, [activeHashtag, runSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  function onQueryChange(v: string) {
    setQuery(v);
    setActiveHashtag(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 350);
  }

  return (
    <div className="max-w-[680px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      {/* search box */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search people, posts, #hashtags…"
          className="w-full bg-white/[0.05] border border-white/10 rounded-full pl-10 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#7C3AED]"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setActiveHashtag(null); onHashtag(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10"
          >
            <X size={14} className="text-[#94A3B8]" />
          </button>
        )}
      </div>

      {activeHashtag && (
        <div className="flex items-center justify-between bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-2xl px-4 py-3 mb-4">
          <p className="text-sm font-extrabold text-white">#{activeHashtag}</p>
          <button onClick={() => { setActiveHashtag(null); onHashtag(""); }} className="text-xs font-bold text-[#A78BFA]">Clear</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* users */}
          {results.users.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">People</h3>
              <div className="space-y-1">
                {results.users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => u.username && onOpenProfile(u.username)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.04] text-left"
                  >
                    {u.image ? (
                      <Image src={u.image} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" unoptimized />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold">
                        {(u.name || u.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{u.name || u.username}</p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        @{u.username}
                        {u.followers !== undefined && ` · ${formatCount(u.followers)} followers`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* hashtags */}
          {results.hashtags.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Hashtags</h3>
              <div className="flex flex-wrap gap-2">
                {results.hashtags.map((h) => (
                  <button
                    key={h.tag}
                    onClick={() => { setActiveHashtag(h.tag); onHashtag(h.tag); }}
                    className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-sm font-bold text-[#38BDF8] hover:border-[#38BDF8]/50"
                  >
                    #{h.tag} <span className="text-[#64748B] text-xs">· {formatCount(h.count)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* post grid */}
          {results.posts.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">Posts</h3>
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {results.posts.map((p) => {
                  const media = p.repostedFrom ?? p;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setDetailId(p.id)}
                      className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.04] group"
                    >
                      {media.mediaType === "video" ? (
                        <>
                          {media.thumbnailUrl ? (
                            <Image src={media.thumbnailUrl} alt="" fill sizes="220px" className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-black/40">
                              <Play size={22} className="text-white/70" />
                            </div>
                          )}
                          <Play size={14} className="absolute top-2 right-2 text-white drop-shadow" />
                        </>
                      ) : media.mediaUrls[0] ? (
                        <Image src={media.mediaUrls[0]} alt="" fill sizes="220px" className="object-cover" unoptimized />
                      ) : (
                        <p className="p-2 text-[10px] text-[#94A3B8] line-clamp-6 text-left">{p.content}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && results.users.length === 0 && results.hashtags.length === 0 && results.posts.length === 0 && (
            <p className="text-center text-sm text-[#64748B] py-14">Nothing found. Try a different search.</p>
          )}
        </div>
      )}

      {detailId && (
        <PostDetail
          postId={detailId}
          onClose={() => setDetailId(null)}
          onOpenProfile={onOpenProfile}
          onHashtag={(tag) => { setDetailId(null); setActiveHashtag(tag); onHashtag(tag); }}
        />
      )}
    </div>
  );
}
