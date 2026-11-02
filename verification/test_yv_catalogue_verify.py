#!/usr/bin/env python3
"""Offline test suite for the RECONSTRUCTED yv_catalogue_verify.py (2.5.0-reconstructed).

PROVENANCE NOTE (honesty contract)
  These tests are RECREATED from the recovered specifications
  (PROPOSED-API-VERIFICATION-PLAN.md §6.4, P1-READINESS-CODE-AUDIT-v2.4.0.md,
  P0-V2.4-IMPLEMENTATION-REPORT.md, P1-PREPARATION-CONFIRMATION.md).
  They are NOT the original 105-test suite (lost with the previous session);
  the count below is this reconstruction's own suite.

Safety
  Zero network: setUpModule installs a hard socket/urllib ban for the entire
  run; every HTTP interaction uses fake transports (patched `_once`).
  Zero App-Key use: no test ever sets YOUVERSION_APP_KEY for API calls;
  key-handling tests prove refusal/absence behavior.
"""

import json
import os
import socket
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import yv_catalogue_verify as yv  # noqa: E402


# --------------------------------------------------------------------------- #
# Hard network ban for the WHOLE suite                                         #
# --------------------------------------------------------------------------- #

def _network_denied(*_a, **_k):
    raise AssertionError("NETWORK ACCESS ATTEMPTED DURING OFFLINE TEST RUN")


def setUpModule():
    # Ban raw sockets and urllib at the module level for every test.
    yv.urllib.request.urlopen = _network_denied
    socket.socket = _network_denied
    socket.create_connection = _network_denied


def tearDownModule():
    pass


# --------------------------------------------------------------------------- #
# Fixtures (synthetic, format-faithful to the real supplier files)             #
# --------------------------------------------------------------------------- #

def biblica_fixture(rows, stated=69, header_line=None):
    """Build a Biblica-format catalogue text.

    `rows`: list of (abbrev, name, id_or_None). The real file layout is:
    line1 blank, line2 title, line3 'N Bibles in License', line4 blank,
    line5 'Search by name...', line6 header, lines 7.. data.
    """
    lines = ["", "Biblica Fast-track Bible License - v1", f"{stated} Bibles in License",
             "", "Search by name, abbreviation, or ID", "Abrev\tName\tID"]
    for abbrev, name, bid in rows:
        if bid is None:
            lines.append(f"{abbrev}\t{name}")
        else:
            lines.append(f"{abbrev}\t{name}\t{bid}")
    return "\n".join(lines) + "\n"


def wycliffe_fixture(rows, stated=None):
    lines = ["Wycliffe Fast-track Bible License - v1",
             f"{stated if stated is not None else len([r for r in rows if r[2]])} Bibles in License",
             "", "Search by name, abbreviation, or ID", "Abrev\tName\tID"]
    for abbrev, name, bid in rows:
        if bid is None:
            lines.append(f"{abbrev}\t{name}")
        else:
            lines.append(f"{abbrev}\t{name}\t{bid}")
    return "\n".join(lines) + "\n"


# The real Biblica 68-ID set is cross-checked in the optional integration
# test (class TestRealCatalogues, skipped unless the files are supplied).

GOOD_ROWS = [("AKCB", "Akuapem Twi Contemporary Bible 2020", "1631"),
             ("APD", "Hiligaynon Contemporary Bible 2022", "10"),
             ("HCV", "Hindi Contemporary Version", "1628"),
             ("BCV", "Bengali Contemporary Version 2019 (Updated 2021)", "2412"),
             ("TCV-IN", "Indian Tamil Contemporary Version 2022", "2730")]
YOM_ROW = ("YOM", "Kiyombe New Testament with Psalms", None)


def make_temp_catalogue(text, suffix=".txt"):
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(text)
    return path


def healthy_pair():
    """Biblica with exactly one missing-ID row (YOM) + healthy Wycliffe."""
    bib = make_temp_catalogue(biblica_fixture(GOOD_ROWS + [YOM_ROW], stated=6))
    wyc = make_temp_catalogue(wycliffe_fixture([("AABV", "Ayta Ambala NT Portions", "3952"),
                                                ("aai", "Miniafia Oyan New Testament", "407"),
                                                ("zyp", "Chin, Zyphe NT", "930")], stated=3))
    return bib, wyc


def load_pair(bib_path, wyc_path):
    b = yv.load_catalogue(bib_path, yv.PROVIDER_BIBLICA)
    w = yv.load_catalogue(wyc_path, yv.PROVIDER_WYCLIFFE)
    state, overlap, b_ids, w_ids = yv.build_lists_state(b, w)
    provisional = yv.evaluate_biblica_provisional(state, overlap)
    state["biblica"]["provisional"] = provisional
    state["wycliffe"]["provisional"] = {"eligible": False,
                                        "valid_ids_count": state["wycliffe"]["id_count"],
                                        "defect": None}
    return state, overlap, b_ids, w_ids, provisional


AGREED_LIC = {"license_id": "LIC-1", "name": "Biblica Open Licence",
              "organization_name": "Biblica", "agreed_dt": "2026-10-01T00:00:00Z",
              "agreed": True, "agreed_basis": "developer_id_filtered",
              "terms_html": "<p>terms</p>", "attribution_html": "<p>attr</p>"}
NO_TERMS_LIC = {"license_id": "LIC-2", "name": "Biblica Open Licence",
                "organization_name": "Biblica", "agreed_dt": "2026-10-01T00:00:00Z",
                "agreed": True, "agreed_basis": "developer_id_filtered"}


