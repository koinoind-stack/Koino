# SESSION HANDOFF — YouVersion Catalogue Verifier Reconstruction

**Date:** 2026-11-02 · **Branch:** `feature/youversion-verifier-reconstruction`
**Code commit:** `295e73d7b0885fa1ddb15f1bd66fcab6cedc8563` (on top of `main` @ `74fdbb2`, PR #17 merge)

---

## 1. Version and reconstruction status

- **Tool version:** `2.5.0-reconstructed` (`TOOL_VERSION` in `verification/yv_catalogue_verify.py`; `USER_AGENT` = `koino-readonly-catalogue-verify/2.5.0-reconstructed`).
- **Status:** RECONSTRUCTION COMPLETE — offline-tested, delivered for owner review.
- **This is NOT the recovered original v2.4.1.** The original v2.4.0/v2.4.1 verifier, its 105-test suite and the v2.4.0→v2.4.1 patch were lost with a previous session and remain unrecovered (full read-only search completed — see `final-recovery-search-report-2026-11-02.md`). This tool was rebuilt offline from the preserved v1 source, the owner-approved plan, the v2.4.0 audit (blocker B1 **fixed**), the P0 report, the P1 preparation confirmation and the hash-verified supplier catalogues. Details, inferences and uncertainties: `verification/RECONSTRUCTION-REPORT.md`.

## 2. Files created (SHA256)

| File | Bytes | SHA256 |
|---|---|---|
| `verification/yv_catalogue_verify.py` | ~48 KB | `c6b0704182fb8de03075437e964e1b20f8a3d8a7c3f6e73f44043993343220e2` |
| `verification/test_yv_catalogue_verify.py` | ~34 KB | `538b4b030a761ede761835cb5665ee6f2f447fbaad192ed120f66daf2d36e696` |
| `verification/RECONSTRUCTION-REPORT.md` | ~12 KB | `1303366186c45615fc1b238179292d1b0725903bf1342c4efd307fa58aaf0a90` |
| `verification/offline-validation-summary.json` | ~3.9 KB | `e0c1fd880d30904a04916a307698440af36246d17237b7ceb6fd913f19ca4860` |
| `.gitignore` | +4 lines (`__pycache__/`, `*.pyc`) | (housekeeping) |

## 3. Test results

| Suite | Result |
|---|---|
| Offline suite (no real files; socket/urllib ban active the whole run) | **74 passed / 5 skipped** (skips = real-file integration tests, environment-dependent by design) |
| Full suite WITH the original hash-verified supplier catalogues | **79 / 79 PASSED** (0.29 s) |
| Runtime | 0.2–0.3 s; fake transports only; zero network |
| Lint/syntax | `py_compile` clean; pyflakes clean |

The recreated suite is **not** the original 105-test suite; it is an independent suite mapped to the owner-approved plan §6.4 cases plus the audit's missing-test findings (G5 terms-gate tests included — the v2.4.0 blocker B1 is covered by `test_2_g5_terms_missing_blocks_provisional` and `test_3b_g5_blocks_approved_when_terms_missing`).

## 4. Catalogue validation results (vs the ORIGINAL supplier files)

| Check | Result |
|---|---|
| Biblica | 69 raw rows = **68 valid unique numeric IDs** + 1 missing-ID row; `count_mismatch` arithmetic `69 raw = 68 valid + 1 missing_id` |
| YOM | preserved verbatim: `{"row": 69, "line": 75, "abbreviation_raw": "YOM", "name_raw": "Kiyombe New Testament with Psalms"}` — never assigned an ID, excluded from every probe list |
| 68-ID set vs `biblica68-ids.txt` | **exact match** |
| Wycliffe | **1,037/1,037 valid**; 25 duplicate-abbreviation groups (warning-only — matches the original recheck exactly); `count_matches_owner_statement: true` |
| Cross-provider overlap | **0** — `[C11]` gate CLOSED — `audit_status: provider_lists_incomplete` |
| Provisional mode | **eligible** (exact single-YOM-defect state, G1/G2) |
| Supplier catalogue hashes | Biblica `25ce029bacc4910e30d2fe8b9958d0367bdd086e898ddbeb03a73e9aa668173f`, Wycliffe `75f7f691701f8cbefd392faa5b73ae3d68df4486a8753f56e19321b2d5de7bb4` — both match the values recorded in `P1-PREPARATION-CONFIRMATION.md` §2 |
| API requests during this work | **0** · App Key: never requested, never used |

## 5. Safety verification performed before push

- **Secret scan:** zero real credential patterns (`github_pat_`, `ghp_`, etc.); only synthetic test-fixture strings (LEAKYKEY / TOPSECRETKEY42 / SECRETVALUE / ENVONLYKEY) that exercise the redaction logic.
- **Network inspection:** `urllib` confined to `Transport._once`; GET-only enforced (`transport_refuses_non_get`); the entire test run executes under a hard `socket`+`urlopen` ban.
- **Safeguards implemented and test-asserted:** env-only App Key; redaction incl. dict keys + written-report self-scan (exit 4); rate limit ≥1 s before EVERY request incl. retries; hard budget → safe abort (exit 3) with partial report marked `aborted`; 429 Retry-After honored (capped); 5xx bounded backoff; 401 immediate abort; G5 terms gate on BOTH provisional and approved paths; `serving_permission: "none"` on every record; `permission_to_serve_implied: false` hard-coded; PD/CC + Lockman held at `licensed_agreed_provider_unknown`; SIL exclusion wins over everything; no silent English substitution / machine translation.

## 6. Known limitations

1. **Not the recovered original** — line-for-line parity with the lost v2.4.x is not claimed; inferences are listed in `verification/RECONSTRUCTION-REPORT.md` §3.
2. The recreated suite is independent; the original 105 tests' content is unknown.
3. The South-Asia 17-ID observation list is referenced (count + source pointers) but not embedded — it lives in `WYCLIFFE-SOUTH-ASIA-REVIEW.md`.
4. The P1 API path is implemented but **dormant**: it requires the App Key via environment AND separate owner authorization.
5. Supplier catalogue files are deliberately NOT committed to this public repository (licence-evidence handling); the offline-validation summary records their hashes instead.

## 7. Git state

- **Branch:** `feature/youversion-verifier-reconstruction` (created from `main` @ `74fdbb2`)
- **Commits:** `295e73d` (reconstruction + tests + docs + .gitignore housekeeping) · `4b8878e` (this handoff) · `5f74e26` (push-blocker note)
- **Push status (RESOLVED):** ✅ **PUSHED AND MERGED.** After delivery-time 401s (root cause: a stale `remote.origin.pushurl` carrying a dead token — removed, not replaced), the branch was pushed with a fresh fine-grained PAT and verified server-side by unauthenticated `git ls-remote` (branch tip `5f74e2675893472d760ede63163e8202434df83a`). The owner then merged it: **PR #18 → `main` merge commit `4ac4dc485bbf2085966276c5a0742bc3c9ab114d`** (parents `74fdbb2` + `5f74e26`), 2026-11-02. The temporary push token was deleted from the session immediately after the push and was to be revoked by the owner. `main` was never pushed directly; no force-push; no deploy.
- **Preserved locally:** both commits intact on the local branch; a git bundle (`74fdbb2..HEAD`) was provided alongside this session as the push fallback (superseded by the successful push).

## 8. P1 status — EXPLICIT CONFIRMATION

**P1 API verification has NOT run and remains unauthorized.** Zero API requests were made during reconstruction and testing; zero App-Key use occurred; no Koino application code, production, database or deployment surface was touched. The verifier's API mode will refuse to run without the App Key in the environment, and the owner's explicit authorization is required before any P1 execution (planned: 136 probe requests + 1 seed load, cap 200, ≥1 s interval, per `P1-PREPARATION-CONFIRMATION.md` §4).

---

## 9. Session update (2026-11-02) — PR #18 merge confirmed; YOM owner decision; Bible endpoint rate limiting

### 9.1 Merge confirmation

PR #18 merged `feature/youversion-verifier-reconstruction` into `main` successfully:
merge commit `4ac4dc485bbf2085966276c5a0742bc3c9ab114d` (verified by local fetch —
`main` = `4ac4dc4`, parents `74fdbb2` + `5f74e26`). The branch was later synced with
`main` via PR #19 (`ee0e88f`); §7 above has been corrected accordingly (it previously
recorded the delivery-time push block, now resolved).

