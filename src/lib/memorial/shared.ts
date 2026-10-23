/**
 * Part 4 "In Loving Memory" — shared pure logic.
 *
 * Imported by BOTH server (API routes) and client (components) and by the
 * test suite. Contains NO server-only imports so it is safe everywhere.
 * All authorization rules live here as pure functions and are exercised by
 * scripts/memorial-tests.ts — the API routes are thin wrappers that call
 * them with the session user and DB rows.
 */

export const MEMORIAL_LIMITS = {
  fullName: 120,
  epitaph: 200,
  biography: 10_000,
  serviceInfo: 2_000,
  condolenceMessage: 1_000,
  maxManagers: 5, // co-managers EXCLUDING the creator/owner
} as const;

export const MEMORIAL_VISIBILITIES = ["public", "members", "managers"] as const;
export type MemorialVisibility = (typeof MEMORIAL_VISIBILITIES)[number];

export const CONDOLENCE_POLICIES = ["approved", "open"] as const;
export type CondolencePolicy = (typeof CONDOLENCE_POLICIES)[number];

export const CONDOLENCE_STATUSES = ["pending", "approved", "rejected"] as const;
export type CondolenceStatus = (typeof CONDOLENCE_STATUSES)[number];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export type Viewer = {
  id: string;
  role: string; // "user" | "admin"
} | null;

/** Shape shared between Prisma rows and client payloads for auth decisions. */
export type MemorialAuthShape = {
  creatorId: string;
  visibility: string;
  archived: boolean;
  managerIds: string[]; // co-manager user ids, EXCLUDING the creator
};

// ─── Partial dates ───────────────────────────────────────────────────────────

export type PartialDate = {
  year: number | null;
  month: number | null; // 1-12
  day: number | null;   // 1-31
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Validate ONE partial date. Rules:
 *  - null year          → the whole date is "unknown" (allowed for birth;
 *                         NOT allowed for death — a memorial needs at least
 *                         a death year)
 *  - year               → 1000..3000 (obituary-plausible range)
 *  - month without year → invalid (a month alone is meaningless)
 *  - day without month  → invalid
 *  - day must exist in the given month/year (rejects 31 Feb, accepts
 *    29 Feb only in leap years, etc.)
 */
export function validatePartialDate(d: PartialDate): string | null {
  if (d.year == null) {
    if (d.month != null || d.day != null) return "Month/day cannot be set without a year";
    return null; // fully unknown — allowed
  }
  if (!Number.isInteger(d.year) || d.year < 1000 || d.year > 3000) {
    return "Year must be a 4-digit number between 1000 and 3000";
  }
  if (d.month == null) {
    if (d.day != null) return "Day cannot be set without a month";
    return null; // year only — the most common partial case
  }
  if (!Number.isInteger(d.month) || d.month < 1 || d.month > 12) return "Month must be 1-12";
  if (d.day == null) return null; // year + month
  if (!Number.isInteger(d.day) || d.day < 1 || d.day > daysInMonth(d.year, d.month)) {
    return "Day does not exist in that month";
  }
  return null;
}

/** "15 March 1980" | "March 1980" | "1980" | "" (unknown). */
export function formatPartialDate(d: PartialDate): string {
  if (d.year == null) return "";
  const year = String(d.year);
  if (d.month == null) return year;
  const month = MONTH_NAMES[d.month - 1];
  if (d.day == null) return `${month} ${year}`;
  return `${d.day} ${month} ${year}`;
}

/**
 * Cross-field date validation for a memorial:
 *  - death date must have at least a year
 *  - if both dates have full years, death must not precede birth
 *  - if both dates are complete, death must not precede birth date
 */
export function validateMemorialDates(
  birth: PartialDate,
  death: PartialDate,
): string | null {
  if (death.year == null) return "A memorial needs at least the year of death";
  const bErr = validatePartialDate(birth);
  if (bErr) return `Born: ${bErr}`;
  const dErr = validatePartialDate(death);
  if (dErr) return `Died: ${dErr}`;
  if (birth.year != null && death.year < birth.year) {
    return "Year of death cannot be before year of birth";
  }
  if (
    birth.year != null && birth.month != null && birth.day != null &&
    death.year != null && death.month != null && death.day != null
  ) {
    const b = new Date(birth.year, birth.month - 1, birth.day).getTime();
    const d = new Date(death.year, death.month - 1, death.day).getTime();
    if (d < b) return "Date of death cannot be before date of birth";
  }
  return null;
}

// ─── Authorization matrix (pure — unit-tested) ──────────────────────────────

/** Co-manager ids + the implicit owner (creator). */
export function effectiveManagerIds(m: MemorialAuthShape): string[] {
  return [m.creatorId, ...m.managerIds];
}

export function isManagerOf(m: MemorialAuthShape, viewer: Viewer): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin") return true; // admin oversight per spec
  return effectiveManagerIds(m).includes(viewer.id);
}

/**
 * Visibility rules:
 *  - "public"   → everyone, including signed-out visitors
 *  - "members"  → signed-in users only
 *  - "managers" → managers + admin only
 * Archived memorials are hidden from everyone except managers + admin.
 */
export function canViewMemorial(m: MemorialAuthShape, viewer: Viewer): boolean {
  const manager = isManagerOf(m, viewer);
  if (m.archived) return manager;
  if (m.visibility === "public") return true;
  if (!viewer) return false;
  if (m.visibility === "members") return true;
  return manager; // visibility === "managers"
}

