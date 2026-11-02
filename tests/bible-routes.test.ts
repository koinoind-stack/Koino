/**
 * Regression tests — per-client rate limiting on the public Bible endpoints.
 *
 * Contract under test:
 *   BR-0  clientKeyFromRequest: platform x-real-ip wins, LAST x-forwarded-for
 *         hop is used (client-controlled first hops must not defeat the
 *         limiter), no headers → "unknown"
 *   BR-1  normal reading: GET /api/bible/chapter and GET /api/bible/versions
 *         return 200 for a legitimate client
 *   BR-2  cache hits: a repeated chapter read is served from the server-side
 *         chapter cache with NO second upstream fetch (and still counts as a
 *         normal read for the client's own budget)
 *   BR-3  excessive requests: request bursts beyond the per-client window get
 *         HTTP 429 with Retry-After — chapter keeps the { error: { kind,
 *         message } } taxonomy (kind "rate_limited"), versions keeps the
 *         plain { error } shape used by the other public guards
 *   BR-4  per-client isolation: one client exhausting its budget never blocks
 *         another client
 *
 * Technique: Node's built-in test runner + the repo's existing tsx
 * devDependency. next/server is replaced with a headers-aware in-process fake
 * via mock.module() BEFORE the route modules are imported (same technique as
 * tests/profile-endpoints.test.ts); the REAL lib layer (bible-server,
 * rate-limit, youversion catalog/config) runs on top. Upstream HTTP
 * (bible-api.com / YouVersion) is stubbed via globalThis.fetch — no network,
 * no database, no App Key.
 *
 * Run: npm test
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  clientKeyFromRequest,
  __resetRateLimitForTests,
} from "@/lib/social/rate-limit";
import { __resetYouVersionCatalogForTests } from "@/lib/youversion/catalog";
import { __resetBibleServerCachesForTests } from "@/lib/bible-server";

/* ─── 1. Harness environment (test process only — never production) ──────── */

function disableYouVersion() {
  delete process.env.YOUVERSION_ENABLED;
  delete process.env.YOUVERSION_APP_KEY;
  delete process.env.YOUVERSION_API_BASE_URL;
}
disableYouVersion();

/* ─── 2. Headers-aware fake next/server ──────────────────────────────────── */

type ResponseInitLike = { status?: number; headers?: Record<string, string> };

class FakeNextResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly bodyText: string;
  constructor(bodyText: string, init?: ResponseInitLike) {
    this.bodyText = bodyText;
    this.status = init?.status ?? 200;
    this.headers = new Headers(init?.headers ?? {});
  }
  static json(data: unknown, init?: ResponseInitLike): FakeNextResponse {
    return new FakeNextResponse(JSON.stringify(data), init);
  }
}

function jsonOf(resp: unknown): Record<string, unknown> {
  return JSON.parse((resp as FakeNextResponse).bodyText) as Record<string, unknown>;
}

mock.module("next/server", {
  namedExports: {
    NextResponse: FakeNextResponse,
    NextRequest: class FakeNextRequest {},
  },
});

/* ─── 3. Route modules — imported AFTER the mock (see before()) ──────────── */

type VersionsRoute = typeof import("@/app/api/bible/versions/route");
type ChapterRoute = typeof import("@/app/api/bible/chapter/route");

let versionsRoute: VersionsRoute;
let chapterRoute: ChapterRoute;

before(async () => {
  versionsRoute = await import("@/app/api/bible/versions/route");
  chapterRoute = await import("@/app/api/bible/chapter/route");
});

/* ─── helpers ────────────────────────────────────────────────────────────── */

function kjvJohn3() {
  return {
    reference: "John 3",
    translation_id: "kjv",
    translation_name: "King James Version",
    translation_note: "",
    verses: [1, 2, 3].map((v) => ({
      book_id: "john",
      book_name: "John",
      chapter: 3,
      verse: v,
      text: `Verse ${v} text.`,
    })),
  };
}