# --------------------------------------------------------------------------- #
# Rate limiter / run controller                                                #
# --------------------------------------------------------------------------- #

class TestRateLimiter(unittest.TestCase):
    def _patched(self, mono_values):
        t = mock.patch.object(yv.time, "monotonic", side_effect=mono_values)
        s = mock.patch.object(yv.time, "sleep")
        return t, s

    def test_first_call_does_not_sleep(self):
        t, s = self._patched([100.0, 100.0])
        with t, s as sl:
            yv.RateLimiter(1.0).wait()
            sl.assert_not_called()

    def test_second_call_sleeps_remaining_interval(self):
        t, s = self._patched([100.0, 100.0, 100.4, 100.4])
        with t, s as sl:
            lim = yv.RateLimiter(1.0)
            lim.wait()
            lim.wait()
            sl.assert_called_once()
            self.assertAlmostEqual(sl.call_args[0][0], 0.6, places=6)

    def test_zero_interval_never_sleeps(self):
        t, s = self._patched([1.0, 1.0, 1.0, 1.0])
        with t, s as sl:
            lim = yv.RateLimiter(0)
            lim.wait()
            lim.wait()
            sl.assert_not_called()


class TestRunController(unittest.TestCase):
    def test_counts_requests(self):
        rc = yv.RunController(3)
        self.assertEqual([rc.count(), rc.count(), rc.count()], [1, 2, 3])

    def test_budget_breach_aborts(self):
        rc = yv.RunController(2)
        rc.count()
        rc.count()
        with self.assertRaises(yv.AbortedRun) as ctx:
            rc.count()
        self.assertEqual(ctx.exception.reason, "max_requests_exceeded")


# --------------------------------------------------------------------------- #
# Transport (fake _once — no sockets, ban active)                              #
# --------------------------------------------------------------------------- #

def make_transport(queue, **kw):
    tr = yv.Transport(app_key="test-key", limiter=yv.RateLimiter(0),
                      controller=yv.RunController(kw.pop("max_requests", 1000)),
                      redactor=yv.Redactor(None),
                      sleeper=lambda _s: None,
                      dater=lambda: __import__("datetime").datetime(2026, 11, 2, tzinfo=__import__("datetime").timezone.utc),
                      **kw)
    tr.queue = list(queue)
    tr._once = lambda url: (tr.queue.pop(0) if tr.queue else (200, {}, None))
    return tr


class TestTransport(unittest.TestCase):
    def test_refuses_non_get(self):
        tr = make_transport([])
        for method in ("POST", "PUT", "DELETE", "PATCH", "HEAD"):
            with self.assertRaises(ValueError):
                tr.request("/v1/bibles/9", method=method)

    def test_200_passthrough(self):
        tr = make_transport([(200, {"data": {"id": 9}}, None)])
        status, body = tr.request("/v1/bibles/9")
        self.assertEqual((status, body["data"]["id"]), (200, 9))

    def test_429_honors_retry_after_then_succeeds(self):
        sleeps = []
        tr = make_transport([(429, {}, "2"), (200, {"ok": True}, None)])
        tr._sleep = sleeps.append
        status, body = tr.request("/v1/bibles/9")
        self.assertEqual(status, 200)
        self.assertEqual(sleeps, [2])
        self.assertEqual(tr.retries_429, 1)

    def test_429_exhaustion_aborts(self):
        tr = make_transport([(429, {}, "1")] * 4)
        with self.assertRaises(yv.AbortedRun) as ctx:
            tr.request("/v1/bibles/9")
        self.assertEqual(ctx.exception.reason, "http_429_retries_exhausted")

    def test_429_retry_after_capped(self):
        sleeps = []
        tr = make_transport([(429, {}, "9999"), (200, {}, None)],
                            max_retry_wait=120)
        tr._sleep = sleeps.append
        tr.request("/v1/bibles/9")
        self.assertEqual(sleeps, [120])

    def test_retry_after_http_date(self):
        sleeps = []
        tr = make_transport([(429, {}, "Mon, 02 Nov 2026 00:00:10 GMT"),
                             (200, {}, None)])
        tr._sleep = sleeps.append
        tr.request("/v1/bibles/9")
        self.assertEqual(len(sleeps), 1)
        self.assertGreaterEqual(sleeps[0], 0)

    def test_5xx_bounded_backoff_then_success(self):
        sleeps = []
        tr = make_transport([(500, {}, None), (503, {}, None), (200, {"ok": 1}, None)])
        tr._sleep = sleeps.append
        status, _ = tr.request("/v1/bibles/9")
        self.assertEqual(status, 200)
        self.assertEqual(tr.retries_5xx, 2)

    def test_5xx_exhaustion_aborts(self):
        tr = make_transport([(500, {}, None)] * 4)
        with self.assertRaises(yv.AbortedRun) as ctx:
            tr.request("/v1/bibles/9")
        self.assertEqual(ctx.exception.reason, "http_5xx_retries_exhausted")

    def test_401_immediate_abort_never_retried(self):
        tr = make_transport([(401, {}, None), (200, {}, None)])
        with self.assertRaises(yv.AbortedRun) as ctx:
            tr.request("/v1/bibles/9")
        self.assertEqual(ctx.exception.reason, "http_401_unauthorized")
        self.assertEqual(tr.controller.requests_made, 1)  # no retry

    def test_every_attempt_is_rate_limited_and_counted(self):
        tr = make_transport([(429, {}, "1"), (200, {}, None)])
        tr.request("/v1/bibles/9")
        self.assertEqual(tr.controller.requests_made, 2)  # retry counts too

    def test_audit_trail_stores_urls_only(self):
        tr = make_transport([(200, {}, None)])
        tr.request("/v1/bibles/9")
        self.assertEqual(tr.audit_trail, [tr.build_url("/v1/bibles/9")])
        self.assertTrue(all("X-YVP-App-Key" not in u for u in tr.audit_trail))


