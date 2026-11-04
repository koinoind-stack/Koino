/**
 * Regression tests — onboarding / profile-completion endpoints must enforce
 * account eligibility SERVER-side (the merged suspension fix), and the
 * frontend's CONTINUE kill-switch must be driven by that server response.
 *
 * Endpoints under test (the profile/onboarding write surface):
 *   POST/GET  /api/profile/setup          — onboarding save + resume
 *   GET       /api/profile/check-username — real-time username validation
 *                                           (drives the CONTINUE disabled flag)
 *   PATCH     /api/profile                — post-onboarding profile editing
 *   POST      /api/profile/upload-avatar  — avatar upload
 *   GET       /api/auth/me                — the client hook's identity source
 *
 * Technique: Node's built-in test runner + the repo's existing tsx
 * devDependency. Supabase auth, Prisma, Supabase service client and
 * next/server are replaced with in-process fakes via mock.module() BEFORE
 * the route modules are imported; the REAL src/lib/auth-server.ts runs on
 * top of those fakes, exactly as in tests/auth-server.test.ts.
 * No network, no database, no real user data.
 *
 * Run: npm test
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Harness environment (test process only — never production) ─────────
process.env.BOOTSTRAP_ADMIN_EMAIL = "";
process.env.KOINO_ADMIN_EMAIL = "";

// ─── 2. Fake Supabase session ───────────────────────────────────────────────
type FakeSessionUser = {
  email: string | null;
  user_metadata: Record<string, unknown>;
} | null;

let sessionUser: FakeSessionUser = null;

function setSession(email: string | null): void {
  sessionUser = email === null ? null : { email, user_metadata: {} };
}

// ─── 3. Fake Prisma (the User surface the profile routes use) ───────────────
type FakeUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  usernameChangedAt: Date | null;
  bio: string | null;
  role: string;
  totalPoints: number;
  profileCompleted: boolean;
  accountStatus: string;
  dateOfBirth: Date | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  mobileNumber: string | null;
  faithStatus: string | null;
  faithJourney: string | null;
  communityRole: string | null;
  communityRoleOther: string | null;
  communityRoleVisible: boolean;
};

const usersByEmail = new Map<string, FakeUser>();
let idSeq = 0;
const dbCalls = { findUnique: 0, findFirst: 0, update: 0, create: 0 };

function resetDb(): void {
  usersByEmail.clear();
  idSeq = 0;
  dbCalls.findUnique = 0;
  dbCalls.findFirst = 0;
  dbCalls.update = 0;
  dbCalls.create = 0;
}

function seedUser(partial: Partial<FakeUser> & { email: string }): FakeUser {
  const row: FakeUser = {
    id: `cuid_test_${++idSeq}`,
    name: null,
    image: null,
    username: null,
    usernameChangedAt: null,
    bio: null,
    role: "user",
    totalPoints: 0,
    profileCompleted: true,
    accountStatus: "active",
    dateOfBirth: null,
    gender: null,
    state: null,
    city: null,
    mobileNumber: null,
    faithStatus: null,
    faithJourney: null,
    communityRole: null,
    communityRoleOther: null,
    communityRoleVisible: true,
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
    findFirst: async (args: {
      where: { username?: { equals: string }; NOT?: { id: string } };
    }) => {
      dbCalls.findFirst++;
      const wanted = args.where.username?.equals?.toLowerCase();
      if (!wanted) return null;
      for (const row of usersByEmail.values()) {
        if (
          (row.username ?? "").toLowerCase() === wanted &&
          row.id !== args.where.NOT?.id
        ) {
          return row;
        }
      }
      return null;
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
    create: async (args: { data: Record<string, unknown> }) => {
      dbCalls.create++;
      const email = String(args.data.email);
      const row: FakeUser = {
        id: `cuid_test_${++idSeq}`,
        email,
        name: (args.data.name as string | null) ?? null,
        image: (args.data.image as string | null) ?? null,
        username: null,
        usernameChangedAt: null,
        bio: null,
        role: (args.data.role as string) ?? "user",
        totalPoints: (args.data.totalPoints as number) ?? 0,
        profileCompleted: false,
        accountStatus: "active",
        dateOfBirth: null,
        gender: null,
        state: null,
        city: null,
        mobileNumber: null,
        faithStatus: null,
        faithJourney: null,
        communityRole: null,
        communityRoleOther: null,
        communityRoleVisible: true,
      };
      usersByEmail.set(email, row);
      return { ...row };
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
}

/**
 * Parse the JSON body of a route-handler response. Route handlers are
 * statically typed as returning next/server NextResponse, but at runtime the
 * mock above supplies FakeNextResponse instances — so the parameter accepts
 * unknown and reads the mock's bodyText through a cast.
 */
