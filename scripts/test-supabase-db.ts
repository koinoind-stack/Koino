// Quick test: connect to Supabase Postgres and run a simple query
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
  log: ["error", "warn"],
});

async function main() {
  console.log("Connecting to Supabase Postgres...");
  try {
    // Try a simple query that doesn't depend on any tables
    const result = await db.$queryRaw`SELECT current_database() as db_name, current_user as user_name, NOW() as server_time;`;
    console.log("✅ Connection successful!");
    console.log("Database:", (result as any)[0].db_name);
    console.log("User:", (result as any)[0].user_name);
    console.log("Server time:", (result as any)[0].server_time);

    // List all tables in public schema
    const tables = await db.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    console.log("\n📋 Tables in public schema:");
    (tables as any[]).forEach((t) => console.log(`  - ${t.table_name}`));

    // Try to query the Gift table
    console.log("\n🎁 Trying to query Gift table...");
    const gifts = await db.gift.findMany({ take: 3 });
    console.log(`✅ Gift query successful — found ${gifts.length} gifts`);
    gifts.forEach((g) => console.log(`  - ${g.giftId}: ${g.title}`));
  } catch (e: any) {
    console.error("❌ Connection/query failed:");
    console.error("Message:", e.message);
    if (e.code) console.error("Code:", e.code);
  } finally {
    await db.$disconnect();
  }
}

main();
