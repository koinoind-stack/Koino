// Run the migration directly against Supabase
import { PrismaClient } from "@prisma/client";
import { assertNotProductionDb } from "./lib/db-guard";

// Phase 1 Fix 5: refuse to run against the production database (see
// scripts/lib/db-guard.ts — this is how E2E test data leaked to prod).
assertNotProductionDb("run-supabase-migration");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}

const db = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
  log: ["query", "error", "warn"],
});

async function main() {
  console.log("Running ALTER TABLE migration...\n");

  // Add columns to Gift
  await db.$executeRaw`ALTER TABLE "Gift" ADD COLUMN IF NOT EXISTS "variations" TEXT NOT NULL DEFAULT '[]'`;
  console.log("✅ Added Gift.variations column");

  await db.$executeRaw`ALTER TABLE "Gift" ADD COLUMN IF NOT EXISTS "attributes" TEXT NOT NULL DEFAULT '[]'`;
  console.log("✅ Added Gift.attributes column");

  // Add column to GiftRedemption
  await db.$executeRaw`ALTER TABLE "GiftRedemption" ADD COLUMN IF NOT EXISTS "selectedVariations" TEXT NOT NULL DEFAULT '[]'`;
  console.log("✅ Added GiftRedemption.selectedVariations column");

  // Verify
  console.log("\n📋 Verifying columns exist:");
  const columns = await db.$queryRaw`
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Gift', 'GiftRedemption')
      AND column_name IN ('variations', 'attributes', 'selectedVariations')
    ORDER BY table_name, column_name;
  `;
  (columns as any[]).forEach((c) => {
    console.log(`  - ${c.table_name}.${c.column_name} (${c.data_type}, default: ${c.column_default})`);
  });

  // Try the original failing query
  console.log("\n🎁 Testing gift query (this failed before):");
  const gifts = await db.gift.findMany({ take: 3 });
  console.log(`✅ SUCCESS — found ${gifts.length} gifts`);
  gifts.forEach((g) =>
    console.log(`  - ${g.giftId}: ${g.title} | variations: ${JSON.stringify(g.variations)} | attributes: ${JSON.stringify(g.attributes)}`)
  );
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
