// Admin-managed trivia gifts store.
// Gifts added via the admin panel are persisted in localStorage so they
// show up in the Trivia > Rewards tab for players to redeem.

import { TRIVIA_GIFTS, type TriviaGift } from "@/lib/crosscrafted-data";

const STORAGE_KEY = "koino_admin_gifts";

/** Returns the merged list of default + admin-added gifts. */
export function getAllGifts(): TriviaGift[] {
  const adminGifts = getAdminGifts();
  // Merge, admin-added first so they're visible
  return [...adminGifts, ...TRIVIA_GIFTS];
}

/** Returns only the admin-added gifts (for management in the admin panel). */
export function getAdminGifts(): TriviaGift[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TriviaGift[];
  } catch {
    return [];
  }
}

/** Save the full list of admin-added gifts. */
function saveAdminGifts(gifts: TriviaGift[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gifts));
  } catch {
    // localStorage full (base64 images can be large) — ignore
  }
}

/** Add a new gift. Returns the updated admin gifts list. */
export function addGift(gift: Omit<TriviaGift, "id">): TriviaGift[] {
  const gifts = getAdminGifts();
  const newGift: TriviaGift = { ...gift, id: `g_admin_${Date.now()}` };
  const updated = [newGift, ...gifts];
  saveAdminGifts(updated);
  return updated;
}

/** Update an existing admin gift. Only works for admin-added gifts (not defaults). */
export function updateGift(id: string, updates: Partial<TriviaGift>): TriviaGift[] {
  const gifts = getAdminGifts();
  const updated = gifts.map((g) => (g.id === id ? { ...g, ...updates } : g));
  saveAdminGifts(updated);
  return updated;
}

/** Remove an admin-added gift. */
export function removeGift(id: string): TriviaGift[] {
  const gifts = getAdminGifts();
  const updated = gifts.filter((g) => g.id !== id);
  saveAdminGifts(updated);
  return updated;
}

/** Check if a gift is admin-added (vs. a default seed gift). */
export function isAdminGift(id: string): boolean {
  return id.startsWith("g_admin_");
}
