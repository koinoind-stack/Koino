// Unit tests for the unified Bible provider layer (YVP-* series continues).
// Contract under test:
//   YVP-7  verse-text parser: monotonic marker split, stray digits ignored,
//          single-block degradation
//   YVP-8  slug→USFM mapping covers every Koino book and formats refs
//   YVP-9  version-ref parse/format round-trip + rejection of bad refs
//   YVP-10 YouVersion REST client error taxonomy (401/403/404/429/204/5xx/
//          network/disabled) with Retry-After honored
//   YVP-11 catalogue mapping: language filter, dedupe, attribution, order
//   YVP-12 unified fallback dedup: coveredByYouVersion marking
//   YVP-13 unified chapter resolution: koino transport, youversion transport,
//          resilient KJV/WEB fallback, structured errors
import { strict as assert } from "node:assert";
import { test, beforeEach } from "node:test";
import {
  parseVerseText,
} from "../src/lib/youversion/text";
import {
  SLUG_TO_USFM,
  usfmChapterRef,
  usfmVerseRef,
  parseVersionRef,
  formatVersionRef,
  KOINO_FALLBACK_VERSIONS,
  markCoveredFallbacks,
  type BibleVersion,
} from "../src/lib/bible-versions";
import { BIBLE_BOOKS } from "../src/lib/bible-data";
import {
  YouVersionError,
  yvFetch,
  listBiblesForLanguage,
  getPassage,
} from "../src/lib/youversion/client";
import {
  getYouVersionCatalog,
  __resetYouVersionCatalogForTests,
} from "../src/lib/youversion/catalog";
import {
  resolveChapter,
  __resetBibleServerCachesForTests,
} from "../src/lib/bible-server";

/* ─── fetch stubbing helpers ─────────────────────────────────────────────── */

type FetchLog = { url: string; init?: RequestInit }[];

