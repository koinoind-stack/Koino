"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Play, BadgeCheck, MoreHorizontal, Flag, Ban, Globe, Instagram, Youtube, Facebook, Twitter, Church } from "lucide-react";
import { toast } from "sonner";
import type { Post, SocialUser } from "./types";
import { api } from "./types";
import PostDetail from "./PostDetail";
import { formatCount } from "@/lib/social/format";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { resolvedCommunityRoleLabel } from "@/lib/community-roles";

type Props = {
  username: string;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onEditProfile?: () => void;
};

type ProfileData = {
  user: SocialUser & {
    bio?: string | null;
    state?: string | null;
    city?: string | null;
    createdAt?: string;
    role?: string | null;
    website?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    communityRole?: string | null;
    communityRoleOther?: string | null;
  };
  counters: { followers: number; following: number; posts: number };
  isSelf: boolean;
  viewerFollows: boolean;
  faith?: {
    points: number;
    tier: string | null;
    tierIcon: string | null;
    badges: { id: string; name: string; icon: string; description: string; unlockedAt: string }[];
  };
  posts: Post[];
  nextCursor: string | null;
};

/** Profile link chips (public, under the bio). Order + labels + icons.
 *  i18nKey = dictionary key; label = literal fallback for strings that have
 *  no key yet (Instagram/YouTube/Facebook are brand names anyway). */
const PROFILE_LINKS: {
  key: "website" | "instagram" | "youtube" | "facebook" | "twitter";
  i18nKey?: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "website", i18nKey: "profile.link.website", label: "Website", Icon: Globe },
  { key: "instagram", label: "Instagram", Icon: Instagram },
  { key: "youtube", label: "YouTube", Icon: Youtube },
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "twitter", i18nKey: "profile.link.twitter", label: "X (Twitter)", Icon: Twitter },
];

/** Short chip label from a stored link: hostname, or @handle for platforms. */
function linkChipLabel(key: string, url: string): string {
  try {
    const u = new URL(url);
    if (key === "website") return u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || u.hostname;
    return "@" + decodeURIComponent(last).replace(/^@/, "");
  } catch {
    return url.slice(0, 40);
  }
}

