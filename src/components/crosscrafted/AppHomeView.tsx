"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Sparkles,
  Search,
  Calendar,
  Award,
  HeartHandshake,
  Store,
  Building2,
  ArrowRight,
} from "lucide-react";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import LordsbookCommunityCard from "@/components/crosscrafted/LordsbookCommunityCard";

type View =
  | "bible"
  | "comic"
  | "churches"
  | "events"
  | "trivia"
  | "prayer-wall"
  | "shop"
  | "business-directory";

type Props = {
  /** Navigate to a feature view. The parent (page.tsx) wires this to goView(). */
  onNavigate: (view: View) => void;
};

type FeatureCard = {
  icon: typeof BookOpen;
  color: string;
  title: string;
  desc: string;
  view: View;
  group: "FAITH" | "CONNECT" | "GROW" | "PLAY" | "DISCOVER";
};

// Public shape returned by GET /api/blog/latest. Only the fields the App Home
// cards need — never exposes draft content or admin fields.
type BlogCardData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  category: string;
  author: string | null;
  publishedAt: string | null; // ISO string (serialized by the API)
};

// Single source of truth for the App Home feature grid.
// Each card links to an existing feature — no fake functionality.
const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: BookOpen,
    color: "#7C3AED",
    title: "Holy Bible",
    desc: "Read Scripture and explore Bible resources.",
    view: "bible",
    group: "FAITH",
  },
  {
    icon: Sparkles,
    color: "#EC4899",
    title: "Bible Comics",
    desc: "Experience Bible stories through original visual storytelling.",
    view: "comic",
    group: "PLAY",
  },
  {
    icon: Search,
    color: "#F39B9B",
    title: "Churches",
    desc: "Discover Christian churches and congregations by location.",
    view: "churches",
    group: "CONNECT",
  },
  {
    icon: Calendar,
    color: "#38BDF8",
    title: "Events",
    desc: "Discover Christian events and gatherings near you.",
    view: "events",
    group: "CONNECT",
  },
  {
    icon: HeartHandshake,
    color: "#F59E0B",
    title: "Prayer Wall",
    desc: "Share prayer requests and pray for others.",
    view: "prayer-wall",
    group: "CONNECT",
  },
  {
    icon: Award,
    color: "#22C55E",
    title: "Bible Trivia",
    desc: "Test your Bible knowledge and earn Faith Points.",
    view: "trivia",
    group: "PLAY",
  },
  {
    icon: Store,
    color: "#9786E3",
    title: "Marketplace",
    desc: "Discover Christian products and connect with sellers.",
    view: "shop",
    group: "DISCOVER",
  },
  {
    icon: Building2,
    color: "#0EA5E9",
    title: "Business Directory",
    desc: "Discover Christian businesses, services and professionals.",
    view: "business-directory",
    group: "DISCOVER",
  },
];

const GROUPS: { label: string; color: string }[] = [
  { label: "FAITH", color: "#7C3AED" },
  { label: "CONNECT", color: "#F39B9B" },
  { label: "GROW", color: "#38BDF8" },
  { label: "PLAY", color: "#EC4899" },
  { label: "DISCOVER", color: "#0EA5E9" },
];

