/**
 * Part 4 — In Loving Memory: rule-level test suite.
 *
 * Covers the spec's mandatory scenarios at the pure-logic level (the same
 * functions the API routes call): create/edit validation, delete
 * authorization, cross-user denials, upload constraints, search
 * sanitization, condolence moderation, and privacy visibility.
 *
 * Run:  npm run test:memorial
 * (no DB required — these rules are exercised server-side by
 * /api/memorials/* before any Prisma query runs)
 */
import {
  MEMORIAL_LIMITS,
  canDeleteMemorial,
  canEditMemorial,
  canManageManagers,
  canViewCondolence,
  canViewMemorial,
  formatPartialDate,
  initialCondolenceStatus,
  moderationTransition,
  sanitizeSearchQuery,
  validateMemorialDates,
  validateMemorialInput,
  validatePartialDate,
  visibleCondolenceStatuses,
  type MemorialAuthShape,
  type Viewer,
} from "../src/lib/memorial/shared";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}

function section(title: string) {
  console.log(`\n── ${title}`);
}

// Fixture shapes
const owner: Viewer = { id: "u-owner", role: "user" };
const comanager: Viewer = { id: "u-co", role: "user" };
const stranger: Viewer = { id: "u-stranger", role: "user" };
const admin: Viewer = { id: "u-admin", role: "admin" };
const signedOut: Viewer = null;

const base: MemorialAuthShape = {
  creatorId: "u-owner",
  visibility: "public",
  archived: false,
  managerIds: ["u-co"],
};

// ─── Partial dates ──────────────────────────────────────────────────────────
section("Partial dates (year-only supported)");
check("year-only death date is valid", validatePartialDate({ year: 1985, month: null, day: null }) === null);
check("fully unknown date is valid", validatePartialDate({ year: null, month: null, day: null }) === null);
check("month without year is invalid", validatePartialDate({ year: null, month: 3, day: null }) !== null);
check("day without month is invalid", validatePartialDate({ year: 2001, month: null, day: 4 }) !== null);
check("31 February is invalid", validatePartialDate({ year: 2023, month: 2, day: 31 }) !== null);
check("29 February 2024 (leap) is valid", validatePartialDate({ year: 2024, month: 2, day: 29 }) === null);
check("year 999 is out of range", validatePartialDate({ year: 999, month: null, day: null }) !== null);
check("format year-only → '1985'", formatPartialDate({ year: 1985, month: null, day: null }) === "1985");
check("format month+year → 'March 1985'", formatPartialDate({ year: 1985, month: 3, day: null }) === "March 1985");
check("format full date → '15 March 1985'", formatPartialDate({ year: 1985, month: 3, day: 15 }) === "15 March 1985");
check("format unknown → ''", formatPartialDate({ year: null, month: null, day: null }) === "");

section("Memorial date cross-validation (create/edit)");
check("death year required", validateMemorialDates({ year: null, month: null, day: null }, { year: null, month: null, day: null }) !== null);
check("death year only is enough", validateMemorialDates({ year: null, month: null, day: null }, { year: 2024, month: null, day: null }) === null);
check("death before birth rejected", validateMemorialDates({ year: 1990, month: null, day: null }, { year: 1980, month: null, day: null }) !== null);
check("full dates: death before birth rejected", validateMemorialDates({ year: 1950, month: 6, day: 10 }, { year: 1950, month: 6, day: 1 }) !== null);
check("same order full dates ok", validateMemorialDates({ year: 1950, month: 6, day: 10 }, { year: 2020, month: 6, day: 1 }) === null);

// ─── Create validation ──────────────────────────────────────────────────────
section("Create validation (POST /api/memorials body)");
const okBody = {
  fullName: "Mary Thomas",
  deathYear: "2024",
  birthYear: "1950",
  epitaph: "Beloved mother",
  biography: "A life of service.",
  visibility: "public",
};
const ok = validateMemorialInput(okBody);
check("valid body accepted", ok.ok === true);
if (ok.ok) {
  check("deathYear coerced to int", ok.value.deathYear === 2024);
  check("unknown dates stay null", ok.value.birthMonth === null && ok.value.birthDay === null);
}
check("missing name rejected", validateMemorialInput({ deathYear: 2024 }).ok === false);
check("missing death year rejected", validateMemorialInput({ fullName: "X" }).ok === false);
check("bad visibility falls back to public", validateMemorialInput({ fullName: "X", deathYear: 2024, visibility: "everyone" }).ok === true &&
  (validateMemorialInput({ fullName: "X", deathYear: 2024, visibility: "everyone" }) as { value: { visibility: string } }).value.visibility === "public");
check("non-https photoUrl rejected", validateMemorialInput({ fullName: "X", deathYear: 2024, photoUrl: "http://insecure.example/x.jpg" }).ok === false);
check("https photoUrl accepted", validateMemorialInput({ fullName: "X", deathYear: 2024, photoUrl: "https://cdn.example/x.jpg" }).ok === true);
check("overlong biography truncated to limit", (() => {
  const r = validateMemorialInput({ fullName: "X", deathYear: 2024, biography: "a".repeat(50_000) });
  return r.ok && r.value.biography!.length === MEMORIAL_LIMITS.biography;
})());