/** Instagram-style profile: header, counters, Posts/Reels/Saved tabs, grid. */
export default function SocialProfileView({ username, onBack, onOpenProfile, onHashtag, onEditProfile }: Props) {
  const t = useTranslation();
  const [data, setData] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<"posts" | "reels" | "saved">("posts");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (nextTab: "posts" | "reels" | "saved", cursor?: string) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await api<ProfileData>(
          `/api/social/users/${encodeURIComponent(username)}?tab=${nextTab}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        setData((prev) =>
          cursor && prev && prev.user.id === res.user.id
            ? { ...res, posts: [...prev.posts, ...res.posts] }
            : res,
        );
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [username],
  );

  useEffect(() => {
    setTab("posts");
    load("posts");
  }, [username, load]);

  useEffect(() => {
    if (tab === "saved" && data?.isSelf) load("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && data?.nextCursor && !loadingMore) {
          load(tab, data.nextCursor);
        }
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [data, loadingMore, tab, load]);

  async function toggleFollow() {
    if (!data || busy) return;
    setBusy(true);
    const prev = data;
    setData({
      ...data,
      viewerFollows: !data.viewerFollows,
      counters: {
        ...data.counters,
        followers: data.counters.followers + (data.viewerFollows ? -1 : 1),
      },
    });
    try {
      const res = await api<{ following: boolean }>(
        `/api/social/users/${encodeURIComponent(username)}/follow`,
        { method: "POST" },
      );
      setData((d) => (d ? { ...d, viewerFollows: res.following } : d));
    } catch (err) {
      setData(prev);
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!data) return;
    setMenuOpen(false);
    try {
      await api("/api/social/report", {
        method: "POST",
        body: JSON.stringify({ targetType: "user", targetId: data.user.id, reason: "inappropriate" }),
      });
      toast.success("Report submitted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function block() {
    if (!data) return;
    setMenuOpen(false);
    if (!confirm(`Block @${username}? You won't see each other's content.`)) return;
    try {
      await api("/api/social/block", { method: "POST", body: JSON.stringify({ username }) });
      toast.success("Blocked");
      onBack();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }
  if (!data) {
    // Fetch failed (or profile unavailable) — never render a blank page.
    return (
      <div className="max-w-[680px] mx-auto px-3 md:px-4 pt-20 pb-24 text-center">
        <h2 className="text-lg font-bold text-white mb-1">{t("profile.unavailable")}</h2>
        <p className="text-sm text-[#94A3B8] mb-6">
          {t("profile.unavailableBody")}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-full bg-white/5 text-white text-sm font-semibold hover:bg-white/10"
          >
            {t("profile.backHome")}
          </button>
          <button
            onClick={() => load(tab)}
            className="px-4 py-2 rounded-full bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8]"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  const gridPosts = data.posts;
  const tabs: Array<{ id: "posts" | "reels" | "saved"; label: string }> = [
    { id: "posts", label: t("explore.tab.posts") },
    { id: "reels", label: t("explore.tab.reels") },
    ...(data.isSelf ? [{ id: "saved" as const, label: t("profile.tab.saved") }] : []),
  ];

  return (
    <div className="max-w-[680px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      {/* header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft size={18} className="text-[#94A3B8]" />
        </button>
        <h1 className="text-lg font-extrabold text-white flex items-center gap-1">
          @{username}
          {data.user.verified && <BadgeCheck size={16} className="text-[#22D3EE]" />}
        </h1>
        <div className="flex-1" />
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-2 rounded-full hover:bg-white/5">
            <MoreHorizontal size={18} className="text-[#94A3B8]" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-50 w-44 bg-[#13294A] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                <button onClick={report} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5">
                  <Flag size={15} /> Report
                </button>
                {!data.isSelf && (
                  <button onClick={block} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
                    <Ban size={15} /> Block
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* identity row */}
      <div className="flex items-center gap-5 mb-5">
        {data.user.image ? (
          <Image src={data.user.image} alt="" width={80} height={80} className="w-20 h-20 rounded-full object-cover" unoptimized />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white text-2xl font-black">
            {(data.user.name || data.user.username || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-lg font-extrabold text-white">{formatCount(data.counters.posts)}</p>
            <p className="text-[11px] text-[#64748B]">{t("profile.count.posts")}</p>
          </div>
          <button onClick={() => setFollowModal("followers")}>
            <p className="text-lg font-extrabold text-white">{formatCount(data.counters.followers)}</p>
            <p className="text-[11px] text-[#64748B]">{t("profile.count.followers")}</p>
          </button>
          <button onClick={() => setFollowModal("following")}>
            <p className="text-lg font-extrabold text-white">{formatCount(data.counters.following)}</p>
            <p className="text-[11px] text-[#64748B]">{t("profile.count.following")}</p>
          </button>
        </div>
      </div>

      {/* bio */}
      <div className="mb-4">
        <p className="text-sm font-bold text-white flex items-center gap-1.5">
          {data.user.name}
          {data.user.role === "admin" && (
            <span
              title={t("profile.adminTitle")}
              className="shrink-0 px-1.5 py-px rounded bg-gradient-to-r from-[#2563EB] to-[#F97316] text-[8px] font-extrabold text-white uppercase tracking-wide leading-none"
            >
              {t("group.role.admin")}
            </span>
          )}
        </p>
        {data.user.bio && <p className="text-[13px] text-[#CBD5E1] mt-1 whitespace-pre-wrap">{data.user.bio}</p>}
        {(data.user.state || data.user.city) && (
          <p className="text-[11px] text-[#64748B] mt-1">
            📍 {[data.user.city, data.user.state].filter(Boolean).join(", ")}
          </p>
        )}
        {(() => {
          // Self-reported community role — the API only returns it when the
          // user opted in (communityRoleVisible). Never a verified title.
          const roleLabel = resolvedCommunityRoleLabel(data.user.communityRole, data.user.communityRoleOther);
          if (!roleLabel) return null;
          return (
            <span
              title={t("profile.communityRoleTitle")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2563EB]/10 border border-[#2563EB]/30 text-[11px] font-bold text-[#93C5FD] mt-2.5"
            >
              <Church size={12} className="text-[#2563EB]" />
              {roleLabel}
            </span>
          );
        })()}
        {(() => {
          const links = PROFILE_LINKS.flatMap(({ key, i18nKey, label, Icon }) => {
            const url = data.user[key];
            const displayLabel = i18nKey ? t(i18nKey) : label;
            return url ? [{ key, label: displayLabel, Icon, url }] : [];
          });
          if (links.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {links.map(({ key, label, Icon, url }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={url}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-bold text-[#CBD5E1] hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Icon size={12} className="text-[#2563EB]" />
                  {key === "website" ? label : linkChipLabel(key, url)}
                  <span className="text-[#64748B] font-semibold">· {label}</span>
                </a>
              ))}
            </div>
          );
        })()}
      </div>

      {/* faith journey — FP balance + badges actually unlocked (server-verified) */}
      {data.faith && (data.faith.points > 0 || data.faith.badges.length > 0) && (
        <div className="mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5B84A]/10 border border-[#F5B84A]/30 text-[11px] font-extrabold text-[#FCD34D]">
              ⚡ {t("common.faithPoints", { count: data.faith.points.toLocaleString() })}
            </span>
            {data.faith.tier && (
              <span
                title={t("profile.tierTitle")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2563EB]/10 border border-[#2563EB]/30 text-[11px] font-bold text-[#93C5FD]"
              >
                {data.faith.tierIcon && <span>{data.faith.tierIcon}</span>}
                {data.faith.tier}
              </span>
            )}
          </div>
          {data.faith.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {data.faith.badges.map((b) => (
                <span
                  key={b.id}
                  title={t("profile.badgeUnlockedTitle", { description: b.description, date: new Date(b.unlockedAt).toLocaleDateString() })}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-bold text-[#CBD5E1]"
                >
                  <span aria-hidden>{b.icon}</span>
                  {b.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 mb-5">
        {data.isSelf ? (
          <button
            onClick={onEditProfile}
            className="flex-1 py-2.5 rounded-2xl bg-white/[0.06] border border-white/10 text-sm font-bold text-white hover:bg-white/10"
          >
            {t("profile.edit")}
          </button>
        ) : (
          <button
            onClick={toggleFollow}
            disabled={busy}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${
              data.viewerFollows
                ? "bg-white/[0.06] border border-white/10 text-white hover:bg-white/10"
                : "bg-[#2563EB] text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
            }`}
          >
            {data.viewerFollows ? t("churches.following") : t("churches.follow")}
          </button>
        )}
      </div>

      {/* tabs */}
      <div className="flex border-t border-white/[0.06] mb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wider border-t-2 -mt-px transition-all ${
              tab === t.id ? "border-white text-white" : "border-transparent text-[#64748B] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* grid */}
      {gridPosts.length === 0 ? (
        <p className="text-center text-sm text-[#64748B] py-14">
          {tab === "saved" ? t("profile.emptySaved") : tab === "reels" ? t("profile.emptyReels") : t("profile.emptyPosts")}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-2">
          {gridPosts.map((p) => {
            const media = p.repostedFrom ?? p;
            return (
              <button
                key={p.id}
                onClick={() => setDetailId(p.id)}
                className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.04]"
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
      )}
      <div ref={sentinel} />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      )}

      {/* overlays */}
      {detailId && (
        <PostDetail
          postId={detailId}
          onClose={() => { setDetailId(null); load(tab); }}
          onOpenProfile={onOpenProfile}
          onHashtag={onHashtag}
        />
      )}
      {followModal && (
        <FollowListModal
          username={username}
          list={followModal}
          onClose={() => setFollowModal(null)}
          onOpenProfile={(u) => { setFollowModal(null); onOpenProfile(u); }}
        />
      )}
    </div>
  );
}

