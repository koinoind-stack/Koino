/**
 * Church cover-image upload + public contact details tests (2026-11-04).
 *
 * Admin reported on the live directory:
 *   1. "image is not showing" — the ImagePicker embedded photos as base64
 *      data URLs, but every church API truncates image strings to 1000
 *      chars for safety → data URLs (100KB+) were silently corrupted
 *      (verified in production: cover_image was EXACTLY 1000 chars with
 *      no base64 padding). Fix: real upload endpoint + uploadUrl mode in
 *      the picker + gradient fallback for broken images.
 *   2. "i need contact details for church it has only whatsapp" — the
 *      public API never returned contactPhone/contactEmail and the detail
 *      modal only offered WhatsApp. Fix: public payload + Call/Email
 *      buttons + phone/email fields in the owner form.
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

const uploadApi = src("app", "api", "churches", "upload-image", "route.ts");
const publicChurches = src("app", "api", "churches", "route.ts");
const mineApi = src("app", "api", "churches", "mine", "route.ts");
const imagePicker = src("components", "crosscrafted", "ImagePicker.tsx");
const churchesView = src("components", "crosscrafted", "ChurchesView.tsx");
const listYourEntity = src("components", "crosscrafted", "ListYourEntity.tsx");
const dataLib = src("lib", "crosscrafted-data.ts");
const en = src("lib", "i18n", "en.ts");
const te = src("lib", "i18n", "te.ts");
const pkg = read("package.json");

// ─── 1. Upload endpoint ─────────────────────────────────────────────────────

test("CMC-1: POST /api/churches/upload-image — authenticated, rate-limited, validated", () => {
  assert.match(uploadApi, /export async function POST\(req: NextRequest\)/);
  assert.match(uploadApi, /getAuthUser/);
  assert.match(uploadApi, /Not authenticated/);
  assert.match(uploadApi, /\{ status: 401 \}/);
  assert.match(uploadApi, /rateLimit\(`churches:upload:\$\{user\.id\}`/);
  assert.match(uploadApi, /ALLOWED_TYPES = \["image\/png", "image\/jpeg", "image\/jpg", "image\/webp"\]/);
  assert.match(uploadApi, /MAX_FILE_SIZE = 5 \* 1024 \* 1024/);
});

test("CMC-2: upload processes with sharp → WebP and stores under churches/<uid>/ in Supabase Storage", () => {
  assert.match(uploadApi, /sharp\(buffer\)/);
  assert.match(uploadApi, /\.resize\(1200, null, \{ withoutEnlargement: true \}\)/);
  assert.match(uploadApi, /\.webp\(\{ quality: 85 \}\)/);
  assert.match(uploadApi, /churches\/\$\{user\.id\}\/\$\{timestamp\}\.webp/);
  assert.match(uploadApi, /believ-comic-artwork/);
  assert.match(uploadApi, /getPublicUrl\(storagePath\)/);
  // Versioned URL so re-uploads bust caches
  assert.match(uploadApi, /\?v=\$\{timestamp\}/);
});

// ─── 2. ImagePicker upload mode ─────────────────────────────────────────────

test("CMC-3: ImagePicker accepts uploadUrl and uploads files as multipart", () => {
  assert.match(imagePicker, /uploadUrl\?: string;/);
  assert.match(imagePicker, /body\.append\("file", file\)/);
  assert.match(imagePicker, /fetch\(uploadUrl, \{ method: "POST", body \}\)/);
  // Failed uploads must surface a toast — never a silently corrupted image
  assert.match(imagePicker, /imagePicker\.error\.uploadFailed/);
  // In-flight uploads show a spinner state
  assert.match(imagePicker, /imagePicker\.uploading/);
});

test("CMC-4: church forms pass uploadUrl — business form does NOT", () => {
  // Owner edit/create modal in ChurchesView
  assert.match(
    churchesView,
    /uploadUrl="\/api\/churches\/upload-image"/
  );
  // Church variant in ListYourEntity (the picker labelled with churches photos)
  const churchLabelAt = listYourEntity.indexOf('label={t("churches.form.photos")}');
  const churchPicker = listYourEntity.slice(churchLabelAt - 300, churchLabelAt + 300);
  assert.match(churchPicker, /uploadUrl="\/api\/churches\/upload-image"/);
  // Business picker stays on data URLs (its own API contract, unchanged)
  const businessLabelAt = listYourEntity.indexOf('label={t("list.form.businessPhotos")}');
  const businessPicker = listYourEntity.slice(businessLabelAt - 300, businessLabelAt + 300);
  assert.ok(!businessPicker.includes("uploadUrl"), "business picker must not use the church upload endpoint");
});

// ─── 3. Broken-image fallback (legacy corrupted data URLs) ─────────────────

test("CMC-5: detail hero + directory card + mine card fall back to the gradient on image error", () => {
  // Hero restructured: gradient underlay + self-hiding img
  assert.match(churchesView, /Gradient always renders underneath/);
  // Card cover has an underlay too
  assert.match(churchesView, /Gradient underlay — broken\/missing covers fall back to it/);
  // onError handlers: hero + card + mine thumbnail (3 self-hiding imgs)
  const onErrors = churchesView.match(/onError=\{\(e\) => \{\s*e\.currentTarget\.style\.display = "none";\s*\}\}/g) || [];
  assert.ok(onErrors.length >= 3, `expected >=3 onError fallbacks, found ${onErrors.length}`);
});

// ─── 4. Public contact details ──────────────────────────────────────────────

test("CMC-6: public GET /api/churches returns contactPhone + contactEmail", () => {
  assert.match(publicChurches, /contactPhone: c\.contactPhone/);
  assert.match(publicChurches, /contactEmail: c\.contactEmail/);
});

test("CMC-7: mine endpoint returns contact details so owners can edit them", () => {
  assert.match(mineApi, /contactPhone: true/);
  assert.match(mineApi, /contactEmail: true/);
  assert.match(mineApi, /contactPhone: c\.contactPhone/);
  assert.match(mineApi, /contactEmail: c\.contactEmail/);
});

test("CMC-8: detail modal renders Call (tel:) and Email (mailto:) buttons", () => {
  assert.match(churchesView, /href=\{`tel:\$\{openChurch\.contactPhone\.replace\(\/\[\^\+0-9\]\/g, ""\)\}`\}/);
  assert.match(churchesView, /href=\{`mailto:\$\{openChurch\.contactEmail\}`\}/);
  assert.match(churchesView, /t\("churches\.contactCall"\)/);
  assert.match(churchesView, /t\("churches\.contactEmailBtn"\)/);
});

// ─── 5. Owner form: contact number + email fields ──────────────────────────

test("CMC-9: owner form has contact phone/email inputs wired to the payload (POST + PATCH keys)", () => {
  // Form fields bound to formData
  assert.match(churchesView, /value=\{formData\.contact_phone\}/);
  assert.match(churchesView, /value=\{formData\.contact_email\}/);
  assert.match(churchesView, /t\("churches\.form\.contactPhone"\)/);
  assert.match(churchesView, /t\("churches\.form\.contactEmail"\)/);
  // Payload carries BOTH spellings (POST: contact_phone, PATCH: contactPhone)
  assert.match(churchesView, /contact_phone: formData\.contact_phone \|\| null/);
  assert.match(churchesView, /contactPhone: formData\.contact_phone \|\| null/);
  assert.match(churchesView, /contact_email: formData\.contact_email \|\| null/);
  assert.match(churchesView, /contactEmail: formData\.contact_email \|\| null/);
  // openEdit populates from the church object (public + mine payloads)
  assert.match(churchesView, /contact_phone: c\.contactPhone \|\| ""/);
  assert.match(churchesView, /contact_email: c\.contactEmail \|\| ""/);
});

test("CMC-10: Church type documents contact fields as public (owner-published)", () => {
  assert.match(dataLib, /Listing contact details — public \(owner-published, like whatsapp_number\)/);
});

// ─── 6. i18n parity (en + te) ───────────────────────────────────────────────

test("CMC-11: every new contact/upload string exists in BOTH en and te", () => {
  const keys = [
    "churches.contactCall",
    "churches.contactEmailBtn",
    "churches.form.contactPhone",
    "churches.form.contactEmail",
    "imagePicker.uploading",
    "imagePicker.error.uploadFailed",
  ];
  for (const k of keys) {
    assert.ok(en.includes(`"${k}"`), `en missing ${k}`);
    assert.ok(te.includes(`"${k}"`), `te missing ${k}`);
  }
});

// ─── 7. Wiring ──────────────────────────────────────────────────────────────

test("CMC-12: test suite is wired into npm test", () => {
  assert.match(pkg, /tests\/church-media-contact\.test\.ts/);
});
