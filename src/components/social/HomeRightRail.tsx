"use client";

/**
 * Right-hand discovery column for the signed-in home (three-column layout).
 *
 * Spec: useful, data-driven community content only —
 *   1. People to follow      — real suggested members from /api/social/search
 *   2. Daily Bible verse     — real public-domain KJV scripture, deterministic
 *                              per calendar day, opens the existing Bible
 *                              reader at the passage (bibleTarget deep link)
 *   3. Upcoming events       — real PUBLISHED events from /api/events
 *   4. Trending discussions  — hashtags aggregated from the real engagement-
 *                              ranked trending feed (/api/social/posts?tab=trending)
 *
 * No fake users, counts, events or verses are ever rendered. Every section
 * hides itself (or renders a compact line) when its data is unavailable, and
 * every item links to an existing page or action. No new routes, no schema
 * changes — everything reuses existing working endpoints.
 */

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, MapPin, TrendingUp, Users } from "lucide-react";
import type { Post, SocialUser } from "./types";
import { api } from "./types";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Props = {
  onOpenProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onOpenEvents: () => void;
  /** Opens the existing Bible reader at a passage (page.tsx bibleTarget). */
  onOpenPassage: (bookId: string, chapter: number) => void;
};

type FeedEvent = {
  id: string;
  title: string;
  location: string;
  startDate: string;
};

