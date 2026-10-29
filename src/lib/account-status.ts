/**
 * Account-status eligibility — single source of truth for the whole app.
 *
 * ⚙ Schema (prisma/schema.prisma → User.accountStatus, String, default "active"):
 *       "active" | "blocked" | "suspended" | "deactivated"
 *
 * 🔒 Policy (fail-closed):
 *   ONLY the exact, verified value "active" may use authenticated features.
 *   Every other value — "blocked", "suspended", "deactivated", or anything
 *   unexpected/missing — is treated as INELIGIBLE. The comparison is exact
 *   and lowercase on purpose: the only server-side writer of this field is
 *   PATCH /api/admin/members/[id], which validates against the same
 *   lowercase value set, and the column default is lowercase "active".
 *
 * This module is intentionally dependency-free (no imports) so the security
 * decision can be unit-tested in complete isolation from Next.js, Supabase
 * and Prisma.
 */

/** Every value the schema documents for User.accountStatus. */
export const ACCOUNT_STATUS_VALUES = [
  "active",
  "blocked",
  "suspended",
  "deactivated",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUS_VALUES)[number];

/** Statuses that may use authenticated features. Nothing else. */
const ACCOUNT_ELIGIBLE_STATUSES: ReadonlySet<string> = new Set<string>([
  "active",
]);

/**
 * Decide whether a DB `accountStatus` value may use authenticated features.
 *
 * Returns true ONLY for the exact string "active". Null, undefined, empty,
 * wrong-case or unknown values all return false (fail-closed), so an account
 * with corrupt/missing status data can never regain access by accident.
 *
 * Pure function — exported for automated regression tests and reused by
 * src/lib/auth-server.ts to gate getAuthUser() centrally.
 */
export function isAccountStatusEligible(
  status: string | null | undefined
): boolean {
  return typeof status === "string" && ACCOUNT_ELIGIBLE_STATUSES.has(status);
}
