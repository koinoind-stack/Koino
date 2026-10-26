import { db } from "@/lib/db";

/**
 * Shared helpers for the In Loving Memory (Part 4) routes.
 * Kept tiny — authorization is always: owner > manager > admin > viewer.
 */

export type MemorialRole = "owner" | "manager" | null;

/** The viewer's management role on a memorial (null when not a manager). */
export async function memorialRole(memorialId: string, userId: string | null | undefined): Promise<MemorialRole> {
  if (!userId) return null;
  const row = await db.memorialManager.findUnique({
    where: { memorialId_userId: { memorialId, userId } },
    select: { role: true },
  });
  return (row?.role as MemorialRole) ?? null;
}

/** Family-chosen section visibility. Unknown keys / bad JSON → all shown. */
const DISPLAY_KEYS = ["photos", "videos", "tributes", "verse", "family", "candles"] as const;
export type MemorialDisplay = Record<(typeof DISPLAY_KEYS)[number], boolean>;

export function parseDisplay(json: string | null | undefined): MemorialDisplay {
  const out = { photos: true, videos: true, tributes: true, verse: true, family: true, candles: true };
  try {
    const parsed = JSON.parse(json || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const key of DISPLAY_KEYS) {
        if (typeof parsed[key] === "boolean") out[key] = parsed[key];
      }
    }
  } catch {
    // default: everything visible
  }
  return out;
}

export function serializeDisplay(body: unknown): MemorialDisplay | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const out = { photos: true, videos: true, tributes: true, verse: true, family: true, candles: true };
  let touched = false;
  for (const key of DISPLAY_KEYS) {
    const v = (body as Record<string, unknown>)[key];
    if (typeof v === "boolean") {
      out[key] = v;
      touched = true;
    }
  }
  return touched ? out : null;
}

/** Parse the gallery JSON column (Post.mediaUrls convention). */
export function parseGallery(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === "string" && u.startsWith("https://"))
      : [];
  } catch {
    return [];
  }
}

/** Rejects obvious phone numbers (10+ consecutive digits after removing
 *  separators) so private contact details are not published accidentally. */
export function containsPhoneNumber(text: string): boolean {
  return /\d{10}/.test(text.replace(/[\s\-().+]/g, ""));
}

/** Can this viewer open the memorial at all? Mirrors the GET [id] rules. */
export function canView(
  memorial: { status: string; visibility: string },
  role: MemorialRole,
  isAdmin: boolean,
): boolean {
  if (role || isAdmin) return true; // managers and admins always see it (incl. drafts)
  if (memorial.status !== "published") return false; // draft / unpublished are manager-only
  return memorial.visibility === "public" || memorial.visibility === "unlisted";
}