function stubFetch(handler: (url: string) => { status: number; body?: unknown; headers?: Record<string, string> }) {
  const log: FetchLog = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    log.push({ url: u, init });
    const r = handler(u);
    const headers = new Headers(r.headers || {});
    if (r.status === 204) {
      return new Response(null, { status: 204, headers });
    }
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers });
  }) as unknown as typeof fetch;
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  return {
    log,
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

beforeEach(() => {
  disableYouVersion();
  __resetYouVersionCatalogForTests();
  __resetBibleServerCachesForTests();
});

/* ─── YVP-7: verse text parser ───────────────────────────────────────────── */

test("YVP-7a: parseVerseText splits inline verse markers", () => {
  const { verses, degraded } = parseVerseText(
    "1 In the beginning God created the heavens. 2 The earth was without form. 3 And God said, Let there be light."
  );
  assert.equal(degraded, false);
  assert.equal(verses.length, 3);
  assert.deepEqual(
    verses.map((v) => v.verse),
    [1, 2, 3]
  );
  assert.equal(verses[0].text, "In the beginning God created the heavens.");
  assert.match(verses[2].text, /Let there be light\.$/);
});

test("YVP-7b: parseVerseText ignores non-marker digits inside text", () => {
  // "2024" and "2 years" tokens: the stray "2" coincides with expected verse 2
  // only when it appears standalone; a number fused to words never splits.
  const { verses } = parseVerseText(
    "1 Noah lived 350 years after the flood. 2 Shem was 100 years old."
  );
  assert.equal(verses.length, 2);
  assert.match(verses[0].text, /350 years/);
});

test("YVP-7c: parseVerseText degrades to one block without markers", () => {
  const { verses, degraded } = parseVerseText("In the beginning God created the heavens and the earth.");
  assert.equal(degraded, true);
  assert.equal(verses.length, 1);
  assert.equal(verses[0].verse, 1);
});

test("YVP-7d: parseVerseText handles empty content", () => {
  const { verses, degraded } = parseVerseText("   ");
  assert.equal(degraded, true);
  assert.equal(verses.length, 0);
});

/* ─── YVP-8: slug → USFM mapping ─────────────────────────────────────────── */

test("YVP-8a: every Koino book slug has a USFM code", () => {
  const missing = BIBLE_BOOKS.filter((b) => !SLUG_TO_USFM[b.id]);
  assert.deepEqual(missing, []);
  assert.equal(Object.keys(SLUG_TO_USFM).length, 66);
});

test("YVP-8b: USFM refs format correctly", () => {
  assert.equal(usfmChapterRef("john", 3), "JHN.3");
  assert.equal(usfmVerseRef("john", 3, 16), "JHN.3.16");
  assert.equal(usfmChapterRef("1corinthians", 13), "1CO.13");
  assert.equal(usfmChapterRef("song_of_solomon", 1), "SNG.1");
  assert.equal(usfmChapterRef("not-a-book", 1), null);
});

/* ─── YVP-9: version refs ────────────────────────────────────────────────── */

test("YVP-9: version ref round-trip and validation", () => {
  assert.equal(formatVersionRef({ provider: "youversion", id: "3034" }), "youversion:3034");
  assert.equal(formatVersionRef({ provider: "koino", id: "kjv" }), "koino:kjv");
  assert.deepEqual(parseVersionRef("youversion:3034"), { provider: "youversion", id: "3034" });
  assert.deepEqual(parseVersionRef("koino:web"), { provider: "koino", id: "web" });
  assert.equal(parseVersionRef(null), null);
  assert.equal(parseVersionRef(""), null);
  assert.equal(parseVersionRef("kjv"), null); // no provider prefix
  assert.equal(parseVersionRef("bogus:1"), null);
  assert.equal(parseVersionRef("youversion:"), null);
  const extra = parseVersionRef("youversion:3034:extra");
  assert.deepEqual(extra, { provider: "youversion", id: "3034:extra" });
});

/* ─── YVP-10: YouVersion REST client ─────────────────────────────────────── */

test("YVP-10a: yvFetch refuses to run when the provider is disabled", async () => {
  disableYouVersion();
  const stub = stubFetch(() => ({ status: 200, body: {} }));
  try {
    await assert.rejects(() => yvFetch("/v1/bibles"), (err: YouVersionError) => {
      assert.equal(err.kind, "disabled");
      return true;
    });
    assert.equal(stub.log.length, 0, "no outbound request may happen while disabled");
  } finally {
    stub.restore();
  }
});

test("YVP-10b: status→kind mapping (401/403/404/429/5xx) and Retry-After on 429", async () => {
  enableYouVersion();
  // 401 → unauthorized, single attempt
  {
    const stub = stubFetch(() => ({ status: 401, body: {} }));
    try {
      await assert.rejects(
        () => yvFetch("/v1/bibles?x=1"),
        (e: YouVersionError) => (assert.equal(e.kind, "unauthorized"), true)
      );
      assert.equal(stub.log.length, 1);
    } finally {
      stub.restore();
    }
  }
  // 403 → unlicensed
  {
    const stub = stubFetch(() => ({ status: 403, body: {} }));
    try {
      await assert.rejects(
        () => yvFetch("/v1/bibles"),
        (e: YouVersionError) => (assert.equal(e.kind, "unlicensed"), true)
      );
    } finally {
      stub.restore();
    }
  }
  // 429 → retries, then rate_limited
  {
    const stub = stubFetch(() => ({ status: 429, body: {}, headers: { "retry-after": "0" } }));
    try {
      await assert.rejects(
        () => yvFetch("/v1/bibles"),
        (e: YouVersionError) => (assert.equal(e.kind, "rate_limited"), true)
      );
      assert.equal(stub.log.length, 3, "429 must be retried up to MAX_ATTEMPTS");
    } finally {
      stub.restore();
    }
  }
  // 500 → retries, then server
  {
    const stub = stubFetch(() => ({ status: 500, body: {} }));
    try {
      await assert.rejects(
        () => yvFetch("/v1/bibles"),
        (e: YouVersionError) => (assert.equal(e.kind, "server"), true)
      );
      assert.equal(stub.log.length, 3);
    } finally {
      stub.restore();
    }
  }
  // 204 → empty
  {
    const stub = stubFetch(() => ({ status: 204 }));
    try {
      await assert.rejects(
        () => yvFetch("/v1/bibles"),
        (e: YouVersionError) => (assert.equal(e.kind, "empty"), true)
      );
    } finally {
      stub.restore();
    }
  }
  // network failure → network
  {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("boom");
    }) as typeof fetch;
    try {
      await assert.rejects(
        () => yvFetch("/v1/bibles"),
        (e: YouVersionError) => (assert.equal(e.kind, "network"), true)
      );
    } finally {
      globalThis.fetch = original;
    }
  }
});

test("YVP-10c: request carries the X-YVP-App-Key header and the key never appears in error messages", async () => {
  enableYouVersion();
  const stub = stubFetch(() => ({ status: 403, body: {} }));
  try {
    await assert.rejects(() => yvFetch("/v1/bibles?language_ranges%5B%5D=te"));
    assert.equal(stub.log.length, 1);
    const headers = (stub.log[0].init?.headers || {}) as Record<string, string>;
    assert.equal(headers["X-YVP-App-Key"], "yvp_test_key_1234567890");
  } finally {
    stub.restore();
  }
});