# --------------------------------------------------------------------------- #
# Redaction                                                                    #
# --------------------------------------------------------------------------- #

class TestRedactor(unittest.TestCase):
    def test_scrubs_nested_structures(self):
        r = yv.Redactor("SECRET123")
        out = r.scrub({"a": ["x", {"b": "has SECRET123 inside"}], "c": "clean"})
        self.assertEqual(out["a"][1]["b"], "has [REDACTED] inside")
        self.assertEqual(out["c"], "clean")
        self.assertEqual(r.replacements, 1)

    def test_no_secret_noop(self):
        r = yv.Redactor(None)
        self.assertEqual(r.scrub({"a": "b"}), {"a": "b"})

    def test_written_report_self_scan_detects_and_rewrites(self):
        secret = "LEAKYKEY"
        r = yv.Redactor(secret)
        report = {"line_raw": f"preamble {secret} here", "safe": "ok"}
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            # Simulate a scrub bypass — the self-scan is the last line of defense.
            with mock.patch.object(r, "scrub", side_effect=lambda x: x):
                leaks = yv.write_report(path, report, r)
            self.assertGreater(leaks, 0)
            with open(path, encoding="utf-8") as fh:
                content = fh.read()
            self.assertNotIn(secret, content)
            self.assertIn(yv.Redactor.MARKER, content)


# --------------------------------------------------------------------------- #
# Catalogue parsing                                                            #
# --------------------------------------------------------------------------- #

class TestBiblicaParsing(unittest.TestCase):
    def setUp(self):
        # 5 good rows + YOM; stated count 6 (69=68+1 arithmetic in real file)
        self.path = make_temp_catalogue(biblica_fixture(GOOD_ROWS + [YOM_ROW], stated=6))
        self.meta, self.entries, self.problems, self.ids, self.warn = \
            yv.load_catalogue(self.path, yv.PROVIDER_BIBLICA)

    def test_header_detected_line6(self):
        self.assertTrue(self.meta["header_detected"])
        self.assertEqual(self.meta["header_line"], 6)

    def test_stated_count_from_preamble(self):
        self.assertEqual(self.meta["stated_count_in_file"],
                         {"stated": 6, "line": 3})

    def test_counts(self):
        self.assertEqual(self.meta["raw_data_rows"], 6)
        self.assertEqual(len(self.ids), 5)

    def test_count_mismatch_with_arithmetic(self):
        self.assertEqual(len(self.problems["count_mismatch"]), 1)
        self.assertEqual(self.problems["count_mismatch"][0]["arithmetic"],
                         "6 raw = 5 valid + 1 missing_id")

    def test_yom_missing_id_verbatim(self):
        yom = self.problems["missing_id_rows"]
        self.assertEqual(len(yom), 1)
        self.assertEqual(yom[0]["row"], 6)
        self.assertEqual(yom[0]["line"], 12)  # header line 6 + row 6
        self.assertEqual(yom[0]["abbreviation_raw"], "YOM")
        self.assertEqual(yom[0]["name_raw"], "Kiyombe New Testament with Psalms")

    def test_sha256_computed(self):
        import hashlib
        with open(self.path, "rb") as fh:
            self.assertEqual(self.meta["sha256"], hashlib.sha256(fh.read()).hexdigest())

    def test_duplicate_abbreviations_warning_only(self):
        path = make_temp_catalogue(biblica_fixture(
            GOOD_ROWS + [("APD", "Another Point Duplicate", "999"), YOM_ROW], stated=7))
        meta, entries, problems, ids, warn = yv.load_catalogue(path, yv.PROVIDER_BIBLICA)
        self.assertTrue(any(w["code"] == "duplicate_abbreviations" for w in warn))
        self.assertEqual(problems["duplicate_ids"], {})  # IDs still unique

    def test_duplicate_ids_are_a_problem(self):
        path = make_temp_catalogue(biblica_fixture(
            [("A", "Alpha", "10"), ("B", "Beta", "10"), YOM_ROW], stated=3))
        meta, entries, problems, ids, warn = yv.load_catalogue(path, yv.PROVIDER_BIBLICA)
        self.assertEqual(problems["duplicate_ids"], {"10": [1, 2]})
        self.assertEqual(len(ids), 1)

    def test_non_numeric_id_row(self):
        path = make_temp_catalogue(biblica_fixture(
            [("A", "Alpha", "XYZ"), YOM_ROW], stated=2))
        meta, entries, problems, ids, warn = yv.load_catalogue(path, yv.PROVIDER_BIBLICA)
        # 'XYZ' is a non-numeric ID token — its own problem class, never coerced
        self.assertEqual(len(problems["non_numeric_ids"]), 1)
        self.assertEqual(len(problems["missing_id_rows"]), 1)  # YOM only
        self.assertEqual(len(ids), 0)

    def test_sil_rows_flagged(self):
        path = make_temp_catalogue(biblica_fixture(
            [("SILX", "SIL International Publication", "55"), YOM_ROW], stated=2))
        meta, entries, problems, ids, warn = yv.load_catalogue(path, yv.PROVIDER_BIBLICA)
        self.assertEqual(len(problems["sil_flagged_rows"]), 1)

    def test_missing_header_is_malformed(self):
        path = make_temp_catalogue("no header here\njust junk\n")
        meta, entries, problems, ids, warn = yv.load_catalogue(path, yv.PROVIDER_BIBLICA)
        self.assertFalse(meta["header_detected"])
        self.assertEqual(len(problems["malformed_rows"]), 1)


