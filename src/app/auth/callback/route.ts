import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Validate the post-sign-in redirect target.
 *
 * Security fix (open redirect): the `?next=` query parameter used to be
 * passed straight into `new URL(next, requestUrl.origin)`. WHATWG URL
 * resolution accepts absolute URLs, so `?next=https://evil.example` (or a
 * protocol-relative `?next=//evil.example`) redirected freshly
 * authenticated users to an attacker-controlled site — a phishing-grade
 * open redirect on the most sensitive redirect in the app.
 *
 * Policy: `next` must be a SAME-ORIGIN relative path.
 *   - must start with a single "/"
 *   - must NOT start with "//" or "/\" (protocol-relative tricks; browsers
 *     treat both as "//<host>")
 *   - must contain no control characters or whitespace (header/URL smuggling)
 *   - after resolution, the final URL origin must equal the request origin
 *     (belt-and-braces: even a crafted bypass falls back to "/")
 * Anything else falls back to "/", preserving all legitimate deep links
 * (e.g. "/?view=comic", "/memorials/abc?x=1#anchor") unchanged.
 */
export function safeNextPath(raw: string | null | undefined, requestOrigin: string): string {
  const fallback = "/";
  if (!raw) return fallback;

  // Control chars / whitespace (spaces are legal in paths only when encoded;
  // a raw one here means tampering).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return fallback;

  // Relative-path-only policy.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  // Belt-and-braces: resolve and require the SAME origin as the request.
  try {
    const resolved = new URL(raw, requestOrigin);
    if (resolved.origin !== requestOrigin) return fallback;
  } catch {
    return fallback;
  }

  return raw;
}

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
  const next = safeNextPath(requestUrl.searchParams.get("next"), requestUrl.origin);

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