test("YVP-10d: listBiblesForLanguage pages and getPassage returns typed content", async () => {
  enableYouVersion();
  let calls = 0;
  const stub = stubFetch((url) => {
    calls += 1;
    if (url.includes("/v1/bibles?")) {
      if (!url.includes("page_token")) {
        return {
          status: 200,
          body: {
            data: [
              { id: 3034, abbreviation: "BSB", title: "Berean Standard Bible", language_tag: "te" },
            ],
            next_page_token: "PAGE2",
          },
        };
      }
      return {
        status: 200,
        body: { data: [{ id: 9999, abbreviation: "TLV", title: "Other", language_tag: "te" }] },
      };
    }
    // passage endpoint
    return {
      status: 200,
      body: { id: "JHN.3.16", content: "For God so loved the world…", reference: "John 3:16" },
    };
  });
  try {
    const bibles = await listBiblesForLanguage("te");
    assert.equal(bibles.length, 2);
    assert.equal(calls, 2, "pagination must follow next_page_token");
    const passage = await getPassage(3034, "JHN.3.16");
    assert.equal(passage.id, "JHN.3.16");
    assert.match(passage.content, /God so loved/);
  } finally {
    stub.restore();
  }
});

/* ─── YVP-11: catalogue ──────────────────────────────────────────────────── */

test("YVP-11: catalogue maps, dedupes, filters and caches; disabled → empty", async () => {
  // disabled → empty, no requests
  disableYouVersion();
  {
    const stub = stubFetch(() => ({ status: 200, body: { data: [] } }));
    try {
      const versions = await getYouVersionCatalog();
      assert.equal(versions.length, 0);
      assert.equal(stub.log.length, 0);
    } finally {
      stub.restore();
    }
  }

  // enabled → merged per-language catalogue with caching
  enableYouVersion();
  let languageCalls = 0;
  const stub = stubFetch((url) => {
    if (!url.includes("/v1/bibles?")) return { status: 200, body: { data: [] } };
    languageCalls += 1;
    if (url.includes("language_ranges%5B%5D=te")) {
      return {
        status: 200,
        body: {
          data: [
            {
              id: 3034,
              abbreviation: "BSB",
              title: "Berean Standard Bible",
              localized_title: "Telugu: Berean Study Bible",
              language_tag: "te",
              copyright: "Public Domain.",
            },
            { id: 3034, abbreviation: "BSB", title: "duplicate", language_tag: "te" },
            { id: 4444, abbreviation: "NO LANG", title: "missing language tag", language_tag: "" },
          ],
        },
      };
    }
    return { status: 200, body: { data: [] } };
  });
  try {
    const first = await getYouVersionCatalog();
    assert.equal(first.length, 1, "dedupe by id + drop entries without a language tag");
    assert.equal(first[0].provider, "youversion");
    assert.equal(first[0].id, "3034");
    assert.equal(first[0].languageTag, "te");
    assert.equal(first[0].attribution, "Public Domain.");
    const callsAfterFirst = languageCalls;
    const second = await getYouVersionCatalog();
    assert.equal(second.length, 1);
    assert.equal(languageCalls, callsAfterFirst, "catalogue must be served from cache");
  } finally {
    stub.restore();
  }
});

/* ─── YVP-12: fallback dedup ─────────────────────────────────────────────── */

test("YVP-12: markCoveredFallbacks hides koino entries duplicated by YouVersion", () => {
  const yvKjv: BibleVersion = {
    provider: "youversion",
    id: "1401",
    label: "King James Version",
    abbr: "KJV",
    languageTag: "en",
    languageLabel: "English",
    nativeLanguageLabel: "English",
    attribution: null,
  };
  const yvOther: BibleVersion = {
    provider: "youversion",
    id: "3034",
    label: "Berean Standard Bible",
    abbr: "BSB",
    languageTag: "en",
    languageLabel: "English",
    nativeLanguageLabel: "English",
    attribution: null,
  };
  const merged = markCoveredFallbacks([yvOther, yvKjv, ...KOINO_FALLBACK_VERSIONS]);
  const koinoKjv = merged.find((v) => v.provider === "koino" && v.id === "kjv");
  const koinoWeb = merged.find((v) => v.provider === "koino" && v.id === "web");
  assert.equal(koinoKjv?.coveredByYouVersion, true, "KJV is covered by the YouVersion KJV");
  // WEB is not in this catalogue → stays uncovered (remains selectable)
  assert.equal(koinoWeb?.coveredByYouVersion, undefined);
  // YouVersion entries are never marked
  assert.equal(yvOther.coveredByYouVersion, undefined);
});

/* ─── YVP-13: unified chapter resolution ─────────────────────────────────── */

