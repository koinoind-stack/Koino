# Rebrand & LordsBook Integration Readiness (Task 51)

**Current brand: Koino.** Nothing in this document changes the live brand —
this is the preparation layer so a future, board-approved rebrand to
LordsBook is a small, safe change.

---

## Part A — Where the brand lives now (centralization map)

| Concern | Source of truth | Notes |
|---|---|---|
| Brand name / tagline / description | `src/lib/brand.ts` (`BRAND`) | Single import for all display chrome |
| Site URL / canonical origin | `BRAND.url` ← `NEXT_PUBLIC_SITE_URL` env | Used by metadata, sitemap, robots |
| Logo / favicon / PWA icons | `/public/brand/logo.png` ← `BRAND.assets.logo` | Legacy `/koino-logo.png` kept for installed PWAs |
| Page title / SEO metadata / OG | `src/app/layout.tsx` ← `SITE_TITLE`, `BRAND` | |
| PWA manifest | `src/app/manifest.ts` ← `BRAND.pwa` | |
| robots.txt / sitemap.xml | `src/app/robots.ts`, `src/app/sitemap.ts` ← `BRAND.url` | Static `public/robots.txt` was removed |
| Footer | `KoinoFooter.tsx` ← `BRAND.name` | |
| i18n (13 languages) | `LanguageContext.t()` rewrites the word at render time | **Zero translation-file edits needed** |
| Legal pages (terms/privacy/cookies) | `BRAND.name` interpolations | Historical document versions keep old name — intentional |
| Social share titles | PostCard / ReelsView ← `BRAND` | |

### Intentionally NOT brand-facing (identifiers — never rename casually)
- Prisma models `KoinoReward`, `KoinoArticle` (DB schema stability)
- Env vars `KOINO_ADMIN_EMAIL`, `KOINO_WHATSAPP_CHANNEL_URL`
- localStorage `koino_admin_gifts`, cookie `believ_lang`
- Window event `koino:profile-updated`, service-worker cache `koino-v1`
- Internal legacy naming (`components/crosscrafted/*`, `crosscrafted-data.ts`, npm package name `koino`)

---

## Part B — Future rebrand runbook (Koino → LordsBook)

1. Edit `src/lib/brand.ts`: `name`, `tagline`, `description`, `pwa`, `email`, `social` (≈1 file).
2. Replace `public/brand/logo.png` with the new logo (same path).
3. Set `NEXT_PUBLIC_SITE_URL=https://lordsbook.com` (or keep and 301 — see C4).
4. `NEXT_PUBLIC_SITE_URL` change flows into metadata/sitemap/robots automatically.
5. Update `contactEmail` if the support address changes.
6. Run the production build; grep for stray literals: `grep -rn "Koino" src/ --include="*.tsx" | grep -v brand.ts` — remaining hits are i18n source values (auto-rewritten at runtime), comments, and the intentional identifiers list in Part A.
7. Deploy; verify title/OG/manifest/robots/footer/legal pages.
8. Content-level demo strings (merch catalog, organizer names in `crosscrafted-data.ts`) are product data — update separately if desired.
9. Keep `koino-logo.png` in `public/` so already-installed PWAs don't break; remove only after an acceptable grace period.

---

## Part C — LordsBook integration recommendations (PREPARATION ONLY)

**Nothing below has been executed. No LordsBook data has been accessed,
imported, or modified. No SSO or data pipeline exists. A migration plan
requires separate written approval.**

### C1. Member mapping (avoid duplicate accounts)
- Map accounts by **verified email** (Supabase auth identity). Add an
  `external_identities` table (`provider`, `externalUserId`, `userId`,
  `linkedAt`) rather than mutating existing IDs.
- Users existing on both platforms: email match → link; conflict (different
  emails, same person) → account-merge flow with user confirmation.

### C2. Content relationship preservation
- Posts/comments/likes/bookmarks/media all key off `userId` (cuid). A merge
  must re-point `authorId`/`userId` foreign keys inside one transaction, with
  a dry-run diff and a verified backup/restore path first.

### C3. Auth & account verification
- Both platforms use Supabase auth. Recommended: shared auth project or
  migrated identities with password-reset on first LordsBook login.
- Keep `profileCompleted`, email-verification and admin-verification flags.

### C4. Domain change & redirects
- Serve 301s `koino.in/* → lordsbook.com/*` for at least 12 months.
- Keep OG image + sitemap regeneration under the new domain (already
  config-driven via `NEXT_PUBLIC_SITE_URL`).

### C5. Consent, permissions & rollback
- Notify users before any merge; honor deletion/privacy requests.
- Feature-flag the cutover; snapshot both databases first; documented
  rollback = restore snapshot + revert env (`NEXT_PUBLIC_SITE_URL`) + redeploy.

---

## Verification snapshot (Task 51)
- `tsc --noEmit`: clean (3 pre-existing baseline errors in examples/scripts only)
- Production build: EXIT=0
- Runtime smoke: `/robots.txt`, `/manifest.webmanifest`, `/sitemap.xml` all serve from config
- Brand rendering verified: `<title>`, og metadata, footer, legal pages
