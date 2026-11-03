/**
 * Regression tests — Phase 1: Security & Visibility Stabilization.
 *
 * Pins the eight Phase 1 fixes from the approved Implementation Plan v2
 * (Chapter 6 §6.1, Table 14), basis commit 426e0f8:
 *
 *   Fix 1  /api/blog/latest visibility gate — status leg was missing, so a
 *          row in a non-published workflow state with a stale legacy
 *          `published` boolean could render on the landing page.
 *   Fix 2  scheduledAt hold — a future `scheduledAt` now hides a post on
 *          EVERY public BlogPost surface (in-memory gate + Prisma where
 *          builder + page/sitemap/social-feed wiring).
 *   Fix 3  share-card gate — replaced the ad-hoc `published + scheduledAt`
 *          check (no status, no publishedAt) with the ONE shared gate.
 *   Fix 4  admin instant-publish (publishNow) now syncs the feed wrapper
 *          immediately — the article reaches the home feed on create.
 *   Fix 5  hard delete removes the wrapper Post in the SAME transaction —
 *          no orphaned excerpt-only post linking to a 404.
 *   Fix 12a admin/contributors guard — 401 (unauthenticated) and 403
 *          (unauthorized) no longer collapse into a bare 403.
 *   Fix 13a /api/admin/upload — approved contributors must hold
 *          CAN_UPLOAD_IMAGES on their Contributor record.
 *   Fix 14  /api/contributor/apply — userId resolved from the session,
 *          client-supplied values ignored.
 *
 * Technique: Node's built-in test runner (node:test) + the repo's tsx
 * devDependency. Prisma, Supabase auth, next/server, the rate limiter and
 * the share-card renderer are replaced with in-process fakes via
 * mock.module() BEFORE the modules under test are imported. No network,
 * no database, no real user data. The YouVersion/Bible modules are mocked
 * out (parseVersionRef/resolveChapter) — this suite never exercises them.
 *
 * Run: npm test
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Harness environment (test process only — never production) ─────────
// The upload route treats this exact value as "not configured", giving a
// deterministic post-auth failure point for permission-pass cases.
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-service-role-key";

// ─── 2. Fake session (getAuthUser) ──────────────────────────────────────────
type FakeAuthUser = { id: string; role: string; name: string | null; username: string | null };
let sessionUser: FakeAuthUser | null = null;
function setSession(u: FakeAuthUser | null): void {
  sessionUser = u;
}

// ─── 3. Fake Prisma ─────────────────────────────────────────────────────────
type Call = { model: string; op: string; args: any };
const calls: Call[] = [];
let blogPostRows: any[] = []; // rows returned by blogPost.findMany/findUnique
let contributorRow: any = null;
const createdApplications: any[] = [];
let wrapperPostRow: any = null; // existing wrapper returned by post.findUnique
let transactionDepth = 0;
let txOps: Call[] = []; // ops executed inside the current transaction

function record(model: string, op: string, args: any): void {
  const entry = { model, op, args };
  calls.push(entry);
  if (transactionDepth > 0) txOps.push(entry);
}

const fakeDb = {
  blogPost: {
    findMany: async (args: any) => {
      record("blogPost", "findMany", args);
      return blogPostRows;
    },
    findUnique: async (args: any) => {
      record("blogPost", "findUnique", args);
      if (args.select && Object.keys(args.select).length === 1 && args.select.id) {
        return blogPostRows.find((r) => r.id === args.where.id) ?? null;
      }
      if (args.where.slug) return blogPostRows.find((r) => r.slug === args.where.slug) ?? null;
      return blogPostRows.find((r) => r.id === args.where.id) ?? null;
    },
    count: async (args: any) => {
      record("blogPost", "count", args);
      return blogPostRows.length;
    },
    create: async (args: any) => {
      record("blogPost", "create", args);
      const row = {
        id: "bp_new",
        scheduledAt: null,
        featuredImage: null,
        ...args.data,
      };
      blogPostRows = [...blogPostRows, row];
      return row;
    },
    delete: async (args: any) => {
      record("blogPost", "delete", args);
      const row = blogPostRows.find((r) => r.id === args.where.id) ?? null;
      blogPostRows = blogPostRows.filter((r) => r.id !== args.where.id);
      return row;
    },
  },
  post: {
    findUnique: async (args: any) => {
      record("post", "findUnique", args);
      return wrapperPostRow;
    },
    create: async (args: any) => {
      record("post", "create", args);
      wrapperPostRow = { id: "post_new", ...args.data };
      return wrapperPostRow;
    },
    update: async (args: any) => {
      record("post", "update", args);
      wrapperPostRow = { ...(wrapperPostRow ?? {}), ...args.data };
      return wrapperPostRow;
    },
    deleteMany: async (args: any) => {
      record("post", "deleteMany", args);
      const had = wrapperPostRow !== null;
      wrapperPostRow = null;
      return { count: had ? 1 : 0 };
    },
  },
  contributor: {
    findUnique: async (args: any) => {
      record("contributor", "findUnique", args);
      return contributorRow;
    },
    findMany: async (args: any) => {
      record("contributor", "findMany", args);
      return contributorRow ? [contributorRow] : [];
    },
  },
  contributorApplication: {
    findMany: async (args: any) => {
      record("contributorApplication", "findMany", args);
      return [];
    },
    findUnique: async (args: any) => {
      record("contributorApplication", "findUnique", args);
      return null;
    },
    update: async (args: any) => {
      record("contributorApplication", "update", args);
      return {};
    },
    create: async (args: any) => {
      record("contributorApplication", "create", args);
      const row = { id: `app_${createdApplications.length + 1}`, ...args.data };
      createdApplications.push(row);
      return row;
    },
  },
  user: {
    findUnique: async (args: any) => {
      record("user", "findUnique", args);
      // blog/articles requireActiveUser() reads accountStatus for the
      // session user — the harness session user is always active.
      if (args.where.id && sessionUser && args.where.id === sessionUser.id) {
        return { id: sessionUser.id, accountStatus: "active" };
      }
      return null;
    },
  },
  // Phase 1 fix 5 test: $transaction must hand the SAME ops a single tx —
  // the fake runs the callback against a proxy that tags every call.
  $transaction: async (cb: (tx: any) => Promise<any>) => {
    record("db", "$transaction", {});
    transactionDepth++;
    txOps = [];
    try {
      return await cb(fakeDb);
    } finally {
      transactionDepth--;
    }
  },
};

// ─── 4. Fake next/server ────────────────────────────────────────────────────
class FakeNextResponse {
  readonly status: number;
  readonly body: unknown;
  readonly bodyText: string | null;
  readonly headers: Record<string, string>;
  constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.bodyText = typeof body === "string" ? body : null;
    this.status = init?.status ?? 200;
    this.headers = init?.headers ?? {};
  }
  static json(data: unknown, init?: { status?: number }): FakeNextResponse {
    return new FakeNextResponse(JSON.stringify(data), init);
  }
}

// ─── 5. Replace the module graph BEFORE importing the code under test ──────
// `@/lib/marketplace` carries a build-time-only `import "server-only"` (the
// Next.js compiler aliases it; the direct node runner cannot resolve it).
// The marketplace logic itself is not under test — stub the one helper the
// share-card route uses, with the same semantics as the real implementation.
mock.module("@/lib/marketplace", {
  namedExports: {
    safeParseArray: (raw: unknown): any[] => {
      if (typeof raw !== "string" || raw.trim().length === 0) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  },
});
mock.module("@/lib/db", { namedExports: { db: fakeDb } });
mock.module("next/server", { namedExports: { NextResponse: FakeNextResponse } });
mock.module("@/lib/auth-server", {
  namedExports: {
    getAuthUser: async () => sessionUser,
  },
});
mock.module("@/lib/social/rate-limit", {
  namedExports: { rateLimit: () => true },
});
mock.module("@/lib/share/card-renderer", {
  namedExports: {
    renderShareCard: async (spec: unknown) => {
      record("renderer", "renderShareCard", spec);
      return Buffer.from("fake-png-bytes");
    },
    isCardFormat: (f: string) => ["square", "portrait", "story", "landscape"].includes(f),
    isKoinoHostedImage: () => false,
  },
});
// The share-card route imports the Bible transport — keep it stubbed and
// untouched (Phase 1 must not load, call or modify the YouVersion stack).
mock.module("@/lib/bible-versions", {
  namedExports: { parseVersionRef: () => null },
});
mock.module("@/lib/bible-server", {
  namedExports: {
    resolveChapter: async () => ({ ok: false as const, error: "stubbed" }),
  },
});
mock.module("@/lib/supabase/service", {
  namedExports: {
    createServiceClient: () => {
      throw new Error("createServiceClient must not be reached in Phase 1 tests");
    },
  },
});
// (sharp is a real dependency and loads fine — no mock needed; the upload
// routes under test reject before sharp ever runs.)

// ─── 6. Import the modules under test (AFTER the mocks) ────────────────────
type BlogLib = typeof import("@/lib/blog");
type BlogServer = typeof import("@/lib/blog-server");
type LatestRoute = typeof import("@/app/api/blog/latest/route");
type ShareCardRoute = typeof import("@/app/api/share-card/route");
type BlogArticlesRoute = typeof import("@/app/api/blog/articles/route");
type AdminBlogIdRoute = typeof import("@/app/api/admin/blog/[id]/route");
type AdminContributorsRoute = typeof import("@/app/api/admin/contributors/route");
type AdminUploadRoute = typeof import("@/app/api/admin/upload/route");
type ApplyRoute = typeof import("@/app/api/contributor/apply/route");

let blogLib: BlogLib;
let blogServer: BlogServer;
let latestRoute: LatestRoute;
let shareCardRoute: ShareCardRoute;
let blogArticlesRoute: BlogArticlesRoute;
let adminBlogIdRoute: AdminBlogIdRoute;
let adminContributorsRoute: AdminContributorsRoute;
let adminUploadRoute: AdminUploadRoute;
let applyRoute: ApplyRoute;

before(async () => {
  blogLib = await import("@/lib/blog");
  blogServer = await import("@/lib/blog-server");
  latestRoute = await import("@/app/api/blog/latest/route");
  shareCardRoute = await import("@/app/api/share-card/route");
  blogArticlesRoute = await import("@/app/api/blog/articles/route");
  adminBlogIdRoute = await import("@/app/api/admin/blog/[id]/route");
  adminContributorsRoute = await import("@/app/api/admin/contributors/route");
  adminUploadRoute = await import("@/app/api/admin/upload/route");
  applyRoute = await import("@/app/api/contributor/apply/route");
});

function resetState(): void {
  calls.length = 0;
  txOps = [];
  transactionDepth = 0;
  blogPostRows = [];
  contributorRow = null;
  createdApplications.length = 0;
  wrapperPostRow = null;
  setSession(null);
}

/** The runtime responses are the FakeNextResponse mocks; the compile-time
 *  types are the real NextResponse. Read the fake-only fields through this. */
