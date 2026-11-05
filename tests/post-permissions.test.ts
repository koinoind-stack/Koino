/**
 * Regression tests — Phase 1 Fix 2: post ownership & permission controls.
 *
 * THE BUG: PostCard computed
 *   canEdit = state.repostedFrom === null && shown.author.id === state.author.id
 * Because `shown = state.repostedFrom ?? state`, every non-repost post has
 * `shown === state`, so the id comparison was ALWAYS true → Edit/Delete
 * appeared on OTHER users' posts (every non-repost), while Block (rendered
 * on `!canEdit`) was hidden exactly where it should be available.
 *
 * THE FIX: ownership is computed against the viewer's own Prisma user id
 * (useViewerId → /api/auth/me, the identity CommentRow already uses) via
 * the pure helper computePostPermissions(). Menu visibility only — every
 * action is re-verified server-side, which these tests also pin down:
 *
 *   Section A  — computePostPermissions() unit tests (UI visibility rules)
 *   Section B  — server enforcement: PATCH/DELETE /api/social/posts/[id]
 *                (edit/delete is author-or-group-manager ONLY; suspension
 *                still blocks everything — PR #12 behavior preserved)
 *   Section C  — server enforcement: comment delete (comment author or
 *                post author only)
 *   Section D  — server enforcement: block/unblock toggle
 *
 * Technique: Node's built-in test runner + tsx; Supabase auth, Prisma,
 * Supabase service client and next/server are faked in-process via
 * mock.module() BEFORE the route modules are imported (same harness as
 * tests/profile-endpoints.test.ts). No network, no database, no user data.
 *
 * Run: npm test
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Harness environment (test process only — never production) ─────────
process.env.BOOTSTRAP_ADMIN_EMAIL = "";
process.env.KOINO_ADMIN_EMAIL = "";
delete process.env.SUPABASE_SERVICE_ROLE_KEY; // DELETE storage cleanup must stay off

// ─── 2. Fake Supabase session ───────────────────────────────────────────────
let sessionUser: { email: string | null; user_metadata: Record<string, unknown> } | null = null;

function setSession(email: string | null): void {
  sessionUser = email === null ? null : { email, user_metadata: {} };
}

// ─── 3. Fake Prisma ─────────────────────────────────────────────────────────
type FakeUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  role: string;
  totalPoints: number;
  profileCompleted: boolean;
  accountStatus: string;
};

const usersByEmail = new Map<string, FakeUser>();
const posts = new Map<string, Record<string, unknown>>();
const groupMembers = new Map<string, { role: string; status: string }>();
const comments = new Map<string, Record<string, unknown>>();
const blocks = new Map<string, { id: string; blockerId: string; blockedId: string }>();
const follows = new Map<string, { followerId: string; followingId: string }>();

const dbCalls = {
  postUpdate: 0,
  postDelete: 0,
  commentDelete: 0,
  blockCreate: 0,
  blockDelete: 0,
  followDeleteMany: 0,
};

let idSeq = 0;

function resetDb(): void {
  usersByEmail.clear();
  posts.clear();
  groupMembers.clear();
  comments.clear();
  blocks.clear();
  follows.clear();
  dbCalls.postUpdate = 0;
  dbCalls.postDelete = 0;
  dbCalls.commentDelete = 0;
  dbCalls.blockCreate = 0;
  dbCalls.blockDelete = 0;
  dbCalls.followDeleteMany = 0;
  idSeq = 0;
}

function seedUser(partial: Partial<FakeUser> & { email: string; id: string }): FakeUser {
  const row: FakeUser = {
    id: partial.id,
    email: partial.email,
    name: partial.name ?? "Test User",
    image: null,
    username: partial.username ?? partial.email.split("@")[0],
    role: partial.role ?? "user",
    totalPoints: 0,
    profileCompleted: true,
    accountStatus: partial.accountStatus ?? "active",
  };
  usersByEmail.set(row.email, row);
  return row;
}

function findById(id: string): FakeUser | null {
  for (const row of usersByEmail.values()) if (row.id === id) return row;
  return null;
}

function seedPost(p: { id: string; authorId: string; groupId?: string | null; repostedFromId?: string | null }): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: p.id,
    content: "original caption",
    mediaType: "text",
    mediaUrls: "[]",
    thumbnailUrl: null,
    aspectRatio: null,
    hashtags: [],
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    viewCount: 0,
    isReel: false,
    memorial: null,
    video: null,
    article: null,
    editedAt: null,
    createdAt: new Date(),
    authorId: p.authorId,
    repostedFromId: p.repostedFromId ?? null,
    groupId: p.groupId ?? null,
    author: findById(p.authorId)
      ? { id: p.authorId, name: findById(p.authorId)!.name, username: findById(p.authorId)!.username, image: null, verified: false }
      : { id: p.authorId, name: "A", username: "a", image: null, verified: false },
    repostedFrom: null,
  };
  posts.set(p.id, row);
  return row;
}

function seedComment(p: { id: string; postId: string; userId: string; parentId?: string | null }): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: p.id,
    postId: p.postId,
    userId: p.userId,
    parentId: p.parentId ?? null,
    content: "a comment",
    createdAt: new Date(),
    _count: { replies: 0 },
  };
  comments.set(p.id, row);
  return row;
}

const gk = (groupId: string, userId: string) => `${groupId}:${userId}`;

const fakeDb = {
  user: {
    findUnique: async (args: { where: { email?: string; id?: string } }) => {
      if (args.where.email !== undefined) return usersByEmail.get(args.where.email) ?? null;
      if (args.where.id !== undefined) return findById(args.where.id);
      return null;
    },
    findFirst: async (args: { where: { username?: { equals: string } } }) => {
      const wanted = args.where.username?.equals?.toLowerCase();
      if (!wanted) return null;
      for (const row of usersByEmail.values()) {
        if ((row.username ?? "").toLowerCase() === wanted) return row;
      }
      return null;
    },
  },
  post: {
    findUnique: async (args: { where: { id: string } }) => posts.get(args.where.id) ?? null,
    // Part 2: serializePosts now also batches the viewer's repost markers
    // (fetchViewerRepostSet) — PATCH flows serialize the updated post, so the
    // mock needs the query. No repost markers exist in this suite's fixture
    // data, hence an empty result.
    findMany: async () => [],
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      dbCalls.postUpdate++;
      const row = posts.get(args.where.id);
      if (!row) {
        const err = new Error("Record to update not found.");
        (err as { code?: string }).code = "P2025";
        throw err;
      }
      for (const [k, v] of Object.entries(args.data)) {
        // Prisma-style operators ({ increment }) are not simulated — tests
        // only rely on direct assignments (content, editedAt, hashtags).
        if (v !== null && typeof v === "object" && !Array.isArray(v) && !((v as unknown) instanceof Date)) continue;
        row[k] = v;
      }
      return { ...row };
    },
    delete: async (args: { where: { id: string } }) => {
      dbCalls.postDelete++;
      const row = posts.get(args.where.id);
      posts.delete(args.where.id);
      return row ?? null;
    },
  },
  groupMember: {
    findUnique: async (args: { where: { groupId_userId: { groupId: string; userId: string } } }) =>
      groupMembers.get(gk(args.where.groupId_userId.groupId, args.where.groupId_userId.userId)) ?? null,
  },
  postComment: {
    findFirst: async (args: { where: { id: string; postId: string } }) => {
      const row = comments.get(args.where.id);
      if (!row || row.postId !== args.where.postId) return null;
      return row;
    },
    delete: async (args: { where: { id: string } }) => {
      dbCalls.commentDelete++;
      const row = comments.get(args.where.id);
      comments.delete(args.where.id);
      return row ?? null;
    },
  },
  block: {
    findUnique: async (args: { where: { blockerId_blockedId: { blockerId: string; blockedId: string } } }) => {
      const key = `${args.where.blockerId_blockedId.blockerId}:${args.where.blockerId_blockedId.blockedId}`;
      return blocks.get(key) ?? null;
    },
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
    create: async (args: { data: { blockerId: string; blockedId: string } }) => {
      dbCalls.blockCreate++;
      const key = `${args.data.blockerId}:${args.data.blockedId}`;
      const row = { id: `blk_${++idSeq}`, blockerId: args.data.blockerId, blockedId: args.data.blockedId };
      blocks.set(key, row);
      return row;
    },
    delete: async (args: { where: { id: string } }) => {
      dbCalls.blockDelete++;
      for (const [key, b] of blocks.entries()) {
        if (b.id === args.where.id) {
          blocks.delete(key);
          return b;
        }
      }
      return null;
    },
  },
  follow: {
    deleteMany: async (args: { where: { followerId: string; followingId: string } }) => {
      dbCalls.followDeleteMany++;
      let removed = 0;
      for (const [key, f] of follows.entries()) {
        if (f.followerId === args.where.followerId && f.followingId === args.where.followingId) {
          follows.delete(key);
          removed++;
        }
      }
      return { count: removed };
    },
    findMany: async (args: { where: { followerId: string; followingId: { in: string[] } } }) => {
      const out: Array<{ followingId: string }> = [];
      for (const f of follows.values()) {
        if (f.followerId === args.where.followerId && args.where.followingId.in.includes(f.followingId)) {
          out.push(f);
        }
      }
      return out;
    },
  },
  postLike: { findMany: async () => [] },
  postBookmark: { findMany: async () => [] },
  notification: { create: async () => ({} as unknown) },
  $transaction: async (ops: Array<Promise<unknown>>) => {
    for (const op of ops) await op;
    return ops;
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
type PostRoute = typeof import("@/app/api/social/posts/[id]/route");
type CommentRoute = typeof import("@/app/api/social/posts/[id]/comments/[commentId]/route");
type BlockRoute = typeof import("@/app/api/social/block/route");
type PermModule = typeof import("@/components/social/post-permissions");

let postRoute: PostRoute;
let commentRoute: CommentRoute;
let blockRoute: BlockRoute;
let perms: PermModule;

before(async () => {
  postRoute = await import("@/app/api/social/posts/[id]/route");
  commentRoute = await import("@/app/api/social/posts/[id]/comments/[commentId]/route");
  blockRoute = await import("@/app/api/social/block/route");
  perms = await import("@/components/social/post-permissions");
});

/** Route handlers mix mocked NextResponse and native Response — handle both. */
async function bodyOf(res: unknown): Promise<Record<string, unknown>> {
  const r = res as { bodyText?: string; json?: () => Promise<unknown>; status: number };
  if (typeof r.bodyText === "string") return JSON.parse(r.bodyText);
  return (await r.json!()) as Record<string, unknown>;
}

