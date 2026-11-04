import { PrismaClient } from '@prisma/client'

// ─── Serverless-safe datasource URL (Task 79 — EMAXCONNECTION fix) ─────────
// Production hit "EMAXCONNECTION: max clients reached in session mode
// (pool_size: 15)" on signup/profile queries. Cause: DATABASE_URL points at
// the Supabase SESSION pooler (port 5432), which pins one pool slot per
// connection for the connection's lifetime, while Prisma on Vercel sizes its
// per-lambda pool from the HOST's CPU count (very large on Vercel machines).
// A handful of warm lambdas therefore saturate the 15-slot session pool.
//
// Fix (code-side, no Vercel env change needed): rewrite the pooler URL to
// Supavisor TRANSACTION mode (port 6543) — connections are handed back after
// every transaction, so thousands of clients can multiplex over the pool —
// and cap the per-lambda pool explicitly.
function serverlessDatasourceUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  try {
    const u = new URL(raw)
    // Only touch Supabase pooler hosts (Supavisor). Any other URL — direct
    // db.<ref>.supabase.co, local Postgres, SQLite — is left untouched.
    if (!u.hostname.includes('pooler.supabase.')) return raw
    // Session mode (5432) → transaction mode (6543).
    if (!u.port || u.port === '5432') u.port = '6543'
    // Required on transaction mode: disables prepared statements.
    if (u.searchParams.get('pgbouncer') !== 'true') u.searchParams.set('pgbouncer', 'true')
    // Explicit cap instead of CPU-derived sizing. 5 (not 1): the app uses
    // interactive $transaction() in several routes, and a value of 1 leaves
    // no headroom if a stray query runs outside `tx` inside a transaction
    // callback. 5 still bounds each lambda to ≤5 server slots.
    if (!u.searchParams.get('connection_limit')) u.searchParams.set('connection_limit', '5')
    // Wait up to 15s for a free slot under burst instead of failing fast.
    if (!u.searchParams.get('pool_timeout')) u.searchParams.set('pool_timeout', '15')
    return u.toString()
  } catch {
    return raw
  }
}

const datasourceUrl = serverlessDatasourceUrl(process.env.DATABASE_URL)

// Shared PrismaClient singleton — connection-pool fix (Task 47).
//
// Why cache on globalThis in ALL environments (including production):
//   Vercel serverless functions can hold multiple module registries per
//   process. Without a cross-context cache, each registry creates its own
//   PrismaClient, and every extra client opens extra Supabase Session-Pooler
//   connections that stay pinned for the lifetime of the lambda. With
//   pool_size: 15 on the Session Pooler, that quickly exhausts the pool
//   (FATAL EMAXCONNSESSION). Caching on globalThis guarantees at most ONE
//   PrismaClient per server process.
//
// Every module must import `db` from here instead of instantiating
// PrismaClient directly. Per-instance connection count is controlled by
// `connection_limit` on DATABASE_URL (see .env.example).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Runtime URL override (see serverlessDatasourceUrl above). The CLI
    // (prisma generate/db push) keeps using raw DATABASE_URL untouched.
    ...(datasourceUrl ? { datasourceUrl } : {}),
    // Full query logging is dev-only; in production keep error/warn events
    // only (query logging on Vercel floods logs and adds overhead).
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })

globalForPrisma.prisma = db
