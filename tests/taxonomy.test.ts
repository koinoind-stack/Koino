/**
 * Regression tests — Phase 2: Taxonomy & Content-Type Foundations.
 *
 * Pins the Phase 2 scope from the approved Implementation Plan v2 (§2, §5.3),
 * basis commit 1dbd489 (current main, post PR #21):
 *
 *   1. Content types — exactly the six values incl. TESTIMONY; server-side
 *      validation accepts exactly those.
 *   2. Seed integrity — six canonical categories in review order; topic set
 *      with the SIX legacy SPA keys preserved exactly (same id + color);
 *      unique slugs; every topic parent exists. The seed script is
 *      upsert-shaped (re-run creates nothing — idempotency by construction).
 *   3. Slug rules — format validation, slugify behavior, cross-table
 *      uniqueness checks.
 *   4. Admin authorization — every taxonomy API route carries the strict
 *      401/403 requireAdmin guard (live matrix on the categories route).
 *   5. Association guards — inactive topics cannot be newly assigned;
 *      unknown articles/topics rejected; ceiling enforced; writes are
 *      transactional replace-sets.
 *   6. Reorder — batch sortOrder persistence, unknown ids rejected.
 *   7. Wiring — AdminView Taxonomy tab, HomeApp Grow "knowledge" entry,
 *      /knowledge landing contract, i18n key parity, package.json suite
 *      registration, migration + schema contract.
 *
 * Technique: Node's built-in test runner (node:test) + tsx, with
 * mock.module() fakes for Prisma, auth and next/server BEFORE the modules
 * under test are imported. No network, no database, no production contact.
 * The YouVersion/Bible stack is never imported by any module under test.
 *
 * Run: npm test
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Fake session (getAuthUser) ──────────────────────────────────────────
type FakeAuthUser = { id: string; role: string; name: string | null; username: string | null };
let sessionUser: FakeAuthUser | null = null;
function setSession(u: FakeAuthUser | null): void {
  sessionUser = u;
}

// ─── 2. Fake Prisma ─────────────────────────────────────────────────────────
type Call = { model: string; op: string; args: any };
const calls: Call[] = [];
let categoryRows: any[] = [];
let topicRows: any[] = [];
let koinoArticleRows: any[] = [];
let articleTopicRows: any[] = [];
let nextTopicId = 1;
let transactionCount = 0;

function record(model: string, op: string, args: any): void {
  calls.push({ model, op, args });
}
function resetState(): void {
  calls.length = 0;
  categoryRows = [];
  topicRows = [];
  koinoArticleRows = [];
  articleTopicRows = [];
  nextTopicId = 1;
  transactionCount = 0;
  setSession(null);
}

const fakeDb = {
  category: {
    findUnique: async (args: any) => {
      record("category", "findUnique", args);
      return categoryRows.find((r) => r.id === args.where.id) ?? null;
    },
    findFirst: async (args: any) => {
      record("category", "findFirst", args);
      const not = args.where?.NOT?.id;
      return (
        categoryRows.find((r) => r.slug === args.where.slug && r.id !== not) ?? null
      );
    },
    findMany: async (args: any) => {
      record("category", "findMany", args);
      const inIds = args.where?.id?.in;
      return inIds ? categoryRows.filter((r) => inIds.includes(r.id)) : categoryRows;
    },
    create: async (args: any) => {
      record("category", "create", args);
      const row = { id: `cat_${categoryRows.length + 1}`, isActive: true, ...args.data };
      categoryRows.push(row);
      return row;
    },
    update: async (args: any) => {
      record("category", "update", args);
      const row = categoryRows.find((r) => r.id === args.where.id);
      if (!row) throw new Error("P2025");
      Object.assign(row, args.data);
      return row;
    },
  },
  topic: {
    findUnique: async (args: any) => {
      record("topic", "findUnique", args);
      if (args.where.legacyKey !== undefined) {
        return topicRows.find((r) => r.legacyKey === args.where.legacyKey) ?? null;
      }
      return topicRows.find((r) => r.id === args.where.id) ?? null;
    },
    findFirst: async (args: any) => {
      record("topic", "findFirst", args);
      const not = args.where?.NOT?.id;
      return topicRows.find((r) => r.slug === args.where.slug && r.id !== not) ?? null;
    },
    findMany: async (args: any) => {
      record("topic", "findMany", args);
      const inIds = args.where?.id?.in;
      let rows = topicRows;
      if (args.where?.isActive !== undefined) {
        rows = rows.filter((r) => r.isActive === args.where.isActive);
      }
      if (inIds) rows = rows.filter((r) => inIds.includes(r.id));
      return rows;
    },
    create: async (args: any) => {
      record("topic", "create", args);
      const row = { id: `top_${nextTopicId++}`, isActive: true, ...args.data };
      topicRows.push(row);
      return row;
    },
    update: async (args: any) => {
      record("topic", "update", args);
      const row = topicRows.find((r) => r.id === args.where.id);
      if (!row) throw new Error("P2025");
      Object.assign(row, args.data);
      return row;
    },
    delete: async (args: any) => {
      record("topic", "delete", args);
      const i = topicRows.findIndex((r) => r.id === args.where.id);
      if (i === -1) throw new Error("P2025");
      return topicRows.splice(i, 1)[0];
    },
  },
  koinoArticle: {
    findUnique: async (args: any) => {
      record("koinoArticle", "findUnique", args);
      return koinoArticleRows.find((r) => r.id === args.where.id) ?? null;
    },
  },
  articleTopic: {
    findMany: async (args: any) => {
      record("articleTopic", "findMany", args);
      return articleTopicRows.filter((r) => r.articleId === args.where.articleId);
    },
    deleteMany: async (args: any) => {
      record("articleTopic", "deleteMany", args);
      const before = articleTopicRows.length;
      articleTopicRows = articleTopicRows.filter((r) => r.articleId !== args.where.articleId);
      return { count: before - articleTopicRows.length };
    },
    createMany: async (args: any) => {
      record("articleTopic", "createMany", args);
      for (const d of args.data) articleTopicRows.push({ id: `at_${articleTopicRows.length + 1}`, ...d });
      return { count: args.data.length };
    },
  },
  $transaction: async (cb: (tx: any) => Promise<any>) => {
    record("db", "$transaction", {});
    transactionCount++;
    return cb(fakeDb);
  },
};

// ─── 3. Fake next/server + auth ─────────────────────────────────────────────
class FakeNextResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Record<string, string>;
  constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.headers = init?.headers ?? {};
  }
  static json(data: unknown, init?: { status?: number }): FakeNextResponse {
    return new FakeNextResponse(JSON.stringify(data), init);
  }
}

mock.module("@/lib/db", { namedExports: { db: fakeDb } });
mock.module("next/server", { namedExports: { NextResponse: FakeNextResponse } });
mock.module("@/lib/auth-server", {
  namedExports: { getAuthUser: async () => sessionUser },
});

// ─── 4. Import the modules under test (AFTER the mocks) ─────────────────────
type ContentTaxonomy = typeof import("@/lib/content-taxonomy");
type TaxonomyServer = typeof import("@/lib/taxonomy-server");
type CategoriesRoute = typeof import("@/app/api/admin/taxonomy/categories/route");
type TopicsRoute = typeof import("@/app/api/admin/taxonomy/topics/route");
type ArticleTopicsRoute = typeof import("@/app/api/admin/taxonomy/articles/[id]/topics/route");
type TopicsReorderRoute = typeof import("@/app/api/admin/taxonomy/topics/reorder/route");

let contentTaxonomy: ContentTaxonomy;
let taxonomyServer: TaxonomyServer;
let categoriesRoute: CategoriesRoute;
let topicsRoute: TopicsRoute;
let articleTopicsRoute: ArticleTopicsRoute;
let topicsReorderRoute: TopicsReorderRoute;

before(async () => {
  contentTaxonomy = await import("@/lib/content-taxonomy");
  taxonomyServer = await import("@/lib/taxonomy-server");
  categoriesRoute = await import("@/app/api/admin/taxonomy/categories/route");
  topicsRoute = await import("@/app/api/admin/taxonomy/topics/route");
  articleTopicsRoute = await import("@/app/api/admin/taxonomy/articles/[id]/topics/route");
  topicsReorderRoute = await import("@/app/api/admin/taxonomy/topics/reorder/route");
});

// ─── 5. Pure unit tests — content types ─────────────────────────────────────

test("P2-TYPE-1: the content-type list is EXACTLY the six unified values", () => {
  assert.deepEqual(
    [...contentTaxonomy.CONTENT_TYPES],
    ["BLOG", "ARTICLE", "BIBLE_STUDY", "DEVOTIONAL", "TESTIMONY", "APOLOGETICS"]
  );
});

test("P2-TYPE-2: TESTIMONY is a first-class content type (v2 revision)", () => {
  assert.ok(contentTaxonomy.CONTENT_TYPES.includes("TESTIMONY"));
  assert.equal(contentTaxonomy.CONTENT_TYPE_LABELS.TESTIMONY, "Testimony");
});

test("P2-TYPE-3: isContentType accepts exactly the six and rejects everything else", () => {
  for (const t of contentTaxonomy.CONTENT_TYPES) {
    assert.equal(contentTaxonomy.isContentType(t), true, t);
  }
  for (const bad of ["blog", "BLOGS", "Sermon", "", "APOLOGETIC", 42, null, undefined]) {
    assert.equal(contentTaxonomy.isContentType(bad as any), false, String(bad));
  }
});

test("P2-TYPE-4: existing public routes are wired; unified-only types are not dead links", () => {
  assert.equal(contentTaxonomy.CONTENT_TYPE_ROUTES.BLOG, "/blog");
  assert.equal(contentTaxonomy.CONTENT_TYPE_ROUTES.APOLOGETICS, "/apologetics");
  // Phase 2 follow-up (post-PR #22): every type now resolves to a REAL
  // destination — the unified-only types open /knowledge/browse?type=<TYPE>
  // (read-only listing over the existing KoinoArticle model), so the landing
  // never shows a dead "Coming soon" card. Full contract: navigation suite.
  assert.equal(
    contentTaxonomy.CONTENT_TYPE_ROUTES.TESTIMONY,
    "/knowledge/browse?type=TESTIMONY"
  );
  assert.equal(
    contentTaxonomy.CONTENT_TYPE_ROUTES.BIBLE_STUDY,
    "/knowledge/browse?type=BIBLE_STUDY"
  );
});

// ─── 6. Pure unit tests — slugs ─────────────────────────────────────────────

test("P2-SLUG-1: slug format rules", () => {
  for (const ok of ["apologetics", "problem-of-evil", "god-2", "a"]) {
    assert.equal(contentTaxonomy.isValidSlug(ok), true, ok);
  }
  for (const bad of ["", "UPPER", "double--hyphen", "-lead", "trail-", "has space", "sl/ash", "a".repeat(81)]) {
    assert.equal(contentTaxonomy.isValidSlug(bad), false, bad);
  }
});

test("P2-SLUG-2: slugify derives valid slugs from names (apostrophes, ampersands, case)", () => {
  assert.equal(contentTaxonomy.slugify("God's Existence"), "gods-existence");
  assert.equal(contentTaxonomy.slugify("Science & Faith"), "science-and-faith");
  assert.equal(contentTaxonomy.slugify("Prayer and Encouragement"), "prayer-and-encouragement");
  assert.equal(contentTaxonomy.slugify("Church & Ministry"), "church-and-ministry");
  for (const name of ["God's Existence", "Church & Ministry"]) {
    assert.equal(contentTaxonomy.isValidSlug(contentTaxonomy.slugify(name)), true, name);
  }
});

test("P2-SLUG-3: buildSlug validates explicit slugs and derives from names", async () => {
  assert.equal(taxonomyServer.buildSlug("Bible Study", "bible-study"), "bible-study");
  assert.equal(taxonomyServer.buildSlug("Bible Study"), "bible-study");
  assert.throws(
    () => taxonomyServer.buildSlug("Bible Study", "Not A Slug!"),
    (e: any) => e instanceof taxonomyServer.TaxonomyError && e.status === 400
  );
});

// ─── 7. Pure unit tests — seed integrity (Plan v2 §2.3/2.4, Tables 4–6) ─────

test("P2-SEED-1: exactly six canonical categories, in review order", () => {
  assert.deepEqual(
    contentTaxonomy.CATEGORY_SEED.map((c) => c.name),
    [
      "Apologetics",
      "Bible Study",
      "Christian Living",
      "Church and Ministry",
      "Community",
      "Prayer and Encouragement",
    ]
  );
  assert.deepEqual(
    contentTaxonomy.CATEGORY_SEED.map((c) => c.sortOrder),
    [1, 2, 3, 4, 5, 6]
  );
});

test("P2-SEED-2: the SIX legacy topic keys are preserved exactly, with SPA colors", () => {
  const byLegacy = new Map(
    contentTaxonomy.TOPIC_SEED.filter((t) => t.legacyKey).map((t) => [t.legacyKey, t])
  );
  const expected: [string, string, string][] = [
    ["gods_existence", "gods-existence", "#A855F7"],
    ["problem_of_evil", "problem-of-evil", "#EF4444"],
    ["resurrection", "resurrection-of-jesus", "#22C55E"],
    ["bible_reliability", "bible-reliability", "#3B82F6"],
    ["science_faith", "science-faith", "#F59E0B"],
    ["world_religions", "world-religions", "#EC4899"],
  ];
  for (const [key, slug, color] of expected) {
    const t = byLegacy.get(key);
    assert.ok(t, `legacy key ${key} must be seeded`);
    assert.equal(t.slug, slug);
    assert.equal(t.color, color, `${key} keeps its SPA color`);
    assert.equal(t.parentCategorySlug, "apologetics");
  }
  assert.equal(byLegacy.size, 6);
});

test("P2-SEED-3: seed is internally consistent — unique slugs, valid parents, valid slugs", () => {
  const catSlugs = contentTaxonomy.CATEGORY_SEED.map((c) => c.slug);
  assert.equal(new Set(catSlugs).size, catSlugs.length, "category slugs unique");
  const topicSlugs = contentTaxonomy.TOPIC_SEED.map((t) => t.slug);
  assert.equal(new Set(topicSlugs).size, topicSlugs.length, "topic slugs unique");
  for (const t of contentTaxonomy.TOPIC_SEED) {
    assert.ok(
      catSlugs.includes(t.parentCategorySlug),
      `topic ${t.slug} parent ${t.parentCategorySlug} exists`
    );
    assert.equal(contentTaxonomy.isValidSlug(t.slug), true, t.slug);
  }
  // Table 6 coverage: 6 legacy + 5 new apologetics + Forgiveness = 12
  assert.equal(contentTaxonomy.TOPIC_SEED.length, 12);
});

test("P2-SEED-4: the seed script is upsert-shaped — a re-run creates nothing", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("prisma/scripts/seed-taxonomy.ts", "utf8");
  // Idempotency by construction: look up BEFORE create, on both entities.
  assert.ok(
    src.includes('db.category.findUnique({ where: { slug: c.slug } })'),
    "categories must be looked up by slug before creating"
  );
  assert.ok(
    src.includes('db.topic.findUnique({ where: { slug: t.slug } })'),
    "topics must be looked up by slug before creating"
  );
  // Legacy-key conflicts surface loudly instead of being overwritten.
  assert.ok(src.includes("Seed conflict"), "legacyKey conflicts must never be silent");
});

// ─── 8. Mocked-db behavior — taxonomy-server ────────────────────────────────

const ADMIN: FakeAuthUser = { id: "u_admin", role: "admin", name: "Admin", username: "admin" };

function seedTaxonomyRows() {
  categoryRows.push(
    { id: "cat_ap", name: "Apologetics", slug: "apologetics", isActive: true, sortOrder: 1 },
    { id: "cat_cl", name: "Christian Living", slug: "christian-living", isActive: true, sortOrder: 3 }
  );
  topicRows.push(
    { id: "top_1", name: "God's Existence", slug: "gods-existence", legacyKey: "gods_existence", parentCategoryId: "cat_ap", isActive: true, sortOrder: 1 },
    { id: "top_2", name: "Forgiveness", slug: "forgiveness", legacyKey: null, parentCategoryId: "cat_cl", isActive: true, sortOrder: 2 },
    { id: "top_3", name: "Retired Topic", slug: "retired-topic", legacyKey: "resurrection", parentCategoryId: "cat_ap", isActive: false, sortOrder: 3 }
  );
  koinoArticleRows.push({ id: "ka_1" });
}

test("P2-PICK-1: active pickers exclude deactivated topics; legacy resolution still finds them", async () => {
  resetState();
  seedTaxonomyRows();

  const active = await taxonomyServer.listActiveTopics();
  assert.equal(active.length, 2, "deactivated topics are excluded from pickers");

  // Legacy resolution (Q&A pipeline bridge) does NOT filter on isActive —
  // deactivation hides a topic from NEW assignments but never breaks the
  // existing UserQuestion.category → topic mapping.
  const retired = await taxonomyServer.resolveTopicByLegacyKey("resurrection");
  assert.ok(retired, "deactivated legacy topic still resolves via legacyKey");
  assert.equal(retired!.isActive, false);
});

test("P2-ASSOC-1: setArticleTopics — happy path is a transactional replace-set", async () => {
  resetState();
  seedTaxonomyRows();
  setSession(ADMIN);

  const result = await taxonomyServer.setArticleTopics("ka_1", ["top_1", "top_2"]);
  assert.deepEqual(result.sort(), ["top_1", "top_2"]);
  assert.equal(transactionCount, 1, "replace-set runs inside one transaction");
  const del = calls.find((c) => c.model === "articleTopic" && c.op === "deleteMany");
  const cre = calls.find((c) => c.model === "articleTopic" && c.op === "createMany");
  assert.ok(del && cre, "delete-then-create inside the same transaction");
});

test("P2-ASSOC-2: setArticleTopics — inactive topics cannot be NEWLY assigned (409)", async () => {
  resetState();
  seedTaxonomyRows();
  await assert.rejects(
    () => taxonomyServer.setArticleTopics("ka_1", ["top_1", "top_3"]),
    (e: any) => e instanceof taxonomyServer.TaxonomyError && e.status === 409
  );
});

test("P2-ASSOC-3: setArticleTopics — unknown article (404) and unknown topic (400)", async () => {
  resetState();
  seedTaxonomyRows();
  await assert.rejects(
    () => taxonomyServer.setArticleTopics("ka_missing", ["top_1"]),
    (e: any) => e instanceof taxonomyServer.TaxonomyError && e.status === 404
  );
  await assert.rejects(
    () => taxonomyServer.setArticleTopics("ka_1", ["top_nope"]),
    (e: any) => e instanceof taxonomyServer.TaxonomyError && e.status === 400
  );
});

test("P2-REORD-1: reorder persists array order as sortOrder and rejects unknown ids", async () => {
  resetState();
  seedTaxonomyRows();
  const n = await taxonomyServer.reorderTaxonomy("topic", ["top_2", "top_1"]);
  assert.equal(n, 2);
  const updates = calls.filter((c) => c.model === "topic" && c.op === "update");
  assert.equal(updates.length, 2);
  assert.deepEqual(
    updates.map((u) => ({ id: u.args.where.id, sortOrder: u.args.data.sortOrder })),
    [
      { id: "top_2", sortOrder: 1 },
      { id: "top_1", sortOrder: 2 },
    ]
  );
  await assert.rejects(
    () => taxonomyServer.reorderTaxonomy("topic", ["top_2", "top_ghost"]),
    (e: any) => e instanceof taxonomyServer.TaxonomyError && e.status === 400
  );
});

test("P2-SLUG-4: slug uniqueness is checked across BOTH taxonomy tables", async () => {
  resetState();
  seedTaxonomyRows();
  await assert.rejects(
    () => taxonomyServer.assertSlugAvailable("gods-existence"),
    (e: any) => e instanceof taxonomyServer.TaxonomyError && e.status === 409
  );
  await assert.rejects(
    () => taxonomyServer.assertSlugAvailable("apologetics"),
    (e: any) => e instanceof taxonomyServer.TaxonomyError && e.status === 409
  );
  await taxonomyServer.assertSlugAvailable("completely-free"); // no throw
});

// ─── 9. Route behavior — authorization matrix + validation ──────────────────

function reqWith(body: unknown): any {
  return { json: async () => body };
}

test("P2-AUTH-1: categories GET — 401 unauthenticated / 403 non-admin / 200 admin", async () => {
  resetState();
  seedTaxonomyRows();

  const anon = await categoriesRoute.GET();
  assert.equal(anon.status, 401);

  setSession({ id: "u_member", role: "user", name: "Member", username: "member" });
  const member = await categoriesRoute.GET();
  assert.equal(member.status, 403);

  setSession(ADMIN);
  const admin = await categoriesRoute.GET();
  assert.equal(admin.status, 200);
});

test("P2-AUTH-2: categories POST — 403 non-admin; admin create derives slug; 409 on duplicate; 400 on bad slug", async () => {
  resetState();
  seedTaxonomyRows();

  setSession({ id: "u_member", role: "user", name: "Member", username: "member" });
  const member = await categoriesRoute.POST(reqWith({ name: "Youth" }));
  assert.equal(member.status, 403);

  setSession(ADMIN);
  const created = await categoriesRoute.POST(reqWith({ name: "Youth Ministry" }));
  assert.equal(created.status, 201);
  const body = JSON.parse((created as any).body);
  assert.equal(body.category.slug, "youth-ministry", "slug derived from name");

  const dup = await categoriesRoute.POST(reqWith({ name: "Another Apologetics", slug: "apologetics" }));
  assert.equal(dup.status, 409);

  const badSlug = await categoriesRoute.POST(reqWith({ name: "Broken", slug: "Not A Slug!" }));
  assert.equal(badSlug.status, 400);
});

test("P2-AUTH-3: topics POST — 403 non-admin; forged legacyKey can never land", async () => {
  resetState();
  seedTaxonomyRows();
  setSession({ id: "u_member", role: "user", name: "Member", username: "member" });
  const member = await topicsRoute.POST(reqWith({ name: "X", parentCategoryId: "cat_ap" }));
  assert.equal(member.status, 403);

  setSession(ADMIN);
  // The API schema does not accept a legacyKey field: unknown keys are
  // stripped and the server creates legacyKey=null — the forged SPA id must
  // never reach the database.
  const forged = await topicsRoute.POST(
    reqWith({ name: "Sneaky", parentCategoryId: "cat_ap", legacyKey: "gods_existence" })
  );
  assert.equal(forged.status, 201);
  const stored = topicRows.find((t) => t.slug === "sneaky");
  assert.ok(stored, "the topic itself was created");
  assert.equal(stored!.legacyKey, null, "forged legacyKey must NOT be stored");
  // The only row carrying the seeded legacy id is the harness's own top_1.
  assert.deepEqual(
    topicRows.filter((t) => t.legacyKey === "gods_existence").map((t) => t.id),
    ["top_1"]
  );
});

test("P2-AUTH-4: article-topics PUT — 403 non-admin; admin 409 on inactive assignment", async () => {
  resetState();
  seedTaxonomyRows();

  setSession({ id: "u_member", role: "user", name: "Member", username: "member" });
  const member = await articleTopicsRoute.PUT(reqWith({ topicIds: ["top_1"] }), {
    params: Promise.resolve({ id: "ka_1" }),
  } as any);
  assert.equal(member.status, 403);

  setSession(ADMIN);
  const inactive = await articleTopicsRoute.PUT(reqWith({ topicIds: ["top_3"] }), {
    params: Promise.resolve({ id: "ka_1" }),
  } as any);
  assert.equal(inactive.status, 409);

  const ok = await articleTopicsRoute.PUT(reqWith({ topicIds: ["top_1", "top_2"] }), {
    params: Promise.resolve({ id: "ka_1" }),
  } as any);
  assert.equal(ok.status, 200);
});

test("P2-AUTH-5: topics reorder — 401 unauthenticated; admin reorder persists", async () => {
  resetState();
  seedTaxonomyRows();

  const anon = await topicsReorderRoute.POST(reqWith({ ids: ["top_1"] }));
  assert.equal(anon.status, 401);

  setSession(ADMIN);
  const ok = await topicsReorderRoute.POST(reqWith({ ids: ["top_1", "top_2"] }));
  assert.equal(ok.status, 200);
});

// ─── 10. Source contracts — guards and guard rails on all seven routes ──────

const TAXONOMY_ROUTES = [
  "src/app/api/admin/taxonomy/categories/route.ts",
  "src/app/api/admin/taxonomy/categories/[id]/route.ts",
  "src/app/api/admin/taxonomy/categories/reorder/route.ts",
  "src/app/api/admin/taxonomy/topics/route.ts",
  "src/app/api/admin/taxonomy/topics/[id]/route.ts",
  "src/app/api/admin/taxonomy/topics/reorder/route.ts",
  "src/app/api/admin/taxonomy/articles/[id]/topics/route.ts",
];

test("P2-GUARD-1: every taxonomy route enforces the strict 401/403 admin guard", async () => {
  const fs = await import("node:fs");
  for (const route of TAXONOMY_ROUTES) {
    const src = fs.readFileSync(route, "utf8");
    assert.ok(
      src.includes('error: "Authentication required"') && src.includes("status: 401"),
      `${route} must return 401 for unauthenticated callers`
    );
    assert.ok(
      src.includes('error: "Admin access required"') && src.includes("status: 403"),
      `${route} must return 403 for non-admin callers`
    );
    assert.ok(
      src.includes("user.role !== \"admin\""),
      `${route} must compare the SERVER-side role, never a client assertion`
    );
  }
});

test("P2-GUARD-2: hard deletes are restricted — legacy topics and in-use rows are protected", async () => {
  const fs = await import("node:fs");
  const topicDelete = fs.readFileSync("src/app/api/admin/taxonomy/topics/[id]/route.ts", "utf8");
  assert.ok(
    topicDelete.includes("legacyKey") && topicDelete.includes("Deactivate it instead"),
    "legacy-keyed topics must never be hard-deleted"
  );
  assert.ok(
    topicDelete.includes("_count") && topicDelete.includes("status: 409"),
    "in-use topics must be blocked with 409"
  );
  const catDelete = fs.readFileSync("src/app/api/admin/taxonomy/categories/[id]/route.ts", "utf8");
  assert.ok(
    catDelete.includes("Deactivate it instead") && catDelete.includes("status: 409"),
    "in-use categories must be blocked with 409"
  );
});

// ─── 11. Wiring contracts — schema, migration, admin, SPA, i18n ─────────────

test("P2-WIRE-1: schema has the four taxonomy models with the right unique keys", async () => {
  const fs = await import("node:fs");
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  for (const model of ["model Category {", "model Topic {", "model ArticleTopic {", "model SlugRedirect {"]) {
    assert.ok(schema.includes(model), `${model} exists`);
  }
  assert.ok(/model Topic \{[\s\S]*?legacyKey\s+String\?\s+@unique/.test(schema), "Topic.legacyKey @unique");
  assert.ok(/model Category \{[\s\S]*?slug\s+String\s+@unique/.test(schema), "Category.slug @unique");
  assert.ok(/@@unique\(\[articleId, topicId\]\)/.test(schema), "ArticleTopic pair uniqueness");
  assert.ok(/legacyBlogPostId String\? @unique/.test(schema.replace(/\s+/g, " ")), "KoinoArticle.legacyBlogPostId @unique");
  assert.ok(/unifiedArticleId String\?\s+@unique/.test(schema.replace(/\s+/g, " ")), "Post.unifiedArticleId @unique");
});

test("P2-WIRE-2: the migration creates the four tables + additive columns, drops nothing", async () => {
  const fs = await import("node:fs");
  const sql = fs.readFileSync(
    "prisma/migrations/20261103000000_unified_taxonomy/migration.sql",
    "utf8"
  );
  for (const table of ['CREATE TABLE "Category"', 'CREATE TABLE "Topic"', 'CREATE TABLE "ArticleTopic"', 'CREATE TABLE "SlugRedirect"']) {
    assert.ok(sql.includes(table), table);
  }
  assert.ok(sql.includes('ALTER TABLE "KoinoArticle" ADD COLUMN     "legacyBlogPostId" TEXT;'));
  assert.ok(sql.includes('ALTER TABLE "Post" ADD COLUMN     "unifiedArticleId" TEXT;'));
  assert.ok(!/DROP (TABLE|COLUMN)/i.test(sql), "Phase 2 must not drop anything");
  for (const key of ["gods_existence", "problem_of_evil", "resurrection", "bible_reliability", "science_faith", "world_religions"]) {
    assert.ok(sql.includes(key), `migration documents legacy key ${key}`);
  }
});

test("P2-WIRE-3: AdminView registers the Taxonomy tab; HomeApp adds the Grow entry", async () => {
  const fs = await import("node:fs");
  const admin = fs.readFileSync("src/components/crosscrafted/AdminView.tsx", "utf8");
  assert.ok(admin.includes('| "taxonomy"'), "AdminTab union gains taxonomy");
  assert.ok(admin.includes('id: "taxonomy"'), "TABS list gains taxonomy");
  assert.ok(admin.includes('<TaxonomyTab />'), "taxonomy tab renders");

  const home = fs.readFileSync("src/components/home/HomeApp.tsx", "utf8");
  assert.ok(home.includes('| "knowledge"'), "View union gains knowledge");
  assert.ok(
    home.includes('{ id: "knowledge", icon: Library, labelKey: "side.knowledge" }'),
    "Grow category links the knowledge entry"
  );
  assert.ok(
    home.includes('v === "knowledge" ? "knowledge_nav_click"'),
    "pseudo-view navigation + analytics wired"
  );
});

test("P2-WIRE-4: the /knowledge landing rides the DB taxonomy and the shared type registry", async () => {
  const fs = await import("node:fs");
  const page = fs.readFileSync("src/app/knowledge/page.tsx", "utf8");
  assert.ok(page.includes('export const dynamic = "force-dynamic"'), "public DB read is force-dynamic");
  assert.ok(page.includes("getTaxonomyLanding"), "reads the shared taxonomy server");
  assert.ok(page.includes("CONTENT_TYPE_ROUTES"), "type navigation uses the shared route map");
  assert.ok(page.includes("PublicPageLayout"), "uses the public layout");
  // The actual route values are pinned in P2-TYPE-4 (BLOG → /blog,
  // APOLOGETICS → /apologetics) — the page renders them via the map.
});

test("P2-WIRE-5: i18n keys exist in en and te (TE-1 parity)", async () => {
  const en = (await import("@/lib/i18n/en")).default;
  const te = (await import("@/lib/i18n/te")).default;
  assert.ok("side.knowledge" in en && "side.knowledge" in te);
  assert.ok("admin.tab.taxonomy" in en && "admin.tab.taxonomy" in te);
  assert.equal(en["side.knowledge"], "Articles & Knowledge");
});

test("P2-WIRE-6: the new suite is registered in the npm test script", async () => {
  const pkg = JSON.parse((await import("node:fs")).readFileSync("package.json", "utf8"));
  assert.ok(
    pkg.scripts.test.includes("tests/taxonomy.test.ts"),
    "npm test must run the Phase 2 suite"
  );
});