function FollowListModal({
  username,
  list,
  onClose,
  onOpenProfile,
}: {
  username: string;
  list: "followers" | "following";
  onClose: () => void;
  onOpenProfile: (username: string) => void;
}) {
  const t = useTranslation();
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await api<{ users: SocialUser[] }>(
          `/api/social/users/${encodeURIComponent(username)}/follow?list=${list}&page=${p}`,
        );
        setUsers((prev) => (p === 0 ? res.users : [...prev, ...res.users]));
        setHasMore(res.users.length === 50);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [username, list],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#071120] border border-white/10 rounded-t-[28px] md:rounded-[24px] w-full md:max-w-sm max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="font-extrabold text-white capitalize">{t(list === "followers" ? "profile.followersHeading" : "profile.count.following")}</h2>
          <button onClick={onClose} className="text-[#94A3B8] text-sm font-bold">{t("profile.done")}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => u.username && onOpenProfile(u.username)}
              className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.04] text-left"
            >
              {u.image ? (
                <Image src={u.image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" unoptimized />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#F97316] flex items-center justify-center text-white font-bold text-sm">
                  {(u.name || u.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{u.name || u.username}</p>
                <p className="text-[11px] text-[#64748B]">@{u.username}</p>
              </div>
            </button>
          ))}
          {loading && <p className="text-center text-xs text-[#64748B] py-4">Loading…</p>}
          {!loading && hasMore && (
            <button onClick={() => { const p = page + 1; setPage(p); load(p); }} className="w-full py-3 text-xs font-bold text-[#2563EB]">
              {t("profile.loadMore")}
            </button>
          )}
          {!loading && users.length === 0 && <p className="text-center text-xs text-[#64748B] py-6">{t("profile.nobodyYet")}</p>}
        </div>
      </div>
    </div>
  );
}
