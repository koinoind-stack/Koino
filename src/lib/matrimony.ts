/**
 * ─── MATRIMONY — SINGLE SOURCE OF TRUTH (Task 74 Stage B) ──────────────────
 *
 * Client-safe module: constants, zod validation schemas, and PURE decision
 * functions. No secrets, no DB imports. Server-only helpers (eligibility
 * gates, audit logging, serialization) live in src/lib/matrimony/server.ts.
 *
 * PRIVACY RULES (enforced with this module everywhere):
 *  - DOB lives ONLY on User. Age is computed server-side; the full date of
 *    birth is never returned by any matrimony API or rendered on any card.
 *  - Photo storage paths are never exposed; photos are served exclusively
 *    through the authorized route /api/matrimony/photos/[id].
 *  - Photo visibility defaults to CONNECTIONS_ONLY and is enforced on the
 *    server for every request.
 */

import { z } from "zod";

// ─── Limits & options ───────────────────────────────────────────────────────

export const MATRIMONY_MIN_AGE = 18;

/**
 * PRIVATE Supabase Storage bucket for matrimony photos. Created by
 * scripts/matrimony-create-bucket.ts (or the Supabase dashboard) with
 * public: false — objects are readable ONLY via the authorized serving
 * route using the service-role key. Never public, never indexed.
 */
export const MATRIMONY_PHOTOS_BUCKET = "matrimony-photos";

export const MATRIMONY_LIMITS = {
  languagesMin: 1,
  languagesMax: 6,
  languageLengthMax: 30,
  denominationMax: 60,
  educationMax: 80,
  professionMax: 80,
  aboutMeMax: 2000,
  heightMinCm: 90,
  heightMaxCm: 250,
  /** Input upload cap. Kept under Vercel's ~4.5 MB serverless body limit. */
  photoMaxInputBytes: 4 * 1024 * 1024,
  /** Max photos per profile — enforced server-side (DB constraint backs it). */
  photosMax: 3,
  /** Signed-URL lifetime for authorized photo serving (seconds). */
  photoSignedUrlTtlSec: 60,
  photoUploadsPerHour: 20,
} as const;

/** Languages a member can list on their matrimony profile (India + English). */
export const MATRIMONY_LANGUAGES = [
  "English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil",
  "Gujarati", "Urdu", "Kannada", "Malayalam", "Odia", "Punjabi",
  "Assamese", "Other",
] as const;

export const MATRIMONY_INTENTIONS = [
  { value: "seeking_life_partner", label: "Seeking a life partner" },
  { value: "exploring_intentionally", label: "Exploring intentionally" },
] as const;

export const MATRIMONY_TIMELINES = [
  { value: "ready_now", label: "Ready now" },
  { value: "within_6_months", label: "Within 6 months" },
  { value: "within_1_year", label: "Within a year" },
  { value: "1_2_years", label: "1–2 years" },
  { value: "gods_timing", label: "Flexible — God's timing" },
] as const;

/** Photo visibility choices. Default is the SAFEST option. */
export const MATRIMONY_PHOTO_VISIBILITY = [
  "CONNECTIONS_ONLY",
  "ELIGIBLE_MEMBERS",
] as const;

export type MatrimonyPhotoVisibility = (typeof MATRIMONY_PHOTO_VISIBILITY)[number];

/** Profile statuses (see schema comments for the state machine). */
export const MATRIMONY_PROFILE_STATUSES = [
  "draft", "active", "paused", "restricted", "removed",
] as const;

export function isMatrimonyPhotoVisibility(v: string): v is MatrimonyPhotoVisibility {
  return (MATRIMONY_PHOTO_VISIBILITY as readonly string[]).includes(v);
}

// ─── Validation schemas (shared by API routes) ──────────────────────────────

