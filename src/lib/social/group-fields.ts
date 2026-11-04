import { db } from "@/lib/db";

/**
 * Shared helpers for the group create (POST /api/social/groups) and edit
 * (PATCH /api/social/groups/[id]) endpoints. Kept out of the route modules
 * because Next.js only allows HTTP-method exports from route files.
 *
 * parseGroupFields validates the community-upgrade fields (media, location,
 * language, rules, church link) and returns a Prisma `data` fragment.
 *
 * Church linking validates the church exists and is PUBLISHED, and snapshots
 * its name for display. Linking never touches the churchVerified flag — only
 * platform administrators can grant official status.
 */

export type GroupFieldData = {
  coverImage?: string | null;
  logoUrl?: string | null;
  city?: string | null;
  state?: string | null;
  language?: string | null;
  rules?: string | null;
  churchId?: string | null;
  churchName?: string | null;
};

export async function parseGroupFields(body: Record<string, unknown>): Promise<{
  error?: string;
  status?: number;
  data: GroupFieldData;
}> {
  const data: GroupFieldData = {};

  const str = (v: unknown, max: number): string | null => {
    const s = typeof v === "string" ? v.trim().slice(0, max) : "";
    return s || null;
  };

  // Images must come from Koino's signed-URL storage namespace — same rule
  // as post media (defense in depth; the uploader enforces type/size first).
  const mediaUrl = (v: unknown): { seen: boolean; ok: boolean; url: string | null } => {
    if (v === undefined) return { seen: false, ok: true, url: null };
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return { seen: true, ok: true, url: null };
    const ok =
      s.includes("/believ-comic-artwork/social/") && /\.(jpe?g|png|webp)(\?|$)/i.test(s);
    return { seen: true, ok, url: ok ? s.slice(0, 2048) : null };
  };

  const cover = mediaUrl(body.coverImage);
  if (cover.seen && !cover.ok)
    return { error: "Cover image must be uploaded through Koino's uploader (JPG, PNG or WEBP)", status: 400, data: {} };
  if (cover.seen) data.coverImage = cover.url;

  const logo = mediaUrl(body.logoUrl);
  if (logo.seen && !logo.ok)
    return { error: "Group picture must be uploaded through Koino's uploader (JPG, PNG or WEBP)", status: 400, data: {} };
  if (logo.seen) data.logoUrl = logo.url;

  if (body.city !== undefined) data.city = str(body.city, 80);
  if (body.state !== undefined) data.state = str(body.state, 80);
  if (body.language !== undefined) data.language = str(body.language, 40);
  if (body.rules !== undefined) data.rules = str(body.rules, 2000);

  if (body.churchId !== undefined) {
    const churchId = typeof body.churchId === "string" ? body.churchId.trim() : "";
    if (!churchId) {
      data.churchId = null;
      data.churchName = null;
    } else {
      const church = await db.church
        .findUnique({ where: { id: churchId }, select: { id: true, name: true, status: true } })
        .catch(() => null);
      if (!church) return { error: "Could not verify that church — try again", status: 500, data: {} };
      if (church.status !== "PUBLISHED")
        return { error: "That church isn't available in the directory", status: 400, data: {} };
      data.churchId = church.id;
      data.churchName = church.name;
    }
  }

  return { data };
}

/**
 * True when a Prisma error means the schema pieces aren't in the database
 * yet (P2021 missing table, P2022 missing column) or the raw message says
 * "does not exist". Lets group endpoints degrade gracefully during the
 * migration window instead of throwing 500s.
 */
export function isMissingSchema(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "P2021" || e?.code === "P2022" || /does not exist/i.test(e?.message || "");
}