// ─── Daily verse pool ────────────────────────────────────────────────────────
// Real, well-known Scripture in KJV (public domain). bookId/chapter match the
// existing Bible reader book ids (src/lib/bible-data.ts) so "Read passage"
// opens the actual chapter. Indexed by day-of-year so the verse is stable for
// the whole day and rotates daily — not random per render.
const DAILY_VERSES: { text: string; ref: string; bookId: string; chapter: number }[] = [
  { text: "I can do all things through Christ which strengtheneth me.", ref: "Philippians 4:13", bookId: "philippians", chapter: 4 },
  { text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.", ref: "John 3:16", bookId: "john", chapter: 3 },
  { text: "The LORD is my shepherd; I shall not want.", ref: "Psalm 23:1", bookId: "psalms", chapter: 23 },
  { text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding.", ref: "Proverbs 3:5", bookId: "proverbs", chapter: 3 },
  { text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.", ref: "Isaiah 41:10", bookId: "isaiah", chapter: 41 },
  { text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.", ref: "Jeremiah 29:11", bookId: "jeremiah", chapter: 29 },
  { text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.", ref: "Romans 8:28", bookId: "romans", chapter: 8 },
  { text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", ref: "Matthew 11:28", bookId: "matthew", chapter: 11 },
  { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.", ref: "Joshua 1:9", bookId: "joshua", chapter: 1 },
  { text: "God is our refuge and strength, a very present help in trouble.", ref: "Psalm 46:1", bookId: "psalms", chapter: 46 },
  { text: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,", ref: "1 Corinthians 13:4", bookId: "1corinthians", chapter: 13 },
  { text: "Now faith is the substance of things hoped for, the evidence of things not seen.", ref: "Hebrews 11:1", bookId: "hebrews", chapter: 11 },
  { text: "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,", ref: "Galatians 5:22", bookId: "galatians", chapter: 5 },
  { text: "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.", ref: "Lamentations 3:22-23", bookId: "lamentations", chapter: 3 },
];

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function SectionCard({ title, icon: Icon, children, action }: {
  title: string;
  icon?: typeof Users;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#111827]/60 border border-white/[0.05] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
          {Icon && <Icon size={13} />} {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function HomeRightRail({ onOpenProfile, onHashtag, onOpenEvents, onOpenPassage }: Props) {
  const t = useTranslation();
  const [suggested, setSuggested] = useState<SocialUser[]>([]);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [trendTags, setTrendTags] = useState<{ tag: string; count: number }[]>([]);

  // Deterministic daily verse — stable for the whole calendar day.
  const verse = useMemo(() => DAILY_VERSES[dayOfYear() % DAILY_VERSES.length], []);

  // People to follow — same endpoint the feed's suggestion rail uses
  // (suggested members, most-followed first).
  useEffect(() => {
    api<{ users: SocialUser[] }>("/api/social/search")
      .then((d) => setSuggested((d.users || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  // Upcoming events — public PUBLISHED-only endpoint, upcoming-first.
  useEffect(() => {
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d: { events?: FeedEvent[] }) => setEvents((d.events || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  // Trending discussions — aggregate hashtags across the real
  // engagement-ranked trending feed. Hidden entirely when none exist.
  useEffect(() => {
    api<{ posts: Post[] }>("/api/social/posts?tab=trending&limit=30")
      .then((d) => {
        const counts = new Map<string, number>();
        for (const p of d.posts || []) {
          for (const tag of p.hashtags || []) {
            const t = tag.toLowerCase();
            counts.set(t, (counts.get(t) || 0) + 1);
          }
        }
        const top = [...counts.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTrendTags(top);
      })
      .catch(() => {});
  }, []);

  const dateBadge = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return { day: d.getDate(), month: d.toLocaleString(undefined, { month: "short" }) };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ─── 1. PEOPLE TO FOLLOW ─── real suggested members; hidden when none */}
      {suggested.length > 0 && (
        <SectionCard title={t("feed.peopleToFollow")} icon={Users}>
          <div className="space-y-1">
            {suggested.map((u) => (
              <button
                key={u.id}
                onClick={() => u.username && onOpenProfile(u.username)}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.04] text-left transition-colors"
              >
                {u.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(u.name || u.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white truncate">{u.name || u.username}</p>
                  <p className="text-[11px] text-[#64748B] truncate">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ─── 2. DAILY BIBLE VERSE ─── real KJV scripture; opens the real reader */}
      <SectionCard title={t("rail.dailyVerse")} icon={BookOpen}>
        <p className="text-[13px] text-white italic leading-relaxed mb-2">&ldquo;{verse.text}&rdquo;</p>
        <p className="text-[11px] font-bold text-[#A78BFA] mb-3">&mdash; {verse.ref} (KJV)</p>
        <button
          onClick={() => onOpenPassage(verse.bookId, verse.chapter)}
          className="w-full py-2 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-xs font-bold text-[#C4B5FD] hover:bg-[#7C3AED]/25 transition-colors"
        >
          {t("rail.readInBible")}
        </button>
      </SectionCard>

      {/* ─── 3. UPCOMING EVENTS ─── real PUBLISHED events; hidden when none */}
      {events.length > 0 && (
        <SectionCard
          title={t("explore.upcomingEvents")}
          icon={CalendarDays}
          action={
            <button onClick={onOpenEvents} className="text-[10px] font-bold text-[#A78BFA] hover:text-white transition-colors">
              {t("common.seeAll")}
            </button>
          }
        >
          <div className="space-y-2">
            {events.map((ev) => {
              const badge = dateBadge(ev.startDate);
              return (
                <button
                  key={ev.id}
                  onClick={onOpenEvents}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] text-left transition-colors"
                >
                  {badge && (
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex flex-col items-center justify-center">
                      <span className="text-[13px] font-black text-white leading-none">{badge.day}</span>
                      <span className="text-[9px] font-bold text-[#A78BFA] uppercase">{badge.month}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-white truncate">{ev.title}</p>
                    {ev.location && (
                      <p className="text-[11px] text-[#64748B] truncate flex items-center gap-1">
                        <MapPin size={10} className="shrink-0" /> {ev.location}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ─── 4. TRENDING DISCUSSIONS ─── real hashtags from the trending feed */}
      {trendTags.length > 0 && (
        <SectionCard title={t("rail.trendingDiscussions")} icon={TrendingUp}>
          <div className="space-y-1">
            {trendTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => onHashtag(tag)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.04] text-left transition-colors"
              >
                <span className="text-[13px] font-bold text-[#38BDF8] truncate">#{tag}</span>
                <span className="text-[10px] text-[#64748B] shrink-0 ml-2">
                  {t("rail.postsCount", { count })}
                </span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
