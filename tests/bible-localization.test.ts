// Regression tests for the YouVersion-corrections round (YVP-14..YVP-16).
//   YVP-14 scripture-language catalogue covers Urdu (ur) and Assamese (as)
//   YVP-15 localized Bible book names: complete 66-book coverage per
//          language, coherent source, English fallback everywhere else
//   YVP-16 Home reading-plan previews follow the user's saved Bible version
//          (no hardcoded KJV), with safe sanitization of stored refs
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BIBLE_BOOKS, BIBLE_LANGUAGES } from "../src/lib/bible-data";
import {
  SCRIPTURE_LANGUAGES,
  DEFAULT_VERSION_REF,
  sanitizeSavedVersionRef,
} from "../src/lib/bible-versions";
import {
  LOCALIZED_BOOK_NAMES,
  localizedBookName,
} from "../src/lib/bible-book-names";
import {
  getYouVersionCatalog,
  __resetYouVersionCatalogForTests,
} from "../src/lib/youversion/catalog";

/* ─── fetch stubbing (same pattern as youversion-provider.test.ts) ───────── */

function stubFetch(handler: (url: string) => { status: number; body?: unknown }) {
  const fn = (async (url: string | URL) => {
    const r = handler(String(url));
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status,
      headers: new Headers(),
    });
  }) as unknown as typeof fetch;
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  return {
    restore() {
      globalThis.fetch = original;
    },
  };
}

function enableYouVersion() {
  process.env.YOUVERSION_ENABLED = "true";
  process.env.YOUVERSION_APP_KEY = "yvp_test_key_1234567890";
  process.env.YOUVERSION_API_BASE_URL = "https://api.youversion.com";
}

function disableYouVersion() {
  delete process.env.YOUVERSION_ENABLED;
  delete process.env.YOUVERSION_APP_KEY;
  delete process.env.YOUVERSION_API_BASE_URL;
}

/* ─── YVP-14: Urdu + Assamese in the scripture-language catalogue ────────── */

test("YVP-14a: scripture catalogue includes Urdu and Assamese once, aligned with BIBLE_LANGUAGES", () => {
  assert.equal(SCRIPTURE_LANGUAGES.length, BIBLE_LANGUAGES.length);
  assert.equal(SCRIPTURE_LANGUAGES.length, 13, "English + 12 Indian languages");

  const tags = SCRIPTURE_LANGUAGES.map((l) => l.tag);
  assert.equal(tags.filter((t) => t === "ur").length, 1, "urdu listed exactly once");
  assert.equal(tags.filter((t) => t === "as").length, 1, "assamese listed exactly once");

  const ur = SCRIPTURE_LANGUAGES.find((l) => l.tag === "ur")!;
  const as = SCRIPTURE_LANGUAGES.find((l) => l.tag === "as")!;
  assert.equal(ur.label, "Urdu");
  assert.equal(ur.nativeLabel, "اردو", "urdu native label is RTL Perso-Arabic");
  assert.equal(as.label, "Assamese");
  assert.equal(as.nativeLabel, "অসমীয়া", "assamese native label in Assamese script");
});

test("YVP-14b: catalogue build queries ur and as and merges their versions", async () => {
  enableYouVersion();
  __resetYouVersionCatalogForTests();
  const requested = new Set<string>();
  const stub = stubFetch((url) => {
    if (!url.includes("/v1/bibles?")) return { status: 200, body: { data: [] } };
    const m = url.match(/language_ranges%5B%5D=([a-z]+)/);
    if (m) requested.add(m[1]);
    if (m && m[1] === "ur") {
      return {
        status: 200,
        body: {
          data: [
            {
              id: 3025,
              abbreviation: "URB",
              title: "Urdu Bible",
              language_tag: "ur",
              copyright: "© Urdu Bible publisher.",
            },
          ],
        },
      };
    }
    if (m && m[1] === "as") {
      return {
        status: 200,
        body: {
          data: [
            {
              id: 3026,
              abbreviation: "ASB",
              title: "Assamese Bible",
              language_tag: "as",
              copyright: "© Assamese Bible publisher.",
            },
          ],
        },
      };
    }
    return { status: 200, body: { data: [] } };
  });
  try {
    const versions = await getYouVersionCatalog();
    // every scripture language — including ur and as — must be queried
    for (const lang of SCRIPTURE_LANGUAGES) {
      assert.ok(
        requested.has(lang.tag),
        `catalogue must query scripture language ${lang.tag}`
      );
    }
    const urV = versions.find((v) => v.languageTag === "ur");
    const asV = versions.find((v) => v.languageTag === "as");
    assert.ok(urV, "urdu version present in merged catalogue");
    assert.equal(urV!.id, "3025");
    assert.equal(urV!.nativeLanguageLabel, "اردو");
    assert.equal(asV!.id, "3026");
    assert.equal(asV!.nativeLanguageLabel, "অসমীয়া");
    assert.ok(urV!.attribution && urV!.attribution.length > 0, "attribution preserved");
  } finally {
    stub.restore();
    disableYouVersion();
    __resetYouVersionCatalogForTests();
  }
});

/* ─── YVP-15: localized Bible book names ─────────────────────────────────── */