class TestWycliffeParsing(unittest.TestCase):
    def test_clean_list_valid(self):
        path = make_temp_catalogue(wycliffe_fixture(
            [("AABV", "Ayta Ambala NT Portions", "3952"),
             ("aai", "Miniafia Oyan New Testament", "407"),
             ("zyp", "Chin, Zyphe NT", "930")], stated=3))
        meta, entries, problems, ids, warn = yv.load_catalogue(path, yv.PROVIDER_WYCLIFFE)
        self.assertEqual(len(ids), 3)
        self.assertEqual(meta["stated_count_in_file"]["stated"], 3)
        self.assertEqual(problems["count_mismatch"], [])

    def test_duplicate_abbreviations_warning_only(self):
        path = make_temp_catalogue(wycliffe_fixture(
            [("ABP", "Ayta Abellen NT", "2466"),
             ("abp", "Same Abbrev Lower Case", "981"),
             ("zyp", "Chin, Zyphe NT", "930")], stated=3))
        meta, entries, problems, ids, warn = yv.load_catalogue(path, yv.PROVIDER_WYCLIFFE)
        self.assertTrue(any(w["code"] == "duplicate_abbreviations" and w["groups"] == 1
                            for w in warn))
        self.assertEqual(len(ids), 3)  # IDs are the key — all still valid


class TestListsState(unittest.TestCase):
    def test_biblica_invalid_yom_wycliffe_valid(self):
        bib, wyc = healthy_pair()
        state, overlap, b_ids, w_ids, prov = load_pair(bib, wyc)
        self.assertFalse(state["biblica"]["valid"])
        self.assertTrue(state["wycliffe"]["valid"])
        self.assertFalse(state["biblica"]["count_matches_owner_statement"])
        self.assertTrue(state["wycliffe"]["count_matches_owner_statement"])

    def test_provisional_eligible_exact_single_yom(self):
        bib, wyc = healthy_pair()
        state, overlap, b_ids, w_ids, prov = load_pair(bib, wyc)
        self.assertTrue(prov["eligible"])
        self.assertEqual(prov["valid_ids_count"], 5)
        self.assertIn("YOM", prov["defect"])

    def test_f1_second_missing_id_disables(self):
        bib = make_temp_catalogue(biblica_fixture(
            GOOD_ROWS + [YOM_ROW, ("XOM", "Another No-ID Row", None)], stated=7))
        wyc = make_temp_catalogue(wycliffe_fixture(
            [("AABV", "Ayta Ambala NT Portions", "3952")], stated=1))
        state, overlap, b_ids, w_ids, prov = load_pair(bib, wyc)
        self.assertFalse(prov["eligible"])

    def test_f2_duplicate_id_disables(self):
        bib = make_temp_catalogue(biblica_fixture(
            [("A", "Alpha", "10"), ("B", "Beta", "10"), YOM_ROW], stated=3))
        wyc = make_temp_catalogue(wycliffe_fixture(
            [("AABV", "Ayta Ambala NT Portions", "3952")], stated=1))
        state, overlap, b_ids, w_ids, prov = load_pair(bib, wyc)
        self.assertFalse(prov["eligible"])

    def test_f3_overlap_invalidates_both(self):
        bib, wyc = healthy_pair()
        # Add a Wycliffe row carrying a Biblica ID (1628)
        wyc2 = make_temp_catalogue(wycliffe_fixture(
            [("HCV", "Hindi Contemporaneous Version", "1628"),
             ("AABV", "Ayta Ambala NT Portions", "3952")], stated=2))
        state, overlap, b_ids, w_ids, prov = load_pair(bib, wyc2)
        self.assertEqual(overlap, [1628])
        self.assertFalse(state["biblica"]["valid"])
        self.assertFalse(state["wycliffe"]["valid"])
        self.assertFalse(prov["eligible"])

    def test_f4_wycliffe_invalid_disables(self):
        bib = make_temp_catalogue(biblica_fixture(GOOD_ROWS + [YOM_ROW], stated=6))
        wyc = make_temp_catalogue(wycliffe_fixture(
            [("AABV", "Ayta Ambala NT Portions", "3952")], stated=3))  # 1≠3 count
        state, overlap, b_ids, w_ids, prov = load_pair(bib, wyc)
        self.assertFalse(state["wycliffe"]["valid"])
        self.assertFalse(prov["eligible"])


# --------------------------------------------------------------------------- #
# Attribution classification + S2 assessments                                  #
# --------------------------------------------------------------------------- #

