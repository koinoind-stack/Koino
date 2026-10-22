import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";

// Create PrismaClient directly to avoid Turbopack module issues
const db = new PrismaClient();

/**
 * Get the authenticated user from the server side.
 *
 * Reads the Supabase session cookie, looks up the Supabase auth user,
 * then mirrors them into our Prisma User table (creating if missing —
 * this is how we keep Supabase Auth users in sync with our relational DB
 * for trivia points, gift redemptions, etc.).
 *
 * Returns null if not authenticated.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

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

  let dbUser = await db.user.findUnique({ where: { email: user.email } });
  if (!dbUser) {
    dbUser = await db.user.create({
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
    console.log(`[auth] Created new user from Supabase auth: ${user.email} (role: ${dbUser.role})`);
  } else if (shouldBeAdmin && dbUser.role !== "admin") {
    // Promote to admin if bootstrap email matches and they're not already admin
    dbUser = await db.user.update({
      where: { id: dbUser.id },
      data: { role: "admin" },
    });
    console.log(`[auth] Promoted ${user.email} to admin (bootstrap)`);
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    image: dbUser.image,
    role: dbUser.role,
    totalPoints: dbUser.totalPoints,
    profileCompleted: (dbUser as any).profileCompleted ?? false,
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
      role: true,
      totalPoints: true,
    },
  });
}
