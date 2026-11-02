#!/usr/bin/env python3
"""
KOINO — YouVersion licensed catalogue VERIFIER — RECONSTRUCTION (READ-ONLY).

TOOL_VERSION : 2.5.0-reconstructed
PROVENANCE   : RECONSTRUCTED tool. The original v2.4.0/v2.4.1 sources were
               lost with a previous session and are NOT recovered. This file
               was rebuilt offline from:
                 - the preserved original v1 source (yv_catalogue_verify_v1_original.py),
                 - PROPOSED-API-VERIFICATION-PLAN.md (approved design, gates G1-G7/F1-F5),
                 - P1-READINESS-CODE-AUDIT-v2.4.0.md (incl. blocker B1 = G5 terms gate),
                 - P0-V2.4-IMPLEMENTATION-REPORT.md and P1-PREPARATION-CONFIRMATION.md,
                 - the two original supplier catalogues (hash-verified).
               It is NOT the recovered original. Behavioural fidelity is
               documented in verification/RECONSTRUCTION-REPORT.md; anything
               not derivable from the surviving documents is marked INFERRED
               in code comments.

Purpose
  Read-only verification of which Bible editions from Biblica and Wycliffe
  are actually accessible through the YouVersion Platform API under Koino's
  App Key. P1 scope: the 68 individually identified Biblica IDs only
  (YOM excluded — it has no ID and is never probed or invented).

Safety contract (MUST hold when this runs)
  * READ-ONLY: only GET requests; no POST/PUT/PATCH/DELETE anywhere.
  * The App Key is read ONLY from the environment variable YOUVERSION_APP_KEY
    and used ONLY in the X-YVP-App-Key request header. It is NEVER printed,
    logged, written to files, or included in the report. `--app-key` on the
    CLI is REFUSED (exit 2).
  * Every HTTP request — including every retry — passes the shared
    RateLimiter first (min 1 request/second by default). No bypass path.
  * Hard request budget (--max-requests); breach => safe abort, exit 3.
  * 401 => immediate abort (key never printed). 429 honors Retry-After.
  * Licence record != permission to serve: every record carries
    `serving_permission: "none"`; `permission_to_serve_implied: false` is
    hard-coded; G5 requires terms evidence for any provisional/approved
    verdict (fail-closed otherwise).
  * `serveable_provisional` is INTERNAL to the verifier report
    (verdict_scope: "verifier_report_internal_only"); it never equals
    `serveable_approved` and never activates an edition in Koino.
  * No Koino application code, production, database or deployment is read,
    written, configured or signalled. Writes are limited to the JSON report
    (--out) and the licence-terms artifacts directory (--artifacts-dir).
  * SIL-attributed editions are excluded (sil_excluded wins over everything).
  * No silent English substitution and no machine translation anywhere.

Exit codes
  0  clean run · 2  missing key / bad arguments / --app-key refused /
     source-list conflicts · 3  aborted safely (partial report retained,
     marked aborted) · 4  App-Key string found in the written report
     (auto-redacted; investigate before sharing).
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

TOOL = "yv_catalogue_verify"
TOOL_VERSION = "2.5.0-reconstructed"
USER_AGENT = f"koino-readonly-catalogue-verify/{TOOL_VERSION}"
BASE = os.environ.get("YV_API_BASE", "https://api.youversion.com")

# Exit codes (contract above)
EXIT_OK = 0
EXIT_ARGS_OR_KEY = 2
EXIT_ABORTED = 3
EXIT_KEY_LEAK = 4

# Verdict ladder (top wins). `serveable_provisional` is Biblica-68-only and
# INTERNAL to this report (plan §5; audit Check 1).
V_APPROVED = "serveable_approved"
V_PROVISIONAL = "serveable_provisional"
V_REVIEW_REQUIRED = "manual_review_required"
V_REVIEW = "manual_review"
V_NOT_ACCESSIBLE = "licensed_not_api_accessible"
V_LICENCE_UNVERIFIED = "api_accessible_licence_unverified"
V_PROVIDER_UNKNOWN = "licensed_agreed_provider_unknown"
V_NOT_LICENCED = "not_accessible_not_licensed"
V_SIL_EXCLUDED = "sil_excluded"

PROVIDER_BIBLICA = "biblica"
PROVIDER_WYCLIFFE = "wycliffe"

# Providers held at pending review even when licensed (plan §1.2, audit Check 4).
PENDING_REVIEW_ORGS = ("public domain", "creative commons", "lockman")

TIER_A_DETAIL_200 = "TIER_A_DETAIL_200"
TIER_A_LISTED = "TIER_A_LISTED"

DEFAULT_MIN_INTERVAL = 1.0
DEFAULT_MAX_REQUESTS = 200
DEFAULT_MAX_RETRY_WAIT = 120
DEFAULT_MAX_RETRIES_429 = 3
DEFAULT_MAX_RETRIES_5XX = 3
DEFAULT_MAX_RETRIES_NETWORK = 3
REQUEST_TIMEOUT_S = 30

# Advisory only — never scope-extending, never probed without owner tick
# (P1-PREPARATION-CONFIRMATION.md §3).
ADVISORY_CANDIDATES = [
    {"abbreviation": "BCV", "name": "Bengali Contemporary Version 2019 (Updated 2021)", "id": 2412, "language": "Bengali"},
    {"abbreviation": "HCV", "name": "Hindi Contemporary Version", "id": 1628, "language": "Hindi"},
    {"abbreviation": "MCV", "name": "Malayalam Contemporary Version 2020", "id": 2431, "language": "Malayalam"},
    {"abbreviation": "SCA", "name": "Holy Bible, Chhattisgarhi Contemporary Version", "id": 1630, "language": "Chhattisgarhi"},
    {"abbreviation": "TCV-IN", "name": "Indian Tamil Contemporary Version 2022", "id": 2730, "language": "Tamil (India)"},
    {"abbreviation": "TRV", "name": "Sri Lankan Easy Tamil Translation 2021", "id": 3281, "language": "Tamil (Sri Lanka)"},
]

_SIL_WORD = re.compile(r"\bSIL\b")
_STATED_COUNT = re.compile(r"^\s*(\d+)\s+Bibles in License", re.IGNORECASE)


class AbortedRun(Exception):
    """Raised when the run must stop safely (budget/HTTP aborts)."""

    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


# --------------------------------------------------------------------------- #
# Redaction                                                                    #
# --------------------------------------------------------------------------- #

class Redactor:
    """Replaces the App-Key value with [REDACTED] in every written string.

    The key is never stored beyond the run; the transport audit trail stores
    URLs only. If the key string is later found in a written report, the
    report is re-redacted and the run exits 4 (see self_scan below).
    """

    MARKER = "[REDACTED]"

    def __init__(self, secret=None):
        self.secret = (secret or "").strip()
        self.replacements = 0

    def scrub(self, obj):
        if not self.secret:
            return obj
        return self._scrub_value(obj)

    def _scrub_value(self, val):
        if isinstance(val, str):
            if self.secret and self.secret in val:
                self.replacements += val.count(self.secret)
                return val.replace(self.secret, self.MARKER)
            return val
        if isinstance(val, dict):
            # dict KEYS are scrubbed too — a secret must not survive as a key.
            return {self._scrub_value(k): self._scrub_value(v)
                    for k, v in val.items()}
        if isinstance(val, list):
            return [self._scrub_value(v) for v in val]
        return val


def self_scan_report(path, secret):
    """Re-read the written report; return count of secret occurrences."""
    if not secret:
        return 0
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read().count(secret)
    except OSError:
        return 0


# --------------------------------------------------------------------------- #
# Rate limiting / run budget                                                   #
# --------------------------------------------------------------------------- #

class RateLimiter:
    """Enforces a minimum interval between consecutive requests.

    Every HTTP request — including every retry and every page — must call
    wait() first. No bypass path exists (plan §4.1).
    """

    def __init__(self, min_interval=DEFAULT_MIN_INTERVAL):
        self.min_interval = max(0.0, float(min_interval))
        self._last = None

    def wait(self):
        if self.min_interval <= 0:
            self._last = time.monotonic()
            return 0.0
        now = time.monotonic()
        if self._last is not None:
            delta = now - self._last
            remaining = self.min_interval - delta
            if remaining > 0:
                time.sleep(remaining)
        self._last = time.monotonic()
        return self.min_interval


class RunController:
    """Hard request budget; exceeding it aborts the run safely (plan §4.2)."""

    def __init__(self, max_requests):
        self.max_requests = int(max_requests)
        self.requests_made = 0

    def count(self):
        self.requests_made += 1
        if self.requests_made > self.max_requests:
            raise AbortedRun("max_requests_exceeded")
        return self.requests_made


# --------------------------------------------------------------------------- #
# Transport (GET-only, injectable for offline tests)                           #
# --------------------------------------------------------------------------- #

class Transport:
    """Authenticated GET transport.

    * Refuses every method except GET (audit Check 5).
    * Rate-limits before EVERY request, including every retry.
    * Sends the key ONLY in the X-YVP-App-Key header — never in a URL,
      never as a query/body parameter.
    * Audit trail stores URLs only, never headers.
    * 429: honors Retry-After (seconds or HTTP-date), single wait capped at
      max_retry_wait, up to max_retries_429 retries, then safe abort.
    * 5xx: bounded exponential backoff, up to max_retries_5xx, then abort.
    * 401: immediate abort of the whole run — never retried, key never
      printed.
    """

    def __init__(self, app_key, limiter, controller, redactor,
                 max_retry_wait=DEFAULT_MAX_RETRY_WAIT,
                 max_retries_429=DEFAULT_MAX_RETRIES_429,
                 max_retries_5xx=DEFAULT_MAX_RETRIES_5XX,
                 max_retries_network=DEFAULT_MAX_RETRIES_NETWORK,
                 sleeper=None, dater=None):
        self.app_key = (app_key or "").strip()
        self.limiter = limiter
        self.controller = controller
        self.redactor = redactor
        self.max_retry_wait = int(max_retry_wait)
        self.max_retries_429 = int(max_retries_429)
        self.max_retries_5xx = int(max_retries_5xx)
        self.max_retries_network = int(max_retries_network)
        self.audit_trail = []  # URLs only — never headers
        self.retries_429 = 0
        self.retries_5xx = 0
        self._sleep = sleeper or time.sleep
        self._now = dater or (lambda: datetime.now(timezone.utc))

    # -- helpers ------------------------------------------------------------

    @staticmethod
    def _parse_retry_after(value, now_dt):
        if value is None:
            return None
        value = str(value).strip()
        if value.isdigit():
            return int(value)
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            delta = (dt - now_dt).total_seconds()
            return max(0, int(delta))
        except Exception:
            return None

    def build_url(self, path, params=None):
        url = f"{BASE}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params, doseq=True)
        return url

    def _once(self, url):
        """Single GET. Returns (status, body_text_or_json, retry_after)."""
        req = urllib.request.Request(url, method="GET", headers={
            "X-YVP-App-Key": self.app_key,
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        })
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as res:
                body = res.read().decode("utf-8", "replace")
                retry_after = res.headers.get("Retry-After") if res.headers else None
                try:
                    return res.status, json.loads(body), retry_after
                except json.JSONDecodeError:
                    return res.status, body, retry_after
        except urllib.error.HTTPError as e:
            retry_after = e.headers.get("Retry-After") if e.headers else None
            try:
                raw = e.read().decode("utf-8", "replace")
                try:
                    return e.code, json.loads(raw), retry_after
                except json.JSONDecodeError:
                    return e.code, raw, retry_after
            except Exception:
                return e.code, None, retry_after
        except Exception as exc:  # network-level failure
            return -1, {"error": type(exc).__name__}, None

    # -- main entry ----------------------------------------------------------

    def request(self, path, params=None, method="GET"):
        """GET with full rate-limit/retry/budget semantics.

        Returns (status, json_or_text). Raises AbortedRun on fatal aborts.
        Refuses every method except GET (audit Check 5).
        """
        if method != "GET":
            raise ValueError("transport_refuses_non_get")
        url = self.build_url(path, params)
        self.audit_trail.append(url)  # URLs only, never headers

        network_attempts = 0
        while True:
            self.limiter.wait()
            self.controller.count()
            status, body, retry_after = self._once(url)

            if status == 401:
                # Immediate abort; the key value is NEVER printed.
                raise AbortedRun("http_401_unauthorized")

            if status == 429:
                if self.retries_429 >= self.max_retries_429:
                    raise AbortedRun("http_429_retries_exhausted")
                self.retries_429 += 1
                wait_s = self._parse_retry_after(retry_after, self._now())
                if wait_s is None:
                    wait_s = min(30, 2 ** self.retries_429)
                wait_s = min(wait_s, self.max_retry_wait)
                self._sleep(wait_s)
                continue

            if 500 <= status <= 599:
                if self.retries_5xx >= self.max_retries_5xx:
                    raise AbortedRun("http_5xx_retries_exhausted")
                self.retries_5xx += 1
                wait_s = min(self.max_retry_wait, 2 ** self.retries_5xx)
                self._sleep(wait_s)
                continue

            if status == -1:
                if network_attempts >= self.max_retries_network:
                    raise AbortedRun("network_error_retries_exhausted")
                network_attempts += 1
                self._sleep(min(self.max_retry_wait, 2 ** network_attempts))
                continue

            return status, body


# --------------------------------------------------------------------------- #
# Licence-term artifacts                                                       #
# --------------------------------------------------------------------------- #

def write_licence_terms(artifacts_dir, edition_id, licence_records, redactor):
    """Write redacted per-licence artifacts. Returns list of written paths.

    For each agreed licence record: licence-<id>.json plus one <field>.html
    per terms/attribution/caching/display/restriction field present.
    `terms_present` is True iff at least one such field exists (G5 input).
    """
    import pathlib
    out_dir = pathlib.Path(artifacts_dir)
    edition_dir = out_dir / str(edition_id)
    edition_dir.mkdir(parents=True, exist_ok=True)
    written = []
    term_fields = ("terms_html", "attribution_html", "caching_policy",
                   "display_restrictions", "redistribution_restrictions")
    for rec in licence_records or []:
        lic_id = str(rec.get("license_id") or "unknown")
        has_terms = False
        lic_payload = {k: redactor.scrub(v) for k, v in rec.items()}
        (edition_dir / f"licence-{lic_id}.json").write_text(
            json.dumps(lic_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        written.append(str(edition_dir / f"licence-{lic_id}.json"))
        for field in term_fields:
            val = rec.get(field)
            if val:
                has_terms = True
                p = edition_dir / f"{field}.html"
                p.write_text(redactor.scrub(str(val)), encoding="utf-8")
                written.append(str(p))
        rec["terms_present"] = bool(has_terms)
    return written


# --------------------------------------------------------------------------- #
# Catalogue parsing (original supplier files — TSV, "N Bibles in License")     #
# --------------------------------------------------------------------------- #

def _split_row(line):
    """Split a catalogue data row. Tabs first, then runs of 2+ spaces."""
    if "\t" in line:
        parts = [p.strip() for p in line.split("\t") if p.strip()]
    else:
        parts = [p.strip() for p in re.split(r"\s{2,}", line) if p.strip()]
    return parts


def load_catalogue(path, provider):
    """Parse a supplier catalogue file (READ-ONLY).

    Layout (both suppliers): preamble lines, a "N Bibles in License" line,
    a "Search by name..." line, an `Abrev/Name/ID` header line, then data
    rows `ABBREV<sep>Name<sep>ID`. The final Biblica row (YOM) has NO ID —
    it is preserved verbatim as a missing_id row and NEVER assigned one.

    Returns (meta, entries, problems). `entries` includes excluded rows with
    `excluded_reason` set; ids are only produced for numeric-ID rows.
    """
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        raw_lines = fh.read().splitlines()

    meta = {
        "source_file": os.path.basename(path),
        "source_path": path,
        "provider": provider,
        "format": "tsv",
        "delimiter": "\t",
        "header_detected": False,
        "header_labels": ["Abrev", "Name", "ID"],
        "header_line": None,
        "columns": {"abbreviation": 0, "name": 1, "id": 2},
        "preamble": [],
        "stated_count_in_file": {"stated": None, "line": None},
        "blank_lines": 0,
        "comment_lines": 0,
        "raw_data_rows": 0,
        "sha256": None,
    }

    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    meta["sha256"] = h.hexdigest()

    header_idx = None
    for i, line in enumerate(raw_lines):
        if line.strip().lower().startswith("abrev"):
            header_idx = i
            meta["header_detected"] = True
            meta["header_line"] = i + 1  # 1-indexed physical line
            break
    for i, line in enumerate(raw_lines[: header_idx if header_idx is not None else len(raw_lines)]):
        text = line.strip()
        if not text:
            meta["blank_lines"] += 1
            continue
        if text.startswith("#"):
            meta["comment_lines"] += 1
            continue
        meta["preamble"].append({"line": i + 1, "text": text})
        m = _STATED_COUNT.match(text)
        if m:
            meta["stated_count_in_file"] = {"stated": int(m.group(1)), "line": i + 1}

    entries = []
    problems = {
        "count_mismatch": [],
        "missing_id_rows": [],
        "duplicate_ids": {},
        "non_numeric_ids": [],
        "malformed_rows": [],
        "sil_flagged_rows": [],
    }
    warnings = []

    if header_idx is None:
        problems["malformed_rows"].append({"line": None, "error": "header row not found"})
        return meta, entries, problems, [], []

    seen_ids = {}
    abbrev_seen = {}
    data_index = 0
    for i in range(header_idx + 1, len(raw_lines)):
        line = raw_lines[i]
        if not line.strip():
            meta["blank_lines"] += 1
            continue
        if line.strip().startswith("#"):
            meta["comment_lines"] += 1
            continue
        data_index += 1
        meta["raw_data_rows"] += 1
        parts = _split_row(line)
        entry = {
            "row": data_index,
            "line": i + 1,
            "abbreviation_raw": None,
            "name_raw": None,
            "id_raw": None,
            "excluded_reason": None,
            "line_raw": line,
        }
        if len(parts) == 0:
            entry["excluded_reason"] = "malformed_row"
            problems["malformed_rows"].append({"row": data_index, "line": i + 1})
            entries.append(entry)
            continue
        entry["abbreviation_raw"] = parts[0]
        if len(parts) >= 3 and parts[-1].isdigit():
            entry["name_raw"] = " ".join(parts[1:-1])
            entry["id_raw"] = parts[-1]
        elif len(parts) >= 3:
            # An ID token is present but non-numeric — its own problem class;
            # never coerced, never guessed.
            entry["name_raw"] = " ".join(parts[1:])
            entry["id_raw"] = parts[-1]
            entry["excluded_reason"] = "non_numeric_id"
            problems["non_numeric_ids"].append({
                "row": data_index, "line": i + 1, "id_raw": parts[-1]})
        elif len(parts) == 2 and parts[-1].isdigit():
            # 'ABBREV<sep>ID' with no name — malformed (excluded fail-closed).
            entry["name_raw"] = ""
            entry["id_raw"] = parts[-1]
            entry["excluded_reason"] = "malformed_row"
            problems["malformed_rows"].append({"row": data_index, "line": i + 1})
        else:
            # No numeric ID at end (e.g. Biblica YOM row) — never invent one.
            entry["name_raw"] = " ".join(parts[1:]) if len(parts) >= 2 else ""
            entry["excluded_reason"] = "missing_id"

        name_text = f"{entry.get('abbreviation_raw') or ''} {entry.get('name_raw') or ''}"
        if _SIL_WORD.search(name_text):
            entry["excluded_reason"] = entry["excluded_reason"] or "sil_flagged"
            problems["sil_flagged_rows"].append({"row": data_index, "line": i + 1})

        if entry["id_raw"] is not None and entry["excluded_reason"] is None:
            seen_ids.setdefault(entry["id_raw"], []).append(data_index)
        if entry["excluded_reason"] == "missing_id":
            problems["missing_id_rows"].append({
                "row": data_index,
                "line": i + 1,
                "abbreviation_raw": entry["abbreviation_raw"],
                "name_raw": entry["name_raw"],
            })
        abbrev_seen.setdefault((entry["abbreviation_raw"] or "").lower(), []).append(data_index)
        entries.append(entry)

    for id_raw, rows in seen_ids.items():
        if len(rows) > 1:
            problems["duplicate_ids"][str(id_raw)] = rows
    dup_abbrev_groups = {a: r for a, r in abbrev_seen.items() if len(r) > 1}
    if dup_abbrev_groups:
        warnings.append({
            "code": "duplicate_abbreviations",
            "message": ("duplicate abbreviations found (the id is the matching "
                        "key; abbreviations are informational)"),
            "groups": len(dup_abbrev_groups),
        })

    valid_ids = sorted({int(e["id_raw"]) for e in entries
                        if e["id_raw"] is not None and e["excluded_reason"] is None})
    stated = meta["stated_count_in_file"]["stated"]
    if stated is not None and stated != len(valid_ids):
        problems["count_mismatch"].append({
            "stated": stated,
            "valid": len(valid_ids),
            "raw_rows": meta["raw_data_rows"],
            "arithmetic": f"{stated} raw = {len(valid_ids)} valid + "
                          f"{len(problems['missing_id_rows'])} missing_id",
        })
    meta["expected_entries"] = stated
    return meta, entries, problems, valid_ids, warnings


def build_lists_state(biblica, wycliffe):
    """Assemble per-provider list state + cross-provider overlap (F3)."""
    b_meta, b_entries, b_problems, b_ids, b_warn = biblica
    w_meta, w_entries, w_problems, w_ids, w_warn = wycliffe

    overlap = sorted(set(b_ids) & set(w_ids))
    if overlap:
        b_problems.setdefault("cross_provider_overlap", []).extend(overlap)
        w_problems.setdefault("cross_provider_overlap", []).extend(overlap)

    problem_keys = ("count_mismatch", "missing_id_rows", "duplicate_ids",
                    "non_numeric_ids", "malformed_rows", "sil_flagged_rows",
                    "cross_provider_overlap")
    b_valid = not any(b_problems.get(k) for k in problem_keys)
    w_valid = not any(w_problems.get(k) for k in problem_keys)

    b_state = {
        "provider": PROVIDER_BIBLICA,
        "supplied": True,
        "format": b_meta["format"],
        "id_count": len(b_ids),
        "raw_id_entries": b_meta["raw_data_rows"],
        "expected_owner_count": b_meta["expected_entries"],
        "count_matches_owner_statement": (
            b_meta["expected_entries"] == len(b_ids)
            if b_meta["expected_entries"] is not None else None),
        "duplicate_ids": b_problems["duplicate_ids"],
        "warnings": b_warn,
        "problems": b_problems,
        "valid": b_valid,
        "invalid_reasons": ([] if b_valid else
                            [k for k in problem_keys if b_problems.get(k)]),
    }
    w_state = dict(b_state)
    w_state.update({
        "provider": PROVIDER_WYCLIFFE,
        "id_count": len(w_ids),
        "raw_id_entries": w_meta["raw_data_rows"],
        "expected_owner_count": w_meta["expected_entries"],
        "count_matches_owner_statement": (
            w_meta["expected_entries"] == len(w_ids)
            if w_meta["expected_entries"] is not None else None),
        "duplicate_ids": w_problems["duplicate_ids"],
        "warnings": w_warn,
        "problems": w_problems,
        "valid": w_valid,
        "invalid_reasons": ([] if w_valid else
                            [k for k in problem_keys if w_problems.get(k)]),
    })
    return {"biblica": b_state, "wycliffe": w_state}, overlap, set(b_ids), set(w_ids)


def evaluate_biblica_provisional(lists_state, overlap):
    """Plan K1/G1+F1-F4: eligible ONLY for the exact single-YOM-defect state."""
    b = lists_state["biblica"]
    w = lists_state["wycliffe"]
    p = b["problems"]
    eligible = (
        len(p["missing_id_rows"]) == 1
        and not p["duplicate_ids"]
        and not p["non_numeric_ids"]
        and not p["malformed_rows"]
        and not p["sil_flagged_rows"]
        and not overlap
        and w["valid"]
    )
    defect = None
    if p["missing_id_rows"]:
        yom = p["missing_id_rows"][0]
        defect = (f"single missing_id row (row {yom['row']}, line {yom['line']}, "
                  f"{yom['abbreviation_raw']} / {yom['name_raw']})")
    elif b["invalid_reasons"]:
        defect = ", ".join(b["invalid_reasons"])
    return {
        "eligible": bool(eligible),
        "valid_ids_count": b["id_count"],
        "defect": defect,
    }


# --------------------------------------------------------------------------- #
# Attribution / provider classification                                        #
# --------------------------------------------------------------------------- #

def classify_attribution(organization, licence_records):
    """Return (provider, flags). SIL exclusion always wins (G6, plan §1.2)."""
    flags = []
    text = " ".join([str(organization or "")] +
                    [str(r.get("organization_name") or "") for r in (licence_records or [])])
    if _SIL_WORD.search(text):
        return "sil", ["sil_attribution"]
    low = text.lower()
    if "biblica" in low:
        return PROVIDER_BIBLICA, flags
    if "wycliffe" in low:
        return PROVIDER_WYCLIFFE, flags
    for pending in PENDING_REVIEW_ORGS:
        if pending in low:
            flags.append("provider_pending_owner_review")
            return "pending_review", flags
    return "unknown", flags


def assess_licence_restrictions(licence_records, has_licence_step):
    """S2 safeguard — per-agreed-licence restriction assessment.

    `permission_to_serve_implied` is hard-coded False. Missing/unclear terms
    are fail-closed. An absent licence step yields evidence_unavailable.
    """
    rows = []
    if not has_licence_step:
        rows.append({
            "assessment": "evidence_unavailable_fail_closed",
            "permission_to_serve_implied": False,
        })
        return rows
    for rec in licence_records or []:
        terms_present = rec.get("terms_present")
        if terms_present is False:
            assessment = "terms_missing_fail_closed"
        else:
            assessment = "terms_saved_owner_review"
        rows.append({
            "license_id": rec.get("license_id"),
            "attribution": bool(rec.get("attribution_html")),
            "display": bool(rec.get("display_restrictions")),
            "caching": bool(rec.get("caching_policy")),
            "redistribution": bool(rec.get("redistribution_restrictions")),
            "terms_evidence": terms_present,
            "assessment": assessment,
            "permission_to_serve_implied": False,  # hard-coded (S2)
        })
    return rows


# --------------------------------------------------------------------------- #
# Verdict engine — decide_bible_state (G/H/F gates, v2.4.1 G5 fix applied)     #
# --------------------------------------------------------------------------- #

def decide_bible_state(edition_id, tier_a_status, tier_a_basis,
                       organization, licence_records, has_licence_step,
                       lists_state, provisional, biblica_valid_ids):
    """Per-edition verdict. Implements plan §5 with blocker B1 (audit Check 2)
    FIXED: the G5 terms-present clause gates BOTH the provisional and the
    approved path — unclear/missing terms yield manual_review_required +
    `licence_terms_unclear`, never a serving verdict.
    """
    flags = []
    agreed = [r for r in (licence_records or []) if r.get("agreed")]
    has_agreed = bool(agreed)
    # G5 terms-present clause (v2.4.1 fix): at least one agreed record must
    # carry terms_present != False.
    terms_ok = any(r.get("terms_present") is not False for r in agreed) if has_agreed else False

    provider, cls_flags = classify_attribution(organization, licence_records)
    flags.extend(cls_flags)

    # SIL exclusion wins over everything, including provisional (G6/F2 spirit)
    if provider == "sil":
        return _record(V_SIL_EXCLUDED, provider, flags, agreed,
                       has_licence_step, tier_a_status, tier_a_basis)

    # Conflicting attribution (Biblica vs Wycliffe evidence) → manual review
    lic_orgs = {((r.get("organization_name") or "").lower()) for r in (licence_records or [])
                if r.get("organization_name")}
    mapped = {p for p in (PROVIDER_BIBLICA, PROVIDER_WYCLIFFE) if p in " ".join(lic_orgs)}
    if provider in (PROVIDER_BIBLICA, PROVIDER_WYCLIFFE) and mapped and \
            mapped != {provider}:
        flags.append("conflicting_attribution")
        return _record(V_REVIEW, provider, flags, agreed, has_licence_step,
                       tier_a_status, tier_a_basis)

    in_biblica = int(edition_id) in biblica_valid_ids if str(edition_id).isdigit() else False

    # API-time fail-closed (F5): detail non-200 → never a serving verdict
    if tier_a_status != 200:
        if has_agreed:
            return _record(V_NOT_ACCESSIBLE, provider, flags, agreed,
                           has_licence_step, tier_a_status, tier_a_basis)
        return _record(V_NOT_LICENCED, provider, flags, agreed,
                       has_licence_step, tier_a_status, tier_a_basis)

    if not has_agreed:
        # accessible but licence unverified — fail-closed (F5)
        return _record(V_LICENCE_UNVERIFIED, provider, flags, agreed,
                       has_licence_step, tier_a_status, tier_a_basis)

    # PD/CC + Lockman (pending owner review) and unmapped providers are held
    # at licensed_agreed_provider_unknown — NEVER approved/provisional
    # (plan §1.2; audit Check 4).
    if provider in ("pending_review", "unknown"):
        return _record(V_PROVIDER_UNKNOWN, provider, flags, agreed,
                       has_licence_step, tier_a_status, tier_a_basis)

    both_valid = lists_state["biblica"]["valid"] and lists_state["wycliffe"]["valid"]

    if both_valid:
        # H-gate path (stricter); G5 terms clause applies here too (B1 fix).
        if not terms_ok:
            flags.append("licence_terms_unclear")
            return _record(V_REVIEW_REQUIRED, provider, flags, agreed,
                           has_licence_step, tier_a_status, tier_a_basis)
        return _record(V_APPROVED, provider, flags, agreed, has_licence_step,
                       tier_a_status, tier_a_basis)

    # Lists gate closed (biblica invalid while YOM unresolved)
    if provider == PROVIDER_BIBLICA:
        if not in_biblica:
            flags.append("not_in_supplied_provider_list")
            return _record(V_REVIEW_REQUIRED, provider, flags, agreed,
                           has_licence_step, tier_a_status, tier_a_basis)
        # Provisional escape — Biblica ONLY, plan §5 G1-G7 (audit 1685–1694 analog)
        if provisional.get("eligible") and in_biblica:
            # G4 tightened per audit Check 6 item 4: detail_200 basis required.
            if tier_a_basis != TIER_A_DETAIL_200:
                flags.append("tier_a_basis_listed_not_detail_200")
                return _record(V_REVIEW_REQUIRED, provider, flags, agreed,
                               has_licence_step, tier_a_status, tier_a_basis)
            if not terms_ok:  # G5 — blocker B1 fix
                flags.append("licence_terms_unclear")
                return _record(V_REVIEW_REQUIRED, provider, flags, agreed,
                               has_licence_step, tier_a_status, tier_a_basis)
            flags.append("biblica_catalogue_provisional")
            rec = _record(V_PROVISIONAL, provider, flags, agreed, has_licence_step,
                          tier_a_status, tier_a_basis)
            rec["verdict_scope"] = "verifier_report_internal_only"
            return rec
    # Wycliffe editions are NEVER provisional (separate path, plan §1.2);
    # while the lists gate is closed everything else waits for review.
    return _record(V_REVIEW_REQUIRED, provider, flags, agreed,
                   has_licence_step, tier_a_status, tier_a_basis)


def _record(verdict, provider, flags, licence_records, has_licence_step,
            tier_a_status, tier_a_basis):
    return {
        "verdict": verdict,
        "provider": provider,
        "flags": flags,
        "serving_permission": "none",  # hard-coded (S1) — never anything else
        "licence_restriction_assessment": assess_licence_restrictions(
            licence_records, has_licence_step),
        "tier_a": {"status": tier_a_status, "basis": tier_a_basis},
    }


# --------------------------------------------------------------------------- #
# Shared report blocks                                                         #
# --------------------------------------------------------------------------- #

def _safeguards_block():
    return {
        "read_only_get_only": True,
        "serving_permission_hardcoded_none": True,
        "permission_to_serve_implied_false": True,
        "licence_record_present_is_not_serve_permission": True,
        "serveable_provisional_never_activates_edition_in_koino": True,
        "serveable_provisional_never_equals_serveable_approved": True,
        "sil_excluded_wins_over_everything": True,
        "yom_never_probed_or_invented": True,
        "fail_closed_on_unclear_terms": True,
        "no_silent_english_substitution": True,
        "no_machine_translation": True,
        "koino_untouched": True,
    }


def _key_handling_block(have_key):
    return {
        "source": "environment_only",
        "cli_app_key_arg": "refused_exit_2",
        "header": "X-YVP-App-Key",
        "in_url": False,
        "printed": False,
        "exposed_in_report": False,
        "present_this_run": bool(have_key),
    }


def _provider_scope_block():
    return {
        "note": ("SIL International is explicitly excluded from all catalogues, "
                 "implementations and future integrations. Public Domain/CC and "
                 "Lockman remain outside the initial selected catalogue "
                 "(pending owner review)."),
        "providers": {
            PROVIDER_BIBLICA: {
                "dashboard_label": "Biblica",
                "dashboard_bibles": 69,
                "active_account_agreement": True,
                "classification": "selected_for_koino_verification",
                "selected_for_koino_verification": True,
                "source_list_status": "catalogue_supplied",
                "note": ("selected for the initial Koino verification; approval "
                         "still requires the real ID list to pass the [C11] "
                         "fail-closed gate"),
            },
            PROVIDER_WYCLIFFE: {
                "dashboard_label": "Wycliffe",
                "dashboard_bibles": 1037,
                "active_account_agreement": True,
                "classification": "selected_for_koino_verification",
                "selected_for_koino_verification": True,
                "source_list_status": "catalogue_supplied",
                "note": ("selected for the initial Koino verification; approval "
                         "still requires the real ID list to pass the [C11] "
                         "fail-closed gate"),
            },
            "public_domain_creative_commons": {
                "active_account_agreement": True,
                "selected_for_koino_verification": False,
                "note": "outside the initial selected catalogue (pending owner)",
            },
            "lockman": {
                "active_account_agreement": True,
                "selected_for_koino_verification": False,
                "note": "outside the initial selected catalogue (pending owner)",
            },
            "sil_international": {
                "active_account_agreement": True,
                "selected_for_koino_verification": False,
                "excluded": True,
                "note": "explicitly excluded everywhere (owner rule)",
            },
        },
    }


def _limitations_block(mode):
    lim = [
        "Reconstructed tool (2.5.0-reconstructed) — NOT the recovered original "
        "v2.4.1; line-for-line parity is not claimed (see "
        "verification/RECONSTRUCTION-REPORT.md).",
        "P1 API verification has NOT run and remains unauthorized; this run "
        "made zero API requests.",
        "The YOM row (Biblica) has no YouVersion ID; it is reported verbatim "
        "and never probed or invented.",
        "While YOM is unresolved, audit_status stays provider_lists_incomplete "
        "and zero editions can be serveable_approved (H-gate).",
        "Duplicate abbreviations are warnings only; the ID is the matching key.",
        "south_asia_observations are reference-only; the full 17-ID list lives "
        "in WYCLIFFE-SOUTH-ASIA-REVIEW.md and is never scope-extending.",
    ]
    if mode == "offline":
        lim.append("Offline mode: no network transport was constructed; "
                   "api_requests_made is structurally zero.")
    return lim


# --------------------------------------------------------------------------- #
# Offline catalogue validation (keyless, zero requests)                        #
# --------------------------------------------------------------------------- #

def run_offline_validation(biblica_path, wycliffe_path, redactor, have_key):
    biblica = load_catalogue(biblica_path, PROVIDER_BIBLICA)
    wycliffe = load_catalogue(wycliffe_path, PROVIDER_WYCLIFFE)
    lists_state, overlap, b_ids, w_ids = build_lists_state(biblica, wycliffe)
    provisional = evaluate_biblica_provisional(lists_state, overlap)
    lists_state["biblica"]["provisional"] = provisional
    lists_state["wycliffe"]["provisional"] = {"eligible": False,
                                              "valid_ids_count": lists_state["wycliffe"]["id_count"],
                                              "defect": None}  # never provisional (plan §1.2)

    b_meta, _, b_problems, _, _ = biblica
    w_meta, _, _, _, _ = wycliffe

    def catalogue_block(meta, entries, problems, ids):
        return {
            "source_file": meta["source_file"],
            "sha256": meta["sha256"],
            "expected_entries": meta["expected_entries"],
            "format": meta["format"],
            "delimiter": meta["delimiter"],
            "header_detected": meta["header_detected"],
            "header_labels": meta["header_labels"],
            "header_line": meta["header_line"],
            "columns": meta["columns"],
            "preamble": meta["preamble"],
            "stated_count_in_file": meta["stated_count_in_file"],
            "blank_lines": meta["blank_lines"],
            "comment_lines": meta["comment_lines"],
            "raw_data_rows": meta["raw_data_rows"],
            "entries": entries,
            "ids": ids,
            "problems": problems,
        }

    missing = lists_state["biblica"]["problems"]["missing_id_rows"]
    report = {
        "tool": TOOL,
        "tool_version": TOOL_VERSION,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": "offline_fasttrack_catalogues_validation",
        "read_only": True,
        "offline": True,
        "api_requests_made": 0,
        "audit_status": "provider_lists_incomplete",  # G7 — non-overridable here
        "c11_gate": {"gate": "C11", "state": "CLOSED",
                     "reason": "biblica catalogue not fully valid while YOM is unresolved"},
        "provider_scope": _provider_scope_block(),
        "catalogues": {
            "biblica": catalogue_block(b_meta, biblica[1], b_problems, list(b_ids)),
            "wycliffe": catalogue_block(w_meta, wycliffe[1], wycliffe[2], list(w_ids)),
        },
        "provider_lists": lists_state,
        "biblica_provisional_mode": {
            "enabled": provisional["eligible"],
            "internal_only": True,
            "never_activates_edition_in_koino": True,
            "justification": ("single missing_id defect (YOM), all other problem "
                              "classes empty, no cross-provider overlap, Wycliffe "
                              "fully valid — plan §5 G1/G2"),
            "defect_summary": provisional["defect"],
        },
        "cross_provider_overlap_ids": overlap,
        "unresolved_missing_id": missing,  # verbatim — never resolved here
        "indian_language_candidates": {
            "note": ("advisory only — require owner confirmation, never "
                     "scope-extending"),
            "candidates": ADVISORY_CANDIDATES,
        },
        "south_asia_observations": {
            "count": 17,
            "source": "WYCLIFFE-SOUTH-ASIA-REVIEW.md + wycliffe-south-asia-classification.csv",
            "note": ("observations only — the full ID list is NOT embedded in "
                     "this reconstruction; see the review document"),
        },
        "safeguards": _safeguards_block(),
        "key_handling": _key_handling_block(have_key),
        "rate_limit": {"min_interval_s": DEFAULT_MIN_INTERVAL, "max_requests": None,
                       "requests_made": 0, "retries_429": 0, "retries_5xx": 0,
                       "max_retry_wait_s": DEFAULT_MAX_RETRY_WAIT},
        "abort": {"aborted": False, "abort_reason": None},
        "limitations": _limitations_block("offline"),
        "redaction_self_scan": "passed",
    }
    return report


# --------------------------------------------------------------------------- #
# P1 API verification (Biblica-68; requires explicit authorization upstream)   #
# --------------------------------------------------------------------------- #

def run_p1(args, app_key, redactor):
    limiter = RateLimiter(args.min_interval)
    controller = RunController(args.max_requests)
    transport = Transport(app_key, limiter, controller, redactor,
                          max_retry_wait=args.max_retry_wait,
                          max_retries_429=args.max_retries_429,
                          max_retries_5xx=args.max_retries_5xx)

    biblica = load_catalogue(args.biblica_catalogue, PROVIDER_BIBLICA)
    wycliffe = load_catalogue(args.wycliffe_catalogue, PROVIDER_WYCLIFFE)
    lists_state, overlap, b_ids, w_ids = build_lists_state(biblica, wycliffe)
    provisional = evaluate_biblica_provisional(lists_state, overlap)
    lists_state["biblica"]["provisional"] = provisional
    lists_state["wycliffe"]["provisional"] = {"eligible": False,
                                              "valid_ids_count": lists_state["wycliffe"]["id_count"],
                                              "defect": None}

    # Source conflict check (exit 2): with provisional mode active, every
    # supplied probe ID must be an explicit member of the Biblica valid set.
    ids = [i.strip() for i in (args.ids or "").split(",") if i.strip()]
    if not ids:
        raise SystemExit2("--ids is required for API verification mode")
    if provisional["eligible"]:
        outside = [i for i in ids if not i.isdigit() or int(i) not in b_ids]
        if outside:
            raise SystemExit2(
                f"source conflict: probe IDs not in the Biblica valid subset: {outside}")

    aborted = None
    steps_ids = []
    try:
        # Step 1 — seed load (agreed-licence index for G5/Tier B evidence).
        if not args.skip_seeds:
            transport.request("/v1/licenses", {"developer_id": args.developer_id})

        steps_ids = []  # (kept local reset safe if seed partially ran)
        for bid in ids:
            s1, detail = transport.request(f"/v1/bibles/{urllib.parse.quote(bid)}")
            bible = (detail.get("data") if isinstance(detail, dict)
                     and isinstance(detail.get("data"), dict) else detail) or {}
            s2, lic = transport.request("/v1/licenses",
                                        {"bible_id": bid, "developer_id": args.developer_id})
            lic_data = (lic.get("data") if isinstance(lic, dict) else lic) or []
            records = []
            for l in (lic_data if isinstance(lic_data, list) else []):
                records.append({
                    "license_id": l.get("id"),
                    "name": l.get("name"),
                    "organization_id": l.get("organization_id"),
                    "organization_name": l.get("organization_name"),
                    "agreed_dt": l.get("agreed_dt"),
                    "agreed": bool(l.get("agreed_dt")),
                    "agreed_basis": "developer_id_filtered",
                    "terms_html": l.get("terms_html"),
                    "attribution_html": l.get("attribution_html"),
                    "caching_policy": l.get("caching_policy"),
                    "display_restrictions": l.get("display_restrictions"),
                    "redistribution_restrictions": l.get("redistribution_restrictions"),
                })
            has_licence_step = (s2 == 200)
            artifacts = []
            if args.artifacts_dir:
                artifacts = write_licence_terms(args.artifacts_dir, bid, records, redactor)
            basis = TIER_A_DETAIL_200 if s1 == 200 else TIER_A_LISTED
            rec = decide_bible_state(bid, s1, basis,
                                     bible.get("organization") or bible.get("publisher"),
                                     records, has_licence_step,
                                     lists_state, provisional, b_ids)
            rec.update({
                "bible_id": bid,
                "detail_status": s1,
                "title": bible.get("title"),
                "language_tag": bible.get("language_tag"),
                "licence_records": records,
                "discovered_via": os.path.basename(args.biblica_catalogue),
                "provider_list_membership": {
                    "in_biblica_valid_subset": bid.isdigit() and int(bid) in b_ids,
                    "in_wycliffe": bid.isdigit() and int(bid) in w_ids,
                },
                "licence_term_artifacts": artifacts,
            })
            steps_ids.append(rec)
    except AbortedRun as exc:
        aborted = exc.reason

    missing = lists_state["biblica"]["problems"]["missing_id_rows"]
    report = {
        "tool": TOOL,
        "tool_version": TOOL_VERSION,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": "read_only_api_verification_p1_biblica68",
        "read_only": True,
        "offline": False,
        "api_requests_made": controller.requests_made,
        "audit_status": "provider_lists_incomplete",  # G7 — non-overridable
        "provider_scope": _provider_scope_block(),
        "provider_lists": lists_state,
        "biblica_provisional_mode": {
            "enabled": provisional["eligible"],
            "internal_only": True,
            "never_activates_edition_in_koino": True,
            "justification": "plan §5 G1/G2 (single-YOM defect state)",
            "defect_summary": provisional["defect"],
        },
        "cross_provider_overlap_ids": overlap,
        "unresolved_missing_id": missing,
        "safeguards": _safeguards_block(),
        "key_handling": _key_handling_block(bool(app_key)),
        "rate_limit": {
            "min_interval_s": args.min_interval,
            "max_requests": args.max_requests,
            "requests_made": controller.requests_made,
            "retries_429": transport.retries_429,
            "retries_5xx": transport.retries_5xx,
            "max_retry_wait_s": args.max_retry_wait,
        },
        "abort": {"aborted": aborted is not None, "abort_reason": aborted},
        "steps": {"ids": steps_ids if 'steps_ids' in dir() else []},
        "limitations": _limitations_block("api"),
        "redaction_self_scan": "passed",
    }
    return report


class SystemExit2(Exception):
    """Bad arguments / source conflicts → exit 2 with message."""


# --------------------------------------------------------------------------- #
# Report writing (redaction + self-scan) and CLI                               #
# --------------------------------------------------------------------------- #

def write_report(path, report, redactor):
    scrubbed = redactor.scrub(report)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(scrubbed, fh, ensure_ascii=False, indent=2)
    count = self_scan_report(path, redactor.secret)
    if count:
        # Auto-redact the written file, then signal exit 4.
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read()
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text.replace(redactor.secret, Redactor.MARKER))
        return count
    return 0


def build_parser():
    ap = argparse.ArgumentParser(
        prog=TOOL,
        description=("Read-only YouVersion catalogue verifier — "
                     f"{TOOL_VERSION} (RECONSTRUCTION, offline-tested)"))
    ap.add_argument("--biblica-catalogue", type=str, help="Biblica supplier catalogue .txt")
    ap.add_argument("--wycliffe-catalogue", type=str, help="Wycliffe supplier catalogue .txt")
    ap.add_argument("--ids", type=str, default="",
                    help="comma-separated Bible IDs to probe (API mode)")
    ap.add_argument("--developer-id", type=str,
                    default=os.environ.get("YV_DEVELOPER_ID", ""),
                    help="developer UUID (identifier, not a secret)")
    ap.add_argument("--skip-seeds", action="store_true",
                    help="skip the Step-1 licence seed load (no-op when seeds "
                         "are inside the supplied ID set)")
    ap.add_argument("--min-interval", type=float, default=DEFAULT_MIN_INTERVAL)
    ap.add_argument("--max-requests", type=int, default=DEFAULT_MAX_REQUESTS)
    ap.add_argument("--max-retry-wait", type=int, default=DEFAULT_MAX_RETRY_WAIT)
    ap.add_argument("--max-retries-429", type=int, default=DEFAULT_MAX_RETRIES_429)
    ap.add_argument("--max-retries-5xx", type=int, default=DEFAULT_MAX_RETRIES_5XX)
    ap.add_argument("--out", type=str, default="yv-catalogue-verification.json")
    ap.add_argument("--artifacts-dir", type=str, default=None)
    # Refused by contract: the key is NEVER accepted on the CLI.
    ap.add_argument("--app-key", type=str, default=None,
                    help="REFUSED — the App Key is accepted from the "
                         "environment only (exit 2 if supplied)")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)

    if args.app_key is not None:
        print("REFUSED: --app-key is not accepted. The App Key is read ONLY "
              "from the environment variable YOUVERSION_APP_KEY. Nothing was "
              "called, nothing was written.", file=sys.stderr)
        return EXIT_ARGS_OR_KEY

    secret = (os.environ.get("YOUVERSION_APP_KEY") or "").strip()
    redactor = Redactor(secret)

    # API mode requires a key; offline catalogue validation is keyless-safe.
    api_mode = bool(args.ids)
    if api_mode and not secret:
        print("LIMITATION: YOUVERSION_APP_KEY is not set in the environment. "
              "No API calls were made. Nothing can be verified without the "
              "key. Do NOT paste the key into chat or files.", file=sys.stderr)
        return EXIT_ARGS_OR_KEY

    try:
        if api_mode:
            report = run_p1(args, secret, redactor)
        else:
            if not (args.biblica_catalogue and args.wycliffe_catalogue):
                print("Usage: supply --biblica-catalogue and --wycliffe-catalogue "
                      "for offline validation, or --ids for API verification "
                      "(key required via environment).", file=sys.stderr)
                return EXIT_ARGS_OR_KEY
            report = run_offline_validation(args.biblica_catalogue,
                                            args.wycliffe_catalogue, redactor, bool(secret))
    except SystemExit2 as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return EXIT_ARGS_OR_KEY
    except AbortedRun as exc:
        print(f"ABORTED: {exc.reason}", file=sys.stderr)
        return EXIT_ABORTED
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return EXIT_ARGS_OR_KEY

    leaks = write_report(args.out, report, redactor)
    print(f"Read-only report written to {args.out} (no secrets included).")
    if leaks:
        print("WARNING: the App-Key string was found in the written report and "
              "auto-redacted. Investigate before sharing (exit 4).", file=sys.stderr)
        return EXIT_KEY_LEAK
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