const trimmed = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer.`);

export const matrimonyProfileInputSchema = z.object({
  languages: z
    .array(
      z.string().trim().min(1).max(MATRIMONY_LIMITS.languageLengthMax)
    )
    .min(MATRIMONY_LIMITS.languagesMin, "Choose at least one language.")
    .max(MATRIMONY_LIMITS.languagesMax, `Up to ${MATRIMONY_LIMITS.languagesMax} languages.`),
  intention: z
    .string()
    .trim()
    .refine(
      (v) => MATRIMONY_INTENTIONS.some((i) => i.value === v),
      "Please choose your marriage intention."
    ),
  timeline: z
    .string()
    .trim()
    .refine(
      (v) => MATRIMONY_TIMELINES.some((t) => t.value === v),
      "Please choose your preferred timeline."
    ),
  denomination: trimmed(MATRIMONY_LIMITS.denominationMax).optional().nullable(),
  education: trimmed(MATRIMONY_LIMITS.educationMax).optional().nullable(),
  profession: trimmed(MATRIMONY_LIMITS.professionMax).optional().nullable(),
  aboutMe: trimmed(MATRIMONY_LIMITS.aboutMeMax).optional().nullable(),
  heightCm: z
    .number()
    .int()
    .min(MATRIMONY_LIMITS.heightMinCm)
    .max(MATRIMONY_LIMITS.heightMaxCm)
    .optional()
    .nullable(),
  photoVisibility: z.enum(MATRIMONY_PHOTO_VISIBILITY).default("CONNECTIONS_ONLY"),
  // Sourced from the member's Koino account (single source of truth) — the
  // matrimony editor may update these two account fields for convenience.
  state: trimmed(100).optional().nullable(),
  city: trimmed(100).optional().nullable(),
});

export type MatrimonyProfileInput = z.infer<typeof matrimonyProfileInputSchema>;

// ─── Pure decision functions (unit-tested; no DB access) ────────────────────

/**
 * Accurate calendar age in years (UTC-based so timezone drift cannot flip a
 * birthday). Returns -1 for invalid or FUTURE dates — callers treat -1 as
 * ineligible.
 */
export function ageFromDOB(dob: Date | null | undefined, now: Date = new Date()): number {
  if (!dob || !(dob instanceof Date) || isNaN(dob.getTime())) return -1;
  if (dob.getTime() > now.getTime()) return -1; // future date
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** True when the DOB is a real past date yielding age >= MATRIMONY_MIN_AGE. */
export function isMatrimonyEligibleDOB(dob: Date | null | undefined, now: Date = new Date()): boolean {
  const age = ageFromDOB(dob, now);
  return age >= MATRIMONY_MIN_AGE;
}

/**
 * PHOTO AUTHORIZATION MATRIX — the single decision point used by the
 * authorized serving route. Fails closed: every uncertain case denies.
 *
 * Stage B integration point: `hasAcceptedConnection` is always false until
 * Stage C implements real connections. Until then, CONNECTIONS_ONLY photos
 * are visible to the OWNER ONLY — exactly as the Stage B prompt requires.
 */
export function canViewMatrimonyPhoto(input: {
  requesterId: string;
  ownerId: string;
  /** Requester passed requireMatrimonyMember (active account, 18+, DOB ok). */
  requesterEligible: boolean;
  /** Owner's profile status. */
  profileStatus: string;
  visibility: string;
  /** True when a social block exists in EITHER direction (existing Block model). */
  blocked: boolean;
  /** Stage C will pass a real accepted-connection check; always false now. */
  hasAcceptedConnection?: boolean;
}): boolean {
  const {
    requesterId, ownerId, requesterEligible, profileStatus, visibility, blocked,
    hasAcceptedConnection = false,
  } = input;

  // Fail-closed sanity: a photo without a real owner/profile never serves.
  if (!requesterId || !ownerId) return false;

  // The owner always sees their own photos (via the authorized route).
  if (requesterId === ownerId) return true;

  // Everyone else must be an eligible matrimony member, always.
  if (!requesterEligible) return false;

  // Blocked pairs (either direction) never see each other's photos.
  if (blocked) return false;

  // Only ACTIVE profiles serve photos to others — draft/paused/restricted/
  // removed profiles are fully hidden.
  if (profileStatus !== "active") return false;

  if (visibility === "ELIGIBLE_MEMBERS") return true;

  if (visibility === "CONNECTIONS_ONLY") {
    // Stage B: no connection system exists yet → no one but the owner passes.
    return hasAcceptedConnection;
  }

  // Unknown visibility value — deny.
  return false;
}

/**
 * DOB-CHANGE POLICY — decides what happens to a member's matrimony profile
 * when their account DOB changes (called from PATCH /api/profile).
 *
 * Policy (user-confirmed): re-validate eligibility server-side; if the new
 * DOB makes the member ineligible (under 18, invalid, or cleared), the
 * matrimony profile is immediately RESTRICTED (not deleted — the member's
 * Koino account and unrelated content are untouched). Every change is
 * audit-logged by the caller with ages only — never the DOB itself.
 */
export function matrimonyStatusAfterDobChange(input: {
  hasMatrimonyProfile: boolean;
  newDob: Date | null;
  now?: Date;
}): { restrict: boolean; eligible: boolean } {
  if (!input.hasMatrimonyProfile) return { restrict: false, eligible: false };
  const eligible = isMatrimonyEligibleDOB(input.newDob, input.now ?? new Date());
  return { restrict: !eligible, eligible };
}

// ─── DISCOVERY / SEARCH (Task 74 Stage C) ───────────────────────────────────
//
// Scope: browse ACTIVE matrimony profiles. The same privacy rules as Stage B
// apply, enforced server-side in /api/matrimony/discover:
//   - Only status="active" profiles ever appear (draft/paused/restricted/
//     removed are invisible; the owner's account must be active too).
//   - Age is computed server-side from User.dateOfBirth. The full DOB is
//     never sent to any client.
//   - Photos are NOT included unless the owner chose ELIGIBLE_MEMBERS;
//     CONNECTIONS_ONLY stays owner-only until the connection system (the
//     Stage D integration point in canViewMatrimonyPhoto).
//   - Blocked pairs (either direction, existing Block model) never appear.

export const MATRIMONY_DISCOVERY_LIMITS = {
  /** Results per page (default) — also the "Show more" page size. */
  pageDefault: 12,
  pageMin: 6,
  pageMax: 24,
  /** Search text cap — short substring search, not a query language. */
  qMax: 60,
  /** Filterable age bounds. Never below the platform minimum. */
  filterAgeMin: MATRIMONY_MIN_AGE,
  filterAgeMax: 70,
  requestsPerMinute: 60,
} as const;

/** Gender values the discovery filter accepts (matches User.gender values). */
export const MATRIMONY_DISCOVERY_GENDERS = ["male", "female"] as const;

/**
 * SERVER-SIDE zod schema for /api/matrimony/discover query params. Values
 * arrive as strings (searchParams) — coerce handles the numeric fields.
 * Anything unknown-shaped fails closed with 400.
 */
export const matrimonyDiscoveryQuerySchema = z.object({
  q: z.string().trim().max(MATRIMONY_DISCOVERY_LIMITS.qMax).optional(),
  gender: z.enum(MATRIMONY_DISCOVERY_GENDERS).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  language: z.enum(MATRIMONY_LANGUAGES).optional(),
  ageMin: z.coerce
    .number()
    .int()
    .min(MATRIMONY_DISCOVERY_LIMITS.filterAgeMin)
    .max(MATRIMONY_DISCOVERY_LIMITS.filterAgeMax)
    .optional(),
  ageMax: z.coerce
    .number()
    .int()
    .min(MATRIMONY_DISCOVERY_LIMITS.filterAgeMin)
    .max(MATRIMONY_DISCOVERY_LIMITS.filterAgeMax)
    .optional(),
  cursor: z.string().trim().max(120).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(MATRIMONY_DISCOVERY_LIMITS.pageMin)
    .max(MATRIMONY_DISCOVERY_LIMITS.pageMax)
    .optional(),
});

export type MatrimonyDiscoveryQuery = z.infer<typeof matrimonyDiscoveryQuerySchema>;

/**
 * AGE FILTER → DOB RANGE (pure, deterministic, UTC-based).
 *
 * A member aged A "today" was born on/before (today − A years), so:
 *   age >= ageMin  ⟺  dateOfBirth <= end of (today − ageMin years)
 *   age <= ageMax  ⟺  dateOfBirth >= start of (today − ageMax − 1 years) + 1 day
 *
 * Caller passes the returned range straight into Prisma's
 * `user.dateOfBirth` filter. If ageMin > ageMax the two bounds contradict
 * (gte > lte) and the query naturally matches nothing — fail-closed.
 * Only bounds actually requested are set.
 */
export type MatrimonyBirthRange = { gte?: Date; lte?: Date };

export function birthDateRangeFromAges(
  opts: { ageMin?: number; ageMax?: number; now?: Date } = {}
): MatrimonyBirthRange {
  const now = opts.now ?? new Date();
  const range: MatrimonyBirthRange = {};

  if (typeof opts.ageMin === "number" && Number.isFinite(opts.ageMin)) {
    const years = Math.floor(opts.ageMin);
    const d = new Date(
      Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );
    if (!isNaN(d.getTime())) range.lte = d;
  }

  if (typeof opts.ageMax === "number" && Number.isFinite(opts.ageMax)) {
    const years = Math.floor(opts.ageMax) + 1;
    // Day overflow (e.g. the 32nd) is normalized by Date.UTC.
    const d = new Date(
      Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );
    if (!isNaN(d.getTime())) range.gte = d;
  }

  return range;
}

// ─── Keyset pagination cursor (updatedAt + id compound) ─────────────────────
//
// updatedAt is not unique, so a date-only cursor could skip rows that share
// the same timestamp. The cursor carries BOTH values and the query re-creates
// a strict total order: (updatedAt DESC, id DESC). Opaque to the client —
// tampering fails validation and returns 400.

const DISCOVERY_CURSOR_SEP = "~";
const DISCOVERY_ID_RE = /^[a-zA-Z0-9_-]{5,40}$/; // cuid-shaped ids only

export function encodeDiscoveryCursor(input: {
  updatedAt: Date | string;
  id: string;
}): string {
  const iso =
    typeof input.updatedAt === "string" ? input.updatedAt : input.updatedAt.toISOString();
  return `${iso}${DISCOVERY_CURSOR_SEP}${input.id}`;
}

export function parseDiscoveryCursor(
  raw: string | null | undefined
): { updatedAt: Date; id: string } | null {
  if (!raw) return null;
  const sep = raw.lastIndexOf(DISCOVERY_CURSOR_SEP);
  if (sep <= 0) return null;
  const iso = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  if (!DISCOVERY_ID_RE.test(id)) return null;
  return { updatedAt: date, id };
}
