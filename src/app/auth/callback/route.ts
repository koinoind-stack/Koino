import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 *
 * Supabase OAuth callback. After the user signs in with Google on
 * Supabase's hosted page, they're redirected here with a `code` query
 * param. We exchange the code for a session (which sets the auth
 * cookies), then redirect to the page they came from (or home).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] Code exchange error:", error.message);
      // Redirect to signin with an error message
      return NextResponse.redirect(
        new URL(`/auth/signin?error=${encodeURIComponent("Sign-in failed. Please try again.")}`, requestUrl.origin)
      );
    }
  }

  // Successful — redirect to the original page or home
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
