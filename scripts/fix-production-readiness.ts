// Fix: Publish Genesis 2, add altText to all missing panels
import { PrismaClient } from "@prisma/client";
import { assertNotProductionDb } from "./lib/db-guard";

// Phase 1 Fix 5: refuse to run against the production database (see
// scripts/lib/db-guard.ts — this is how E2E test data leaked to prod).
assertNotProductionDb("fix-production-readiness");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}
const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const ALT_TEXTS: Record<string, string> = {
  // Genesis 2
  "GEN2-P01": "God resting after completing creation. The seventh day, peaceful and serene.",
  "GEN2-P02": "God forming Adam from the dust of the ground, breathing life into him.",
  "GEN2-P03": "The Garden of Eden with rivers flowing through lush vegetation and trees.",
  "GEN2-P04": "Adam placed in the garden, standing near the Tree of Knowledge of Good and Evil.",
  "GEN2-P05": "Adam naming the animals God brought before him in the garden.",
  "GEN2-P06": "God creating Eve from Adam's rib while Adam sleeps peacefully.",
  "GEN2-P07": "Adam and Eve together in the garden, unashamed and in harmony with creation.",
  // Genesis 3
  "GEN3-P01": "The serpent speaking to Eve near the Tree of Knowledge in the garden.",
  "GEN3-P02": "Eve reaching for the forbidden fruit while Adam stands beside her.",
  "GEN3-P03": "Adam and Eve hiding among the trees as God's presence approaches in the garden.",
  "GEN3-P04": "God cursing the serpent, cast to the ground beneath the tree.",
  "GEN3-P05": "Adam and Eve receiving God's words of consequence as thorns sprout from the ground.",
  "GEN3-P06": "Adam and Eve clothed in garments of animal skin, God's act of mercy.",
  "GEN3-P07": "Adam and Eve leaving the garden as cherubim with a flaming sword guard the entrance.",
};

async function main() {
  console.log("═══ Fixing production readiness issues ═══\n");

  // 1. Publish Genesis 2 (was in draft status)
  const gen2 = await db.comicChapter.findUnique({ where: { comicId: "genesis-2" } });
  if (gen2 && gen2.status !== "published") {
    await db.comicChapter.update({
      where: { id: gen2.id },
      data: { status: "published", isActive: true },
    });
    console.log("✅ Genesis 2 published (was: " + gen2.status + ")");
  } else {
    console.log("ℹ️  Genesis 2 already published");
  }

  // 2. Add altText to all panels missing it
  console.log("\nAdding altText to panels...");
  const allPanels = await db.comicPanel.findMany({
    select: { id: true, panelId: true, altText: true },
  });

  let added = 0;
  for (const panel of allPanels) {
    if (!panel.altText || !panel.altText.trim()) {
      const alt = ALT_TEXTS[panel.panelId];
      if (alt) {
        await db.comicPanel.update({
          where: { id: panel.id },
          data: { altText: alt },
        });
        added++;
        console.log("  ✅ " + panel.panelId + ": altText added");
      } else {
        console.log("  ⚠️  " + panel.panelId + ": no altText mapping found");
      }
    } else {
      console.log("  ℹ️  " + panel.panelId + ": altText already exists");
    }
  }

  console.log("\n═══ Summary ═══");
  console.log("AltText added: " + added);
  
  // 3. Verify final state
  const chapters = await db.comicChapter.findMany({
    where: { bookId: "genesis", chapter: { in: [2, 3, 4] } },
    include: { panels: { select: { panelId: true, altText: true, artworkUrl: true } } },
    orderBy: { chapter: "asc" },
  });

  console.log("\n═══ Final State ═══");
  for (const ch of chapters) {
    const withAlt = ch.panels.filter(p => p.altText?.trim()).length;
    const withSupabase = ch.panels.filter(p => p.artworkUrl.includes("supabase.co")).length;
    console.log(ch.comicId + ": status=" + ch.status + " | panels=" + ch.panels.length + " | altText=" + withAlt + "/" + ch.panels.length + " | supabase=" + withSupabase + "/" + ch.panels.length);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