function fakeRequest(url: string, body?: unknown): unknown {
  return { url, json: async () => body ?? {} };
}

const BASE = "http://localhost:3000";

function freshWorld() {
  resetDb();
  setSession(null);
  seedUser({ id: "user_me", email: "me@koino.test", username: "me" });
  seedUser({ id: "user_other", email: "other@koino.test", username: "other" });
  seedUser({ id: "user_third", email: "third@koino.test", username: "third" });
}

// ════════════════════════════════════════════════════════════════════════════
// Section A — computePostPermissions() unit tests (UI visibility rules)
// ════════════════════════════════════════════════════════════════════════════

const minePost = { author: { id: "user_me", username: "me" }, repostedFrom: null };
const otherPost = { author: { id: "user_other", username: "other" }, repostedFrom: null };
const otherRepost = { author: { id: "user_other", username: "other" }, repostedFrom: { id: "p1" } };
const myRepost = { author: { id: "user_me", username: "me" }, repostedFrom: { id: "p1" } };

test("PP-1: OTHER user's post → NO edit, NO delete, Block SHOWN (the reported inversion)", () => {
  const p = perms.computePostPermissions(otherPost, "user_me", false);
  assert.equal(p.isMine, false);
  assert.equal(p.canEdit, false, "Edit must NOT appear on other users' posts");
  assert.equal(p.canDelete, false, "Delete must NOT appear on other users' posts");
  assert.equal(p.canBlock, true, "Block must be available on other users' posts");
});

