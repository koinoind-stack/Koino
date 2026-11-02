# RECONSTRUCTION REPORT — `yv_catalogue_verify.py` v2.5.0-reconstructed

**Date:** 2026-11-02 · **Author:** Z.ai reconstruction session (offline) · **Status:** delivered for owner review
**HONESTY CONTRACT:** This is a **RECONSTRUCTION**, not the recovered original. The original v2.4.0/v2.4.1 sources and their 105-test suite were lost with a previous session and remain unrecovered despite a full read-only search. Line-for-line parity with the lost originals is **NOT claimed** and must not be assumed.

---

## 1. Provenance — what this was rebuilt from

| Source | Used for |
|---|---|
| `yv_catalogue_verify_v1_original.py` (257 lines, preserved) | Core architecture: env-only key, GET-only, header-only key, per-request 1 s pacing, report shape, licence/ids/language steps |
| `PROPOSED-API-VERIFICATION-PLAN.md` (owner-approved) | G1–G7 / F1–F5 gate semantics, `serveable_provisional` design, verdict ladder, report field spec (§6.1–6.3), request budgets |
| `P1-READINESS-CODE-AUDIT-v2.4.0.md` | All Check 1–6 constraints; **blocker B1 fixed** (G5 terms clause now gates BOTH provisional and approved paths); USER_AGENT/TOOL_VERSION aligned (v2.4.0 cosmetic bug not reproduced); G4 tightened to `TIER_A_DETAIL_200` for the provisional branch (audit-sanctioned option) |
| `P0-V2.4-IMPLEMENTATION-REPORT.md` | S1/S2/S3 safeguard semantics (`serving_permission: "none"`, `permission_to_serve_implied: false`, `verdict_scope: "verifier_report_internal_only"`) |
| `P1-PREPARATION-CONFIRMATION.md` | Exact P1 command surface, exit codes 0/2/3/4, abort taxonomy, request-budget table (137 nominal / cap 200), YOM verbatim record |
| `p1-prep-offline-recheck-2026-11-02.json` | Offline report structure, provider/catalogue block fields, expected counts (69=68+1, 1,037, 25 duplicate-abbrev groups, overlap 0) |
| Original supplier catalogues (hash-verified) | Parser format (preamble, "N Bibles in License", `Abrev/Name/ID` header, TSV rows) |

## 2. What was reconstructed (all offline-verified)

- **Catalogue parsers** for both supplier formats with the full problem taxonomy: `count_mismatch`, `missing_id_rows` (YOM verbatim, never invented), `duplicate_ids`, `non_numeric_ids`, `malformed_rows`, `sil_flagged_rows`; duplicate *abbreviations* are warnings only (ID is the matching key).
- **List-state builder + overlap invalidation** (F3) and the **Biblica provisionality evaluator** (G1/G2, F1–F4 — eligible only for the exact single-YOM-defect state).
- **Verdict engine** `decide_bible_state`: SIL-wins exclusion, conflicting-attribution review, PD/CC + Lockman held at `licensed_agreed_provider_unknown`, F5 API-time fail-closed states, H-gate (`serveable_approved` unreachable while YOM is unresolved), provisional escape for Biblica-68 only, **G5 terms gate on both serving paths (B1 fix)**.
- **S2 licence-restriction assessment** with `permission_to_serve_implied: false` hard-coded; `terms_missing_fail_closed` / `evidence_unavailable_fail_closed` / `terms_saved_owner_review` states.
- **Transport**: GET-only (refuses other methods), rate-limiter before EVERY request incl. retries, hard request budget, 429 Retry-After (seconds or HTTP-date, capped), 5xx bounded backoff, 401 immediate abort, network-error bounds, 30 s timeout, URL-only audit trail.
- **Redaction**: key scrubbed in every written string **including dict keys**; written-report self-scan → auto-redact + exit 4.
- **Key handling**: env-only; `--app-key` CLI refused (exit 2); API mode without key → exit 2 with LIMITATION, zero calls; key never printed/logged.
- **Offline validation mode** (keyless, structurally zero requests) reproducing the recheck report structure.
- **P1 runner** (Biblica-68; dormant until separately authorized): seed load, Tier A + Tier B per ID, licence-term artifacts, `--skip-seeds`, budget/abort semantics.

## 3. What was INFERRED (not derivable from surviving documents)

