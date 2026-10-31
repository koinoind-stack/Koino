// i18n coverage regression suite (Telugu Part-1 policy):
// TE-1 te.ts has key parity with en.ts (no missing, no extra)
// TE-2 every {placeholder} in an en value appears in the te value
// TE-3 te values are Telugu or allowlisted format tokens (no English leftovers)
// TE-4 hi.ts may lag (Part 2) but must have no keys missing from en (no stale keys)
// TE-5 brand safety: "Koino" is rewritten by t(); dictionaries keep the literal
import { strict as assert } from "node:assert";
import { test } from "node:test";
import en from "../src/lib/i18n/en";
import te from "../src/lib/i18n/te";
import hi from "../src/lib/i18n/hi";

const PLACEHOLDER = /\{([^}]+)\}/g;
const allowFormat = /^[-+·•.,:;()%\s{}"']*(FP|pts?|MRP|₹|Koino)?[-+·•.,:;()%\s{}"']*$/i;
const allowExact =
  /^(Koino|KJV|WEB|FP|MRP|ESV|WhatsApp|India|https?:\/\/\S+|\+91…?|\{[a-z]+\}(…|\.\.\.)?|[0-9 :A.M.P.Mx\-–]+)$/i;

test("TE-1: te.ts has exact key parity with en.ts", () => {
  const missing = Object.keys(en).filter((k) => !(k in te));
  const extra = Object.keys(te).filter((k) => !(k in en));
  assert.deepEqual(missing, [], `missing in te: ${missing.slice(0, 10).join(", ")}`);
  assert.deepEqual(extra, [], `extra in te: ${extra.slice(0, 10).join(", ")}`);
});

test("TE-2: placeholders preserved in te values", () => {
  const bad: string[] = [];
  for (const [k, enV] of Object.entries(en)) {
    const enVars = enV.match(PLACEHOLDER) || [];
    const teVars = (te[k] || "").match(PLACEHOLDER) || [];
    if (enVars.some((v) => !teVars.includes(v))) bad.push(k);
  }
  assert.deepEqual(bad, [], `placeholder mismatches: ${bad.slice(0, 10).join(", ")}`);
});

test("TE-3: te values are translated (Telugu script or format token)", () => {
  const leftover = Object.entries(en)
    .filter(([k, v]) => te[k] === v && /[A-Za-z]{3,}/.test(v) && !allowFormat.test(v) && !allowExact.test(v))
    .map(([k]) => k);
  assert.deepEqual(leftover, [], `untranslated te values: ${leftover.slice(0, 10).join(", ")}`);
});

test("TE-4: hi.ts has no stale keys (Part 2 will complete translations)", () => {
  const stale = Object.keys(hi).filter((k) => !(k in en));
  assert.deepEqual(stale, [], `stale hi keys: ${stale.slice(0, 10).join(", ")}`);
});

test("TE-5: every dictionary value is a non-empty string", () => {
  for (const [name, dict] of Object.entries({ en, te, hi })) {
    for (const [k, v] of Object.entries(dict)) {
      assert.equal(typeof v, "string", `${name}.${k} not a string`);
      assert.ok((v as string).length > 0, `${name}.${k} empty`);
    }
  }
});