function fakeBody(res: unknown): string {
  return (res as { bodyText?: string }).bodyText ?? "";
}

// ─── 7. Mini where-clause evaluator (shapes used by the gate builder) ──────
type Row = Record<string, any>;
type Where = Record<string, any>;

function matchesWhere(row: Row, where: Where): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      if (!(cond as Where[]).every((c) => matchesWhere(row, c))) return false;
    } else if (key === "OR") {
      if (!(cond as Where[]).some((c) => matchesWhere(row, c))) return false;
    } else if (key === "NOT") {
      if (matchesWhere(row, cond as Where)) return false;
    } else if (cond === null) {
      if (row[key] !== null) return false;
    } else if (cond === undefined) {
      // no constraint
    } else if (typeof cond === "object" && cond !== null && !(cond instanceof Date)) {
      if ("lte" in cond) {
        const v = row[key] as Date | null;
        if (v && v.getTime() > (cond.lte as Date).getTime()) return false;
      }
      if ("in" in cond) {
        if (!(cond.in as any[]).includes(row[key])) return false;
      }
      if ("notIn" in cond) {
        if ((cond.notIn as any[]).includes(row[key])) return false;
      }
      if ("contains" in cond) {
        const hay = String(row[key] ?? "");
        const needle = String(cond.contains);
        const hit = cond.mode === "insensitive"
          ? hay.toLowerCase().includes(needle.toLowerCase())
          : hay.includes(needle);
        if (!hit) return false;
      }
    } else {
      if (row[key] !== cond) return false;
    }
  }
  return true;
}

