# Part 4 Preview Database — Isolated Supabase Project Setup

Part 4 (In Loving Memory) is tested against an **isolated Supabase project**,
NOT the production database. Production configuration is never touched by this
branch. Follow these steps once, before testing the Vercel Preview deployment.

## 1. Create the isolated Preview Supabase project

1. In the Supabase dashboard (same organization as production), create a
   **new project**, e.g. `koino-preview`. Choose the same region as production
   (`ap-northeast-1`) so latency matches.
2. Save the project's database password — it appears exactly once.
3. Wait until the project finishes provisioning.

## 2. Apply the schema to the Preview database ONLY

Run this in the Supabase SQL Editor **with the PREVIEW project selected**
(triple-check the project selector — never the production project):

- Option A (recommended): from your machine, with the preview project's
  **session pooler (5432)** connection string:
  ```
  npx prisma migrate deploy
  ```
  Prisma applies every migration in order, including
  `20261023120000_part4_memorial/migration.sql`.
- Option B: paste the contents of
  `prisma/migrations/20261023120000_part4_memorial/migration.sql`
  into the SQL Editor and run.

⚠️ NEVER run migrations against the production project from this branch
without the owner's explicit approval. `prisma migrate deploy` is
forward-only and safe on Preview; production is a separate decision.

## 3. Create the Storage bucket in the Preview project

The app reuses the existing public-read bucket `believ-comic-artwork`
(same bucket the social features use — avatars, post images, memorial
portraits). A fresh Supabase project does not have it, so run this in the
PREVIEW project's SQL Editor:

```sql
insert into storage.buckets (id, name, public)
values ('believ-comic-artwork', 'believ-comic-artwork', true)
on conflict (id) do nothing;
```

Public read is the default policy of a public bucket — no extra RLS needed
(uploads go through signed URLs minted server-side with the service role key,
exactly like the existing social upload flow).

## 4. Vercel Preview environment variables

Add these in Vercel → Project → Settings → Environment Variables, scope
**Preview only** (leave Production untouched). Values come from the PREVIEW
Supabase project (Settings → Database / API):

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | Transaction pooler 6543 + `pgbouncer=true` — required for Prisma on serverless |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<preview-project-ref>.supabase.co` | Preview project, NOT production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(preview project anon key)* | Public key, preview project |
| `SUPABASE_SERVICE_ROLE_KEY` | *(preview project service_role key)* | Server-only; used for signed upload URLs |
| `KOINO_ADMIN_EMAIL` | `koinoind@gmail.com` | Optional — bootstraps the admin role in Preview |

Pushing `feature/part-4-memorial` triggers a Preview deployment that reads
exactly these Preview-scoped values. Production variables and the production
database remain untouched.

## 5. Smoke-check after the Preview deploys

1. Open the Vercel Preview URL, sign in with a test account.
2. Sidebar → "In Loving Memory" → create a memorial (photo optional,
   partial dates allowed — e.g. only a death year).
3. Add a condolence from a second account; approve it from the first.
4. Confirm production (www.koino.in) is unaffected.
