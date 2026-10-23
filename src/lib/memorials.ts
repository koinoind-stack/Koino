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
