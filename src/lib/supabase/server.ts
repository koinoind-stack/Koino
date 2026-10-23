import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client. Use this in:
 *   - Server Components
 *   - Route Handlers (app/api/...)
 *   - Server Actions
 *
 * Reads + writes cookies via next/headers so the user's auth session
 * is preserved across server requests.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL — e.g. https://abcdef.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — public anon key from Supabase dashboard
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
