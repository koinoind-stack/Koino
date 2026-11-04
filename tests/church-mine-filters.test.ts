/**
 * Church "My Listings" tab + public type filter tests (2026-11-04 follow-up).
 *
 * After PR #35 (admin create/transfer + owner self-edit + type field), the
 * admin asked for the user-facing side to be complete:
 *   1. A "My Listings" tab where the signed-in owner sees ALL their own
 *      submissions (any status: PENDING / PUBLISHED / REJECTED / CANCELLED)
 *      with the review state, and can edit each one.
 *   2. A Type filter (Church / Ministry / Fellowship / Prayer Hall / Other)
 *      on the public directory, wired into filtering, the filter counter,
 *      both "clear filters" buttons, and the filter panel.
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

const mineApi = src("app", "api", "churches", "mine", "route.ts");
const churchesView = src("components", "crosscrafted", "ChurchesView.tsx");
const en = src("lib", "i18n", "en.ts");
const te = src("lib", "i18n", "te.ts");
const pkg = read("package.json");

const CHURCH_TYPES = ["Church", "Ministry", "Fellowship", "Prayer Hall", "Other"];

// ─── 1. GET /api/churches/mine — the owner's submissions, any status ────────

test("ML-1: /api/churches/mine exists as an authenticated GET", () => {
  assert.match(mineApi, /export async function GET\(\)/);
  assert.match(mineApi, /getSessionUser/);
  // Signed-out → 401; suspended account → 403 (same contract as businesses/mine)
  assert.match(mineApi, /jsonError\("Not authenticated", 401\)/);
  assert.match(mineApi, /ACCOUNT_INACTIVE/);
});

test("ML-2: mine endpoint filters server-side on createdById — never on client input", () => {
  assert.match(mineApi, /where: \{ createdById: session\.user\.id \}/);
  assert.match(mineApi, /orderBy: \{ createdAt: "desc" \}/);
  assert.match(mineApi, /take: 100/);
});

test("ML-3: mine returns ALL statuses — no status filter in the where clause", () => {
  // The whole point: PENDING / REJECTED / CANCELLED must be visible to the
  // owner even though the public API only returns PUBLISHED.
  assert.ok(!/status:\s*"PUBLISHED"/.test(mineApi), "mine endpoint must not filter to PUBLISHED");
  assert.match(mineApi, /is_owner: true/);
});

test("ML-4: mine returns the display shape the UI cards need (snake_case parity)", () => {
  for (const key of [
    "service_times",
    "languages",
    "cover_image",
    "cover_gradient",
    "whatsapp_number",
    "followers_count",
    "rejectionReason",
    "type",
    "status",
  ]) {
    assert.ok(mineApi.includes(key), `mine payload missing ${key}`);
  }
});

test("ML-5: mine degrades gracefully when the Church table/column is missing", () => {
  assert.match(mineApi, /P2021|P2022/);
  assert.match(mineApi, /Response\.json\(\{ churches: \[\] \}\)/);
});

// ─── 2. ChurchesView — third tab "My Listings" ──────────────────────────────

test("ML-6: DiscoverTab gains the my-listings tab (3-tab strip)", () => {
  assert.match(churchesView, /type DiscoverTab = "discover" \| "my-churches" \| "my-listings";/);
  assert.match(churchesView, /setDiscoverTab\("my-listings"\)/);
  assert.match(churchesView, /t\("churches\.tab\.myListings"\)/);
});

test("ML-7: My Listings loads lazily from /api/churches/mine and refreshes on demand", () => {
  assert.match(churchesView, /fetch\("\/api\/churches\/mine", \{ cache: "no-store" \}\)/);
  assert.match(churchesView, /discoverTab === "my-listings" && !myListingsLoaded\) loadMyListings\(\)/);
  // Owner edit path must refresh the review state (force re-fetch)
  assert.match(churchesView, /loadMyListings\(true\)/);
});

test("ML-8: MyListingsView renders review status badges + Edit + empty/auth/retry states", () => {
  assert.match(churchesView, /function MyListingsView\(/);
  assert.match(churchesView, /churches\.mine\.statusPending/);
  assert.match(churchesView, /churches\.mine\.statusLive/);
  assert.match(churchesView, /churches\.mine\.statusRejected/);
  assert.match(churchesView, /churches\.mine\.statusCancelled/);
  assert.match(churchesView, /rejectionReason/);
  // Edit reuses the shared owner form (openEdit → PATCH flow)
  assert.match(churchesView, /onEdit=\{openEdit\}/);
  // Auth gate + empty state + retry button
  assert.match(churchesView, /churches\.mine\.signInPrompt/);
  assert.match(churchesView, /churches\.mine\.empty/);
  assert.match(churchesView, /onRetry/);
});

// ─── 3. Public directory — Type filter ──────────────────────────────────────

test("ML-9: filterType state wired into the client-side filter memo", () => {
  assert.match(churchesView, /const \[filterType, setFilterType\] = useState\(""\);/);
  assert.match(churchesView, /if \(filterType && \(c\.type \|\| "Church"\) !== filterType\) return false;/);
  assert.match(
    churchesView,
    /\}, \[churches, filterState, filterCity, filterDenomination, filterType, filterLanguage, filterServiceDay, searchQuery, sortBy\]\);/
  );
});

test("ML-10: Type filter counts as an active filter and is cleared by BOTH clear buttons", () => {
  assert.match(
    churchesView,
    /const activeFilters = \[filterState, filterCity, filterDenomination, filterType, filterLanguage, filterServiceDay, searchQuery\]\.filter\(Boolean\)\.length;/
  );
  // setFilterType("") appears twice: filter-panel clear + filtered-empty clear
  const clears = churchesView.match(/setFilterType\(""\);/g) || [];
  assert.ok(clears.length >= 2, "both clear-filters buttons must reset the type filter");
});

test("ML-11: Type select in the filter panel offers the full fixed CHURCH_TYPES set", () => {
  const panel = churchesView.slice(churchesView.indexOf('t("churches.filter.allTypes")'));
  for (const tp of CHURCH_TYPES) {
    assert.ok(panel.includes(`value={tp}`), `type select missing option ${tp}`);
  }
});

// ─── 4. i18n parity (en + te) ───────────────────────────────────────────────

test("ML-12: every new My Listings / type-filter string exists in BOTH en and te", () => {
  const keys = [
    "churches.tab.myListings",
    "churches.filter.allTypes",
    "churches.mine.signInPrompt",
    "churches.mine.signInHint",
    "churches.mine.empty",
    "churches.mine.emptyHint",
    "churches.mine.count",
    "churches.mine.loadFailed",
    "churches.mine.statusPending",
    "churches.mine.statusLive",
    "churches.mine.statusRejected",
    "churches.mine.statusCancelled",
  ];
  for (const k of keys) {
    assert.ok(en.includes(`"${k}"`), `en missing ${k}`);
    assert.ok(te.includes(`"${k}"`), `te missing ${k}`);
  }
  // Both interpolate {count} the same way
  assert.match(en, /"churches\.mine\.count": "You own \{count\} listing\(s\)"/);
  assert.match(te, /"churches\.mine\.count": "[^"]*\{count\}[^"]*"/);
});

// ─── 5. Wiring ──────────────────────────────────────────────────────────────

test("ML-13: test suite is wired into npm test", () => {
  assert.match(pkg, /tests\/church-mine-filters\.test\.ts/);
});
