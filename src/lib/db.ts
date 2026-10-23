import { PrismaClient } from '@prisma/client'

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
    // Full query logging is dev-only; in production keep error/warn events
    // only (query logging on Vercel floods logs and adds overhead).
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })

globalForPrisma.prisma = db
