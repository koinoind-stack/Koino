"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { LogIn, LogOut } from "lucide-react";

/**
 * Shows the current user's avatar + name + @username + FP balance, or a
 * "Sign In" button. Used in both the desktop and mobile headers.
 *
 * Identity (name / avatar / @handle) comes from OUR database via
 * /api/auth/me — NOT from Supabase metadata — so profile edits are visible
 * here instantly (PROFILE_UPDATED_EVENT triggers a refetch).
 */
export default function HeaderUserSection({
  mobile = false,
  onOpenProfile,
}: {
  mobile?: boolean;
  /** When provided, clicking the avatar/name opens the member's profile. */
  onOpenProfile?: () => void;
}) {
  const router = useRouter();
  const t = useTranslation();
  const { isAuthenticated, points, username, displayName, avatarUrl, isAdmin } = useSupabaseUser();
  const [signedOut, setSignedOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSignedOut(true);
    router.push("/");
    router.refresh();
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <div className="w-6 h-6 rounded-full bg-white/[0.06] animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated || signedOut) {
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

  const name = displayName || username || "Member";
  const handle = username ? `@${username}` : null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <button
        onClick={onOpenProfile}
        disabled={!onOpenProfile}
        title="My profile"
        className="flex items-center gap-1.5 min-w-0 disabled:cursor-default"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover" unoptimized />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F39B9B] to-[#9786E3] flex items-center justify-center text-[10px] font-bold text-slate-950">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        {!mobile && (
          <div className="flex flex-col leading-tight">
            <span className="flex items-center gap-1 min-w-0">
              <span className="text-xs font-bold text-white truncate max-w-[70px]">{name}</span>
              {isAdmin && (
                <span
                  title="Administrator"
                  className="shrink-0 px-1 py-px rounded bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-[8px] font-extrabold text-white uppercase tracking-wide leading-none"
                >
                  Admin
                </span>
              )}
            </span>
            <span className="text-[9px] text-[#64748B] font-bold truncate max-w-[90px]">
              {handle ?? t("common.faithPoints", { count: points.toLocaleString() })}
            </span>
          </div>
        )}
      </button>
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