class TestClassification(unittest.TestCase):
    def test_sil_wins(self):
        provider, flags = yv.classify_attribution(
            "Biblica", [{"organization_name": "SIL International"}])
        self.assertEqual(provider, "sil")
        self.assertIn("sil_attribution", flags)

    def test_biblica_mapping(self):
        provider, _ = yv.classify_attribution("Biblica", [])
        self.assertEqual(provider, "biblica")

    def test_wycliffe_mapping(self):
        provider, _ = yv.classify_attribution("Wycliffe Bible Translators", [])
        self.assertEqual(provider, "wycliffe")

    def test_pending_review_orgs(self):
        for org in ("Public Domain", "Creative Commons", "Lockman Foundation"):
            provider, flags = yv.classify_attribution(org, [])
            self.assertEqual(provider, "pending_review")
            self.assertIn("provider_pending_owner_review", flags)

    def test_unknown(self):
        provider, _ = yv.classify_attribution("Mystery Org", [])
        self.assertEqual(provider, "unknown")


class TestAssessments(unittest.TestCase):
    def test_terms_present_owner_review(self):
        rows = yv.assess_licence_restrictions([dict(AGREED_LIC, terms_present=True)], True)
        self.assertEqual(rows[0]["assessment"], "terms_saved_owner_review")
        self.assertFalse(rows[0]["permission_to_serve_implied"])

    def test_terms_missing_fail_closed(self):
        rows = yv.assess_licence_restrictions([dict(NO_TERMS_LIC, terms_present=False)], True)
        self.assertEqual(rows[0]["assessment"], "terms_missing_fail_closed")
        self.assertFalse(rows[0]["permission_to_serve_implied"])

    def test_no_licence_step_evidence_unavailable(self):
        rows = yv.assess_licence_restrictions([], False)
        self.assertEqual(rows[0]["assessment"], "evidence_unavailable_fail_closed")
        self.assertFalse(rows[0]["permission_to_serve_implied"])


# --------------------------------------------------------------------------- #
# Verdict engine — plan §6.4 cases + G5 fix (blocker B1)                       #
# --------------------------------------------------------------------------- #

def decided(bib, wyc, edition_id="1628", status=200, basis=None,
            organization="Biblica", records=None, has_step=True):
    basis = basis or (yv.TIER_A_DETAIL_200 if status == 200 else yv.TIER_A_LISTED)
    records = [AGREED_LIC] if records is None else records
    state, overlap, b_ids, w_ids, prov = load_pair(bib, wyc)
    rec = yv.decide_bible_state(edition_id, status, basis, organization,
                                records, has_step, state, prov, b_ids)
    return rec, state, prov


class TestDecideBibleState(unittest.TestCase):
    def setUp(self):
        self.bib, self.wyc = healthy_pair()

    def test_1_provisional_happy_path(self):
        rec, state, prov = decided(self.bib, self.wyc)
        self.assertEqual(rec["verdict"], yv.V_PROVISIONAL)
        self.assertIn("biblica_catalogue_provisional", rec["flags"])
        self.assertEqual(rec["verdict_scope"], "verifier_report_internal_only")
        self.assertEqual(rec["serving_permission"], "none")
        self.assertFalse(state["biblica"]["valid"])  # audit_status stays incomplete

    def test_2_g5_terms_missing_blocks_provisional(self):
        rec, _, _ = decided(self.bib, self.wyc, records=[dict(NO_TERMS_LIC, terms_present=False)])
        self.assertEqual(rec["verdict"], yv.V_REVIEW_REQUIRED)
        self.assertIn("licence_terms_unclear", rec["flags"])
        self.assertNotIn("biblica_catalogue_provisional", rec["flags"])

    def test_3a_approved_path_requires_terms(self):
        # Simulate BOTH lists valid (the hypothetical resolved-YOM world).
        state, overlap, b_ids, w_ids, prov = load_pair(self.bib, self.wyc)
        state["biblica"]["valid"] = True   # hypothetical resolved-YOM world
        state["wycliffe"]["valid"] = True
        rec = yv.decide_bible_state("1628", 200, yv.TIER_A_DETAIL_200, "Biblica",
                                    [dict(AGREED_LIC, terms_present=True)], True,
                                    state, prov, b_ids)
        self.assertEqual(rec["verdict"], yv.V_APPROVED)

    def test_3b_g5_blocks_approved_when_terms_missing(self):
        state, overlap, b_ids, w_ids, prov = load_pair(self.bib, self.wyc)
        state["biblica"]["valid"] = True
        state["wycliffe"]["valid"] = True
        rec = yv.decide_bible_state("1628", 200, yv.TIER_A_DETAIL_200, "Biblica",
                                    [dict(NO_TERMS_LIC, terms_present=False)], True,
                                    state, prov, b_ids)
        self.assertEqual(rec["verdict"], yv.V_REVIEW_REQUIRED)
        self.assertIn("licence_terms_unclear", rec["flags"])

    def test_4_id_not_in_supplied_list(self):
        rec, _, _ = decided(self.bib, self.wyc, edition_id="8888")
        self.assertEqual(rec["verdict"], yv.V_REVIEW_REQUIRED)
        self.assertIn("not_in_supplied_provider_list", rec["flags"])

    def test_10_wycliffe_edition_never_provisional(self):
        rec, _, _ = decided(self.bib, self.wyc, organization="Wycliffe Bible Translators",
                            records=[dict(AGREED_LIC,
                                          organization_name="Wycliffe Bible Translators")])
        self.assertEqual(rec["verdict"], yv.V_REVIEW_REQUIRED)
        self.assertNotIn("biblica_catalogue_provisional", rec["flags"])

    def test_11_sil_wins_even_when_provisional_eligible(self):
        rec, _, _ = decided(self.bib, self.wyc,
                            organization="SIL International Publications")
        self.assertEqual(rec["verdict"], yv.V_SIL_EXCLUDED)

    def test_12_non200_detail_with_licence(self):
        rec, _, _ = decided(self.bib, self.wyc, status=404)
        self.assertEqual(rec["verdict"], yv.V_NOT_ACCESSIBLE)

    def test_13_accessible_licence_unverified(self):
        rec, _, _ = decided(self.bib, self.wyc, records=[])
        self.assertEqual(rec["verdict"], yv.V_LICENCE_UNVERIFIED)

    def test_14_not_accessible_not_licensed(self):
        rec, _, _ = decided(self.bib, self.wyc, status=500, records=[])
        self.assertEqual(rec["verdict"], yv.V_NOT_LICENCED)

    def test_15_conflicting_attribution_manual_review(self):
        rec, _, _ = decided(self.bib, self.wyc,
                            records=[dict(AGREED_LIC,
                                          organization_name="Wycliffe Bible Translators")])
        self.assertEqual(rec["verdict"], yv.V_REVIEW)
        self.assertIn("conflicting_attribution", rec["flags"])

    def test_16_pending_review_org_never_approved(self):
        state, overlap, b_ids, w_ids, prov = load_pair(self.bib, self.wyc)
        state["biblica"]["valid"] = True
        state["wycliffe"]["valid"] = True
        rec = yv.decide_bible_state("1628", 200, yv.TIER_A_DETAIL_200,
                                    "Lockman Foundation",
                                    [dict(AGREED_LIC,
                                          organization_name="Lockman Foundation")],
                                    True, state, prov, b_ids)
        self.assertEqual(rec["verdict"], yv.V_PROVIDER_UNKNOWN)

    def test_17_every_record_carries_serving_permission_none(self):
        for kwargs in ({}, {"status": 404}, {"records": []}):
            rec, _, _ = decided(self.bib, self.wyc, **kwargs)
            self.assertEqual(rec["serving_permission"], "none")
            for row in rec["licence_restriction_assessment"]:
                self.assertFalse(row["permission_to_serve_implied"])