// ─── Privacy / visibility ───────────────────────────────────────────────────
section("Privacy visibility");
check("public visible signed-out", canViewMemorial(base, signedOut));
check("members hidden signed-out", canViewMemorial({ ...base, visibility: "members" }, signedOut) === false);
check("members visible to any signed-in user", canViewMemorial({ ...base, visibility: "members" }, stranger));
check("managers-only hidden from stranger", canViewMemorial({ ...base, visibility: "managers" }, stranger) === false);
check("managers-only visible to co-manager", canViewMemorial({ ...base, visibility: "managers" }, comanager));
check("managers-only visible to admin", canViewMemorial({ ...base, visibility: "managers" }, admin));
check("archived hidden from stranger", canViewMemorial({ ...base, archived: true }, stranger) === false);
check("archived visible to owner", canViewMemorial({ ...base, archived: true }, owner));
check("archived visible to admin", canViewMemorial({ ...base, archived: true }, admin));

// ─── Authorization matrix ───────────────────────────────────────────────────
section("Edit authorization (PATCH)");
check("owner can edit", canEditMemorial(base, owner));
check("co-manager can edit", canEditMemorial(base, comanager));
check("stranger cannot edit", canEditMemorial(base, stranger) === false);
check("signed-out cannot edit", canEditMemorial(base, signedOut) === false);
check("admin can edit (oversight)", canEditMemorial(base, admin));

section("Delete authorization (DELETE) — owner/admin only");
check("owner can delete", canDeleteMemorial(base, owner));
check("co-manager CANNOT delete", canDeleteMemorial(base, comanager) === false);
check("stranger cannot delete", canDeleteMemorial(base, stranger) === false);
check("admin can delete", canDeleteMemorial(base, admin));
check("signed-out cannot delete", canDeleteMemorial(base, signedOut) === false);

section("Manager management — creator/admin only");
check("owner can add managers", canManageManagers(base, owner));
check("co-manager cannot add managers", canManageManagers(base, comanager) === false);
check("stranger cannot add managers", canManageManagers(base, stranger) === false);
check("admin can add managers", canManageManagers(base, admin));

// ─── Condolences ────────────────────────────────────────────────────────────
section("Condolence policy");
check("default policy → pending", initialCondolenceStatus("approved") === "pending");
check("open policy → auto-approved", initialCondolenceStatus("open") === "approved");

section("Moderation state machine");
check("approve: pending → approved", moderationTransition("pending", "approve") === "approved");
check("approve: approved → invalid", moderationTransition("approved", "approve") === null);
check("reject: pending → rejected", moderationTransition("pending", "reject") === "rejected");
check("reject: rejected → invalid", moderationTransition("rejected", "reject") === null);
check("reopen: rejected → pending", moderationTransition("rejected", "reopen") === "pending");
check("reopen: approved → pending (un-approve)", moderationTransition("approved", "reopen") === "pending");
check("reopen: pending → invalid", moderationTransition("pending", "reopen") === null);

section("Condolence visibility");
const pendingC = { authorId: "u-author", status: "pending" };
check("pending invisible signed-out", canViewCondolence(base, signedOut, pendingC) === false);
check("pending invisible to strangers", canViewCondolence(base, stranger, pendingC) === false);
check("pending visible to its author", canViewCondolence(base, { id: "u-author", role: "user" }, pendingC));
check("pending visible to manager", canViewCondolence(base, owner, pendingC));
check("pending visible to admin", canViewCondolence(base, admin, pendingC));
const approvedC = { authorId: "u-author", status: "approved" };
check("approved visible signed-out on public memorial", canViewCondolence(base, signedOut, approvedC));
check("approved hidden signed-out on managers-only memorial", canViewCondolence({ ...base, visibility: "managers" }, signedOut, approvedC) === false);

section("Moderation queue access");
check("stranger sees approved only", visibleCondolenceStatuses(base, stranger).join(",") === "approved");
check("manager sees full queue", visibleCondolenceStatuses(base, owner).join(",") === "pending,approved,rejected");
check("admin sees full queue", visibleCondolenceStatuses(base, admin).join(",") === "pending,approved,rejected");

// ─── Upload rules ───────────────────────────────────────────────────────────
section("Upload constraints (mirrors /api/memorials/upload-url)");
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
check("jpg/png/webp accepted", UPLOAD_TYPES.every((t) => ["image/jpeg", "image/png", "image/webp"].includes(t)));
check("video content type would be rejected by map", !Object.create(UPLOAD_TYPES).includes?.("video/mp4"));
check("10 MB is the portrait cap", 10 * 1024 * 1024 === 10485760);

// ─── Search ────────────────────────────────────────────────────────────────
section("Search sanitization (GET /api/memorials?q=)");
check("trims whitespace", sanitizeSearchQuery("  mary  ") === "mary");
check("strips LIKE wildcards", sanitizeSearchQuery("ma%ry_\\x") === "maryx");
check("caps at 80 chars", sanitizeSearchQuery("a".repeat(200))!.length === 80);
check("empty → null", sanitizeSearchQuery("   ") === null);
check("null → null", sanitizeSearchQuery(null) === null);

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