function stubFetch(handler: (url: string) => { status: number; body?: unknown }) {
  const log: string[] = [];
  const fn = (async (url: string | URL) => {
    const u = String(url);
    log.push(u);
    const r = handler(u);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  }) as unknown as typeof fetch;
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  return {
    log,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function req(path: string, clientIp: string | null): Request {
  const headers: Record<string, string> = {};
  if (clientIp) headers["x-real-ip"] = clientIp;
  return new Request(`http://localhost:3000${path}`, { headers });
}

const CHAPTER_OK = `/api/bible/chapter?version=koino:kjv&book=john&chapter=3`;
const CHAPTER_LIMIT = 60; // keep in sync with src/app/api/bible/chapter/route.ts
const VERSIONS_LIMIT = 30; // keep in sync with src/app/api/bible/versions/route.ts

/* ─── shared state reset (no cross-test leakage) ─────────────────────────── */

beforeEach(() => {
  disableYouVersion();
  __resetRateLimitForTests();
  __resetYouVersionCatalogForTests();
  __resetBibleServerCachesForTests();
});

/* ─── BR-0: client identity extraction ───────────────────────────────────── */

test("BR-0a: clientKeyFromRequest prefers the platform x-real-ip", () => {
  const r = new Request("http://localhost/x", {
    headers: {
      "x-real-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    },
  });
  assert.equal(clientKeyFromRequest(r), "203.0.113.9");
});

test("BR-0b: without x-real-ip the LAST x-forwarded-for hop is used", () => {
  const r = new Request("http://localhost/x", {
    headers: { "x-forwarded-for": "198.51.100.1, 198.51.100.2, 198.51.100.3" },
  });
  // The first hop is client-controlled; only the edge-appended last hop is
  // trustworthy for limiting.
  assert.equal(clientKeyFromRequest(r), "198.51.100.3");
});

test("BR-0c: no proxy headers → shared 'unknown' bucket (dev parity)", () => {
  assert.equal(clientKeyFromRequest(new Request("http://localhost/x")), "unknown");
});

/* ─── BR-1: normal reading ───────────────────────────────────────────────── */

test("BR-1a: normal reading — chapter request returns 200 with verses (one upstream fetch)", async () => {
  const stub = stubFetch((url) =>
    url.includes("bible-api.com") ? { status: 200, body: kjvJohn3() } : { status: 404 }
  );
  try {
    const res = await chapterRoute.GET(req(CHAPTER_OK, "203.0.113.7"));
    assert.equal(res.status, 200);
    const body = jsonOf(res) as Record<string, unknown>;
    assert.equal(body.provider, "koino");
    assert.equal(body.versionRef, "koino:kjv");
    assert.equal(body.reference, "John 3");
    const verses = body.verses as { verse: number; text: string }[];
    assert.equal(verses.length, 3);
    assert.equal(stub.log.length, 1);
  } finally {
    stub.restore();
  }
});

test("BR-1b: normal reading — versions catalogue returns 200 with fallbacks", async () => {
  const res = await versionsRoute.GET(req("/api/bible/versions", "203.0.113.7"));
  assert.equal(res.status, 200);
  const body = jsonOf(res) as { enabled: boolean; versions: unknown[] };
  // YouVersion disabled in the harness → catalogue falls back to Koino only.
  assert.equal(body.enabled, false);
  assert.ok(Array.isArray(body.versions) && body.versions.length > 0);
});

/* ─── BR-2: cache hits ───────────────────────────────────────────────────── */

test("BR-2: repeated chapter read is a cache hit — no second upstream fetch", async () => {
  const stub = stubFetch((url) =>
    url.includes("bible-api.com") ? { status: 200, body: kjvJohn3() } : { status: 404 }
  );
  try {
    const r1 = await chapterRoute.GET(req(CHAPTER_OK, "203.0.113.7"));
    const r2 = await chapterRoute.GET(req(CHAPTER_OK, "203.0.113.7"));
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(stub.log.length, 1, "second identical read must be served from cache");
  } finally {
    stub.restore();
  }
});

/* ─── BR-3: excessive requests → HTTP 429 ────────────────────────────────── */

test("BR-3a: excessive chapter requests → HTTP 429, rate_limited kind, Retry-After", async () => {
  const stub = stubFetch((url) =>
    url.includes("bible-api.com") ? { status: 200, body: kjvJohn3() } : { status: 404 }
  );
  try {
    const ip = "203.0.113.31";
    let last: FakeNextResponse | null = null;
    // After the first read every request is a cache hit — the limiter still
    // counts each client request (it sits upstream of the cache by design).
    for (let i = 0; i <= CHAPTER_LIMIT; i++) {
      last = (await chapterRoute.GET(req(CHAPTER_OK, ip))) as unknown as FakeNextResponse;
    }
    assert.equal(last!.status, 429);
    assert.equal(last!.headers.get("retry-after"), "60");
    const body = jsonOf(last!) as { error: { kind: string; message: string } };
    assert.equal(body.error.kind, "rate_limited");
    assert.ok(body.error.message.length > 0);
  } finally {
    stub.restore();
  }
});

test("BR-3b: excessive versions requests → HTTP 429, plain error, Retry-After", async () => {
  const ip = "203.0.113.32";
  let last: FakeNextResponse | null = null;
  for (let i = 0; i <= VERSIONS_LIMIT; i++) {
    last = (await versionsRoute.GET(req("/api/bible/versions", ip))) as unknown as FakeNextResponse;
  }
  assert.equal(last!.status, 429);
  assert.equal(last!.headers.get("retry-after"), "60");
  const body = jsonOf(last!) as { error: string };
  assert.equal(body.error, "Too many requests");
});

/* ─── BR-4: per-client isolation ─────────────────────────────────────────── */

test("BR-4: per-client isolation — an exhausted client never blocks another", async () => {
  const stub = stubFetch((url) =>
    url.includes("bible-api.com") ? { status: 200, body: kjvJohn3() } : { status: 404 }
  );
  try {
    const heavy = "203.0.113.41";
    let last: FakeNextResponse | null = null;
    for (let i = 0; i <= CHAPTER_LIMIT; i++) {
      last = (await chapterRoute.GET(req(CHAPTER_OK, heavy))) as unknown as FakeNextResponse;
    }
    assert.equal(last!.status, 429, "heavy client must be limited");

    const other = await chapterRoute.GET(req(CHAPTER_OK, "203.0.113.42"));
    assert.equal(other.status, 200, "a different client must still read normally");
  } finally {
    stub.restore();
  }
});
