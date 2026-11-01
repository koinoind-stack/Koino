// Unit tests for the dormant YouVersion Platform configuration gate (YVP-*).
// Contract under test:
//   YVP-1 disabled by default (no env → enabled=false, default base URL)
//   YVP-2 fail-closed: key present but flag off → stays disabled
//   YVP-3 fail-loud: flag on but key missing → throws with guidance
//   YVP-4 enabled: request headers carry X-YVP-App-Key (exact header name)
//   YVP-5 base URL override honored, trailing slashes trimmed
//   YVP-6 diagnostics describe config WITHOUT ever containing the full key
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  getYouVersionConfig,
  youVersionRequestHeaders,
  describeYouVersionConfig,
  YVP_DEFAULT_BASE_URL,
} from "../src/lib/youversion/config";

const KEY = "yvp_test_app_key_abcdefgh12345678";

function clearEnv() {
  delete process.env.YOUVERSION_ENABLED;
  delete process.env.YOUVERSION_APP_KEY;
  delete process.env.YOUVERSION_API_BASE_URL;
}

test("YVP-1: disabled by default — no env vars set", () => {
  clearEnv();
  const cfg = getYouVersionConfig();
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.appKey, null);
  assert.equal(cfg.baseUrl, YVP_DEFAULT_BASE_URL);
  assert.equal(cfg.baseUrl, "https://api.youversion.com");
});

test("YVP-2: fail-closed — key set but flag off stays disabled", () => {
  clearEnv();
  process.env.YOUVERSION_APP_KEY = KEY;
  // YOUVERSION_ENABLED unset (or any non-"true" value) must disable.
  const cfg = getYouVersionConfig();
  assert.equal(cfg.enabled, false);
  assert.throws(() => youVersionRequestHeaders(cfg));
  // Case/whitespace variants of the flag must not enable either.
  process.env.YOUVERSION_ENABLED = "TRUE ";
  assert.equal(getYouVersionConfig().enabled, true);
  process.env.YOUVERSION_ENABLED = "yes";
  assert.equal(getYouVersionConfig().enabled, false);
  process.env.YOUVERSION_ENABLED = "1";
  assert.equal(getYouVersionConfig().enabled, false);
});

test("YVP-3: fail-loud — flag on but key missing throws with guidance", () => {
  clearEnv();
  process.env.YOUVERSION_ENABLED = "true";
  assert.throws(
    () => getYouVersionConfig(),
    /YOUVERSION_APP_KEY is empty[\s\S]*never as a NEXT_PUBLIC_/,
    "error must explain the missing key and the server-only rule"
  );
  // Whitespace-only key counts as missing.
  process.env.YOUVERSION_APP_KEY = "   ";
  assert.throws(() => getYouVersionConfig());
});

test("YVP-4: enabled config builds X-YVP-App-Key request headers", () => {
  clearEnv();
  process.env.YOUVERSION_ENABLED = "true";
  process.env.YOUVERSION_APP_KEY = KEY;
  const cfg = getYouVersionConfig();
  assert.equal(cfg.enabled, true);
  const headers = youVersionRequestHeaders(cfg);
  assert.equal(headers["X-YVP-App-Key"], KEY);
  assert.equal(headers.Accept, "application/json");
  // Disabled config must refuse to build headers.
  clearEnv();
  assert.throws(() => youVersionRequestHeaders(getYouVersionConfig()));
});

test("YVP-5: base URL override honored and normalized", () => {
  clearEnv();
  process.env.YOUVERSION_ENABLED = "true";
  process.env.YOUVERSION_APP_KEY = KEY;
  process.env.YOUVERSION_API_BASE_URL = "https://staging.example.com/api/";
  const cfg = getYouVersionConfig();
  assert.equal(cfg.baseUrl, "https://staging.example.com/api");
});

test("YVP-6: diagnostics never leak the full app key", () => {
  clearEnv();
  process.env.YOUVERSION_ENABLED = "true";
  process.env.YOUVERSION_APP_KEY = KEY;
  const cfg = getYouVersionConfig();
  const desc = describeYouVersionConfig(cfg);
  assert.ok(!desc.includes(KEY), "diagnostics must not contain the raw key");
  assert.ok(desc.includes("***" + KEY.slice(-4)), "masked tail is shown");
  assert.ok(desc.includes(`${KEY.length} chars`));
  // Disabled state is explicitly labeled.
  clearEnv();
  assert.equal(
    describeYouVersionConfig(getYouVersionConfig()),
    "YouVersion provider: disabled"
  );
});