/** Edit (PATCH): creator, co-managers, admin. Even on archived memorials. */
export function canEditMemorial(m: MemorialAuthShape, viewer: Viewer): boolean {
  return isManagerOf(m, viewer);
}

/** Delete: creator (owner) or admin ONLY — co-managers can never delete. */
export function canDeleteMemorial(m: MemorialAuthShape, viewer: Viewer): boolean {
  if (!viewer) return false;
  return viewer.id === m.creatorId || viewer.role === "admin";
}

/** Add/remove co-managers: creator or admin only. */
export function canManageManagers(m: MemorialAuthShape, viewer: Viewer): boolean {
  if (!viewer) return false;
  return viewer.id === m.creatorId || viewer.role === "admin";
}

/**
 * Moderate condolences (approve/reject/delete-any): managers + admin.
 * Same set as canEditMemorial, kept separate so rules can evolve apart.
 */
export function canModerateCondolences(m: MemorialAuthShape, viewer: Viewer): boolean {
  return isManagerOf(m, viewer);
}

/**
 * Which condolence statuses this viewer may list:
 *  - managers/admin see everything (pending + approved + rejected)
 *  - everyone else sees approved only
 */
export function visibleCondolenceStatuses(
  m: MemorialAuthShape,
  viewer: Viewer,
): CondolenceStatus[] {
  return canModerateCondolences(m, viewer)
    ? ["pending", "approved", "rejected"]
    : ["approved"];
}

/** Can this viewer see one specific condolence row? */
export function canViewCondolence(
  m: MemorialAuthShape,
  viewer: Viewer,
  c: { authorId: string; status: string },
): boolean {
  if (c.status === "approved") return canViewMemorial(m, viewer);
  if (!viewer) return false; // pending/rejected are invisible signed-out
  if (viewer.id === c.authorId) return true; // authors always see their own
  return canModerateCondolences(m, viewer);
}

/**
 * Initial status of a new condolence under this memorial's policy.
 *  - "approved" policy (default): manager must approve first → pending
 *  - "open" policy: posts go live immediately → approved
 */
export function initialCondolenceStatus(policy: string): CondolenceStatus {
  return policy === "open" ? "approved" : "pending";
}

/**
 * Moderation state machine: transitions a manager may perform.
 *  approve:  pending → approved
 *  reject:   pending → rejected
 *  reopen:   rejected → pending (second look), approved → pending (un-approve)
 */
export function moderationTransition(
  current: string,
  action: "approve" | "reject" | "reopen",
): CondolenceStatus | null {
  if (action === "approve") return current === "pending" ? "approved" : null;
  if (action === "reject") return current === "pending" ? "rejected" : null;
  return current === "rejected" || current === "approved" ? "pending" : null;
}

// ─── Input validation (create / edit) ───────────────────────────────────────

export type MemorialInput = {
  fullName: string;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  epitaph: string | null;
  biography: string | null;
  serviceInfo: string | null;
  photoUrl: string | null;
  visibility: MemorialVisibility;
  condolencePolicy: CondolencePolicy;
};

type Body = Record<string, unknown>;

function optInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN; // NaN → caught by date validation
}

function optString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * Validate + normalize a create/edit body. Returns { ok, value } or
 * { ok: false, error }. Client fields mirror the Prisma model 1:1.
 */
export function validateMemorialInput(
  body: Body,
): { ok: true; value: MemorialInput } | { ok: false; error: string } {
  const fullName = optString(body.fullName, MEMORIAL_LIMITS.fullName);
  if (!fullName) {
    return { ok: false, error: `Name is required (max ${MEMORIAL_LIMITS.fullName} characters)` };
  }

  const birth = {
    year: optInt(body.birthYear),
    month: optInt(body.birthMonth),
    day: optInt(body.birthDay),
  };
  const death = {
    year: optInt(body.deathYear),
    month: optInt(body.deathMonth),
    day: optInt(body.deathDay),
  };

  const dateError = validateMemorialDates(birth, death);
  if (dateError) return { ok: false, error: dateError };

  const visibility = MEMORIAL_VISIBILITIES.includes(body.visibility as MemorialVisibility)
    ? (body.visibility as MemorialVisibility)
    : "public";
  const condolencePolicy = CONDOLENCE_POLICIES.includes(body.condolencePolicy as CondolencePolicy)
    ? (body.condolencePolicy as CondolencePolicy)
    : "approved";

  const photoUrl = optString(body.photoUrl, 2048);
  if (photoUrl && !/^https:\/\//.test(photoUrl)) {
    return { ok: false, error: "Photo URL must be an https:// URL" };
  }

  return {
    ok: true,
    value: {
      fullName,
      birthYear: birth.year,
      birthMonth: birth.month,
      birthDay: birth.day,
      deathYear: death.year,
      deathMonth: death.month,
      deathDay: death.day,
      epitaph: optString(body.epitaph, MEMORIAL_LIMITS.epitaph),
      biography: optString(body.biography, MEMORIAL_LIMITS.biography),
      serviceInfo: optString(body.serviceInfo, MEMORIAL_LIMITS.serviceInfo),
      photoUrl,
      visibility,
      condolencePolicy,
    },
  };
}

// ─── Search (GET /api/memorials?q=) ─────────────────────────────────────────

/**
 * Sanitize a free-text search query: trim, cap length, strip LIKE-pattern
 * characters. Empty/null → null (no filtering).
 */
export function sanitizeSearchQuery(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim().slice(0, 80).replace(/[%_\\]/g, "");
  return q || null;
}