### 9.2 OWNER DECISION — Biblica YOM row stays unchanged and unresolved

The owner has decided that the Biblica YOM entry ("Kiyombe New Testament with Psalms")
**must remain exactly as supplied — a missing-ID row — and stays unresolved**, because
it carries no YouVersion Bible ID.

- The row is **preserved verbatim** by `verification/yv_catalogue_verify.py`
  (`excluded_reason: "missing_id"`, row 69 / line 75 of the supplied Biblica file).
- It is **excluded from every API probe list** — it has no ID, so there is nothing to
  probe; no ID may be invented for it, and it must never be deleted or "fixed" to make
  a gate pass.
- **YOM must not block other work**: the other **68 valid Biblica IDs remain intact**
  and fully usable for verification and future licensing steps; the Wycliffe list
  (1,037 rows) is unaffected. YOM's unresolved state is a permanent, accepted condition
  of the Biblica supplier list — not an open blocker.
- Consequence inside the verifier (unchanged behavior, now a documented owner decision):
  `audit_status` remains `provider_lists_incomplete` and the H-gate keeps
  `serving_permission: "none"` until real licence verification (P1) runs — for every
  edition, not because of YOM alone.

### 9.3 Per-client rate limiting added to the public Bible endpoints

`GET /api/bible/versions` and `GET /api/bible/chapter` previously had **no per-client
rate limiting** — the only public Bible surface without an abuse guard. This session:

