import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  isValidCommunityRole,
  COMMUNITY_ROLE_OTHER,
  COMMUNITY_ROLE_OTHER_MAX,
} from "@/lib/community-roles";

/**
 * GET /api/profile — the signed-in user's own editable profile.
 * PATCH /api/profile — server-authoritative partial profile editing.
 *
 * ⚠️ DEPLOY GATE (Task 49): reads/writes User.bio + User.usernameChangedAt,
 * which require migration 20261023000000_add_profile_edit_fields to be
 * applied first. Deploy the migration together with this code.
 *
 * Editable fields (PATCH, all optional — only provided keys change):
 *   - name           (≤ 100 chars after trim)
 *   - bio            (≤ 500 chars after trim)
 *   - state, city, gender, dateOfBirth
 *   - username       (format-validated, case-insensitively unique, and
 *                     subject to a 30-day change cooldown tracked on
 *                     User.usernameChangedAt — initial onboarding setup
 *                     is NOT counted, only subsequent changes)
 *   - website, instagram, youtube, facebook, twitter
 *                     (public links — accepts a pasted URL or a bare
 *                     @handle, normalizes to a full https URL; hostname
 *                     must match the platform for the social fields;
 *                     empty string clears the field. Requires migration
 *                     20261024000000_add_user_social_links — already
 *                     applied to production by hand.)
 *   - communityRole, communityRoleOther, communityRoleVisible
 *                     (self-reported, optional community role. Role must
 *                     be one of src/lib/community-roles.ts values or
 *                     null/"" to clear; "other" carries free text in
 *                     communityRoleOther (≤ 60 chars, cleared whenever
 *                     the role is not "other"); communityRoleVisible
 *                     gates PUBLIC display only. Requires migration
 *                     20261024110000_add_community_role — applied to
 *                     production by hand.)
 *
 * Ownership: the session user is always the target user — there is no
 * user-id parameter, so no IDOR surface exists.
 */
export async function GET() {
  const session = await getAuthUser();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      username: true,
      bio: true,
      state: true,
      city: true,
      gender: true,
      dateOfBirth: true,
      usernameChangedAt: true,
      profileCompleted: true,
      createdAt: true,
      website: true,
      instagram: true,
      youtube: true,
      facebook: true,
      twitter: true,
      communityRole: true,
      communityRoleOther: true,
      communityRoleVisible: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const USERNAME_COOLDOWN_DAYS = 30;

// ─── social / website links ───
// Accepts what users actually paste: "https://x.com/foo", "x.com/foo",
// "@foo" or "foo" — and stores ONE canonical https URL per field.
const LINK_FIELDS = ["website", "instagram", "youtube", "facebook", "twitter"] as const;
const LINK_MAX_LENGTH = 200;
const SOCIAL_HANDLE_RE = /^[A-Za-z0-9._-]{1,30}$/;
const SOCIAL_HOST_RE: Record<Exclude<(typeof LINK_FIELDS)[number], "website">, RegExp> = {
  instagram: /(^|\.)instagram\.com$/i,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/i,
  facebook: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i,
  twitter: /(^|\.)(twitter\.com|x\.com)$/i,
};
const SOCIAL_HANDLE_URL: Record<Exclude<(typeof LINK_FIELDS)[number], "website">, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  facebook: (h) => `https://www.facebook.com/${h}/`,
  twitter: (h) => `https://x.com/${h}`,
};

/** Normalizes a pasted link; null = invalid (caller returns 400). */
function normalizeLink(field: (typeof LINK_FIELDS)[number], raw: string): string | null {
  let v = raw.trim();
  if (!v || v.length > LINK_MAX_LENGTH || /\s/.test(v)) return null;

  // Bare handle for social fields: "@foo" / "foo" (no dot-slash path).
  if (field !== "website" && !/^https?:\/\//i.test(v) && !v.includes("/")) {
    const handle = v.replace(/^@/, "");
    if (!SOCIAL_HANDLE_RE.test(handle)) return null;
    return SOCIAL_HANDLE_URL[field](handle);
  }

  // URL-shaped input — add the protocol users routinely omit, then parse.
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname || !u.hostname.includes(".")) return null;
  // Social fields must point at their platform (blocks mis-pasted links).
  if (field !== "website" && !SOCIAL_HOST_RE[field].test(u.hostname)) return null;
  const out = u.toString();
  return out.length <= LINK_MAX_LENGTH ? out : null;
}

