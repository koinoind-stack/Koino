"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { LogIn, LogOut } from "lucide-react";
import type { User } from "@supabase/supabase-js";

/**
 * Shows the current user's avatar + name + FP balance, or a "Sign In" button.
 * Used in both the desktop and mobile headers.
 *
 * Reads auth state from Supabase via the @supabase/ssr browser client.
 * Fetches the user's Faith Points from /api/trivia/stats on login.
 */
export default function HeaderUserSection({ mobile = false }: { mobile?: boolean }) {
  const router = useRouter();
  const t = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    const supabase = createClient();

    // Get current session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // Fetch Faith Points from the API
        fetch("/api/trivia/stats")
          .then((r) => r.text())
          .then((text) => {
            if (text) {
              const data = JSON.parse(text);
              setPoints(data.totalPoints || 0);
            }
          })
          .catch(() => setPoints(0));
      }
    });

    // Subscribe to auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetch("/api/trivia/stats")
          .then((r) => r.text())
          .then((text) => {
            if (text) {
              const data = JSON.parse(text);
              setPoints(data.totalPoints || 0);
            }
          })
          .catch(() => setPoints(0));
      } else {
        setPoints(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <div className="w-6 h-6 rounded-full bg-white/[0.06] animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <a
        href="/auth/signin"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition-all ${
          mobile ? "px-2.5" : ""
        }`}
      >
        <LogIn size={14} />
        {!mobile && <span>{t("user.signIn")}</span>}
      </a>
    );
  }

  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "U";
  const initials = (name as string).charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F39B9B] to-[#9786E3] flex items-center justify-center text-[10px] font-bold text-slate-950">
        {initials}
      </div>
      {!mobile && (
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-bold text-white truncate max-w-[80px]">
            {name}
          </span>
          <span className="text-[9px] text-[#F59E0B] font-bold">
            {t("common.faithPoints", { count: points.toLocaleString() })}
          </span>
        </div>
      )}
      <button
        onClick={handleSignOut}
        className="p-1 rounded-lg hover:bg-white/5 transition-colors"
        title={t("user.signOut")}
      >
        <LogOut size={12} className="text-[#64748B]" />
      </button>
    </div>
  );
}
