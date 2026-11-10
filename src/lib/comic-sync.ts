// ─── Comic Bible reading sync (server-side progress + bookmarks) ─────────────
// Mirrors the localStorage stores (cc_comic_progress / cc_comic_bookmarks in
// @/lib/bible-data + ComicView) to the server for AUTHENTICATED members so
// reading state survives devices and browsers.
//
// CONTRACT (Comic Bible redesign Part 2 §4):
//   • Guest readers are unaffected — everything here is a no-op without a
//     session, and localStorage remains the offline-safe primary store.
//   • Signed-in readers keep BOTH in sync: local writes never wait on the
//     network (fire-and-forget pushes); server reads merge with a
//     "highest progress wins" policy so progress never regresses.
//   • One server row per user per story — upserts only; duplicate records are
//     impossible by construction (DB @@unique([userId, comicChapterId])).
//   • Every function here is fail-silent: a failed sync must NEVER break
//     reading. No throws across the module boundary; callers decide how to
//     handle `null` (usually: just keep using local state).

import type { ComicProgress } from "@/lib/bible-data";

const PROGRESS_ENDPOINT = "/api/comic/progress";
const BOOKMARKS_ENDPOINT = "/api/comic/bookmarks";

/** Abort anything still pending after this long — reads must never hang the reader. */
const READ_TIMEOUT_MS = 2500;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await Promise.race([
      fetch(url, { ...init, credentials: "same-origin" }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ]);
    if (!res || !(res as Response).ok) return null;
    return await (res as Response).json();
  } catch {
    return null;
  }
}

// ─── Reading progress ────────────────────────────────────────────────────────

/**
 * All server-side progress for the signed-in user, keyed exactly like the
 * local store ("${bookId}-${chapter}"). Returns null when the user is signed
 * out or the fetch failed — callers then simply keep local state.
 */
export async function fetchServerComicProgress(): Promise<Record<string, ComicProgress> | null> {
  const data = (await fetchJson(PROGRESS_ENDPOINT)) as
    | { progress?: Record<string, ComicProgress> }
    | null;
  if (!data || typeof data !== "object" || !data.progress) return null;
  return data.progress;
}

/**
 * Fire-and-forget upsert of one story's progress. Never awaited by the
 * reader's render path; failures are ignored (local progress stays source of
 * truth for the session).
 */
export function pushComicProgress(
  bookId: string,
  chapter: number,
  lastPanel: number,
  totalPanels: number
): void {
  try {
    void fetch(PROGRESS_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ bookId, chapter, lastPanel, totalPanels }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* sync is best-effort by design */
  }
}

/**
 * Reset progress. With bookId+chapter → one story; without → everything.
 * Fire-and-forget; the caller clears local state immediately regardless.
 */
export function resetServerComicProgress(bookId?: string, chapter?: number): void {
  try {
    const params = new URLSearchParams();
    if (bookId) params.set("bookId", bookId);
    if (typeof chapter === "number" && Number.isFinite(chapter)) params.set("chapter", String(chapter));
    const qs = params.toString();
    void fetch(`${PROGRESS_ENDPOINT}${qs ? `?${qs}` : ""}`, {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    /* sync is best-effort by design */
  }
}

// ─── Story bookmarks ─────────────────────────────────────────────────────────

/**
 * All server-side bookmarks for the signed-in user, keyed
 * "${bookId}-${chapter}" → sorted bookmarked page numbers (same shape as the
 * reader's local store). null = signed out / failed.
 */
export async function fetchServerComicBookmarks(): Promise<Record<string, number[]> | null> {
  const data = (await fetchJson(BOOKMARKS_ENDPOINT)) as
    | { bookmarks?: Record<string, number[]> }
    | null;
  if (!data || typeof data !== "object" || !data.bookmarks) return null;
  return data.bookmarks;
}

/**
 * Fire-and-forget upsert of one story's bookmark.
 *   • Reader page bookmarks: push the FULL sorted page list (replace
 *     semantics). An empty list removes the story's bookmark row.
 *   • Library story bookmarks: pass `{ storyLevel: true }` — an empty page
 *     list then CREATES the row (story marked bookmarked with no page marks).
 */
export function pushComicBookmarks(
  bookId: string,
  chapter: number,
  pages: number[],
  opts?: { storyLevel?: boolean }
): void {
  try {
    void fetch(BOOKMARKS_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ bookId, chapter, pages, storyLevel: opts?.storyLevel === true }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* sync is best-effort by design */
  }
}