- **Reused the existing project limiter** (`src/lib/social/rate-limit.ts`, Task 50
  sliding window) instead of adding a new mechanism. The lib gained:
  - `clientKeyFromRequest()` — per-client identity for public endpoints:
    `x-real-ip` (platform-set) → LAST `x-forwarded-for` hop (edge-appended; earlier
    hops are client-controlled and must not be trusted, or rotating a fake first hop
    would defeat the limiter) → `"unknown"` (dev parity with the share-card guard).
  - `rateLimitClient(req, scope, limit, windowMs)` — fail-open wrapper (same policy
    as the groups route's `rateLimitSafe`): limiting must never break reading.
  - `__resetRateLimitForTests()` — test hook, mirroring the other `__reset*ForTests`.
- **`GET /api/bible/chapter`**: 60 requests/min/client, checked BEFORE the cache and
  both providers. 429 body keeps the route's `{ error: { kind: "rate_limited", … } }`
  taxonomy so the reader renders its friendly slow-down state; `Retry-After: 60`.
- **`GET /api/bible/versions`**: 30 requests/min/client. 429 body `{ error: "Too many
  requests" }` (same shape as the share-card guard); `Retry-After: 60`.
- **Cache note**: the limiter counts every client request including cache hits (it
  sits upstream of the chapter cache by design) — limits are far above legitimate
  reading, so this only bites abuse loops.
- `__resetBibleServerCachesForTests()` now also clears the transport-level
  `koinoCache` (it previously cleared only `chapterCache`), so tests start from a
  truly cold cache.
- Tests: `tests/bible-routes.test.ts` (BR-0…BR-4, 9 cases — normal reading, cache
  hits, excessive requests → 429 shapes + `Retry-After`, per-client isolation,
  identity extraction); registered in the `npm test` file list. Full suite: **165/165
  passed** (156 pre-existing + 9 new). No YouVersion API request was made; the App
  Key was never accessed; `YOUVERSION_ENABLED` remains unset in code.
