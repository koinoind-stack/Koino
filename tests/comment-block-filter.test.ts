/**
 * Regression tests — Phase 1 Fix 3: comment listing 500 for viewers with
 * blocks (Prisma author-field mismatch).
 *
 * THE BUG: getBlockFilter() always returned `{ authorId: { notIn } }`.
 * That is valid on the Post model, but PostComment's author field is
 * `userId` (prisma/schema.prisma → model PostComment). Passing the filter
 * into db.postComment.findMany made Prisma throw PrismaClientValidationError
 * ("Unknown argument `authorId`"), so GET /api/social/posts/[id]/comments
 * returned HTTP 500 for EXACTLY those viewers who had blocked someone (or
 * were blocked by someone) — everyone else got no filter and a 200.
 *
 * THE FIX: getBlockFilter(viewerId, authorField) now REQUIRES the author
 * field name; the comments route passes "userId", the posts route
 * "authorId".
 *
 * Technique: Node's built-in test runner + tsx; Supabase auth, Prisma and
 * next/server faked in-process via mock.module() BEFORE the route module
 * is imported (same harness as tests/profile-endpoints.test.ts). The fake
 * postComment.findMany mimics real Prisma behavior by THROWING when it
 * receives a field that does not exist on the PostComment model.
 * No network, no database, no user data.
 *
 * Run: npm test
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Harness environment (test process only — never production) ─────────
process.env.BOOTSTRAP_ADMIN_EMAIL = "";
process.env.KOINO_ADMIN_EMAIL = "";

// ─── 2. Fake Supabase session ───────────────────────────────────────────────
let sessionUser: { email: string | null; user_metadata: Record<string, unknown> } | null = null;

function setSession(email: string | null): void {
  sessionUser = email === null ? null : { email, user_metadata: {} };
}

// ─── 3. Fake Prisma ─────────────────────────────────────────────────────────
const usersByEmail = new Map<string, { id: string; email: string; role: string; accountStatus: string }>();
const blocks = new Map<string, { id: string; blockerId: string; blockedId: string }>();
const posts = new Map<string, { id: string; authorId: string }>();

let lastCommentWhere: Record<string, unknown> | null = null;
let idSeq = 0;

function resetDb(): void {
  usersByEmail.clear();
  blocks.clear();
  posts.clear();
  lastCommentWhere = null;
  idSeq = 0;
}

function seedUser(id: string, email: string): void {
  usersByEmail.set(email, { id, email, role: "user", accountStatus: "active" });
}

function seedBlock(blockerId: string, blockedId: string): void {
  blocks.set(`${blockerId}:${blockedId}`, { id: `blk_${++idSeq}`, blockerId, blockedId });
}

/** Fields that exist on the PostComment model (prisma/schema.prisma). */
const POST_COMMENT_FIELDS = new Set(["id", "postId", "userId", "parentId", "content", "createdAt", "post", "user", "parent", "replies"]);

/** Condition operators Prisma accepts UNDER a scalar field. */
const PRISMA_OPERATORS = new Set([
  "equals", "not", "in", "notIn", "lt", "lte", "gt", "gte",
  "contains", "startsWith", "endsWith", "mode", "has", "hasEvery", "hasSome", "isEmpty", "isSet", "search",
]);

/** Validate the value of one model field (a condition object or a literal). */
function assertValidCondition(value: unknown, path: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) return;
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (!PRISMA_OPERATORS.has(key)) {
      const err = new Error(
        `Unknown argument \`${key}\`. Available options are listed in green. (simulated PrismaClientValidationError at ${path}.${key})`,
      );
      err.name = "PrismaClientValidationError";
      throw err;
    }
  }
}

/** Recursively validate a where-clause the way PrismaClientValidationError does. */
function assertValidPostCommentWhere(where: unknown, path = "where"): void {
  if (!where || typeof where !== "object") return;
  for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
    const p = `${path}.${key}`;
    if (key === "AND" || key === "OR" || key === "NOT") {
      const arr = Array.isArray(value) ? value : [value];
      for (const inner of arr) assertValidPostCommentWhere(inner, p);
      continue;
    }
    if (!POST_COMMENT_FIELDS.has(key)) {
      const err = new Error(
        `Unknown argument \`${key}\`. Available options are listed in green. (simulated PrismaClientValidationError at ${p})`,
      );
      err.name = "PrismaClientValidationError";
      throw err;
    }
    // Nested relation filters (user/replies) are not exercised in these tests.
    if (key === "user" || key === "replies" || key === "parent" || key === "post") continue;
    assertValidCondition(value, p);
  }
}