1. `terms_present` is computed from the presence of any of `terms_html` / `attribution_html` / `caching_policy` / `display_restrictions` / `redistribution_restrictions` (field names inferred from plan §6.2 wording).
2. Duplicate-abbreviation grouping is case-insensitive (reproduces the original's **25** Wycliffe groups exactly — validated against the real file).
3. The offline report's `south_asia_observations` block records the count (17) and source pointers but does NOT embed the 17-ID list (it lives in `WYCLIFFE-SOUTH-ASIA-REVIEW.md`; embedding it was not derivable).
4. `C11` gate semantics rendered as `state: CLOSED` while Biblica is not fully valid (exact original wording unknown).
5. Exact JSON structure of per-edition records beyond plan §6.2 (ordering, extra convenience fields).
6. `NonSleepTransport`-style injectability and the `transport_factory` seam are reconstruction conveniences for offline testing.
7. Exit-code message wording; log phrasing.

## 4. What remains uncertain / explicitly NOT claimed

- **Not** the recovered original v2.4.1; internal line references in comments map to the AUDIT's line numbers of the lost file, for traceability only.
- The original 105-test suite content is unknown; the recreated suite (79 tests) is independent and its coverage map is documented below.
- Behaviour of the lost v2.4.x in edge cases not covered by the surviving documents (e.g. exact 5xx backoff base) may differ.
- No claim about hash values of the lost files; identity of any future recovered original must be established by re-running its own 105-test suite, not by comparing to this reconstruction.

## 5. Validation evidence (all offline)

| Check | Result |
|---|---|
| Recreated offline test suite | **74 passed / 5 skipped** (skips = real-file integration tests, environment-dependent) |
| Full suite WITH real supplier catalogues | **79 / 79 PASSED** |
| Biblica parse vs originals | 69 raw = **68 valid** + 1 missing_id; YOM verbatim `{"row": 69, "line": 75, "abbreviation_raw": "YOM", "name_raw": "Kiyombe New Testament with Psalms"}` |
| 68-ID set vs `biblica68-ids.txt` | **exact match** |
| Wycliffe parse vs original | **1,037/1,037 valid**, 25 duplicate-abbreviation groups (matches original recheck), warning-only |
| Cross-provider overlap | 0 · `[C11]` CLOSED · `audit_status: provider_lists_incomplete` · provisional eligible |
| Catalogue hashes | Biblica `25ce029b…8173f`, Wycliffe `75f7f691…de7bb4` — match recorded references |
| Syntax/lint | `py_compile` clean, pyflakes clean |
| Secret scan | Zero real credential patterns; only synthetic test-fixture strings (LEAKYKEY / TOPSECRETKEY42 / SECRETVALUE / ENVONLYKEY) used to exercise redaction |
| Network inspection | `urllib` confined to `Transport._once`; the whole test run executes under a hard socket+urllib ban |
| API requests made during reconstruction | **0** · App Key: never requested, never used |

## 6. Mandatory-safeguard map (owner instruction §3 → implementation → test)

| Safeguard | Implementation | Test |
|---|---|---|
| Offline only, zero API requests | offline mode has no transport; suite socket-banned | setUpModule ban + `api_requests_made: 0` assertions |
| No `YOUVERSION_APP_KEY` use | env-only read at main(); `--app-key` refused exit 2 | `TestKeyHandling` |
| No network calls | GET-only transport; ban in tests | `test_refuses_non_get`, module ban |
| 68 Biblica IDs preserved | parser valid-set + integration check | `TestRealCatalogues.test_ids_match_biblica68_file` |
| YOM verbatim, never invented | missing_id row preserved, excluded from probes | `test_yom_missing_id_verbatim`, real-file test |
| 1,037 Wycliffe rows | parser | `test_wycliffe_1037_valid` |
| SIL excluded completely | parse flag + attribution win + provider_scope | `test_11_sil_wins…`, `test_sil_rows_flagged` |
| PD/CC + Lockman outside initial catalogue | provider_scope `selected: false` + pending verdict | `test_16_pending_review_org_never_approved` |
| Duplicate abbreviations warning-only | warnings list, IDs still valid | `test_duplicate_abbreviations_warning_only` |
| G5: missing terms never provisional/approved | terms gate on both paths (B1 fix) | `test_2…`, `test_3b…` |
| Unknown/unclear restrictions fail-closed | fail-closed assessments + verdicts | `TestAssessments` |
| `serveable_provisional` internal only | `verdict_scope: verifier_report_internal_only` + safeguards block | `test_1…`, happy-P1 assertions |
| `serving_permission: "none"` always | hard-coded in `_record` | `test_17_every_record_carries_serving_permission_none` |
| No Koino activation/production changes | commit contains only `verification/` + handoff docs | git diff review |
| No silent English substitution / machine translation | no such code; safeguard flag | safeguards block assertions |

## 7. Files in this delivery

| File | Purpose |
|---|---|
| `verification/yv_catalogue_verify.py` | The reconstructed verifier (single file, Python 3 stdlib only) |
| `verification/test_yv_catalogue_verify.py` | Recreated offline test suite (pytest/unittest compatible) |
| `verification/RECONSTRUCTION-REPORT.md` | This document |
| `verification/offline-validation-summary.json` | Compact summary of the validation run vs the ORIGINAL supplier files (full 1,106-row evidence JSON retained locally, not committed for size) |
| `SESSION-HANDOFF.md` (repo root) | Handoff: status, hashes, test results, limitations, branch/commit, P1-unauthorized confirmation |
