/**
 * Local smoke test for the Task 121 share-card renderer (no DB needed).
 * Renders one card per format + one with an artwork-style background, and
 * writes PNGs to /tmp for inspection. Run: npx tsx scripts/share-card-smoke.ts
 */
import { renderShareCard } from "../src/lib/share/card-renderer";
import fs from "fs";

async function main() {
  const specs = [
    {
      name: "verse-square",
      spec: {
        format: "square" as const,
        kicker: "Bible Verse",
        title:
          "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
        reference: "John 3:16 (KJV)",
        gradientSeed: 1,
      },
    },
    {
      name: "verse-story",
      spec: {
        format: "story" as const,
        kicker: "Bible Verse",
        title:
          "The Lord is my shepherd, I lack nothing. He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul. He guides me along the right paths for his name's sake.",
        reference: "Psalm 23:1-3 (WEB)",
        gradientSeed: 1,
      },
    },
    {
      name: "landscape-og",
      spec: {
        format: "landscape" as const,
        kicker: "Bible Comics • Genesis 1",
        title: "In the Beginning",
        body:
          "Day one: light breaks into the darkness. God speaks, and creation begins to take shape across the pages of Scripture.",
        reference: "Genesis 1:1-5",
        gradientSeed: 0,
      },
    },
    {
      name: "portrait-bg",
      spec: {
        format: "portrait" as const,
        kicker: "Bible Comics • Genesis 1",
        title: "A Cover Card With Artwork",
        body: "This one composites a real background image under the scrim — the path used for Koino-hosted artwork.",
        reference: "Genesis 1",
        bgImageUrl:
          "https://irzkwtrawvtqfpbyapzx.supabase.co/storage/v1/object/public/believ-comic-artwork/comics/genesis/1/GEN1-P01.webp",
        bgIsKoinoHosted: true,
        gradientSeed: 0,
      },
    },
  ];

  for (const { name, spec } of specs) {
    const png = await renderShareCard(spec);
    const out = `/tmp/sharecard-${name}.png`;
    fs.writeFileSync(out, png);
    console.log(`OK ${name}: ${png.length} bytes -> ${out}`);
  }
  console.log("ALL RENDER SMOKE TESTS PASSED");
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
