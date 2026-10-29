/**
 * Regression tests — centralized account-suspension enforcement.
 *
 * Modules under test:
 *   - src/lib/auth-server.ts  (getAuthUser / getAuthAccountState /
 *                              getAuthUserFromDB) — the single shared guard
 *                              used by all 98 caller files, including every
 *                              admin API route.
 *   - src/lib/apologetics-server.ts (requireAuth / requireAdmin) — a real
 *     "alternative" shared guard, to prove suspended admins cannot slip
 *     through a helper that re-implements authorization on top of getAuthUser.
 *   - src/lib/social/server.ts (getSessionUser) — second defense layer.
 *
 * Technique: Node's built-in test runner (node:test) + the repo's existing
 * tsx devDependency. Supabase auth, Prisma and next/server are replaced with
 * in-process fakes via mock.module() BEFORE the modules under test are
 * imported. No network, no database, no real user data.
 *
 * Run: npm test
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Harness environment (test process only — never production) ─────────
process.env.BOOTSTRAP_ADMIN_EMAIL = "root@koino.test, admin@koino.test";
process.env.KOINO_ADMIN_EMAIL = "owner@koino.test";

// ─── 2. Fake Supabase session ───────────────────────────────────────────────
type FakeSessionUser = {
  email: string | null;
  user_metadata: Record<string, unknown>;
} | null;

let sessionUser: FakeSessionUser = null;

function setSession(
  email: string | null,
  metadata: Record<string, unknown> = {}
): void {
  sessionUser = email === null ? null : { email, user_metadata: metadata };
}

// ─── 3. Fake Prisma (mirrors the small surface auth-server uses) ───────────
type FakeUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  bio: string | null;
  role: string;
  totalPoints: number;
  profileCompleted: boolean;
  accountStatus: string;
};

const usersByEmail = new Map<string, FakeUser>();
let idSeq = 0;
const dbCalls = { findUnique: 0, create: 0, update: 0 };

function resetDb(): void {
  usersByEmail.clear();
  idSeq = 0;
  dbCalls.findUnique = 0;
  dbCalls.create = 0;
  dbCalls.update = 0;
}

function seedUser(
  partial: Partial<FakeUser> & { email: string }
): FakeUser {
  const row: FakeUser = {
    id: `cuid_test_${++idSeq}`,
    name: null,
    image: null,
    username: null,
    bio: null,
    role: "user",
    totalPoints: 0,
    profileCompleted: true,
    accountStatus: "active",
    ...partial,
  };
  usersByEmail.set(row.email, row);
  return row;
}

function findByEmail(email: string): FakeUser | null {
  return usersByEmail.get(email) ?? null;
}

function findById(id: string): FakeUser | null {
  for (const row of usersByEmail.values()) {
    if (row.id === id) return row;
  }
  return null;
}

const fakeDb = {
  user: {
    findUnique: async (args: { where: { email?: string; id?: string } }) => {
      dbCalls.findUnique++;
      if (args.where.email !== undefined) return findByEmail(args.where.email);
      if (args.where.id !== undefined) return findById(args.where.id);
      return null;
    },
    create: async (args: { data: Record<string, unknown> }) => {
      dbCalls.create++;
      const email = String(args.data.email);
      if (usersByEmail.has(email)) {
        const err = new Error("Unique constraint failed on the fields: (`email`)");
        (err as { code?: string }).code = "P2002";
        throw err;
      }
      const row: FakeUser = {
        id: `cuid_test_${++idSeq}`,
        email,
        name: (args.data.name as string | null) ?? null,
        image: (args.data.image as string | null) ?? null,
        username: null,
        bio: null,
        role: (args.data.role as string) ?? "user",
        totalPoints: (args.data.totalPoints as number) ?? 0,
        profileCompleted: false,
        accountStatus: "active", // schema default
      };
      usersByEmail.set(email, row);
      return { ...row };
    },
    update: async (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      dbCalls.update++;
      const row = findById(args.where.id);
      if (!row) {
        const err = new Error("Record to update not found.");
        (err as { code?: string }).code = "P2025";
        throw err;
      }
      Object.assign(row, args.data);
      return { ...row };
    },
  },
};

// ─── 4. Fake next/server (only NextResponse is needed by the guards) ───────
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
}

// ─── 5. Replace the module graph BEFORE importing the code under test ──────
mock.module("@/lib/supabase/server", {
  namedExports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: sessionUser }, error: null }),
      },
    }),
  },
});

mock.module("@/lib/db", { namedExports: { db: fakeDb } });

mock.module("next/server", { namedExports: { NextResponse: FakeNextResponse } });

// ─── 6. Import the modules under test (AFTER the mocks, via a file-level
// before() hook — the repo compiles .ts to CJS, which forbids top-level await)
type AuthServerModule = typeof import("@/lib/auth-server");
type GuardsModule = typeof import("@/lib/apologetics-server");
type SocialModule = typeof import("@/lib/social/server");

let authServer: AuthServerModule;
let guards: GuardsModule;
let social: SocialModule;

before(async () => {
  authServer = await import("@/lib/auth-server");
  guards = await import("@/lib/apologetics-server");
  social = await import("@/lib/social/server");
});

function freshState(): void {
  resetDb();
  setSession(null);
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH — baseline authentication behavior
// ════════════════════════════════════════════════════════════════════════════

test("AUTH-1: unauthenticated request is rejected — null user, state anonymous, no DB read", async () => {
  freshState();
  const user = await authServer.getAuthUser();
  const state = await authServer.getAuthAccountState();
  assert.equal(user, null, "no session must yield null");
  assert.deepEqual(state, { state: "anonymous" });
  assert.equal(dbCalls.findUnique, 0, "anonymous must short-circuit before any DB access");
});

test("AUTH-2: active authenticated user is returned with their full profile", async () => {
  freshState();
  setSession("active@koino.test", { full_name: "Ada User" });
  seedUser({
    email: "active@koino.test",
    username: "ada",
    bio: "hello",
    totalPoints: 42,
    role: "user",
  });

  const user = await authServer.getAuthUser();
  assert.ok(user, "active user must receive an auth object");
  assert.equal(user.email, "active@koino.test");
  assert.equal(user.username, "ada");
  assert.equal(user.role, "user");
  assert.equal(user.totalPoints, 42);
  assert.deepEqual(await authServer.getAuthAccountState(), { state: "active", user });
});

test("AUTH-3: suspended authenticated user is rejected", async () => {
  freshState();
  setSession("suspended@koino.test");
  seedUser({ email: "suspended@koino.test", accountStatus: "suspended" });

  assert.equal(await authServer.getAuthUser(), null, "suspended user must NOT receive an auth object");
  assert.deepEqual(await authServer.getAuthAccountState(), { state: "suspended" });
});

test("AUTH-4: blocked, deactivated and unknown statuses are rejected fail-closed", async () => {
  const rejected = ["blocked", "deactivated", "banned", "", "ACTIVE"];
  for (const status of rejected) {
    freshState();
    const email = `x-${status || "empty"}@koino.test`;
    setSession(email);
    seedUser({ email, accountStatus: status });
    assert.equal(await authServer.getAuthUser(), null, `status "${status}" must be rejected`);
  }
});

test("AUTH-5: missing (null) accountStatus is rejected fail-closed", async () => {
  freshState();
  setSession("corrupt@koino.test");
  seedUser({
    email: "corrupt@koino.test",
    accountStatus: null as unknown as string,
  });
  assert.equal(await authServer.getAuthUser(), null);
  assert.deepEqual(await authServer.getAuthAccountState(), { state: "suspended" });
});

test("AUTH-6: suspended session is distinguishable from anonymous (no silent fallback)", async () => {
  freshState();
  const anon = await authServer.getAuthAccountState();
  assert.deepEqual(anon, { state: "anonymous" });

  setSession("suspended@koino.test");
  seedUser({ email: "suspended@koino.test", accountStatus: "suspended" });
  const suspended = await authServer.getAuthAccountState();
  assert.equal(suspended.state, "suspended");
  assert.notDeepEqual(suspended, anon, "suspended must never collapse into anonymous at the state level");
});

test("AUTH-7: session user without an email is treated as anonymous", async () => {
  freshState();
  sessionUser = { email: null, user_metadata: {} };
  assert.equal(await authServer.getAuthUser(), null);
  assert.deepEqual(await authServer.getAuthAccountState(), { state: "anonymous" });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN — role parity and shared guards
// ════════════════════════════════════════════════════════════════════════════

test("ADMIN-1: active administrator is returned with role admin", async () => {
  freshState();
  setSession("boss@koino.test");
  seedUser({ email: "boss@koino.test", role: "admin" });

  const user = await authServer.getAuthUser();
  assert.ok(user);
  assert.equal(user.role, "admin");
});

test("ADMIN-2: suspended administrator is rejected by the shared auth guard", async () => {
  freshState();
  setSession("boss@koino.test");
  seedUser({ email: "boss@koino.test", role: "admin", accountStatus: "suspended" });

  assert.equal(await authServer.getAuthUser(), null);
  assert.deepEqual(await authServer.getAuthAccountState(), { state: "suspended" });
});

test("ADMIN-3: suspended administrator is never promoted or modified (gate runs before any write)", async () => {
  freshState();
  // Email matches BOOTSTRAP_ADMIN_EMAIL but the record is suspended with
  // role "user" — the pre-fix code would have promoted it on sight.
  setSession("root@koino.test");
  const row = seedUser({
    email: "root@koino.test",
    role: "user",
    accountStatus: "suspended",
  });

  assert.equal(await authServer.getAuthUser(), null);
  assert.equal(dbCalls.update, 0, "no promotion write may run for an ineligible account");
  assert.equal(row.role, "user", "stored role must be unchanged");
  assert.equal(row.accountStatus, "suspended", "stored status must be unchanged");
});

test("ADMIN-4: active administrator passes the real requireAdmin() shared helper", async () => {
  freshState();
  setSession("boss@koino.test");
  seedUser({ email: "boss@koino.test", role: "admin" });

  const auth = await guards.requireAdmin();
  assert.equal(auth.response, null);
  assert.equal(auth.user?.role, "admin");
});

test("ADMIN-5: suspended administrator is rejected by the real requireAdmin() helper (alternative helper path)", async () => {
  freshState();
  setSession("boss@koino.test");
  seedUser({ email: "boss@koino.test", role: "admin", accountStatus: "suspended" });

  const auth = await guards.requireAdmin();
  assert.ok(auth.response, "suspended admin must receive a rejection response");
  assert.equal(auth.user, null);
  // requireAdmin() delegates to requireAuth() first, so an ineligible account
  // gets the shared guard's 401 "Authentication required" before the role
  // check (which would answer 403) — rejected either way, fail-closed.
  assert.equal(auth.response.status, 401);
});

test("ADMIN-6: suspended ordinary user is 401-rejected by the real requireAuth() helper", async () => {
  freshState();
  setSession("suspended@koino.test");
  seedUser({ email: "suspended@koino.test", accountStatus: "suspended" });

  const auth = await guards.requireAuth();
  assert.ok(auth.response);
  assert.equal(auth.response.status, 401);
});

test("ADMIN-7: bootstrap promotion still works for ACTIVE accounts (existing behavior preserved)", async () => {
  freshState();
  setSession("root@koino.test");
  seedUser({ email: "root@koino.test", role: "user", accountStatus: "active" });

  const user = await authServer.getAuthUser();
  assert.ok(user);
  assert.equal(user.role, "admin", "bootstrap admin promotion must keep working");
  assert.equal(dbCalls.update, 1);
});

// ════════════════════════════════════════════════════════════════════════════
// SOC — second defense layer (social routes' own guard)
// ════════════════════════════════════════════════════════════════════════════

test("SOC-1: social getSessionUser rejects suspended users (defense in depth)", async () => {
  freshState();
  setSession("suspended@koino.test");
  seedUser({ email: "suspended@koino.test", accountStatus: "suspended" });

  const result = await social.getSessionUser();
  assert.equal(result.user, null, "suspended user must be rejected by the social guard too");
});

test("SOC-2: social getSessionUser still returns active users", async () => {
  freshState();
  setSession("active@koino.test");
  seedUser({ email: "active@koino.test" });

  const result = await social.getSessionUser();
  assert.ok(result.user, "active user must pass the social guard");
  assert.equal(result.user.role, "user");
});

// ════════════════════════════════════════════════════════════════════════════
// STATE — status-change dynamics + behavior preservation
// ════════════════════════════════════════════════════════════════════════════

test("STATE-1: suspending an account takes effect on the very next request (live DB read, no cache)", async () => {
  freshState();
  setSession("flip@koino.test");
  const row = seedUser({ email: "flip@koino.test" });

  const before = await authServer.getAuthUser();
  assert.ok(before, "active before suspension");

  row.accountStatus = "suspended"; // equivalent of admin PATCH /api/admin/members/[id]

  const after = await authServer.getAuthUser();
  assert.equal(after, null, "suspension must apply immediately — no stale auth object");
  assert.deepEqual(await authServer.getAuthAccountState(), { state: "suspended" });
});

test("STATE-2: reactivating the account restores access per existing rules", async () => {
  freshState();
  setSession("flip@koino.test");
  const row = seedUser({ email: "flip@koino.test", accountStatus: "suspended" });

  assert.equal(await authServer.getAuthUser(), null, "rejected while suspended");

  row.accountStatus = "active"; // admin lifts the suspension

  const restored = await authServer.getAuthUser();
  assert.ok(restored, "reactivated user must regain access without any workaround");
  assert.equal(restored.role, "user");
});

test("STATE-3: a genuinely new signup is still mirrored as an active user (onboarding preserved)", async () => {
  freshState();
  setSession("brand-new@koino.test", {
    full_name: "New Person",
    avatar_url: "https://img.example/a.png",
  });

  const user = await authServer.getAuthUser();
  assert.ok(user);
  assert.equal(dbCalls.create, 1);
  assert.equal(user.name, "New Person");
  assert.equal(user.role, "user");
  assert.equal(user.profileCompleted, false);
  assert.equal(findByEmail("brand-new@koino.test")?.accountStatus, "active");
});

test("STATE-4: getAuthUserFromDB reflects the eligibility gate too", async () => {
  freshState();
  setSession("fresh@koino.test");
  seedUser({ email: "fresh@koino.test", totalPoints: 7 });

  const dbRow = await authServer.getAuthUserFromDB();
  assert.ok(dbRow);
  assert.equal(dbRow.totalPoints, 7);

  findByEmail("fresh@koino.test")!.accountStatus = "suspended";
  assert.equal(await authServer.getAuthUserFromDB(), null, "suspended account must not reach the DB fetch");
});

test("STATE-5: getAuthUser return shape is unchanged (9 documented fields)", async () => {
  freshState();
  setSession("shape@koino.test");
  seedUser({ email: "shape@koino.test" });

  const user = await authServer.getAuthUser();
  assert.ok(user);
  assert.deepEqual(Object.keys(user).sort(), [
    "bio",
    "email",
    "id",
    "image",
    "name",
    "profileCompleted",
    "role",
    "totalPoints",
    "username",
  ]);
});
