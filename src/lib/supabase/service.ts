import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the SERVICE ROLE key — bypasses Row Level Security.
 *
 * ⚠️ SECURITY: This key can do ANYTHING on your Supabase project. NEVER expose
 * it to the browser. Only use this in:
 *   - Server-only code (Route Handlers, Server Actions, server-side scripts)
 *   - Migration/seed scripts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL — e.g. https://abcdef.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — secret service role key from Supabase dashboard
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