const EXPECTED_BOOK_LANGS = ["hi", "ta", "te", "ml", "kn", "mr", "gu", "pa", "bn", "or", "as"];

test("YVP-15a: every localized language covers exactly the 66 Koino books with non-empty names", () => {
  const bookIds = BIBLE_BOOKS.map((b) => b.id).sort();
  assert.equal(bookIds.length, 66);

  const langs = Object.keys(LOCALIZED_BOOK_NAMES).sort();
  assert.deepEqual(langs, [...EXPECTED_BOOK_LANGS].sort());

  for (const [lang, names] of Object.entries(LOCALIZED_BOOK_NAMES)) {
    const keys = Object.keys(names).sort();
    assert.deepEqual(
      keys,
      bookIds,
      `${lang} book-name map must cover exactly the 66 Koino book slugs`
    );
    for (const [slug, name] of Object.entries(names)) {
      assert.ok(
        typeof name === "string" && name.trim().length > 0,
        `${lang}/${slug} must have a non-empty name`
      );
    }
  }
});

test("YVP-15b: spot checks — authentic IRV book-name labels per language", () => {
  assert.equal(LOCALIZED_BOOK_NAMES.te.genesis, "ఆదికాండం");
  assert.equal(LOCALIZED_BOOK_NAMES.te.psalms, "కీర్తనలు");
  assert.equal(LOCALIZED_BOOK_NAMES.te.matthew, "మత్తయి రాసిన సువార్త");
  assert.equal(LOCALIZED_BOOK_NAMES.hi.genesis, "उत्पत्ति");
  assert.equal(LOCALIZED_BOOK_NAMES.hi.psalms, "भजन संहिता");
  assert.equal(LOCALIZED_BOOK_NAMES.as.genesis, "আদিপুস্তক");
  assert.equal(LOCALIZED_BOOK_NAMES.ta.genesis, "ஆதியாகமம்");
  assert.equal(LOCALIZED_BOOK_NAMES.bn.revelation, "প্রকাশিত বাক্য");
});

test("YVP-15c: ur is intentionally absent (no Devanagari-script leak) — English fallback applies", () => {
  assert.ok(!("ur" in LOCALIZED_BOOK_NAMES), "ur must not ship a mismatched-script set");
  const gen = BIBLE_BOOKS.find((b) => b.id === "genesis")!;
  assert.equal(localizedBookName(gen, "ur"), gen.name, "urdu UI falls back to English name");
  assert.equal(localizedBookName(gen, "en"), gen.name);
  assert.equal(localizedBookName(gen, "xx-unknown"), gen.name);
});

test("YVP-15d: localizedBookName resolves by slug and tolerates gaps", () => {
  const john = BIBLE_BOOKS.find((b) => b.id === "john")!;
  assert.equal(localizedBookName(john, "te"), "యోహాను రాసిన సువార్త");
  // a book missing from a language map (defensive) → English fallback
  const partial = { ...LOCALIZED_BOOK_NAMES.te };
  delete (partial as Record<string, string>).john;
  const original = LOCALIZED_BOOK_NAMES.te;
  try {
    (LOCALIZED_BOOK_NAMES as Record<string, Record<string, string>>).te = partial;
    assert.equal(localizedBookName(john, "te"), john.name);
  } finally {
    (LOCALIZED_BOOK_NAMES as Record<string, Record<string, string>>).te = original;
  }
});

/* ─── YVP-16: Home plan previews follow the user's saved version ─────────── */

test("YVP-16a: sanitizeSavedVersionRef keeps valid refs and defaults on anything else", () => {
  assert.equal(sanitizeSavedVersionRef("koino:kjv"), "koino:kjv");
  assert.equal(sanitizeSavedVersionRef("koino:web"), "koino:web");
  assert.equal(sanitizeSavedVersionRef("youversion:3034"), "youversion:3034");
  // tampered/injected storage values → default (never passed through)
  assert.equal(sanitizeSavedVersionRef(null), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef(undefined), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef(""), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef("kjv"), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef("bogus:1"), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef("youversion:"), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef("koino:"), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef("javascript:alert(1)"), DEFAULT_VERSION_REF);
  assert.equal(sanitizeSavedVersionRef("__proto__:/x"), DEFAULT_VERSION_REF);
});

test("YVP-16b: HomeApp passes the saved version to BiblePlansView — no hardcoded KJV", () => {
  const src = readFileSync(
    join(process.cwd(), "src", "components", "home", "HomeApp.tsx"),
    "utf8"
  );
  assert.ok(
    !src.includes('versionRef="koino:kjv"'),
    "Home must not hardcode the KJV version for plan previews"
  );
  assert.ok(
    src.includes("versionRef={bibleVersionRef}"),
    "plan previews must receive the sanitized saved version"
  );
  assert.ok(
    src.includes("sanitizeSavedVersionRef(localStorage.getItem(VERSION_STORAGE_KEY))"),
    "Home must read the same storage key the reader writes"
  );
  assert.ok(
    src.includes("}, [view]);"),
    "Home must re-read the selection when the view changes (same-tab updates)"
  );
});
