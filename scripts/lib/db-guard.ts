/**
 * DB-target guard — Phase 1 Fix 5.
 *
 * HOW TEST DATA GOT INTO PRODUCTION (investigated 2026-10-30):
 * none of the repo's DB scripts hardcode a target — they all run against
 * whatever DATABASE_URL happens to be exported in the shell (or .env), and
 * several of them CREATE user-visible records (comics, trivia, rebrands).
 * Running an E2E/content script with production credentials exported is
 * enough to write records like "E2E Verification Church II" straight into
 * the production database. Nothing in the toolchain stopped it.
 *
 * WHAT THIS GUARD DOES (fail-closed, zero dependencies):
 *   1. Prints a loud one-line BANNER of the resolved target
 *      (host + database + Supabase project ref — never credentials).
 *   2. Refuses to run when the target looks like PRODUCTION:
 *        - DATABASE_URL matches PRODUCTION_DATABASE_URL (same host+database
 *          or same Supabase project ref), or
 *        - the DATABASE_URL's Supabase project ref equals the ref of
 *          NEXT_PUBLIC_SUPABASE_URL (the app's own production project —
 *          that URL is public, it ships in the site bundle).
 *   3. The refusal is bypassable ONLY with an explicit ALLOW_PRODUCTION_DB=1
 *      environment variable, which prints an additional warning line — an
 *      intentional, visible, two-hand action.
 *
 * USAGE (write-scripts only — read-only tooling does not need this):
 *   import { assertNotProductionDb } from "./lib/db-guard";
 *   assertNotProductionDb("my-script-name");
 */

export type DbTarget = {
  raw: string;
  host: string;
  port: string | null;
  database: string;
  user: string | null;
  /** Supabase project ref when detectable (pooler user "postgres.<ref>",
   *  direct host "db.<ref>.supabase.co"). Null for non-Supabase targets. */
  projectRef: string | null;
};

function safeDecode(component: string): string {
  try {
    return decodeURIComponent(component);
  } catch {
    return component;
  }
}

/** Parse a postgres connection URL. Returns null when unparseable. */
export function parseDbTarget(rawUrl: string): DbTarget | null {
  if (!rawUrl) return null;
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return null;

  const host = u.hostname;
  const database = safeDecode(u.pathname.replace(/^\//, "").split("?")[0]);
  const user = u.username ? safeDecode(u.username) : null;

  let projectRef: string | null = null;
  const poolerUserRef = /^postgres\.([a-z0-9]+)$/i.exec(user ?? "");
  const directHostRef = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(host);
  const poolerHost = /\.pooler\.supabase\.com$/i.test(host);
  if (poolerUserRef) projectRef = poolerUserRef[1].toLowerCase();
  else if (directHostRef) projectRef = directHostRef[1].toLowerCase();
  else if (poolerHost && user && user !== "postgres") projectRef = user.toLowerCase();

  return { raw: rawUrl, host, port: u.port || null, database, user, projectRef };
}

/** Extract the project ref from a public Supabase URL (https://<ref>.supabase.co). */
export function supabaseRefFromPublicUrl(publicUrl: string): string | null {
  if (!publicUrl) return null;
  try {
    const u = new URL(publicUrl);
    const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function sameTarget(a: DbTarget, b: DbTarget): boolean {
  if (a.projectRef && b.projectRef && a.projectRef === b.projectRef) return true;
  return (
    a.host.toLowerCase() === b.host.toLowerCase() &&
    a.database === b.database &&
    a.database !== ""
  );
}

/**
 * Decide whether `dbUrl` points at production.
 * Pure function — unit-tested in tests/db-guard.test.ts.
 */
export function isProductionDbTarget(
  dbUrl: string,
  opts: {
    productionDatabaseUrl?: string | undefined;
    publicSupabaseUrl?: string | undefined;
  } = {},
): { production: boolean; reason: string | null } {
  const target = parseDbTarget(dbUrl);
  if (!target) return { production: false, reason: null };

  if (opts.productionDatabaseUrl) {
    const prod = parseDbTarget(opts.productionDatabaseUrl);
    if (prod && sameTarget(target, prod)) {
      return {
        production: true,
        reason: prod.projectRef && target.projectRef
          ? `same Supabase project ref as PRODUCTION_DATABASE_URL (${prod.projectRef})`
          : `same host/database as PRODUCTION_DATABASE_URL (${prod.host}/${prod.database})`,
      };
    }
  }

  if (opts.publicSupabaseUrl) {
    const appRef = supabaseRefFromPublicUrl(opts.publicSupabaseUrl);
    if (appRef && target.projectRef === appRef) {
      return {
        production: true,
        reason: `DATABASE_URL targets the app's own Supabase project (${appRef}) — the production data store`,
      };
    }
  }

  return { production: false, reason: null };
}

/** Human-readable, credential-free description of the current target. */
export function describeDbTarget(rawUrl: string): string {
  const t = parseDbTarget(rawUrl);
  if (!t) return "unparseable DATABASE_URL";
  return `host=${t.host} db=${t.database || "?"}${t.projectRef ? ` (supabase ref: ${t.projectRef})` : ""}`;
}

/**
 * The guard. Call at the very top of any script that WRITES to the DB.
 * Throws when the target looks like production (unless ALLOW_PRODUCTION_DB=1).
 */
export function assertNotProductionDb(scriptName: string): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      `[db-guard] ${scriptName}: DATABASE_URL is required. ` +
        "Set it in .env (local) or your shell/CI environment before running this script.",
    );
  }

  console.log(`[db-guard] ${scriptName} → target: ${describeDbTarget(dbUrl)}`);

  const verdict = isProductionDbTarget(dbUrl, {
    productionDatabaseUrl: process.env.PRODUCTION_DATABASE_URL,
    publicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  if (!verdict.production) return;

  if ((process.env.ALLOW_PRODUCTION_DB || "").trim() === "1") {
    console.warn(
      `[db-guard] *** PRODUCTION DATABASE TARGETED — continuing because ALLOW_PRODUCTION_DB=1 is explicitly set (${verdict.reason}) ***`,
    );
    return;
  }

  throw new Error(
    `[db-guard] ${scriptName}: REFUSING to run — the configured DATABASE_URL appears to be the PRODUCTION database (${verdict.reason}). ` +
      "Point DATABASE_URL at a local/dev database instead. " +
      "If you truly intend to modify production, re-run with ALLOW_PRODUCTION_DB=1 (you will see a warning).",
  );
}