export default function AppHomeView({ onNavigate }: Props) {
  const t = useTranslation();
  const { user, isAuthenticated } = useSupabaseUser();

  // ─── Latest blog posts ("Latest from Koino") ───
  // Loaded client-side on mount. The section is only rendered when posts
  // exist — on error or empty list it stays hidden (no skeleton, no empty
  // state) to keep the App Home clean.
  const [blogPosts, setBlogPosts] = useState<BlogCardData[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/blog/latest?limit=3", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setBlogPosts([]);
          return;
        }
        const data = (await res.json()) as { posts?: BlogCardData[] };
        if (!cancelled) {
          setBlogPosts(Array.isArray(data.posts) ? data.posts : []);
        }
      } catch {
        // Silently hide the section on network/parse error.
        if (!cancelled) setBlogPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Supabase auth user — name comes from user_metadata (full_name / name),
  // falling back to the email local-part. Mirrors HeaderUserSection pattern.
  const displayName = isAuthenticated
    ? (user?.user_metadata?.full_name ||
       user?.user_metadata?.name ||
       (user?.email ? user.email.split("@")[0] : null) ||
       "friend")
    : null;

  const greeting = displayName
    ? `Welcome, ${String(displayName).split(" ")[0]}`
    : "Welcome to Koino";

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-28 md:pb-5">
      {/* ─── HERO WELCOME ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-6 pt-2"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F39B9B] mb-2">
          KOINO
        </p>
        <h1 className="text-2xl font-black text-white mb-1">
          {greeting}
        </h1>
        <p className="text-sm text-[#A09DB1]">
          Faith. Fellowship. Belong.
        </p>
        <p className="text-[11px] text-[#726E88] mt-2 max-w-md mx-auto">
          Choose where you'd like to go. Everything in Koino is one tap away.
        </p>
      </motion.div>

      {/* ─── FEATURE CARDS GROUPED BY FAITH / CONNECT / GROW / PLAY / DISCOVER ─── */}
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const cards = FEATURE_CARDS.filter((c) => c.group === group.label);
          if (cards.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span
                  className="text-[10px] font-black uppercase tracking-[0.25em]"
                  style={{ color: group.color }}
                >
                  {group.label}
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: `linear-gradient(to right, ${group.color}33, transparent)` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {cards.map((f, i) => (
                  <motion.button
                    key={f.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    onClick={() => onNavigate(f.view)}
                    className="text-left bg-[#1C1929] border hover:bg-[#22202F] transition-all group rounded-2xl p-3.5 space-y-2"
                    style={{ borderColor: `${f.color}33` }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center border"
                      style={{ backgroundColor: `${f.color}1A`, borderColor: `${f.color}40` }}
                    >
                      <f.icon style={{ color: f.color }} size={16} />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-white group-hover:opacity-90 transition-opacity">
                        {f.title}
                      </h3>
                      <p className="text-[10px] text-[#A09DB1] leading-relaxed mt-0.5 line-clamp-2">
                        {f.desc}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                      style={{ color: f.color }}
                    >
                      Open <ArrowRight size={9} />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── LORDSBOOK COMMUNITY CARD ─── */}
      {/* Placed below the main feature groups so Koino features remain primary */}
      <div className="mt-6">
        <LordsbookCommunityCard
          title="Meet Christians Around the World"
          description="Your faith journey is better together. Connect with Christians around the world, share your faith, join conversations and build meaningful Christian friendships on Lordsbook."
          buttonText="Meet Christians on Lordsbook"
          context="home"
        />
      </div>

      {/* ─── LATEST FROM KOINO (BLOG) ───
          Surface recent published blog posts at the bottom of the App Home.
          Renders ONLY when posts exist — hidden entirely on empty/error.
          Uses <a href> (not next/link) because /blog/* is a public App
          Router page outside the SPA — full route navigation is intended. */}
      {blogPosts.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F39B9B]">
              LATEST FROM KOINO
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-[#F39B9B]/20 to-transparent" />
          </div>
          <p className="text-[11px] text-[#A09DB1] mb-3 px-1">
            Christian articles, teachings, and stories to help you grow in faith.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {blogPosts.map((post) => (
              <a
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-[#F39B9B]/25 transition-all flex flex-col"
              >
                {post.featuredImage ? (
                  <div className="h-28 bg-[#0f0f1a] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  // Gradient placeholder — keeps card height stable when no image.
                  <div className="h-28 bg-gradient-to-br from-[#2B254E] via-[#1C1929] to-[#0f0f1a]" />
                )}
                <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#F39B9B]">
                    {post.category}
                  </span>
                  <h3 className="text-[13px] font-bold text-white line-clamp-1 group-hover:text-[#F39B9B] transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-[10px] text-[#A09DB1] line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                  {post.publishedAt && (
                    <div className="mt-auto pt-1.5 flex items-center gap-1 text-[9px] text-[#64748B]">
                      <Calendar size={9} />
                      {new Date(post.publishedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