# --------------------------------------------------------------------------- #
# Key handling (env-only; --app-key refused; missing key → exit 2, 0 calls)    #
# --------------------------------------------------------------------------- #

class TestKeyHandling(unittest.TestCase):
    def test_app_key_cli_arg_refused_exit2(self):
        rc = yv.main(["--app-key", "SHOULD-NOT-BE-USED", "--ids", "9"])
        self.assertEqual(rc, yv.EXIT_ARGS_OR_KEY)

    def test_api_mode_without_key_exit2_zero_calls(self):
        env = {k: v for k, v in os.environ.items() if k != "YOUVERSION_APP_KEY"}
        with mock.patch.dict(os.environ, env, clear=True):
            bib, wyc = healthy_pair()
            rc = yv.main(["--ids", "1628", "--biblica-catalogue", bib,
                          "--wycliffe-catalogue", wyc, "--out",
                          os.path.join(tempfile.gettempdir(), "nokey.json")])
        self.assertEqual(rc, yv.EXIT_ARGS_OR_KEY)

    def test_key_goes_to_header_only_never_url(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            captured["headers"] = {k.title(): v for k, v in req.header_items()}
            raise AssertionError("this fake must not be reached in offline suite")

        # We do NOT call the real network path in tests; instead assert on the
        # request-construction logic by calling _once with urlopen patched to a
        # recorder that returns a canned response via a stubbed context manager.
        class FakeRes:
            status = 200
            headers = {}

            def read(self):
                return b'{"data": {}}'

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def recorder(req, timeout=None):
            captured["url"] = req.full_url
            captured["headers"] = {k.title(): v for k, v in req.header_items()}
            return FakeRes()

        with mock.patch.object(yv.urllib.request, "urlopen", recorder):
            tr = yv.Transport(app_key="ENVONLYKEY", limiter=yv.RateLimiter(0),
                              controller=yv.RunController(10), redactor=yv.Redactor(None))
            tr.request("/v1/bibles/9")
        self.assertEqual(captured["headers"].get("X-Yvp-App-Key"), "ENVONLYKEY")
        self.assertNotIn("ENVONLYKEY", captured["url"])

    def test_report_key_handling_block(self):
        block = yv._key_handling_block(True)
        self.assertEqual(block["source"], "environment_only")
        self.assertEqual(block["cli_app_key_arg"], "refused_exit_2")
        self.assertFalse(block["in_url"])
        self.assertFalse(block["exposed_in_report"])


# --------------------------------------------------------------------------- #
# Offline validation end-to-end (main-level, exit codes)                       #
# --------------------------------------------------------------------------- #

class TestOfflineValidation(unittest.TestCase):
    def test_end_to_end_exit0_report_contents(self):
        bib, wyc = healthy_pair()
        out = os.path.join(tempfile.mkdtemp(), "offline-report.json")
        env = {k: v for k, v in os.environ.items() if k != "YOUVERSION_APP_KEY"}
        with mock.patch.dict(os.environ, env, clear=True):
            rc = yv.main(["--biblica-catalogue", bib, "--wycliffe-catalogue", wyc,
                          "--out", out])
        self.assertEqual(rc, yv.EXIT_OK)
        with open(out, encoding="utf-8") as fh:
            report = json.load(fh)
        self.assertEqual(report["tool_version"], "2.5.0-reconstructed")
        self.assertTrue(report["read_only"])
        self.assertTrue(report["offline"])
        self.assertEqual(report["api_requests_made"], 0)
        self.assertEqual(report["audit_status"], "provider_lists_incomplete")
        self.assertEqual(report["c11_gate"]["state"], "CLOSED")
        self.assertTrue(report["biblica_provisional_mode"]["enabled"])
        self.assertTrue(report["safeguards"]["serving_permission_hardcoded_none"])
        self.assertEqual(report["unresolved_missing_id"][0]["abbreviation_raw"], "YOM")
        self.assertIn("P1 API verification has NOT run",
                      " ".join(report["limitations"]))

    def test_missing_files_exit2(self):
        rc = yv.main(["--biblica-catalogue", "/nonexistent/b.txt",
                      "--wycliffe-catalogue", "/nonexistent/w.txt", "--out",
                      os.path.join(tempfile.gettempdir(), "x.json")])
        self.assertEqual(rc, yv.EXIT_ARGS_OR_KEY)

    def test_no_args_usage_exit2(self):
        rc = yv.main([])
        self.assertEqual(rc, yv.EXIT_ARGS_OR_KEY)

    def test_key_leak_self_scan_exit4_and_redacted(self):
        # The self-scan is the LAST line of defense: even if scrubbing were
        # bypassed entirely, the written report is re-read and any surviving
        # key occurrence is rewritten + the run exits 4.
        secret = "TOPSECRETKEY42"
        text = biblica_fixture(GOOD_ROWS + [YOM_ROW], stated=6)
        text = text.replace("Search by name, abbreviation, or ID",
                            f"Search by name, abbreviation, or ID {secret}")
        bib = make_temp_catalogue(text)
        _, wyc = healthy_pair()

        class NoScrubRedactor(yv.Redactor):
            def scrub(self, obj):
                return obj  # deliberately bypassed — self-scan must catch it

        out = os.path.join(tempfile.mkdtemp(), "leak.json")
        env = dict(os.environ, YOUVERSION_APP_KEY=secret)
        with mock.patch.dict(os.environ, env, clear=True):
            with mock.patch.object(yv, "Redactor", NoScrubRedactor):
                rc = yv.main(["--biblica-catalogue", bib,
                              "--wycliffe-catalogue", wyc, "--out", out])
        self.assertEqual(rc, yv.EXIT_KEY_LEAK)
        with open(out, encoding="utf-8") as fh:
            content = fh.read()
        self.assertNotIn(secret, content)
        self.assertIn(yv.Redactor.MARKER, content)


# --------------------------------------------------------------------------- #
# P1 runner: budget abort + abort marking (fake transport, zero network)       #
# --------------------------------------------------------------------------- #

class NoSleepTransport(yv.Transport):
    """Transport whose sockets never open and whose sleeps never sleep."""

    injected_queue = []  # set per-test; consumed by _once

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("sleeper", lambda _s: None)
        super().__init__(*args, **kwargs)
        self.urls = []

    def _once(self, url):
        self.urls.append(url)
        if NoSleepTransport.injected_queue:
            return NoSleepTransport.injected_queue.pop(0)
        if "/v1/bibles/" in url:
            return 200, {"data": {"id": 0, "title": "Test Edition",
                                  "organization": "Biblica",
                                  "language_tag": "hi"}}, None
        return 200, {"data": [{"id": "LIC-1", "name": "Biblica Open Licence",
                               "organization_name": "Biblica",
                               "agreed_dt": "2026-10-01T00:00:00Z",
                               "terms_html": "<p>terms</p>",
                               "attribution_html": "<p>attr</p>"}]}, None


class TestP1RunnerAborts(unittest.TestCase):
    def _run(self, max_requests, queue, ids="1628,2412"):
        bib, wyc = healthy_pair()
        out = os.path.join(tempfile.mkdtemp(), "p1.json")
        args = yv.build_parser().parse_args([
            "--ids", ids, "--biblica-catalogue", bib, "--wycliffe-catalogue", wyc,
            "--skip-seeds", "--min-interval", "0", "--max-requests", str(max_requests),
            "--out", out])
        secret = "K"
        NoSleepTransport.injected_queue = list(queue)
        with mock.patch.dict(os.environ, {"YOUVERSION_APP_KEY": secret}, clear=False):
            with mock.patch.object(yv, "Transport", NoSleepTransport):
                report = yv.run_p1(args, secret, yv.Redactor(secret))
        return report, out

    def test_budget_breach_marks_report_aborted(self):
        # seed skipped; 2 ids × 2 requests = 4 needed; cap at 3 → abort
        report, _ = self._run(3, [])
        self.assertTrue(report["abort"]["aborted"])
        self.assertEqual(report["abort"]["abort_reason"], "max_requests_exceeded")
        self.assertLess(len(report["steps"]["ids"]), 2)  # partial evidence retained

    def test_401_during_run_aborts_safely(self):
        report, _ = self._run(50, [(401, {}, None)])
        self.assertTrue(report["abort"]["aborted"])
        self.assertEqual(report["abort"]["abort_reason"], "http_401_unauthorized")

    def test_seed_counts_against_budget(self):
        bib, wyc = healthy_pair()
        out = os.path.join(tempfile.mkdtemp(), "p1b.json")
        args = yv.build_parser().parse_args([
            "--ids", "1628", "--biblica-catalogue", bib, "--wycliffe-catalogue", wyc,
            "--min-interval", "0", "--max-requests", "1", "--out", out])
        secret = "K"
        with mock.patch.dict(os.environ, {"YOUVERSION_APP_KEY": secret}, clear=False):
            with mock.patch.object(yv, "Transport", NoSleepTransport):
                report = yv.run_p1(args, secret, yv.Redactor(secret))
        # Seed consumes the whole budget of 1 → abort before any probe
        self.assertTrue(report["abort"]["aborted"])
        self.assertEqual(report["steps"]["ids"], [])

    def test_source_conflict_exit2_for_ids_outside_68(self):
        bib, wyc = healthy_pair()
        args = yv.build_parser().parse_args([
            "--ids", "1628,99999999", "--biblica-catalogue", bib,
            "--wycliffe-catalogue", wyc, "--skip-seeds"])
        secret = "K"
        with self.assertRaises(yv.SystemExit2):
            with mock.patch.dict(os.environ, {"YOUVERSION_APP_KEY": secret}, clear=False):
                yv.run_p1(args, secret, yv.Redactor(secret))

    def test_happy_p1_path_provisional_verdicts(self):
        report, _ = self._run(200, [])
        self.assertFalse(report["abort"]["aborted"])
        self.assertEqual(report["api_requests_made"], 4)  # 2 ids × 2 requests
        self.assertEqual(report["audit_status"], "provider_lists_incomplete")
        verdicts = {r["verdict"] for r in report["steps"]["ids"]}
        self.assertEqual(verdicts, {yv.V_PROVISIONAL})
        for rec in report["steps"]["ids"]:
            self.assertEqual(rec["serving_permission"], "none")
            self.assertEqual(rec["verdict_scope"], "verifier_report_internal_only")


# --------------------------------------------------------------------------- #
# Licence-term artifacts                                                       #
# --------------------------------------------------------------------------- #

class TestLicenceArtifacts(unittest.TestCase):
    def test_terms_present_iff_field_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            recs = [dict(AGREED_LIC), dict(NO_TERMS_LIC)]
            written = yv.write_licence_terms(tmp, "1628", recs, yv.Redactor(None))
            self.assertEqual(recs[0]["terms_present"], True)
            self.assertEqual(recs[1]["terms_present"], False)
            self.assertTrue(any("terms_html.html" in p for p in written))

    def test_artifacts_are_redacted(self):
        with tempfile.TemporaryDirectory() as tmp:
            recs = [dict(AGREED_LIC, terms_html="secret SECRETVALUE here")]
            yv.write_licence_terms(tmp, "9", recs, yv.Redactor("SECRETVALUE"))
            with open(os.path.join(tmp, "9", "licence-LIC-1.json"), encoding="utf-8") as fh:
                self.assertNotIn("SECRETVALUE", fh.read())


# --------------------------------------------------------------------------- #
# Optional integration: REAL supplier catalogues (skipped unless supplied)     #
# --------------------------------------------------------------------------- #

REAL_DIR = os.environ.get("KOINO_REAL_CATALOGUES", "")
REAL_BIBLICA = os.path.join(REAL_DIR, "Biblica Fast-track Bible License - v1.txt")
REAL_WYCLIFFE = os.path.join(REAL_DIR, "Wycliffe Fast-track Bible License - v1.txt")
REAL_IDS = os.environ.get("KOINO_REAL_IDS", "")


@unittest.skipUnless(os.path.exists(REAL_BIBLICA) and os.path.exists(REAL_WYCLIFFE),
                     "real supplier catalogues not supplied (offline-only run)")
class TestRealCatalogues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bib = yv.load_catalogue(REAL_BIBLICA, yv.PROVIDER_BIBLICA)
        cls.wyc = yv.load_catalogue(REAL_WYCLIFFE, yv.PROVIDER_WYCLIFFE)
        cls.state, cls.overlap, cls.b_ids, cls.w_ids = yv.build_lists_state(cls.bib, cls.wyc)
        cls.prov = yv.evaluate_biblica_provisional(cls.state, cls.overlap)

    def test_biblica_68_valid_plus_yom_row69_line75(self):
        meta, entries, problems, ids, warn = self.bib
        self.assertEqual(meta["raw_data_rows"], 69)
        self.assertEqual(len(ids), 68)
        yom = problems["missing_id_rows"]
        self.assertEqual(len(yom), 1)
        self.assertEqual(yom[0], {"row": 69, "line": 75,
                                  "abbreviation_raw": "YOM",
                                  "name_raw": "Kiyombe New Testament with Psalms"})

    def test_ids_match_biblica68_file(self):
        if not REAL_IDS or not os.path.exists(REAL_IDS):
            self.skipTest("biblica68-ids.txt not supplied")
        expected = sorted(int(x) for x in open(REAL_IDS).read().split(",") if x.strip())
        self.assertEqual(sorted(self.b_ids), expected)

    def test_wycliffe_1037_valid(self):
        meta, entries, problems, ids, warn = self.wyc
        self.assertEqual(len(ids), 1037)
        self.assertTrue(self.state["wycliffe"]["valid"])

    def test_no_overlap_and_provisional_eligible(self):
        self.assertEqual(self.overlap, [])
        self.assertTrue(self.prov["eligible"])

    def test_hashes_match_recorded_references(self):
        self.assertEqual(self.bib[0]["sha256"],
                         "25ce029bacc4910e30d2fe8b9958d0367bdd086e898ddbeb03a73e9aa668173f")
        self.assertEqual(self.wyc[0]["sha256"],
                         "75f7f691701f8cbefd392faa5b73ae3d68df4486a8753f56e19321b2d5de7bb4")


if __name__ == "__main__":
    unittest.main()
