/**
 * Church listing management tests (2026-11-04 admin request).
 *
 * Admin asked for, on the church directory ("listings"):
 *   1. Cover image option in the admin edit modal
 *   2. Contact number option in the admin edit modal
 *   3. Service languages (English / Hindi / Telugu / …) editable
 *   4. A "type" option (Church / Ministry / Fellowship / Prayer Hall / Other)
 *   5. Owners can edit/update their own listing after submission
 *   6. Admin can CREATE a church from the admin panel
 *   7. Admin can TRANSFER a listing to its rightful owner (registered user
 *      looked up by email)
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

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20261104090000_add_church_type/migration.sql");
const publicChurches = src("app", "api", "churches", "route.ts");
const publicChurchId = src("app", "api", "churches", "[id]", "route.ts");
const adminChurches = src("app", "api", "admin", "churches", "route.ts");
const adminChurchId = src("app", "api", "admin", "churches", "[id]", "route.ts");
const adminCreate = src("app", "api", "admin", "churches", "create", "route.ts");
const adminView = src("components", "crosscrafted", "AdminView.tsx");
const churchesView = src("components", "crosscrafted", "ChurchesView.tsx");
const listYourEntity = src("components", "crosscrafted", "ListYourEntity.tsx");
const dataLib = src("lib", "crosscrafted-data.ts");
const en = src("lib", "i18n", "en.ts");
const te = src("lib", "i18n", "te.ts");

const CHURCH_TYPES = ["Church", "Ministry", "Fellowship", "Prayer Hall", "Other"];

// ─── 1. Schema + migration ───────────────────────────────────────────────────

test("CL-1: Church.type column exists in the Prisma schema with a safe default", () => {
  const churchModel = schema.slice(schema.indexOf("model Church {"), schema.indexOf("model ChurchFollow"));
  assert.match(churchModel, /type\s+String\s+@default\("Church"\)/);
});

test("CL-2: migration adds the column idempotently (safe for manual SQL Editor runs)", () => {
  assert.match(migration, /ALTER TABLE "Church" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Church';/);
});

// ─── 2. Type option — shared constant + all APIs accept it ──────────────────

test("CL-3: crosscrafted-data exports the fixed CHURCH_TYPES set", () => {
  assert.match(dataLib, /export const CHURCH_TYPES = \[[^\]]*"Church"[^\]]*"Ministry"[^\]]*"Fellowship"[^\]]*"Prayer Hall"[^\]]*"Other"\]/);
  for (const tp of CHURCH_TYPES) {
    assert.ok(dataLib.includes(`"${tp}"`), `missing type ${tp}`);
  }
});

test("CL-4: public POST /api/churches accepts type; public GET returns type + is_owner", () => {
  // POST — whitelist + stored on create
  assert.match(publicChurches, /const CHURCH_TYPES = \["Church", "Ministry", "Fellowship", "Prayer Hall", "Other"\];/);
  assert.match(publicChurches, /CHURCH_TYPES\.includes\(rawType\) \? rawType : "Church"/);
  assert.match(publicChurches, /type,/);
  // GET — optional viewer + ownership flag (never leaks the owner email)
  assert.match(publicChurches, /const viewer = await getAuthUser\(\)\.catch\(\(\) => null\);/);
  assert.match(publicChurches, /type: c\.type \|\| "Church",/);
  assert.match(publicChurches, /is_owner: !!\(viewer && c\.createdById && viewer\.id === c\.createdById\),/);
});

// ─── 3. Owner self-edit endpoint ─────────────────────────────────────────────

test("CL-5: PATCH /api/churches/[id] is owner-or-admin guarded and never changes status", () => {
  assert.match(publicChurchId, /export async function PATCH/);
  assert.match(publicChurchId, /if \(!user\)[\s\S]{0,120}status: 401/);
  assert.match(publicChurchId, /const isAdmin = user\.role === "admin";/);
  assert.match(publicChurchId, /const isOwner = !!church\.createdById && church\.createdById === user\.id;/);
  assert.match(publicChurchId, /if \(!isAdmin && !isOwner\)[\s\S]{0,160}status: 403/);
  // Rate limited like every public write
  assert.match(publicChurchId, /rateLimit\(`churches:edit:\$\{user\.id\}`, 10, 10 \* 60_000\)/);
  // Ownership/status are NOT writable here — transfer + moderation stay admin-only
  assert.doesNotMatch(publicChurchId, /createdById:/);
  assert.doesNotMatch(publicChurchId, /data\.status/);
  assert.doesNotMatch(publicChurchId, /status: "(PUBLISHED|PENDING|REJECTED|CANCELLED)"/);
  assert.match(publicChurchId, /revalidatePath\("\/", "layout"\)/);
  // Accepts the fields owners need (incl. type + images → cover)
  for (const field of ["name", "description", "denomination", "state", "city", "contactPhone", "whatsappNumber", "service_times", "languages", "images"]) {
    assert.ok(publicChurchId.includes(field), `PATCH must accept ${field}`);
  }
  assert.match(publicChurchId, /CHURCH_TYPES\.includes\(rawType\)/);
});

// ─── 4. Admin: transfer + create + type ─────────────────────────────────────

test("CL-6: admin POST transfer action moves the listing to a registered user by email", () => {
  assert.match(adminChurches, /"verify", "unverify", "transfer"\]/);
  assert.match(adminChurches, /transferEmail is required for the transfer action/);
  assert.match(adminChurches, /db\.user\.findFirst\(\{[\s\S]{0,200}email: \{ equals: transferEmail, mode: "insensitive" \}/);
  assert.match(adminChurches, /No registered user found with email/);
  // Same-user transfer is a no-op
  assert.match(adminChurches, /already belongs to/);
  // Ownership is written from the looked-up user, never from raw body values
  assert.match(adminChurches, /\.\.\.\(transferToId \? \{ createdById: transferToId, createdByEmail: transferToEmail \} : \{\}\),/);
  assert.match(adminChurches, /transferred to \$\{transferToEmail\}/);
});

test("CL-7: admin create route — admin-only, full field set, admin-chosen status, optional owner", () => {
  assert.match(adminCreate, /export async function POST/);
  assert.match(adminCreate, /Forbidden — admin only/);
  assert.match(adminCreate, /Church name is required\./);
  assert.match(adminCreate, /Description is required\./);
  assert.match(adminCreate, /City and State are required\./);
  // Status: admin decides — PUBLISHED default, PENDING opt-in
  assert.match(adminCreate, /body\.status === "PENDING" \? "PENDING" : "PUBLISHED"/);
  // Optional rightful owner at creation time (registered users only)
  assert.match(adminCreate, /ownerEmail/);
  assert.match(adminCreate, /db\.user\.findFirst\(\{[\s\S]{0,200}mode: "insensitive"/);
  assert.match(adminCreate, /Leave the field empty to keep the listing under your account/);
  // createdById comes from the lookup or the admin — never raw body
  assert.match(adminCreate, /createdById: ownerId,/);
  assert.doesNotMatch(adminCreate, /createdById: body/);
  // Same rich field set as the public POST
  for (const field of ["contactPhone", "whatsappNumber", "service_times", "languages", "images", "coverImage"]) {
    assert.ok(adminCreate.includes(field), `create route must support ${field}`);
  }
  assert.match(adminCreate, /revalidatePath\("\/", "layout"\)/);
});

test("CL-8: admin GET + PATCH expose and accept the listing type", () => {
  assert.match(adminChurches, /type: c\.type \|\| "Church",/);
  assert.match(adminChurchId, /const CHURCH_TYPES = \["Church", "Ministry", "Fellowship", "Prayer Hall", "Other"\];/);
  assert.match(adminChurchId, /CHURCH_TYPES\.includes\(rawType\)/);
  assert.match(adminChurchId, /Invalid type\. Allowed:/);
  // contactPhone + images(→cover) already supported on the correction path
  assert.match(adminChurchId, /data\.contactPhone = contactPhone;/);
  assert.match(adminChurchId, /data\.coverImage = imgs\[0\]/);
});

// ─── 5. Admin UI ─────────────────────────────────────────────────────────────

test("CL-9: admin edit form has cover image, contact number, type and language chips", () => {
  const editForm = adminView.slice(adminView.indexOf("function ChurchEditForm"), adminView.indexOf("function CreateChurchForm"));
  // State pre-filled from the API row
  assert.match(editForm, /coverImage: church\.cover_image \|\| ""/);
  assert.match(editForm, /contactPhone: church\.contactPhone \|\| ""/);
  assert.match(editForm, /type: \(church\.type as string\) \|\| "Church"/);
  assert.match(editForm, /languages: \(church\.languages \|\| \[\]\) as string\[\]/);
  // Fields rendered: cover preview, tel input, type select, language chips
  assert.match(editForm, /Cover image</);
  assert.match(editForm, /Contact number</);
  assert.match(editForm, /Type</);
  assert.match(editForm, /Service languages</);
  assert.match(editForm, /CHURCH_TYPES\.map/);
  assert.match(editForm, /LANGUAGES\.map/);
  // Patch sent to the API: type + contactPhone + languages + images(→cover)
  assert.match(editForm, /type: form\.type,/);
  assert.match(editForm, /contactPhone: form\.contactPhone,/);
  assert.match(editForm, /languages: form\.languages,/);
  assert.match(editForm, /images: form\.coverImage\.trim\(\) \? \[form\.coverImage\.trim\(\)\] : \[\],/);
});

test("CL-10: admin tab has an Add-listing button, create modal and transfer modal", () => {
  const tab = adminView.slice(adminView.indexOf("function ChurchesTab"), adminView.indexOf("function ChurchEditForm"));
  assert.match(tab, /<Plus size=\{13\} \/> Add listing/);
  assert.match(tab, /handleCreateSave/);
  assert.match(tab, /\/api\/admin\/churches\/create/);
  assert.match(tab, /confirmTransfer/);
  assert.match(tab, /action: "transfer", transferEmail/);
  assert.match(tab, /Transfer listing<\/h3>/);
  assert.match(tab, /<UserCheck size=\{12\} \/> Transfer/);
  // Create form component: status select + owner email
  const createForm = adminView.slice(adminView.indexOf("function CreateChurchForm"), adminView.indexOf("// ─── EVENTS"));
  assert.match(createForm, /PUBLISHED — live immediately/);
  assert.match(createForm, /PENDING — review later/);
  assert.match(createForm, /Owner email \(optional\)/);
  assert.match(createForm, /status: form\.status,/);
  assert.match(createForm, /ownerEmail: form\.ownerEmail\.trim\(\) \|\| null,/);
});

// ─── 6. Public UI: owner edit + type everywhere ─────────────────────────────

test("CL-11: ChurchesView — owners get an Edit listing button wired to the PATCH flow", () => {
  assert.match(churchesView, /const \[editingId, setEditingId\] = useState<string \| null>\(null\);/);
  assert.match(churchesView, /const openEdit = \(c: Church\) => \{/);
  assert.match(churchesView, /\{openChurch\.is_owner && \([\s\S]{0,400}openEdit\(openChurch\)/);
  // Edit path PATCHes /api/churches/[id]; create path still POSTs
  assert.match(churchesView, /await fetch\(`\/api\/churches\/\$\{editTargetId\}`, \{[\s\S]{0,120}method: "PATCH"/);
  assert.match(churchesView, /await fetch\("\/api\/churches", \{[\s\S]{0,120}method: "POST"/);
  // editingId captured BEFORE closeFormModal() resets it
  assert.match(churchesView, /const editTargetId = editingId;/);
  assert.match(churchesView, /const wasEditing = editTargetId !== null;/);
  // Optimistic merge must not clobber followers (Partial, no zeroed counts)
  assert.match(churchesView, /const edited: Partial<Church> = \{/);
  // Mode-aware chrome
  assert.match(churchesView, /editingId \? t\("churches\.editListing"\) : t\("churches\.listYourChurch"\)/);
  assert.match(churchesView, /editingId\s*\?\s*t\("churches\.updateListing"\)\s*:\s*t\("churches\.form\.submit"\)/);
  // Type select is part of the form (fallback modal) and sent in the payload
  assert.match(churchesView, /t\("churches\.type"\)/);
  assert.match(churchesView, /CHURCH_TYPES\.map\(\(tp\) =>/);
  assert.match(churchesView, /type: formData\.type,/);
  // Detail shows the type badge for non-Church listings
  assert.match(churchesView, /openChurch\.type && openChurch\.type !== "Church"/);
});

test("CL-12: ListYourEntity — user submissions carry the listing type too", () => {
  assert.match(listYourEntity, /CHURCH_TYPES/);
  assert.match(listYourEntity, /type: "Church",/);
  assert.match(listYourEntity, /type: formData\.type,/);
  assert.match(listYourEntity, /CHURCH_TYPES\.map\(\(tp\) =>/);
});

test("CL-13: Church type carries type / is_owner / contactPhone fields", () => {
  assert.match(dataLib, /type\?: ChurchType \| string;/);
  assert.match(dataLib, /is_owner\?: boolean;/);
  assert.match(dataLib, /contactPhone\?: string \| null;/);
});

// ─── 7. i18n parity (en + te) for every new user-facing string ──────────────

test("CL-14: new churches.* keys exist in BOTH en.ts and te.ts", () => {
  const keys = [
    "churches.type",
    "churches.editListing",
    "churches.updateListing",
    "churches.editSuccess",
    "churches.editSuccessDesc",
  ];
  for (const k of keys) {
    assert.match(en, new RegExp(`"${k}": "`), `en.ts missing ${k}`);
    assert.match(te, new RegExp(`"${k}": "`), `te.ts missing ${k}`);
  }
  // Telugu script sanity for the owner-facing strings
  const teText = te;
  assert.ok(/[\u0C15-\u0C39]/.test(teText.match(/"churches\.editListing": "([^"]+)"/)?.[1] || ""), "editListing must be Telugu");
  assert.ok(/[\u0C15-\u0C39]/.test(teText.match(/"churches\.editSuccess": "([^"]+)"/)?.[1] || ""), "editSuccess must be Telugu");
});
