/**
 * Home-shell performance regression tests (2026-11-04 "site opens slowly").
 *
 * Measured production problems pinned here:
 *
 *   1. TTFB — src/app/page.tsx exported `force-dynamic` (share-link OG
 *      metadata lived there), so EVERY visit to / was a fresh server render
 *      in a US function region (x-vercel-cache: MISS, 0.3–1.9s TTFB) while
 *      static pages like /privacy were edge HITs. Fix: / is a static
 *      prerender; src/proxy.ts rewrites ONLY share-param URLs
 *      (/?comic=…, /?view=bible&…, /?post=…, /?group=…, /?event=…) to the
 *      new /share route, which kept the dynamic generateMetadata. Visitors
 *      get edge-cached HTML; WhatsApp previews still resolve real cards.
 *   2. FIRST-LOAD JS — HomeApp statically imported all ~30 views, shipping
 *      the entire SPA in the entry bundle (751KB compressed across 22
 *      chunks). Fix: the 23 views that can never be the initial screen load
 *      via next/dynamic; landing/onboarding/feed/dashboard/profile/header
 *      stay static so first paint is unaffected.
 *
 * Technique: Node's built-in test runner (node:test) + tsx. Pure source
 * contracts — no network, no database, no production contact.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(p, "utf8");
const src = (...p: string[]) => read(path.join("src", ...p));

const homePage = src("app", "page.tsx");
const sharePage = src("app", "share", "page.tsx");
const proxy = src("proxy.ts");
const homeApp = src("components", "home", "HomeApp.tsx");

// ─── 1. Static home shell ────────────────────────────────────────────────────

test("HS-1: / is a static shell — no force-dynamic, no metadata DB lookups", () => {
  assert.doesNotMatch(homePage, /force-dynamic/);
  assert.doesNotMatch(homePage, /generateMetadata/);
  assert.doesNotMatch(homePage, /from "@\/lib\/db"/);
  // Still renders the app…
  assert.match(homePage, /import HomeApp from "@\/components\/home\/HomeApp";/);
  assert.match(homePage, /return <HomeApp \/>;/);
  // …and keeps a canonical for plain /.
  assert.match(homePage, /canonical: "\/"/);
});

test("HS-2: /share keeps the dynamic renderer with real share-link metadata", () => {
  assert.match(sharePage, /export const dynamic = "force-dynamic";/);
  assert.match(sharePage, /export async function generateMetadata/);
  assert.match(sharePage, /from "@\/lib\/db"/);
  // All five share surfaces must still resolve OG cards:
  assert.match(sharePage, /db\.comicChapter\.findFirst/); // /?comic=book/ch
  assert.match(sharePage, /first\(sp\["view"\]\) === "bible"/); // /?view=bible
  assert.match(sharePage, /db\.post\.findUnique/); // /?post=
  assert.match(sharePage, /db\.group\.findUnique/); // /?group=
  assert.match(sharePage, /db\.event\.findUnique/); // /?event=
  assert.match(sharePage, /return <HomeApp \/>;/);
});

// ─── 2. Proxy rewrite: share URLs → /share, everything else untouched ───────

test("HS-3: proxy rewrites only share-param URLs on / to /share", () => {
  // Detection covers every share surface…
  assert.match(proxy, /\["comic", "post", "group", "event"\]/);
  assert.match(proxy, /url\.searchParams\.get\("view"\) === "bible"/);
  // …is anchored on the root path only…
  assert.match(proxy, /url\.pathname !== "\/"\) return false;/);
  // …and rewrites to /share preserving the query string.
  assert.match(proxy, /rewriteUrl\.pathname = "\/share";/);
  assert.match(proxy, /NextResponse\.rewrite\(rewriteUrl\);/);
  // The rewrite must run BEFORE the Supabase session work (share previews
  // are public; the session refresh must not be on the critical path).
  const rewriteAt = proxy.indexOf("NextResponse.rewrite(rewriteUrl)");
  const supabaseAt = proxy.indexOf("createServerClient(");
  assert.ok(rewriteAt !== -1 && supabaseAt !== -1, "rewrite or session block missing");
  assert.ok(rewriteAt < supabaseAt, "share rewrite must precede the Supabase session refresh");
});

// ─── 3. Code splitting: heavy views load on demand ──────────────────────────

const LAZY_VIEWS = [
  "ChurchesView",
  "TriviaView",
  "PrayerWallView",
  "EventsView",
  "ApologeticsView",
  "ShopView",
  "ListYourEntity",
  "BibleView",
  "BiblePlansView",
  "AdminView",
  "ComicView",
  "ComicLibraryView",
  "BusinessDirectoryView",
  "MatrimonyView",
  "GroupsView",
  "GroupDetailView",
  "ExploreView",
  "ReelsView",
  "WatchView",
  "ComposerView",
  "SocialProfileView",
  "NotificationsView",
  "PostDetail",
] as const;

const STATIC_VIEWS = [
  "LandingHero",
  "HeaderUserSection",
  "LanguageSwitcher",
  "AppHomeView",
  "OnboardingView",
  "EditProfileView",
  "FeedView",
  "HomeRightRail",
] as const;

test("HS-4: all 23 non-initial views are next/dynamic imports with a loading fallback", () => {
  for (const view of LAZY_VIEWS) {
    assert.doesNotMatch(
      homeApp,
      new RegExp(`import ${view} from "@\/`),
      `${view} must not be statically imported`
    );
    assert.match(
      homeApp,
      new RegExp(
        `const ${view} = dynamic\\(\\(\\) => import\\("@\/(components|matrimony|social)\/[A-Za-z]+/${view}"\\), \\{ loading: ViewLoader \\}\\);`
      ),
      `${view} must be a dynamic() import with ViewLoader`
    );
  }
});

test("HS-5: initial-screen views stay statically imported (no waterfall before first paint)", () => {
  for (const view of STATIC_VIEWS) {
    assert.match(
      homeApp,
      new RegExp(`import ${view} from "@\/`),
      `${view} must remain a static import`
    );
    assert.doesNotMatch(
      homeApp,
      new RegExp(`const ${view} = dynamic\\(`),
      `${view} must not be dynamic()`
    );
  }
});

test("HS-6: the ViewLoader fallback renders a themed spinner", () => {
  assert.match(homeApp, /function ViewLoader\(\)/);
  assert.match(homeApp, /animate-spin/);
  // #7C3AED is the brand accent — keeps the loading state on-brand.
  assert.match(homeApp, /border-\[#7C3AED\]/);
});

// ─── 4. Behavior preservation: deep-link props still wired ──────────────────

test("HS-7: deep-link prop wiring in HomeApp is untouched by the split", () => {
  // YVP-16b contract (bible-localization.test.ts) still holds — kept here as
  // a fast-failing guard next to the change that could have broken it.
  assert.match(homeApp, /versionRef=\{bibleVersionRef\}/);
  assert.match(homeApp, /sanitizeSavedVersionRef\(localStorage\.getItem\(VERSION_STORAGE_KEY\)\)/);
  // Comic deep link still opens ComicView with the chapter params…
  assert.match(homeApp, /<ComicView/);
  // …and post/group/event deep links still feed their views.
  assert.match(homeApp, /deepLinkPostId=/);
  assert.match(homeApp, /initialEventId=\{deepLinkedEventId\}/);
  assert.match(homeApp, /deepLinkQuestionId=\{deepLinkedQuestionId\}/);
});
