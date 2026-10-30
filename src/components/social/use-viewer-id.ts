"use client";

import { useEffect, useState } from "react";

/**
 * Viewer identity for feed components (Phase 1 Fix 2).
 *
 * Returns the current user's PRISMA user id (the same id space as
 * `post.author.id`), or null when signed out. This is what ownership
 * checks must compare against — the Supabase auth UID from
 * useSupabaseUser() is a DIFFERENT id namespace and must not be used for
 * ownership comparisons.
 *
 * Identity source: GET /api/auth/me (returns { id, ... } from our DB),
 * the exact identity CommentRow already uses for its delete button.
 *
 * Caching: every PostCard on a feed page would otherwise fire its own
 * /api/auth/me request (PostDetail's CommentRow does exactly that, once
 * per comment). This hook shares ONE request via a module-level cache:
 *   - a resolved id is cached for the page session (ids don't change
 *     while signed in);
 *   - a signed-out result is cached for only 30s, so a client-side
 *     sign-in (password flow uses router.push, no full reload) still
 *     picks up the new identity shortly after without a reload.
 *
 * `resetViewerIdCache()` exists for tests / future auth-change events.
 */

const ANON_CACHE_TTL_MS = 30_000;

let cachedId: string | null = null;
let cachedAt = 0;
let inflight: Promise<string | null> | null = null;

async function fetchViewerId(): Promise<string | null> {
  if (inflight) return inflight;

  // A resolved signed-in id is stable for the page session — serve it.
  if (cachedId !== null) return cachedId;
  // A signed-out result is only trusted for a short window (see header).
  if (cachedAt > 0 && Date.now() - cachedAt < ANON_CACHE_TTL_MS) return null;

  inflight = fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: unknown) => {
      const id = d && typeof d === "object" && typeof (d as { id?: unknown }).id === "string"
        ? (d as { id: string }).id
        : null;
      cachedId = id;
      cachedAt = Date.now();
      return id;
    })
    .catch(() => {
      cachedId = null;
      cachedAt = Date.now();
      return null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetViewerIdCache(): void {
  cachedId = null;
  cachedAt = 0;
  inflight = null;
}

export function useViewerId(): string | null {
  const [id, setId] = useState<string | null>(() =>
    inflight || cachedAt > 0 ? cachedId : null,
  );

  useEffect(() => {
    let alive = true;
    fetchViewerId().then((v) => {
      if (alive) setId(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return id;
}