function jsonOf(resp: unknown): Record<string, unknown> {
  return JSON.parse((resp as FakeNextResponse).bodyText) as Record<string, unknown>;
}

/** Minimal stand-in for NextRequest: only url/json/formData are used. */
function fakeRequest(
  url: string,
  body?: unknown,
  formData?: () => Promise<FormData>
): unknown {
  return {
    url,
    json: async () => body,
    formData: formData ?? (async () => new FormData()),
  };
}

// ─── 5. Replace the module graph BEFORE importing the routes ────────────────
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

// ─── 6. Import the route modules (AFTER the mocks, via before()) ────────────
type SetupRoute = typeof import("@/app/api/profile/setup/route");
type CheckUsernameRoute = typeof import("@/app/api/profile/check-username/route");
type ProfileRoute = typeof import("@/app/api/profile/route");
type UploadAvatarRoute = typeof import("@/app/api/profile/upload-avatar/route");
type AuthMeRoute = typeof import("@/app/api/auth/me/route");

let setupRoute: SetupRoute;
let checkUsernameRoute: CheckUsernameRoute;
let profileRoute: ProfileRoute;
let uploadAvatarRoute: UploadAvatarRoute;
let authMeRoute: AuthMeRoute;

before(async () => {
  setupRoute = await import("@/app/api/profile/setup/route");
  checkUsernameRoute = await import("@/app/api/profile/check-username/route");
  profileRoute = await import("@/app/api/profile/route");
  uploadAvatarRoute = await import("@/app/api/profile/upload-avatar/route");
  authMeRoute = await import("@/app/api/auth/me/route");
});

const CHECK_URL = (u: string) =>
  `http://localhost:3000/api/profile/check-username?username=${encodeURIComponent(u)}`;

function freshState(): void {
  resetDb();
  setSession(null);
}

// ════════════════════════════════════════════════════════════════════════════
// SUSPENDED — the production symptom: onboarding CONTINUE stays disabled
// ════════════════════════════════════════════════════════════════════════════

test("EP-1: suspended user — check-username returns 401 and never available:true (the CONTINUE kill-switch)", async () => {
  freshState();
  setSession("susp@koino.test");
  seedUser({ email: "susp@koino.test", accountStatus: "suspended" });

  const res = await checkUsernameRoute.GET(
    fakeRequest(CHECK_URL("wantedname")) as never
  );
  assert.equal(res.status, 401, "suspended session must be rejected server-side");
  const body = jsonOf(res);
  assert.notEqual(body.available, true, "frontend enables CONTINUE only on available===true");
});

test("EP-2: suspended user — POST /api/profile/setup (step=profile) is 401 and performs NO write", async () => {
  freshState();
  setSession("susp@koino.test");
  seedUser({ email: "susp@koino.test", accountStatus: "suspended" });

  const res = await setupRoute.POST(
    fakeRequest("http://localhost:3000/api/profile/setup", {
      step: "profile",
      username: "wantedname",
      state: "Kerala",
      city: "Kochi",
      mobileNumber: "9999999999",
    }) as never
  );
  assert.equal(res.status, 401);
  assert.equal(jsonOf(res).error, "Not authenticated");
  assert.equal(dbCalls.update, 0, "no profile write may happen for a suspended account");
});

test("EP-3: suspended user — GET /api/profile/setup (resume) is 401", async () => {
  freshState();
  setSession("susp@koino.test");
  seedUser({ email: "susp@koino.test", accountStatus: "suspended" });

  const res = await setupRoute.GET();
  assert.equal(res.status, 401);
});

test("EP-4: suspended user — PATCH /api/profile is 401 and performs NO write", async () => {
  freshState();
  setSession("susp@koino.test");
  seedUser({ email: "susp@koino.test", accountStatus: "suspended", bio: "old" });

  const res = await profileRoute.PATCH(
    fakeRequest("http://localhost:3000/api/profile", { bio: "hijacked" }) as never
  );
  assert.equal(res.status, 401);
  assert.equal(dbCalls.update, 0, "profile edit must be blocked before any write");
  assert.equal(findByEmail("susp@koino.test")!.bio, "old", "stored bio unchanged");
});

test("EP-5: suspended user — POST /api/profile/upload-avatar is 401 and never touches storage", async () => {
  freshState();
  setSession("susp@koino.test");
  seedUser({ email: "susp@koino.test", accountStatus: "suspended" });

  const res = await uploadAvatarRoute.POST(
    fakeRequest("http://localhost:3000/api/profile/upload-avatar") as never
  );
  assert.equal(res.status, 401, "rejected before formData/sharp/storage are ever reached");
  assert.equal(dbCalls.update, 0, "no avatar write for a suspended account");
});

