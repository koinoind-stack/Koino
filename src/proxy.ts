import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session-refresh proxy (Next.js 16 — successor of middleware.ts).
 *
 * Runs before every page / API request and makes sure the Supabase auth
 * cookies carried by the request are FRESH:
 *
 *   - If the access token is expired, the refresh happens exactly once,
 *     here, up-front — and the refreshed cookies are forwarded both to the
 *     downstream route handler / server component AND back to the browser.
 *   - Without this, the burst of parallel API calls a freshly-loaded page
 *     fires (/api/auth/me, notifications, feed, ...) could each attempt a
 *     server-side refresh of the same session and race each other
 *     (refresh-token rotation -> "Already Used" -> 401). That is what made
 *     /api/auth/me intermittently fail and the header fall back to
 *     "Member" even though the profile was saved correctly.
 *
 * It performs NO redirects and NO route protection — purely cookie hygiene.
 *
 * ── Share-link rewrite (perf) ───────────────────────────────────────────────
 * Plain / is a static prerender (edge-cached, served in tens of ms). Only
 * share-param URLs are rewritten to /share, the dynamic renderer that keeps
 * the real Open Graph metadata for WhatsApp/Facebook previews. The browser
 * URL is untouched; deep links work exactly as before.
 */

/** Query keys that identify a share link rendered by /share. */
const SHARE_PARAM_KEYS = ["comic", "post", "group", "event"] as const;

function isShareUrl(url: URL): boolean {
  if (url.pathname !== "/") return false;
  if (url.searchParams.get("view") === "bible") return true;
  return SHARE_PARAM_KEYS.some((key) => url.searchParams.has(key));
}

export async function proxy(request: NextRequest) {
  // Share links need the dynamic renderer for their OG metadata — rewrite
  // BEFORE the session work (share previews are public; skipping the refresh
  // here costs nothing, and every /api/* call still gets it).
  if (isShareUrl(request.nextUrl)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/share";
    return NextResponse.rewrite(rewriteUrl);
  }

  // Defensive pass-through when Supabase env is not configured — a missing
  // config must degrade to "no session refresh", never to a site-wide 500.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Refreshed cookies must reach the DOWNSTREAM handler…
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          // …and the BROWSER (so subsequent client fetches are fresh too).
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any app logic between createServerClient and
  // this call — getUser() is what triggers the token refresh + cookie
  // re-issue when the access token is expired. We intentionally ignore the
  // result; this proxy does not gate any route.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export default proxy;

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets. /api is
    // deliberately INCLUDED so API requests always carry a fresh session.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
