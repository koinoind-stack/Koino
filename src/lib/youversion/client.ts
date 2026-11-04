// ─── YouVersion Platform REST client (SERVER-ONLY) ──────────────────────────
//
// Talks to https://api.youversion.com/v1 with the App Key from the secure
// config gate (src/lib/youversion/config.ts). The key NEVER leaves the server:
// this module must only be imported from server code (API routes / server
// components), never from a "use client" module.
//
// Error taxonomy (YouVersionError.kind):
//   disabled      — the provider gate is off; callers should fall back to Koino
//   unauthorized  — 401 invalid/missing App Key
//   unlicensed    — 403 the app is not licensed for this Bible/endpoint
//   not_found     — 404 unknown bible_id / passage reference
//   rate_limited  — 429 (Retry-After honored, short backoff then give up)
//   empty         — 204 no content for the parameters
//   server        — 5xx upstream (retried with backoff, then give up)
//   network       — fetch failure / timeout / malformed JSON
//
// Caching: Bible text is immutable; responses are cached by callers (route
// level). This client adds only short-lived retry semantics, no content cache.

import {
  getYouVersionConfig,
  youVersionRequestHeaders,
  type YouVersionConfig,
} from "./config";

export type YouVersionErrorKind =
  | "disabled"
  | "unauthorized"
  | "unlicensed"
  | "not_found"
  | "rate_limited"
  | "empty"
  | "server"
  | "network";

export class YouVersionError extends Error {
  kind: YouVersionErrorKind;
  status: number;

  constructor(kind: YouVersionErrorKind, status: number, message: string) {
    super(message);
    this.name = "YouVersionError";
    this.kind = kind;
    this.status = status;
  }
}

/** Bible version metadata as returned by GET /v1/bibles. */
export type YouVersionBible = {
  id: number;
  abbreviation: string;
  localized_abbreviation?: string;
  title: string;
  localized_title?: string;
  language_tag: string;
  copyright?: string;
  promotional_content?: string;
  info?: string;
  publisher_url?: string;
};

/** Passage response from GET /v1/bibles/{id}/passages/{ref}. */
export type YouVersionPassage = {
  id: string;
  content: string;
  reference: string;
};

const RETRYABLE_KINDS: ReadonlySet<YouVersionErrorKind> = new Set(["rate_limited", "server"]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mapStatusToKind(status: number): YouVersionErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "unlicensed";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 204) return "empty";
  if (status >= 500) return "server";
  return "network";
}

async function yvFetchOnce(
  cfg: YouVersionConfig,
  path: string
): Promise<{ ok: true; json: unknown } | { ok: false; error: YouVersionError }> {
  let headers: Record<string, string>;
  try {
    headers = youVersionRequestHeaders(cfg);
  } catch {
    return { ok: false, error: new YouVersionError("disabled", 0, "YouVersion provider is disabled") };
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      headers,
      // never let upstream responses be cached by shared CDNs with the key in
      // play; caching happens in our own server-side layer
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { ok: false, error: new YouVersionError("network", 0, `YouVersion request failed: ${path}`) };
  }

  if (!res.ok) {
    const kind = mapStatusToKind(res.status);
    const retryAfter = Number(res.headers.get("retry-after") || "") || undefined;
    // never include headers or auth material in error text
    const error = new YouVersionError(kind, res.status, `YouVersion API ${kind} (${res.status}) for ${path.split("?")[0]}`);
    if (retryAfter && kind === "rate_limited") (error as YouVersionError & { retryAfterSec?: number }).retryAfterSec = retryAfter;
    return { ok: false, error };
  }

  if (res.status === 204) {
    return { ok: false, error: new YouVersionError("empty", 204, `YouVersion returned no content for ${path.split("?")[0]}`) };
  }

  try {
    const json = await res.json();
    return { ok: true, json };
  } catch {
    return { ok: false, error: new YouVersionError("network", res.status, "YouVersion returned malformed JSON") };
  }
}

/** GET a YouVersion API path, honoring 429 Retry-After and 5xx backoff. */
export async function yvFetch(path: string): Promise<unknown> {
  const cfg = getYouVersionConfig();
  if (!cfg.enabled) {
    throw new YouVersionError("disabled", 0, "YouVersion provider is not enabled");
  }

  let lastError: YouVersionError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await yvFetchOnce(cfg, path);
    if (result.ok) return result.json;

    lastError = result.error;
    if (!RETRYABLE_KINDS.has(lastError.kind)) throw lastError;
    if (attempt === MAX_ATTEMPTS) break;

    const ra = (lastError as YouVersionError & { retryAfterSec?: number }).retryAfterSec;
    const backoffMs = ra
      ? Math.min(ra, 5) * 1000
      : 400 * Math.pow(2, attempt - 1);
    await sleep(backoffMs);
  }
  throw lastError ?? new YouVersionError("network", 0, "YouVersion request failed");
}

// ─── Typed API operations ────────────────────────────────────────────────────

/**
 * List Bible versions for ONE language range (basic RFC 4647 range, e.g. "en",
 * "te"). YouVersion's multi-range semantics are first-match-wins, so callers
 * that want a union across languages must call this once per language.
 * Returns ALL licensed-to-this-app versions for the range (all_available is
 * NOT set — unlicensed versions are never returned by the platform).
 */
export async function listBiblesForLanguage(
  languageRange: string,
  opts: { allAvailable?: boolean } = {}
): Promise<YouVersionBible[]> {
  const out: YouVersionBible[] = [];
  let pageToken: string | undefined;
  // defensive page cap (99/page; the catalogue is large but finite)
  for (let page = 0; page < 40; page++) {
    const params = new URLSearchParams();
    params.set("language_ranges[]", languageRange);
    if (opts.allAvailable) params.set("all_available", "true");
    params.set("page_size", "99");
    if (pageToken) params.set("page_token", pageToken);
    const json = (await yvFetch(`/v1/bibles?${params.toString()}`)) as {
      data?: YouVersionBible[];
      next_page_token?: string;
    };
    const data = Array.isArray(json?.data) ? json.data : [];
    out.push(...data);
    pageToken = json?.next_page_token || undefined;
    if (!pageToken) break;
  }
  return out;
}

/** Fetch a passage (verse or whole chapter, USFM ref like "JHN.3.16"). */
export async function getPassage(
  bibleId: string | number,
  passageRef: string,
  opts: { format?: "text" | "html" } = {}
): Promise<YouVersionPassage> {
  const format = opts.format ?? "text";
  const json = (await yvFetch(
    `/v1/bibles/${encodeURIComponent(String(bibleId))}/passages/${encodeURIComponent(passageRef)}?format=${format}`
  )) as { id?: string; content?: string; reference?: string };
  if (!json || typeof json.content !== "string") {
    throw new YouVersionError("empty", 0, `YouVersion passage ${passageRef} returned no content`);
  }
  return {
    id: String(json.id ?? passageRef),
    content: json.content,
    reference: String(json.reference ?? passageRef),
  };
}

/** Fetch one Bible's metadata (for attribution when not in the cached catalogue). */
export async function getBibleMeta(bibleId: string | number): Promise<YouVersionBible> {
  const json = (await yvFetch(`/v1/bibles/${encodeURIComponent(String(bibleId))}`)) as { data?: YouVersionBible } & Partial<YouVersionBible>;
  const bible = (json as { data?: YouVersionBible })?.data ?? (json as YouVersionBible);
  if (!bible || typeof bible.id !== "number") {
    throw new YouVersionError("not_found", 404, `YouVersion bible ${bibleId} not found`);
  }
  return bible;
}
