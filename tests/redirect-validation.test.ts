/**
 * Regression tests — Phase 1 Fix 1: open-redirect validation on the
 * Supabase auth callback (GET /auth/callback).
 *
 * The callback used to pass the raw `?next=` query parameter into
 * `new URL(next, requestUrl.origin)`, so `?next=https://evil.example` and
 * `?next=//evil.example` redirected freshly authenticated users to an
 * attacker-controlled origin. safeNextPath() now forces a same-origin
 * relative path.
 *
 * Technique: Node's built-in test runner + the repo's tsx devDependency.
 * Supabase auth and next/server are replaced with in-process fakes via
 * mock.module() BEFORE the route module is imported (same harness as
 * tests/profile-endpoints.test.ts). No network, no database, no user data.
 *
 * Run: npm test
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Fake Supabase session/exchange ──────────────────────────────────────
let exchangeError: string | null = null;
let exchangeCalledWith: string | null = null;

mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => ({
      auth: {
        exchangeCodeForSession: async (code: string) => {
          exchangeCalledWith = code;
          return { error: exchangeError ? { message: exchangeError } : null };
        },
      },
    }),
  },
});

// ─── 2. Fake next/server (records redirect targets) ─────────────────────────
let lastRedirectUrl: string | null = null;

class FakeNextResponse {
  readonly status: number;
  readonly bodyText: string;
  constructor(bodyText: string, init?: { status?: number }) {
    this.bodyText = bodyText;
    this.status = init?.status ?? 200;
  }
  static json(data: unknown, init?: { status?: number }): FakeNextResponse {
    return new FakeNextResponse(JSON.stringify(data), init);
  }
  static redirect(url: string | URL, status?: number): FakeNextResponse {
    lastRedirectUrl = String(url);
    return new FakeNextResponse("", { status: status ?? 307 });
  }
}

mock.module("next/server", {
  namedExports: {
    NextResponse: FakeNextResponse,
    NextRequest: class FakeNextRequest {},
  },
});

// ─── 3. Import the route (AFTER the mocks, via before()) ────────────────────
type CallbackRoute = typeof import("@/app/auth/callback/route");
let route: CallbackRoute;
let safeNextPath: CallbackRoute["safeNextPath"];

before(async () => {
  route = await import("@/app/auth/callback/route");
  safeNextPath = route.safeNextPath;
});

const ORIGIN = "https://www.koino.in";

function callbackUrl(next: string | null, code?: string): string {
  const u = new URL(`${ORIGIN}/auth/callback`);
  if (code) u.searchParams.set("code", code);
  if (next !== null) u.searchParams.set("next", next);
  return u.toString();
}

async function run(next: string | null, code?: string) {
  lastRedirectUrl = null;
  const res = await route.GET(new Request(callbackUrl(next, code)) as never);
  return { res, location: lastRedirectUrl };
}

// ════════════════════════════════════════════════════════════════════════════
// safeNextPath() — pure-function unit tests
// ════════════════════════════════════════════════════════════════════════════

test("RD-1: absolute URL (https://evil.example) is rejected → \"/\"", () => {
  assert.equal(safeNextPath("https://evil.example/steal", ORIGIN), "/");
});

test("RD-2: protocol-relative \"//evil.example\" is rejected → \"/\"", () => {
  assert.equal(safeNextPath("//evil.example/steal", ORIGIN), "/");
});

test("RD-3: backslash protocol-relative \"/\\\\evil.example\" is rejected → \"/\"", () => {
  assert.equal(safeNextPath("/\\evil.example/steal", ORIGIN), "/");
});

test("RD-4: absolute URL on a look-alike origin (https://www.koino.in.evil.example) is rejected", () => {
  assert.equal(safeNextPath("https://www.koino.in.evil.example/x", ORIGIN), "/");
});

test("RD-5: control characters / whitespace are rejected", () => {
  assert.equal(safeNextPath("/x\r\nSet-Cookie: 1", ORIGIN), "/");
  assert.equal(safeNextPath("/x\n/y", ORIGIN), "/");
  assert.equal(safeNextPath("/x y", ORIGIN), "/");
  assert.equal(safeNextPath("/x\t", ORIGIN), "/");
});

test("RD-6: javascript:/data: schemes are rejected (do not start with '/')", () => {
  assert.equal(safeNextPath("javascript:alert(1)", ORIGIN), "/");
  assert.equal(safeNextPath("data:text/html,hi", ORIGIN), "/");
});

test("RD-7: legitimate same-origin deep links are preserved verbatim", () => {
  assert.equal(safeNextPath("/", ORIGIN), "/");
  assert.equal(safeNextPath("/?view=comic", ORIGIN), "/?view=comic");
  assert.equal(safeNextPath("/memorials/abc?x=1#anchor", ORIGIN), "/memorials/abc?x=1#anchor");
  assert.equal(safeNextPath("/blog/some-slug", ORIGIN), "/blog/some-slug");
});

test("RD-8: null / empty / non-string fall back to \"/\"", () => {
  assert.equal(safeNextPath(null, ORIGIN), "/");
  assert.equal(safeNextPath(undefined, ORIGIN), "/");
  assert.equal(safeNextPath("", ORIGIN), "/");
});

// ════════════════════════════════════════════════════════════════════════════
// GET /auth/callback — end-to-end through the route handler
// ════════════════════════════════════════════════════════════════════════════

test("RD-9: callback with malicious absolute next= redirects to the SAME origin, not the attacker", async () => {
  exchangeError = null;
  const { location } = await run("https://evil.example/steal", "auth-code-123");
  assert.ok(location, "route must issue a redirect");
  assert.equal(new URL(location!).origin, ORIGIN, "redirect must stay on www.koino.in");
  assert.equal(new URL(location!).pathname, "/", "fallback target must be /");
});

test("RD-10: callback with protocol-relative next= (//evil.example) stays on origin", async () => {
  const { location } = await run("//evil.example/steal", "auth-code-123");
  assert.ok(location);
  assert.equal(new URL(location!).origin, ORIGIN);
  assert.equal(new URL(location!).pathname, "/");
});

test("RD-11: callback with a legitimate next= deep link redirects there (no auth regression)", async () => {
  const { location } = await run("/?view=comic", "auth-code-123");
  assert.ok(location);
  const target = new URL(location!);
  assert.equal(target.origin, ORIGIN);
  assert.equal(target.pathname, "/");
  assert.equal(target.search, "?view=comic");
});

test("RD-12: callback still exchanges the code for a session (auth flow unchanged)", async () => {
  exchangeError = null;
  exchangeCalledWith = null;
  await run("/?view=comic", "auth-code-abc");
  assert.equal(exchangeCalledWith, "auth-code-abc", "code exchange must still happen");
});

test("RD-13: code-exchange failure still redirects to /auth/signin with error (regression guard)", async () => {
  exchangeError = "invalid grant";
  const { location } = await run("/", "bad-code");
  assert.ok(location);
  const target = new URL(location!);
  assert.equal(target.origin, ORIGIN);
  assert.equal(target.pathname, "/auth/signin");
  assert.equal(target.searchParams.get("error"), "Sign-in failed. Please try again.");
  exchangeError = null;
});

test("RD-14: callback without next= lands on \"/\" (default unchanged)", async () => {
  const { location } = await run(null, "auth-code-123");
  assert.ok(location);
  assert.equal(new URL(location!).toString(), `${ORIGIN}/`);
});