const fakeDb = {
  user: {
    findUnique: async (args: { where: { email?: string; id?: string } }) => {
      if (args.where.email !== undefined) return usersByEmail.get(args.where.email) ?? null;
      if (args.where.id !== undefined) {
        for (const row of usersByEmail.values()) if (row.id === args.where.id) return row;
      }
      return null;
    },
  },
  post: {
    findUnique: async (args: { where: { id: string } }) => posts.get(args.where.id) ?? null,
  },
  postComment: {
    findMany: async (args: { where: Record<string, unknown> }) => {
      lastCommentWhere = args.where;
      // Mimic Prisma: an invalid field makes the QUERY throw (the route has
      // no try/catch on GET, so this becomes the production HTTP 500).
      assertValidPostCommentWhere(args.where);
      return [
        {
          id: "com_1",
          content: "first",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          userId: "user_other",
          user: { id: "user_other", name: "Other", username: "other", image: null, verified: false },
          replies: [],
          _count: { replies: 0 },
        },
        {
          id: "com_2",
          content: "second",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          userId: "user_third",
          user: { id: "user_third", name: "Third", username: "third", image: null, verified: false },
          replies: [],
          _count: { replies: 0 },
        },
      ];
    },
  },
  block: {
    findMany: async (args: { where: { OR: Array<{ blockerId?: string; blockedId?: string }> } }) => {
      const out: Array<{ id: string; blockerId: string; blockedId: string }> = [];
      for (const b of blocks.values()) {
        const hit = args.where.OR.some(
          (o) => (o.blockerId !== undefined && b.blockerId === o.blockerId) || (o.blockedId !== undefined && b.blockedId === o.blockedId),
        );
        if (hit) out.push(b);
      }
      return out;
    },
  },
};

// ─── 4. Fake next/server ────────────────────────────────────────────────────
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
  static redirect(url: string | URL): FakeNextResponse {
    return new FakeNextResponse("", { status: 307 });
  }
}

mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: sessionUser }, error: null }) },
    }),
  },
});

mock.module("@/lib/db", { namedExports: { db: fakeDb } });

mock.module("@/lib/supabase/service", {
  namedExports: {
    createServiceClient: () => {
      throw new Error("service client must never be constructed in tests");
    },
  },
});

mock.module("next/server", {
  namedExports: {
    NextResponse: FakeNextResponse,
    NextRequest: class FakeNextRequest {},
  },
});

// ─── 5. Import modules (AFTER the mocks, via before()) ──────────────────────
type CommentsRoute = typeof import("@/app/api/social/posts/[id]/comments/route");
type ServerLib = typeof import("@/lib/social/server");

let commentsRoute: CommentsRoute;
let serverLib: ServerLib;

before(async () => {
  commentsRoute = await import("@/app/api/social/posts/[id]/comments/route");
  serverLib = await import("@/lib/social/server");
});

function fakeRequest(url: string): unknown {
  return { url };
}

const BASE = "http://localhost:3000";

function freshWorld(): void {
  resetDb();
  setSession(null);
  seedUser("user_me", "me@koino.test");
  seedUser("user_other", "other@koino.test");
  seedUser("user_third", "third@koino.test");
  posts.set("post_x", { id: "post_x", authorId: "user_other" });
}

// ════════════════════════════════════════════════════════════════════════════
// CB tests
// ════════════════════════════════════════════════════════════════════════════

test("CB-1: viewer who BLOCKED someone can list comments — 200, filter keyed on userId (was: 500)", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedBlock("user_me", "user_third");

  const res = await commentsRoute.GET(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 200, "comment listing must not 500 for viewers with blocks");
  const body = (await res.json()) as { comments: Array<{ id: string }> };
  assert.equal(body.comments.length, 2);

  const where = lastCommentWhere as { NOT?: { userId?: { notIn: string[] }; authorId?: unknown } };
  assert.ok(where, "postComment.findMany must have been called");
  assert.deepEqual(where.NOT?.userId?.notIn, ["user_third"], "blocked user's comments filtered via userId");
  assert.equal(where.NOT && "authorId" in where.NOT, false, "PostComment queries must NEVER receive authorId");
});

test("CB-2: viewer BLOCKED BY someone is also filtered (two-directional block preserved)", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedBlock("user_third", "user_me");

  const res = await commentsRoute.GET(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 200);
  const where = lastCommentWhere as { NOT?: { userId?: { notIn: string[] } } };
  assert.deepEqual(where.NOT?.userId?.notIn, ["user_third"]);
});

test("CB-3: viewer with NO blocks lists comments without a NOT filter (no behavior change)", async () => {
  freshWorld();
  setSession("me@koino.test");

  const res = await commentsRoute.GET(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 200);
  const where = lastCommentWhere as Record<string, unknown>;
  assert.equal("NOT" in where, false, "no block filter when nothing is blocked");
});

test("CB-4: comment listing for a non-existent post is still 404", async () => {
  freshWorld();
  setSession("me@koino.test");

  const res = await commentsRoute.GET(
    fakeRequest(`${BASE}/api/social/posts/post_missing/comments`) as never,
    { params: Promise.resolve({ id: "post_missing" }) } as never,
  );
  assert.equal(res.status, 404);
});

test("CB-5: unauthenticated listing is still 401", async () => {
  freshWorld();
  setSession(null);

  const res = await commentsRoute.GET(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 401);
});

test("CB-6: getBlockFilter unit — \"userId\" builds a userId filter (comments)", async () => {
  freshWorld();
  seedBlock("user_me", "user_third");
  const f = await serverLib.getBlockFilter("user_me", "userId");
  assert.deepEqual(f, { userId: { notIn: ["user_third"] } });
});

test("CB-7: getBlockFilter unit — \"authorId\" builds an authorId filter (posts)", async () => {
  freshWorld();
  seedBlock("user_me", "user_third");
  const f = await serverLib.getBlockFilter("user_me", "authorId");
  assert.deepEqual(f, { authorId: { notIn: ["user_third"] } });
});

test("CB-8: getBlockFilter unit — no blocks returns undefined (no filter at all)", async () => {
  freshWorld();
  const f = await serverLib.getBlockFilter("user_me", "userId");
  assert.equal(f, undefined);
});