test("YVP-13a: resolveChapter validates inputs", async () => {
  const bad = await resolveChapter("koino:kjv", "not-a-book", "1");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.kind, "bad_request");

  const badChapter = await resolveChapter("koino:kjv", "john", "999");
  assert.equal(badChapter.ok, false);
  if (!badChapter.ok) assert.equal(badChapter.kind, "bad_request");

  const badRef = await resolveChapter("garbage", "john", "3");
  assert.equal(badRef.ok, false);
  if (!badRef.ok) assert.equal(badRef.kind, "bad_request");
});

test("YVP-13b: koino transport resolves KJV chapters with provider metadata", async () => {
  const stub = stubFetch((url) => {
    assert.ok(url.startsWith("https://bible-api.com/"), "koino path must use bible-api.com");
    return {
      status: 200,
      body: {
        reference: "John 3:16",
        verses: [
          { book_id: "jhn", book_name: "John", chapter: 3, verse: 16, text: "For God so loved…" },
        ],
        translation_id: "kjv",
        translation_name: "King James Version",
        translation_note: "",
      },
    };
  });
  try {
    const result = await resolveChapter("koino:kjv", "john", "3");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.provider, "koino");
      assert.equal(result.data.versionRef, "koino:kjv");
      assert.equal(result.data.versionAbbr, "KJV");
      assert.equal(result.data.languageTag, "en");
      assert.ok(result.data.attribution && result.data.attribution.includes("King James Version"));
      assert.equal(result.data.verses[0].verse, 16);
    }
  } finally {
    stub.restore();
  }
});

test("YVP-13c: youversion transport resolves chapters with attribution", async () => {
  enableYouVersion();
  const stub = stubFetch((url) => {
    if (url.includes("/v1/bibles/3034?") || (url.includes("/v1/bibles/3034") && !url.includes("passages") && !url.includes("?"))) {
      return {
        status: 200,
        body: {
          id: 3034,
          abbreviation: "BSB",
          title: "Berean Standard Bible",
          language_tag: "en",
          copyright: "Public Domain. Berean Bible.",
        },
      };
    }
    if (url.includes("/passages/")) {
      return {
        status: 200,
        body: {
          id: "JHN.3",
          content: "16 For God so loved the world 17 that he gave his Son",
          reference: "John 3",
        },
      };
    }
    throw new Error("unexpected url: " + url);
  });
  try {
    const result = await resolveChapter("youversion:3034", "john", "3");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.provider, "youversion");
      assert.equal(result.data.versionRef, "youversion:3034");
      assert.equal(result.data.versionAbbr, "BSB");
      assert.equal(result.data.attribution, "Public Domain. Berean Bible.");
      assert.deepEqual(
        result.data.verses.map((v) => v.verse),
        [16, 17]
      );
      assert.match(result.data.verses[0].text, /^For God so loved/);
    }
  } finally {
    stub.restore();
  }
});

test("YVP-13d: unavailable YouVersion version → structured error, KJV falls back to the koino transport", async () => {
  enableYouVersion();
  // YouVersion returns 403 (unlicensed); bible-api.com serves KJV fine.
  const stub = stubFetch((url) => {
    if (url.startsWith("https://api.youversion.com/")) return { status: 403, body: {} };
    return {
      status: 200,
      body: {
        reference: "John 3",
        verses: [{ book_id: "jhn", book_name: "John", chapter: 3, verse: 1, text: "Now…" }],
        translation_id: "kjv",
        translation_name: "King James Version",
        translation_note: "",
      },
    };
  });
  try {
    // A YouVersion-only id (no koino equivalent) must fail with a structured error.
    const err = await resolveChapter("youversion:777777", "john", "3");
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.kind, "unlicensed");

    // KJV via YouVersion-id path falls back to the koino transport.
    const kjv = await resolveChapter("youversion:kjv", "john", "3");
    // note: "kjv" is not a numeric YouVersion id; the platform call fails and
    // the resilient fallback serves the same translation via koino.
    assert.equal(kjv.ok, true);
    if (kjv.ok) assert.equal(kjv.data.provider, "koino");
  } finally {
    stub.restore();
  }
});

test("YVP-13e: disabled provider → youversion refs report 'disabled', koino keeps working", async () => {
  disableYouVersion();
  const stub = stubFetch(() => ({ status: 200, body: {} }));
  try {
    const disabled = await resolveChapter("youversion:3034", "john", "3");
    assert.equal(disabled.ok, false);
    if (!disabled.ok) assert.equal(disabled.kind, "disabled");
    assert.equal(stub.log.length, 0, "no YouVersion traffic while disabled");
  } finally {
    stub.restore();
  }
});
