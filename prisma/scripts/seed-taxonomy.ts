// ─────────────────────────────────────────────────────────────────────────────
// Articles & Knowledge — Phase 2: taxonomy seed (Plan v2 §2.3/2.4, Table 6)
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent by construction: categories upsert by slug, topics upsert by
// slug, and the six legacy keys are preserved EXACTLY so every
// UserQuestion.category value and SPA deep link keeps working.
//
// Run AFTER the 20261103000000_unified_taxonomy migration:
//   npx tsx prisma/scripts/seed-taxonomy.ts
//
// Safe to re-run — a second run creates nothing (reports everything as kept).
// NEVER run automatically at boot; the admin Taxonomy panel is the ongoing
// management path, this script is the one-time canonical seed.

import { PrismaClient } from "@prisma/client";
import { CATEGORY_SEED, TOPIC_SEED } from "../../src/lib/content-taxonomy";

const db = new PrismaClient();

async function main() {
  let created = 0;
  let kept = 0;

  // ── Categories (upsert by slug — the stable identifier) ──
  const categoryIds = new Map<string, string>();
  for (const c of CATEGORY_SEED) {
    const existing = await db.category.findUnique({ where: { slug: c.slug } });
    if (existing) {
      categoryIds.set(c.slug, existing.id);
      kept++;
      console.log(`category kept    : ${c.name} (${c.slug})`);
    } else {
      const row = await db.category.create({
        data: {
          name: c.name,
          slug: c.slug,
          description: c.description,
          iconKey: c.iconKey,
          sortOrder: c.sortOrder,
          isActive: true,
        },
      });
      categoryIds.set(c.slug, row.id);
      created++;
      console.log(`category created : ${c.name} (${c.slug})`);
    }
  }

  // ── Topics (upsert by slug; legacyKey preserved exactly) ──
  for (const t of TOPIC_SEED) {
    const parentCategoryId = categoryIds.get(t.parentCategorySlug);
    if (!parentCategoryId) {
      throw new Error(
        `Seed bug: topic "${t.name}" references unknown parent category slug "${t.parentCategorySlug}"`
      );
    }
    const existing = await db.topic.findUnique({ where: { slug: t.slug } });
    if (existing) {
      // A topic seeded earlier must never silently lose its legacyKey —
      // guard the invariant even if an admin renamed it in between.
      if (t.legacyKey && existing.legacyKey !== t.legacyKey) {
        throw new Error(
          `Seed conflict: topic slug "${t.slug}" exists with legacyKey "${existing.legacyKey}" but seed declares "${t.legacyKey}". Resolve manually.`
        );
      }
      kept++;
      console.log(`topic kept       : ${t.name} (${t.slug})`);
    } else {
      // legacyKey collision (an old row with the same key but another slug)
      // must surface loudly, never be overwritten silently.
      if (t.legacyKey) {
        const byLegacy = await db.topic.findUnique({ where: { legacyKey: t.legacyKey } });
        if (byLegacy) {
          throw new Error(
            `Seed conflict: legacyKey "${t.legacyKey}" is already attached to topic "${byLegacy.slug}" (seed declares "${t.slug}"). Resolve manually.`
          );
        }
      }
      await db.topic.create({
        data: {
          name: t.name,
          slug: t.slug,
          legacyKey: t.legacyKey,
          parentCategoryId,
          description: t.description,
          color: t.color,
          sortOrder: t.sortOrder,
          isActive: true,
        },
      });
      created++;
      console.log(`topic created    : ${t.name} (${t.slug})${t.legacyKey ? ` [legacy: ${t.legacyKey}]` : ""}`);
    }
  }

  console.log(`\nSeed complete: ${created} created, ${kept} kept (idempotent re-run creates nothing).`);
}

main()
  .catch((e) => {
    console.error("Taxonomy seed FAILED:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
