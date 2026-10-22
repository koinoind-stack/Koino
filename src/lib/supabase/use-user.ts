"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

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
  const [loading, setLoading] = useState(true);

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

  return {
    user,
    role,
    points,
    profileCompleted,
    loading,
    isAuthenticated: !!user,
    isAdmin: role === "admin",
  };
}