test("PP-2: OWN post → edit + delete shown, Block hidden", () => {
  const p = perms.computePostPermissions(minePost, "user_me", false);
  assert.equal(p.isMine, true);
  assert.equal(p.canEdit, true);
  assert.equal(p.canDelete, true);
  assert.equal(p.canBlock, false, "must not offer blocking yourself");
});

test("PP-3: anonymous viewer (signed out) → nothing is offered", () => {
  const p = perms.computePostPermissions(otherPost, null, false);
  assert.equal(p.canEdit, false);
  assert.equal(p.canDelete, false);
  assert.equal(p.canBlock, false);
});

test("PP-4: group moderator on ANOTHER user's post → Delete shown (menu only), Block also available", () => {
  const p = perms.computePostPermissions(otherPost, "user_me", true);
  assert.equal(p.canEdit, false, "moderator still cannot EDIT someone else's caption");
  assert.equal(p.canDelete, true, "moderator sees Delete (server re-verifies the role)");
  assert.equal(p.canBlock, true);
});

test("PP-5: repost authored by someone else → Block available, no edit/delete", () => {
  const p = perms.computePostPermissions(otherRepost, "user_me", false);
  assert.equal(p.canEdit, false);
  assert.equal(p.canDelete, false);
  assert.equal(p.canBlock, true);
});