test("EP-6: suspended user — /api/auth/me is 401 (why the app treats the session as signed-out)", async () => {
  freshState();
  setSession("susp@koino.test");
  seedUser({ email: "susp@koino.test", accountStatus: "suspended" });

  const res = await authMeRoute.GET();
  assert.equal(res.status, 401);
  assert.equal(jsonOf(res).error, "Not authenticated");
});

// ════════════════════════════════════════════════════════════════════════════
// BLOCKED / DEACTIVATED — same fail-closed treatment through the endpoints
// ════════════════════════════════════════════════════════════════════════════

test("EP-7: blocked and deactivated accounts are rejected by the setup endpoint too", async () => {
  for (const status of ["blocked", "deactivated"]) {
    freshState();
    setSession("x@koino.test");
    seedUser({ email: "x@koino.test", accountStatus: status });

    const res = await setupRoute.POST(
      fakeRequest("http://localhost:3000/api/profile/setup", {
        step: "profile",
        username: "somebody",
        state: "Kerala",
        city: "Kochi",
        mobileNumber: "9999999999",
      }) as never
    );
    assert.equal(res.status, 401, `status "${status}" must be rejected`);
    assert.equal(dbCalls.update, 0);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// UNAUTHENTICATED — no session at all
// ════════════════════════════════════════════════════════════════════════════

test("EP-8: unauthenticated requests are 401-rejected by setup and check-username", async () => {
  freshState();

  const post = await setupRoute.POST(
    fakeRequest("http://localhost:3000/api/profile/setup", { step: "profile" }) as never
  );
  assert.equal(post.status, 401);

  const check = await checkUsernameRoute.GET(fakeRequest(CHECK_URL("somebody")) as never);
  assert.equal(check.status, 401);
  assert.notEqual(jsonOf(check).available, true);
});

// ════════════════════════════════════════════════════════════════════════════
// ACTIVE — the same endpoints keep working (no over-blocking regression)
// ════════════════════════════════════════════════════════════════════════════

test("EP-9: active user — check-username returns available:true for a free handle", async () => {
  freshState();
  setSession("ada@koino.test");
  seedUser({ email: "ada@koino.test" });

  const res = await checkUsernameRoute.GET(fakeRequest(CHECK_URL("freename")) as never);
  assert.equal(res.status, 200);
  assert.equal(jsonOf(res).available, true);
});

test("EP-10: active user — POST /api/profile/setup saves the profile step (write allowed)", async () => {
  freshState();
  setSession("ada@koino.test");
  const row = seedUser({ email: "ada@koino.test", profileCompleted: false });

  const res = await setupRoute.POST(
    fakeRequest("http://localhost:3000/api/profile/setup", {
      step: "profile",
      username: "adanew",
      state: "Kerala",
      city: "Kochi",
      mobileNumber: "9999999999",
    }) as never
  );
  assert.equal(res.status, 200);
  const body = jsonOf(res);
  assert.equal(body.success, true);
  assert.equal(dbCalls.update, 1, "exactly one profile write");
  assert.equal(row.username, "adanew");
  assert.equal(row.state, "Kerala");
});

test("EP-11: active user — PATCH /api/profile edits the bio (post-onboarding editing preserved)", async () => {
  freshState();
  setSession("ada@koino.test");
  const row = seedUser({ email: "ada@koino.test", bio: "old bio" });

  const res = await profileRoute.PATCH(
    fakeRequest("http://localhost:3000/api/profile", { bio: "new bio" }) as never
  );
  assert.equal(res.status, 200);
  assert.equal(dbCalls.update, 1);
  assert.equal(row.bio, "new bio");
});

test("EP-12: active user — /api/auth/me returns the profile payload", async () => {
  freshState();
  setSession("ada@koino.test");
  seedUser({ email: "ada@koino.test", profileCompleted: true, totalPoints: 5 });

  const res = await authMeRoute.GET();
  assert.equal(res.status, 200);
  const body = jsonOf(res);
  assert.equal(body.email, "ada@koino.test");
  assert.equal(body.profileCompleted, true);
});

test("EP-13: active user — upload-avatar passes the auth guard (fails later only on missing config)", async () => {
  freshState();
  setSession("ada@koino.test");
  seedUser({ email: "ada@koino.test" });

  const res = await uploadAvatarRoute.POST(
    fakeRequest("http://localhost:3000/api/profile/upload-avatar") as never
  );
  // The auth guard passed; the route now stops at the (intentional) missing
  // SUPABASE_SERVICE_ROLE_KEY config check — proving eligibility is NOT what
  // blocks active users.
  assert.equal(res.status, 500);
  assert.match(String(jsonOf(res).error), /Supabase Storage is not configured/i);
  assert.equal(dbCalls.update, 0);
});
