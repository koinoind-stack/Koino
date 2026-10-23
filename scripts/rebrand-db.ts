// Rebrand existing DB rows from "CrossCrafted" → "Believ"
// Run against the Supabase Postgres database.
import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}

const db = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
  log: ["query", "error"],
});

async function main() {
  console.log("=== Rebranding DB rows: CrossCrafted → Believ ===\n");

  // 1. Update Gift titles
  const giftUpdates = await db.$executeRaw`
    UPDATE "Gift"
    SET
      title = REPLACE(title, 'CrossCrafted', 'Believ'),
      description = REPLACE(description, 'CrossCrafted', 'Believ')
    WHERE title LIKE '%CrossCrafted%' OR description LIKE '%CrossCrafted%'`;
  console.log(`✅ Updated ${giftUpdates} gift(s) — title/description rebranded`);

  // 2. Show updated gifts to verify
  const gifts = await db.gift.findMany({
    select: { giftId: true, title: true, description: true },
    orderBy: { pointsRequired: "asc" },
    take: 6,
  });
  console.log("\n📋 Current gifts in DB:");
  gifts.forEach((g) => {
    console.log(`  - ${g.giftId}: ${g.title}`);
    if (g.description.includes("CrossCrafted")) {
      console.log(`    ⚠️ description still has CrossCrafted: ${g.description.substring(0, 80)}...`);
    }
  });

  // 3. Update TriviaPointTransaction reason field
  //    Some old redemptions might have "GIFT_REDEMPTION:g1:CrossCrafted T-Shirt"
  const txUpdates = await db.$executeRaw`
    UPDATE "TriviaPointTransaction"
    SET reason = REPLACE(reason, 'CrossCrafted', 'Believ')
    WHERE reason LIKE '%CrossCrafted%'`;
  console.log(`\n✅ Updated ${txUpdates} transaction(s) — reason field rebranded`);

  // 4. Update User.name if any users had "CrossCrafted" in their name
  //    (unlikely but just in case)
  const userUpdates = await db.$executeRaw`
    UPDATE "User"
    SET name = REPLACE(name, 'CrossCrafted', 'Believ')
    WHERE name LIKE '%CrossCrafted%'`;
  console.log(`✅ Updated ${userUpdates} user(s) — name rebranded`);
}

main()
  .then(() => console.log("\n✨ DB rebrand complete!"))
  .catch((e) => {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