test("PP-6: viewer's OWN repost shell → no edit (no caption of its own), Block hidden", () => {
  const p = perms.computePostPermissions(myRepost, "user_me", false);
  assert.equal(p.isMine, true);
  assert.equal(p.canEdit, false);
  assert.equal(p.canBlock, false);
});

test("PP-7: author without a username → Block hidden (block API works by username)", () => {
  const p = perms.computePostPermissions({ author: { id: "user_other", username: null }, repostedFrom: null }, "user_me", false);
  assert.equal(p.canBlock, false);
});

test("PP-8: moderator flag alone (anonymous) must not unlock Delete", () => {
  const p = perms.computePostPermissions(otherPost, null, true);
  assert.equal(p.canDelete, false);
});

// ════════════════════════════════════════════════════════════════════════════
// Section B — server enforcement: PATCH/DELETE /api/social/posts/[id]
// ════════════════════════════════════════════════════════════════════════════

test("PP-9: PATCH by a NON-author is rejected 403 and performs NO write", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_other" });

  const res = await postRoute.PATCH(
    fakeRequest(`${BASE}/api/social/posts/post_x`, { content: "hijacked caption" }) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 403);
  assert.equal((await bodyOf(res)).error, "You can only edit your own posts");
  assert.equal(dbCalls.postUpdate, 0, "server must enforce ownership, not just the UI");
  assert.equal(posts.get("post_x")!.content, "original caption", "caption unchanged");
});

test("PP-10: PATCH by the author succeeds (legitimate edit unaffected)", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_me" });

  const res = await postRoute.PATCH(
    fakeRequest(`${BASE}/api/social/posts/post_x`, { content: "my updated caption" }) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 200);
  const body = await bodyOf(res);
  assert.equal((body.post as { content: string }).content, "my updated caption");
  assert.equal(dbCalls.postUpdate, 1);
});

test("PP-11: PATCH by a SUSPENDED author is rejected 401 with NO write (PR #12 preserved)", async () => {
  freshWorld();
  seedUser({ id: "user_susp", email: "susp@koino.test", accountStatus: "suspended" });
  setSession("susp@koino.test");
  seedPost({ id: "post_x", authorId: "user_susp" });

  const res = await postRoute.PATCH(
    fakeRequest(`${BASE}/api/social/posts/post_x`, { content: "still able?" }) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 401);
  assert.equal(dbCalls.postUpdate, 0, "suspended accounts must never write (suspension gate)");
});

test("PP-12: DELETE by a NON-author, NON-manager is rejected 403 and the post survives", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_other" });

  const res = await postRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 403);
  assert.equal((await bodyOf(res)).error, "You can only delete your own posts");
  assert.equal(dbCalls.postDelete, 0);
  assert.ok(posts.has("post_x"), "post must NOT be deleted");
});

test("PP-13: DELETE by a plain group MEMBER (non-manager) is rejected 403", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_other", groupId: "group_1" });
  groupMembers.set(gk("group_1", "user_me"), { role: "member", status: "active" });

  const res = await postRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 403);
  assert.equal(dbCalls.postDelete, 0);
});

test("PP-14: DELETE by an ACTIVE group MODERATOR succeeds server-side (moderation intact)", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_other", groupId: "group_1" });
  groupMembers.set(gk("group_1", "user_me"), { role: "moderator", status: "active" });

  const res = await postRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 200);
  assert.equal((await bodyOf(res)).success, true);
  assert.equal(dbCalls.postDelete, 1);
  assert.ok(!posts.has("post_x"));
});

test("PP-15: DELETE by the AUTHOR succeeds (legitimate delete unaffected)", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_me" });

  const res = await postRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 200);
  assert.equal(dbCalls.postDelete, 1);
  assert.ok(!posts.has("post_x"));
});

test("PP-16: DELETE by a SUSPENDED group manager is rejected 401 (suspension gate first)", async () => {
  freshWorld();
  seedUser({ id: "user_susp", email: "susp@koino.test", accountStatus: "suspended" });
  setSession("susp@koino.test");
  seedPost({ id: "post_x", authorId: "user_other", groupId: "group_1" });
  groupMembers.set(gk("group_1", "user_susp"), { role: "owner", status: "active" });

  const res = await postRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x`) as never,
    { params: Promise.resolve({ id: "post_x" }) } as never,
  );
  assert.equal(res.status, 401);
  assert.equal(dbCalls.postDelete, 0, "suspension must win over any group role");
});

// ════════════════════════════════════════════════════════════════════════════
// Section C — server enforcement: comment delete authorization
// ════════════════════════════════════════════════════════════════════════════

test("PP-17: comment DELETE by an unrelated user is rejected 403", async () => {
  freshWorld();
  setSession("third@koino.test");
  seedPost({ id: "post_x", authorId: "user_other" });
  seedComment({ id: "com_1", postId: "post_x", userId: "user_me" });

  const res = await commentRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments/com_1`) as never,
    { params: Promise.resolve({ id: "post_x", commentId: "com_1" }) } as never,
  );
  assert.equal(res.status, 403);
  assert.equal(dbCalls.commentDelete, 0);
});