// ─── helpers ────────────────────────────────────────────────────────────────
const PAST = new Date("2026-01-01T00:00:00Z");
const FUTURE = new Date("2030-01-01T00:00:00Z");

function makeRow(over: Partial<Row>): Row {
  return {
    id: "bp1",
    slug: "post-1",
    title: "A test post",
    excerpt: "ex",
    category: "Bible Study",
    published: true,
    status: "published",
    publishedAt: PAST,
    scheduledAt: null,
    ...over,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// FIX 2 — shared in-memory visibility gate (status × published × dates)
// ════════════════════════════════════════════════════════════════════════════

test("P1-GATE-1: full matrix — visible ONLY when published + status=published + no future publishedAt + no future scheduledAt", () => {
  for (const published of [true, false]) {
    for (const status of ["draft", "pending", "published", "changes_requested", "rejected", "archived"]) {
      for (const publishedAt of [null, PAST, FUTURE]) {
        for (const scheduledAt of [null, PAST, FUTURE]) {
          const expected =
            published &&
            status === "published" &&
            !(publishedAt && publishedAt.getTime() > PAST.getTime() + 1) &&
            !(scheduledAt && scheduledAt.getTime() > PAST.getTime() + 1);
          const got = blogLib.isPubliclyVisible(
            { published, status, publishedAt, scheduledAt },
            new Date(PAST.getTime() + 1)
          );
          assert.equal(
            got,
            expected,
            `published=${published} status=${status} publishedAt=${publishedAt?.toISOString() ?? "null"} scheduledAt=${scheduledAt?.toISOString() ?? "null"}`
          );
        }
      }
    }
  }
});

test("P1-GATE-2: a published post with a FUTURE scheduledAt is hidden (the admin schedule hint must not lie)", () => {
  const post = { published: true, status: "published", publishedAt: PAST, scheduledAt: FUTURE };
  assert.equal(blogLib.isPubliclyVisible(post, PAST), false);
});

test("P1-GATE-3: scheduledAt in the past or null does not block a published post", () => {
  assert.equal(
    blogLib.isPubliclyVisible({ published: true, status: "published", publishedAt: null, scheduledAt: null }, PAST),
    true
  );
  assert.equal(
    blogLib.isPubliclyVisible({ published: true, status: "published", publishedAt: null, scheduledAt: PAST }, PAST),
    true
  );
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 2 — shared Prisma where-builder
// ════════════════════════════════════════════════════════════════════════════

test("P1-WHERE-1: publicBlogPostWhere() carries all four legs (published, status, publishedAt, scheduledAt)", () => {
  const where = blogServer.publicBlogPostWhere(PAST) as Where;
  assert.equal(where.published, true);
  assert.equal(where.status, "published");
  assert.ok(Array.isArray(where.AND) && where.AND.length === 2, "AND must hold the two schedule legs");
  const [publishedAtLeg, scheduledAtLeg] = where.AND as Where[];
  assert.deepEqual(publishedAtLeg.OR, [{ publishedAt: null }, { publishedAt: { lte: PAST } }]);
  assert.deepEqual(scheduledAtLeg.OR, [{ scheduledAt: null }, { scheduledAt: { lte: PAST } }]);
});

test("P1-WHERE-2: evaluator over the builder — pending/changes_requested/rejected rows with published=true are EXCLUDED", () => {
  const where = blogServer.publicBlogPostWhere(PAST) as Where;
  assert.equal(matchesWhere(makeRow({ status: "pending" }), where), false);
  assert.equal(matchesWhere(makeRow({ status: "changes_requested" }), where), false);
  assert.equal(matchesWhere(makeRow({ status: "rejected" }), where), false);
  assert.equal(matchesWhere(makeRow({ status: "draft" }), where), false);
  assert.equal(matchesWhere(makeRow({ status: "archived" }), where), false);
  assert.equal(matchesWhere(makeRow({}), where), true);
});

test("P1-WHERE-3: evaluator over the builder — future publishedAt or future scheduledAt are EXCLUDED", () => {
  const where = blogServer.publicBlogPostWhere(PAST) as Where;
  assert.equal(matchesWhere(makeRow({ publishedAt: FUTURE }), where), false);
  assert.equal(matchesWhere(makeRow({ scheduledAt: FUTURE }), where), false);
  assert.equal(matchesWhere(makeRow({ publishedAt: null, scheduledAt: PAST }), where), true);
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 1 — /api/blog/latest uses the shared gate
// ════════════════════════════════════════════════════════════════════════════

test("P1-LATEST-1: the route's where-clause IS the shared gate (no hand-rolled subset)", async () => {
  resetState();
  await latestRoute.GET({ url: "http://localhost/api/blog/latest?limit=3" } as any);
  const findMany = calls.find((c) => c.model === "blogPost" && c.op === "findMany");
  assert.ok(findMany, "route must query blogPost.findMany");
  // Rebuild the builder output from the very Date the route's clause carries
  // and compare structurally — proves the route delegated to the builder.
  const capturedDate = findMany.args.where.AND[0].OR[1].publishedAt.lte as Date;
  assert.ok(capturedDate instanceof Date, "builder's publishedAt leg must carry the evaluation time");
  const expected = blogServer.publicBlogPostWhere(capturedDate);
  assert.deepEqual(findMany.args.where, expected);
});

test("P1-LATEST-2: matrix — rows in non-published states or with future dates can never land on the landing page", async () => {
  resetState();
  await latestRoute.GET({ url: "http://localhost/api/blog/latest" } as any);
  const where = calls.find((c) => c.model === "blogPost" && c.op === "findMany")!.args.where as Where;
  assert.equal(matchesWhere(makeRow({ status: "pending" }), where), false, "pending must be excluded");
  assert.equal(matchesWhere(makeRow({ status: "changes_requested" }), where), false);
  assert.equal(matchesWhere(makeRow({ status: "rejected" }), where), false);
  assert.equal(matchesWhere(makeRow({ publishedAt: FUTURE }), where), false, "future publishedAt must be excluded");
  assert.equal(matchesWhere(makeRow({ scheduledAt: FUTURE }), where), false, "future scheduledAt must be excluded");
  assert.equal(matchesWhere(makeRow({}), where), true, "a fully published post stays visible");
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 3 — share-card blog branch uses the shared gate
// ════════════════════════════════════════════════════════════════════════════

function shareCardRequest(slug: string): any {
  return {
    url: `http://localhost/api/share-card?type=article&kind=blog&slug=${encodeURIComponent(slug)}`,
    headers: { get: () => null },
  };
}

test("P1-SHARE-1: draft with stale published=true gets NO share image (404)", async () => {
  resetState();
  blogPostRows = [makeRow({ slug: "d", status: "draft" })];
  const res = await shareCardRoute.GET(shareCardRequest("d"));
  assert.equal(res.status, 404);
  assert.equal(calls.find((c) => c.op === "renderShareCard"), undefined, "renderer must not run");
});

test("P1-SHARE-2: pending post gets NO share image (404)", async () => {
  resetState();
  blogPostRows = [makeRow({ slug: "p", status: "pending" })];
  const res = await shareCardRoute.GET(shareCardRequest("p"));
  assert.equal(res.status, 404);
});

test("P1-SHARE-3: future publishedAt gets NO share image (404)", async () => {
  resetState();
  blogPostRows = [makeRow({ slug: "f", publishedAt: FUTURE })];
  const res = await shareCardRoute.GET(shareCardRequest("f"));
  assert.equal(res.status, 404);
});

test("P1-SHARE-4: future scheduledAt gets NO share image (404)", async () => {
  resetState();
  blogPostRows = [makeRow({ slug: "s", scheduledAt: FUTURE })];
  const res = await shareCardRoute.GET(shareCardRequest("s"));
  assert.equal(res.status, 404);
});

test("P1-SHARE-5: a fully public post still renders its share image (200 image/png)", async () => {
  resetState();
  blogPostRows = [makeRow({ slug: "ok" })];
  const res = await shareCardRoute.GET(shareCardRequest("ok"));
  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "image/png");
  assert.ok(calls.find((c) => c.op === "renderShareCard"), "renderer ran");
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 4 — admin instant-publish syncs the feed wrapper on create
// ════════════════════════════════════════════════════════════════════════════

const ARTICLE_BODY = {
  title: "Wrapper sync test",
  content: "Some meaningful content for the test article body.",
  category: "Bible Study",
};

test("P1-WRAPPER-1: admin create with publishNow → wrapper Post exists, published, linked to the article", async () => {
  resetState();
  setSession({ id: "u_admin", role: "admin", name: "Admin", username: "admin" });
  const req = { json: async () => ({ ...ARTICLE_BODY, publishNow: true }) } as any;
  const res = await blogArticlesRoute.POST(req);
  assert.equal(res.status, 201);
  const wrapper = calls.find((c) => c.model === "post" && c.op === "create");
  assert.ok(wrapper, "wrapper Post must be created");
  assert.equal(wrapper.args.data.articleId, "bp_new");
  assert.equal(wrapper.args.data.published, true);
  assert.equal(wrapper.args.data.authorId, "u_admin");
});

test("P1-WRAPPER-2: member create (publishNow ignored) → draft, NO wrapper Post", async () => {
  resetState();
  setSession({ id: "u_member", role: "user", name: "Member", username: "member" });
  const req = { json: async () => ({ ...ARTICLE_BODY, publishNow: true }) } as any;
  const res = await blogArticlesRoute.POST(req);
  assert.equal(res.status, 201);
  const created = calls.find((c) => c.model === "blogPost" && c.op === "create");
  assert.ok(created, "article row must be created");
  assert.equal(created.args.data.status, "draft");
  assert.equal(created.args.data.published, false);
  assert.equal(calls.find((c) => c.model === "post" && c.op === "create"), undefined, "no wrapper for member drafts");
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 5 — hard delete cleans up the wrapper in the SAME transaction
// ════════════════════════════════════════════════════════════════════════════

test("P1-DELETE-1: admin hard delete removes wrapper + article in one transaction", async () => {
  resetState();
  setSession({ id: "u_admin", role: "admin", name: "Admin", username: "admin" });
  blogPostRows = [makeRow({ id: "bp_del" })];
  wrapperPostRow = { id: "post_wrap", articleId: "bp_del" };
  const res = await adminBlogIdRoute.DELETE({} as any, { params: Promise.resolve({ id: "bp_del" }) });
  assert.equal(res.status, 200);
  const tx = calls.find((c) => c.op === "$transaction");
  assert.ok(tx, "delete must run in a transaction");
  const wrapperDel = txOps.find((c) => c.model === "post" && c.op === "deleteMany");
  const articleDel = txOps.find((c) => c.model === "blogPost" && c.op === "delete");
  assert.ok(wrapperDel, "wrapper Post must be deleted");
  assert.deepEqual(wrapperDel.args, { where: { articleId: "bp_del" } });
  assert.ok(articleDel, "article must be deleted");
  assert.deepEqual(articleDel.args, { where: { id: "bp_del" } });
  assert.ok(
    txOps.findIndex((c) => c.model === "post" && c.op === "deleteMany") <
      txOps.findIndex((c) => c.model === "blogPost" && c.op === "delete"),
    "wrapper cleanup happens inside the same transaction as the article delete"
  );
});

test("P1-DELETE-2: deleting a post with NO wrapper still succeeds (deleteMany is idempotent)", async () => {
  resetState();
  setSession({ id: "u_admin", role: "admin", name: "Admin", username: "admin" });
  blogPostRows = [makeRow({ id: "bp_nowrap" })];
  const res = await adminBlogIdRoute.DELETE({} as any, { params: Promise.resolve({ id: "bp_nowrap" }) });
  assert.equal(res.status, 200);
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 12a — admin/contributors: 401 vs 403 no longer collapse
// ════════════════════════════════════════════════════════════════════════════

test("P1-AUTH-1: unauthenticated caller → 401 Authentication required", async () => {
  resetState();
  const res = await adminContributorsRoute.GET({ url: "http://localhost/api/admin/contributors" } as any);
  assert.equal(res.status, 401);
  assert.match(fakeBody(res), /Authentication required/);
});

test("P1-AUTH-2: authenticated non-admin → 403 Admin access required", async () => {
  resetState();
  setSession({ id: "u_member", role: "user", name: "Member", username: "member" });
  const res = await adminContributorsRoute.GET({ url: "http://localhost/api/admin/contributors" } as any);
  assert.equal(res.status, 403);
  assert.match(fakeBody(res), /Admin access required/);
});

test("P1-AUTH-3: admin → 200", async () => {
  resetState();
  setSession({ id: "u_admin", role: "admin", name: "Admin", username: "admin" });
  const res = await adminContributorsRoute.GET({ url: "http://localhost/api/admin/contributors" } as any);
  assert.equal(res.status, 200);
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 13a — /api/admin/upload enforces CAN_UPLOAD_IMAGES for contributors
// ════════════════════════════════════════════════════════════════════════════

function uploadRequest(): any {
  return {
    url: "http://localhost/api/admin/upload",
    headers: { get: () => null },
    formData: async () => ({ get: () => null }),
  };
}

test("P1-UPLOAD-1: approved contributor WITHOUT CAN_UPLOAD_IMAGES → 403 Missing permission", async () => {
  resetState();
  setSession({ id: "u_contrib", role: "user", name: "Contrib", username: "contrib" });
  contributorRow = { status: "approved", permissions: JSON.stringify(["CAN_WRITE_ARTICLES"]) };
  const res = await adminUploadRoute.POST(uploadRequest());
  assert.equal(res.status, 403);
  assert.match(fakeBody(res), /CAN_UPLOAD_IMAGES/);
});

test("P1-UPLOAD-2: approved contributor WITH CAN_UPLOAD_IMAGES passes the auth gate", async () => {
  resetState();
  setSession({ id: "u_contrib2", role: "user", name: "Contrib2", username: "contrib2" });
  contributorRow = { status: "approved", permissions: JSON.stringify(["CAN_WRITE_ARTICLES", "CAN_UPLOAD_IMAGES"]) };
  const res = await adminUploadRoute.POST(uploadRequest());
  // With storage deliberately unconfigured in the harness, passing auth lands
  // on the storage-config error — proving the permission gate no longer blocks.
  assert.equal(res.status, 500);
  assert.match(fakeBody(res), /storage is not configured/i);
});

test("P1-UPLOAD-3: admin passes without any Contributor record", async () => {
  resetState();
  setSession({ id: "u_admin", role: "admin", name: "Admin", username: "admin" });
  const res = await adminUploadRoute.POST(uploadRequest());
  assert.equal(res.status, 500);
  assert.match(fakeBody(res), /storage is not configured/i);
});

test("P1-UPLOAD-4: unauthenticated → 401", async () => {
  resetState();
  const res = await adminUploadRoute.POST(uploadRequest());
  assert.equal(res.status, 401);
});

test("P1-UPLOAD-5: approved contributor with malformed permissions JSON → 403 (fail closed)", async () => {
  resetState();
  setSession({ id: "u_contrib3", role: "user", name: "C3", username: "c3" });
  contributorRow = { status: "approved", permissions: "not-json" };
  const res = await adminUploadRoute.POST(uploadRequest());
  assert.equal(res.status, 403);
  assert.match(fakeBody(res), /CAN_UPLOAD_IMAGES/);
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 14 — /api/contributor/apply ignores client-supplied userId
// ════════════════════════════════════════════════════════════════════════════

const APPLY_BODY = { fullName: "Ada", email: "ada@test.dev", whyContribute: "Faith." };

test("P1-APPLY-1: forged userId in the payload is IGNORED — session user is linked", async () => {
  resetState();
  setSession({ id: "u_real", role: "user", name: "Ada", username: "ada" });
  const req = { json: async () => ({ ...APPLY_BODY, userId: "spoofed-victim-id" }) } as any;
  const res = await applyRoute.POST(req);
  assert.equal(res.status, 200);
  const create = calls.find((c) => c.model === "contributorApplication" && c.op === "create");
  assert.ok(create);
  assert.equal(create.args.data.userId, "u_real", "application must link the SESSION user, not the client value");
});

test("P1-APPLY-2: anonymous application stores userId null", async () => {
  resetState();
  const req = { json: async () => APPLY_BODY } as any;
  const res = await applyRoute.POST(req);
  assert.equal(res.status, 200);
  const create = calls.find((c) => c.model === "contributorApplication" && c.op === "create");
  assert.ok(create, "application row must be created");
  assert.equal(create.args.data.userId, null);
});

// ════════════════════════════════════════════════════════════════════════════
// FIX 2 — surface wiring: pages + sitemap + social feed use the shared gate
// (source contract: these surfaces are RSC pages; a source assertion is the
// cheapest durable guard that no ad-hoc partial filter creeps back in)
// ════════════════════════════════════════════════════════════════════════════

test("P1-WIRE-1: /blog, /blog/[slug], sitemap.ts and the social feed ride the shared gate", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

  const blogList = read("src/app/blog/page.tsx");
  assert.ok(
    blogList.includes("publicBlogPostWhere("),
    "/blog must filter through the shared publicBlogPostWhere builder"
  );

  const blogDetail = read("src/app/blog/[slug]/page.tsx");
  const gateUses = (blogDetail.match(/isPubliclyVisible\(/g) ?? []).length;
  assert.ok(gateUses >= 2, "article page + its metadata must both use the shared in-memory gate");
  assert.ok(
    blogDetail.includes("publicBlogPostWhere("),
    "related-post queries must use the shared where-builder"
  );

  const sitemap = read("src/app/sitemap.ts");
  assert.ok(
    sitemap.includes("publicBlogPostWhere("),
    "the sitemap must list only posts that pass the shared gate"
  );

  const social = read("src/lib/social/server.ts");
  assert.ok(
    social.includes("scheduledAt: r.article.scheduledAt"),
    "feed serialization must pass scheduledAt into the visibility gate"
  );
});
