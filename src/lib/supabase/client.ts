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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail with a DIAGNOSABLE message when the deployment is missing Supabase
  // env vars. NEXT_PUBLIC_* vars are inlined at BUILD time — setting them
  // requires platform env config + redeploy, not runtime changes.
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the hosting platform's environment variables and redeploy."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
