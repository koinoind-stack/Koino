
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { isAccountStatusEligible } from "@/lib/account-status";

// Create PrismaClient directly to avoid Turbopack module issues

/**
 * Shape returned by getAuthUser() for a signed-in, eligible account.
 * (Identical field set to the pre-existing return object — unchanged API
 * surface for all callers.)
 */
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  bio: string | null;
  role: string;
  totalPoints: number;
  profileCompleted: boolean;
};

/**
 * Tri-state account resolution, for routes that must distinguish:
 *   - { state: "anonymous" } — genuinely no valid Supabase session
 *   - { state: "suspended" } — valid session, but the DB account is NOT
 *     eligible ("blocked" / "suspended" / "deactivated" / unknown status).
 *     This state must NEVER be handled as anonymous when a protected
 *     operation is involved.
 *   - { state: "active", user } — valid session + eligible account
 *
 * getAuthUser() collapses "suspended" into null so that every existing
 * require-auth route rejects suspended accounts with its standard
 * 401/403 response — consistent, non-sensitive, fail-closed. Routes that
 * genuinely need the distinction (e.g. to show a friendly "account
 * unavailable" message) can call getAuthAccountState() instead.
 */
export type AuthAccountState =
  | { state: "anonymous" }
  | { state: "suspended" }
  | { state: "active"; user: AuthUser };

/**
 * Get the authenticated user from the server side.
 *
 * Reads the Supabase session cookie, looks up the Supabase auth user,
 * then mirrors them into our Prisma User table (creating if missing —
 * this is how we keep Supabase Auth users in sync with our relational DB
 * for trivia points, gift redemptions, etc.).
 *
 * 🔒 Account-status enforcement (security fix):
 *   The DB record's accountStatus is checked on EVERY request (live read,
 *   no cache — status changes take effect immediately). Only accounts whose
 *   status is "active" (see src/lib/account-status.ts) are returned.
 *   Suspended / blocked / deactivated accounts — admins included — get null,
 *   which every caller already treats as "not authenticated" and rejects
 *   with 401 (or 403 for admin routes). The check runs BEFORE any mirroring
 *   or role-promotion write, so an ineligible account is never modified or
 *   re-activated as a side effect.
 *
 * Returns null if not authenticated — or if authenticated but not eligible.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const account = await resolveAuthAccount();
  return account.state === "active" ? account.user : null;
}

/**
 * Full tri-state resolution used by getAuthUser(); exported for the rare
 * route that must explicitly tell anonymous and suspended sessions apart.
 * See AuthAccountState for the exact contract.
 */
export async function getAuthAccountState(): Promise<AuthAccountState> {
  return resolveAuthAccount();
}

async function resolveAuthAccount(): Promise<AuthAccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { state: "anonymous" };

  // Mirror the Supabase auth user into our Prisma User table.
  // Admins are bootstrapped via the BOOTSTRAP_ADMIN_EMAIL env var (comma-separated).
  // Also check KOINO_ADMIN_EMAIL as an alias (single-admin config).
  // Email comparison is case-insensitive (normalized to lowercase).
  const adminEmails = [
    ...(process.env.BOOTSTRAP_ADMIN_EMAIL || "").split(","),
    ...(process.env.KOINO_ADMIN_EMAIL || "").split(","),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const shouldBeAdmin = adminEmails.includes(user.email.toLowerCase());

  const existing = await db.user.findUnique({ where: { email: user.email } });

  if (existing) {
    // 🔒 SECURITY GATE — must run BEFORE any write below:
    // a blocked/suspended/deactivated (or unknown-status) account is never
    // promoted, never re-mirrored, and never returned — regardless of role.
    // Ordinary users and administrators are subject to the exact same gate.
    if (!isAccountStatusEligible(existing.accountStatus)) {
      return { state: "suspended" };
    }

    let dbUser = existing;

    if (shouldBeAdmin && dbUser.role !== "admin") {
      // Promote to admin if bootstrap email matches and they're not already admin
      dbUser = await db.user.update({
        where: { id: dbUser.id },
        data: { role: "admin" },
      });
      console.log(`[auth] Promoted ${user.email} to admin (bootstrap)`);
    }

    return { state: "active", user: toAuthUser(dbUser) };
  }

  // No DB record yet — mirror the new Supabase auth user into our table.
  // New rows are "active" by schema default, which is correct: this is a
  // genuinely new signup, not a deleted/blocked account (no flow deletes
  // User rows). Role assignment below is the existing bootstrap behavior.
  const created = await db.user.create({
    data: {
      email: user.email,
      // name = display name from Google/email signup metadata.
      // This is NOT the username — username is chosen during onboarding.
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      role: shouldBeAdmin ? "admin" : "user",
      totalPoints: 0,
    },
  });
  console.log(`[auth] Created new user from Supabase auth: ${user.email} (role: ${created.role})`);

  return { state: "active", user: toAuthUser(created) };
}

/**
 * Map a full Prisma User row onto the public AuthUser shape.
 * Kept as one function so the field set stays identical everywhere.
 */
function toAuthUser(dbUser: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  bio: string | null;
  role: string;
  totalPoints: number;
  profileCompleted: boolean | null;
}): AuthUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    image: dbUser.image,
    username: dbUser.username,
    bio: dbUser.bio,
    role: dbUser.role,
    totalPoints: dbUser.totalPoints,
    profileCompleted: dbUser.profileCompleted ?? false,
  };
}

/**
 * Get the authenticated user's full DB record.
 * Use this when you need the freshest totalPoints.
 */
export async function getAuthUserFromDB() {
  const user = await getAuthUser();
  if (!user) return null;
  return db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      username: true,
      bio: true,
      role: true,
      totalPoints: true,
    },
  });
}