function usernameChangeState(usernameChangedAt: Date | null | undefined) {
  if (!usernameChangedAt) {
    return { canChangeNow: true, nextChangeAllowedAt: null as string | null };
  }
  const next = new Date(usernameChangedAt.getTime() + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  return {
    canChangeNow: Date.now() >= next.getTime(),
    nextChangeAllowedAt: next.toISOString(),
  };
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthUser();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const current = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      username: true,
      usernameChangedAt: true,
      profileCompleted: true,
      communityRole: true,
    },
  });
  if (!current) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  // Profile editing requires onboarding to be complete — keeps the flow
  // unambiguous (onboarding owns the first-time profile setup).
  if (!current.profileCompleted) {
    return NextResponse.json(
      { error: "Complete onboarding first", code: "ONBOARDING_INCOMPLETE" },
      { status: 403 },
    );
  }

  const data: Record<string, unknown> = {};

  // ─── name ───
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or fewer" }, { status: 400 });
    }
    data.name = name || null;
  }

  // ─── bio ───
  if (body.bio !== undefined) {
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    if (bio.length > 500) {
      return NextResponse.json({ error: "Bio must be 500 characters or fewer" }, { status: 400 });
    }
    data.bio = bio || null;
  }

  // ─── location / gender ───
  if (body.state !== undefined) {
    const state = typeof body.state === "string" ? body.state.trim() : "";
    if (state.length > 100) {
      return NextResponse.json({ error: "State is too long" }, { status: 400 });
    }
    data.state = state || null;
  }
  if (body.city !== undefined) {
    const city = typeof body.city === "string" ? body.city.trim() : "";
    if (city.length > 100) {
      return NextResponse.json({ error: "City is too long" }, { status: 400 });
    }
    data.city = city || null;
  }
  if (body.gender !== undefined) {
    const allowed = ["male", "female", "prefer_not_to_say"];
    if (body.gender !== null && body.gender !== "" && !allowed.includes(String(body.gender))) {
      return NextResponse.json({ error: "Invalid gender value" }, { status: 400 });
    }
    data.gender = body.gender ? String(body.gender) : null;
  }

  // ─── date of birth ───
  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth === null || body.dateOfBirth === "") {
      data.dateOfBirth = null;
    } else {
      const dob = new Date(String(body.dateOfBirth));
      if (isNaN(dob.getTime())) {
        return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
      }
      // Sanity: DOB must be in the past and the person at least ~5 years old.
      const now = new Date();
      const minAge = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      if (dob > minAge) {
        return NextResponse.json({ error: "Date of birth looks too recent" }, { status: 400 });
      }
      data.dateOfBirth = dob;
    }
  }

  // ─── social / website links (normalized server-side) ───
  for (const f of LINK_FIELDS) {
    if (body[f] !== undefined) {
      const raw = typeof body[f] === "string" ? (body[f] as string).trim() : "";
      if (!raw) {
        data[f] = null; // empty string clears the link
        continue;
      }
      const norm = normalizeLink(f, raw);
      if (!norm) {
        return NextResponse.json(
          { error: `Invalid ${f} link`, code: "INVALID_LINK" },
          { status: 400 },
        );
      }
      data[f] = norm;
    }
  }

  // ─── community role (self-reported, optional, NOT verified) ───
  if (body.communityRole !== undefined) {
    const role = typeof body.communityRole === "string" ? body.communityRole.trim() : "";
    if (role && !isValidCommunityRole(role)) {
      return NextResponse.json({ error: "Invalid community role" }, { status: 400 });
    }
    data.communityRole = role || null;
    // Switching away from "other" always clears the stale free-text.
    if (role !== COMMUNITY_ROLE_OTHER) {
      data.communityRoleOther = null;
    }
  }
  if (body.communityRoleOther !== undefined) {
    const other = typeof body.communityRoleOther === "string" ? body.communityRoleOther.trim() : "";
    if (other.length > COMMUNITY_ROLE_OTHER_MAX) {
      return NextResponse.json(
        { error: `Role description must be ${COMMUNITY_ROLE_OTHER_MAX} characters or fewer` },
        { status: 400 },
      );
    }
    // Only stored when the selected role is actually "other". Uses the role
    // from THIS request when provided (including an explicit clear), else
    // the currently stored one.
    const effectiveRole =
      data.communityRole !== undefined ? data.communityRole : current.communityRole;
    data.communityRoleOther =
      effectiveRole === COMMUNITY_ROLE_OTHER ? other || null : null;
  }
  if (body.communityRoleVisible !== undefined) {
    data.communityRoleVisible = Boolean(body.communityRoleVisible);
  }

  // ─── username (cooldown + uniqueness enforced SERVER-side) ───
  if (body.username !== undefined) {
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    if (!username) {
      return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters: lowercase letters, numbers, underscores" },
        { status: 400 },
      );
    }
    if (username !== (current.username ?? "").toLowerCase()) {
      const state = usernameChangeState(current.usernameChangedAt);
      if (!state.canChangeNow) {
        return NextResponse.json(
          {
            error: "You can change your username once every 30 days",
            code: "USERNAME_COOLDOWN",
            nextChangeAllowedAt: state.nextChangeAllowedAt,
          },
          { status: 429 },
        );
      }
      // Case-insensitive uniqueness: any other user holding this handle wins.
      const clash = await db.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" }, NOT: { id: current.id } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: "That username is already taken", code: "USERNAME_TAKEN" },
          { status: 409 },
        );
      }
      data.username = username;
      // Only setting a DIFFERENT username counts as a change (starts the cooldown).
      data.usernameChangedAt = new Date();
      // P2002 backstop: a concurrent signup could win the race between the
      // findFirst above and this write — the DB-level unique constraint is
      // the final arbiter.
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await db.user.update({
      where: { id: current.id },
      data,
      select: {
        id: true,
        name: true,
        image: true,
        username: true,
        bio: true,
        state: true,
        city: true,
        gender: true,
        dateOfBirth: true,
        usernameChangedAt: true,
        website: true,
        instagram: true,
        youtube: true,
        facebook: true,
        twitter: true,
        communityRole: true,
        communityRoleOther: true,
        communityRoleVisible: true,
      },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That username is already taken", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    console.error("[api/profile] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