test("PP-18: comment DELETE by the comment's OWN author succeeds", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_other" });
  seedComment({ id: "com_1", postId: "post_x", userId: "user_me" });

  const res = await commentRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments/com_1`) as never,
    { params: Promise.resolve({ id: "post_x", commentId: "com_1" }) } as never,
  );
  assert.equal(res.status, 200);
  assert.equal((await bodyOf(res)).success, true);
  assert.equal(dbCalls.commentDelete, 1);
});

test("PP-19: comment DELETE by the POST author (moderating someone else's comment) succeeds", async () => {
  freshWorld();
  setSession("me@koino.test");
  seedPost({ id: "post_x", authorId: "user_me" });
  seedComment({ id: "com_1", postId: "post_x", userId: "user_other" });

  const res = await commentRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments/com_1`) as never,
    { params: Promise.resolve({ id: "post_x", commentId: "com_1" }) } as never,
  );
  assert.equal(res.status, 200);
  assert.equal(dbCalls.commentDelete, 1);
});

test("PP-20: comment DELETE without a session is rejected 401", async () => {
  freshWorld();
  setSession(null);
  seedPost({ id: "post_x", authorId: "user_other" });
  seedComment({ id: "com_1", postId: "post_x", userId: "user_me" });

  const res = await commentRoute.DELETE(
    fakeRequest(`${BASE}/api/social/posts/post_x/comments/com_1`) as never,
    { params: Promise.resolve({ id: "post_x", commentId: "com_1" }) } as never,
  );
  assert.equal(res.status, 401);
});

// ════════════════════════════════════════════════════════════════════════════
// Section D — server enforcement: block / unblock toggle
// ════════════════════════════════════════════════════════════════════════════

test("PP-21: block without a session is rejected 401", async () => {
  freshWorld();
  setSession(null);
  const res = await blockRoute.POST(fakeRequest(`${BASE}/api/social/block`, { username: "other" }) as never);
  assert.equal(res.status, 401);
});

test("PP-22: blocking by username creates the block and removes both follow edges", async () => {
  freshWorld();
  setSession("me@koino.test");
  follows.set("a", { followerId: "user_me", followingId: "user_other" });
  follows.set("b", { followerId: "user_other", followingId: "user_me" });

  const res = await blockRoute.POST(fakeRequest(`${BASE}/api/social/block`, { username: "other" }) as never);
  assert.equal(res.status, 200);
  assert.equal((await bodyOf(res)).blocked, true);
  assert.equal(dbCalls.blockCreate, 1);
  assert.equal(dbCalls.followDeleteMany, 2, "both follow edges must be removed");
  assert.equal(follows.size, 0);
});

test("PP-23: unblocking an existing block removes it (toggle round-trip)", async () => {
  freshWorld();
  setSession("me@koino.test");
  blocks.set("user_me:user_other", { id: "blk_x", blockerId: "user_me", blockedId: "user_other" });

  const res = await blockRoute.POST(fakeRequest(`${BASE}/api/social/block`, { username: "other" }) as never);
  assert.equal(res.status, 200);
  assert.equal((await bodyOf(res)).blocked, false);
  assert.equal(dbCalls.blockDelete, 1);
  assert.equal(blocks.size, 0);
});

test("PP-24: you cannot block yourself", async () => {
  freshWorld();
  setSession("me@koino.test");
  const res = await blockRoute.POST(fakeRequest(`${BASE}/api/social/block`, { username: "me" }) as never);
  assert.equal(res.status, 400);
  assert.equal(dbCalls.blockCreate, 0);
});

test("PP-25: blocking an unknown username is rejected 404", async () => {
  freshWorld();
  setSession("me@koino.test");
  const res = await blockRoute.POST(fakeRequest(`${BASE}/api/social/block`, { username: "ghost" }) as never);
  assert.equal(res.status, 404);
});
