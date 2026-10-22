import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Use this in Client Components ("use client").
 *
 * Reads cookies automatically via @supabase/ssr to keep the user's session
 * in sync between server and browser.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL — e.g. https://abcdef.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — public anon key from Supabase dashboard
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
