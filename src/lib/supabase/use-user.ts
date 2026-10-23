"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Fired (window event) whenever a user's profile is updated anywhere in the
 * app (onboarding completion, Edit Profile save, avatar change). Every
 * useSupabaseUser consumer re-fetches /api/auth/me so header identity,
 * onboarding gates, and profile state stay in sync app-wide.
 */
export const PROFILE_UPDATED_EVENT = "koino:profile-updated";

export function notifyProfileUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
  }
}

/**
 * Hook: returns the current Supabase auth user + their role from our DB.
 *
 * - `user` — the Supabase auth user (null if logged out)
 * - `role` — "user" | "admin" | null (fetched from /api/auth/me, see below)
 * - `loading` — true while we resolve the session
 *
 * Why we need a role fetch:
 *   Supabase Auth only stores auth data. Our app's `role` lives in the
 *   Prisma User table. We expose a tiny `/api/auth/me` endpoint that
 *   returns `{ role, totalPoints }` for the signed-in user.
 */
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"user" | "admin" | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [profileCompleted, setProfileCompleted] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text) {
          const data = JSON.parse(text);
          setRole(data.role || "user");
          setPoints(data.totalPoints || 0);
          setProfileCompleted(data.profileCompleted ?? false);
          setUsername(data.username ?? null);
          setDisplayName(data.name ?? null);
          setAvatarUrl(data.image ?? null);
        }
      }
    } catch {
      // ignore — keep previous state
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        try {
          const res = await fetch("/api/auth/me", { cache: "no-store" });
          if (res.ok) {
            const text = await res.text();
            if (text) {
              const data = JSON.parse(text);
              setRole(data.role || "user");
              setPoints(data.totalPoints || 0);
              setProfileCompleted(data.profileCompleted ?? false);
            }
          }
        } catch {
          // ignore — role defaults to "user"
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          const res = await fetch("/api/auth/me", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            setRole(data.role || "user");
            setPoints(data.totalPoints || 0);
            setProfileCompleted(data.profileCompleted ?? false);
          }
        } catch {
          // ignore
        }
      } else {
        setRole(null);
        setPoints(0);
        setProfileCompleted(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Profile edits anywhere in the app → refetch here so all consumers update.
  useEffect(() => {
    const handler = () => {
      refetchProfile();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handler);
  }, [refetchProfile]);

  return {
    user,
    role,
    points,
    profileCompleted,
    username,
    displayName,
    avatarUrl,
    loading,
    isAuthenticated: !!user,
    isAdmin: role === "admin",
  };
}
