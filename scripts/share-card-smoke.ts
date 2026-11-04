/**
 * Local smoke test for the Task 121 share-card renderer (no DB needed).
 * Renders one card per format + script coverage (Latin/Hindi/Telugu), and
 * writes PNGs to /tmp for inspection. Run: npx tsx scripts/share-card-smoke.ts
 *
 * NOTE: the renderer provisions an ISOLATED fontconfig (FONTCONFIG_PATH →
 * /tmp/koino-share-fonts with ONLY the bundled fonts) at module load — so
 * this test simulates the bare Vercel runtime exactly.
 */
import { renderShareCard } from "../src/lib/share/card-renderer";
import fs from "fs";

async function main() {
  const specs = [
    {
      name: "verse-square",
      spec: {
        format: "square" as const,
        kicker: "Bible Verse • KJV",
        title: "John 3:16",
        body:
          "16 For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life. For God did not send his Son into the world to condemn the world, but to save the world through him.",
        gradientSeed: 1,
      },
    },
    {
      name: "hindi-square",
      spec: {
        format: "square" as const,
        kicker: "BIBLE COMICS • उत्पत्ति 1",
        title: "आदि में परमेश्वर ने आकाश और पृथ्वी की सृष्टि की",
        body: "परमेश्वर ने कहा, “प्रकाश हो!” और प्रकाश हो गया। यहोवा ने देखा कि प्रकाश अच्छा है।",
        reference: "उत्पत्ति 1:1-5",
        gradientSeed: 0,
      },
    },
    {
      name: "telugu-square",
      spec: {
        format: "square" as const,
        kicker: "BIBLE COMICS • ఆదికాండము 1",
        title: "దేవుడు ఆదిలో ఆకాశమును భూమియు సృష్టించెను",
        body: "దేవుడు \u201cవెలుగు కలుగునుగాక\u201d అని అనెను, అప్పుడు వెలుగు కలిగెను.",
        reference: "ఆదికాండము 1:1-5",
        gradientSeed: 0,
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
      name: "portrait-story",
      spec: {
        format: "story" as const,
        kicker: "Bible Verse • WEB",
        title: "Psalm 23:1-6",
        body:
          "1 The Lord is my shepherd; I shall not want. 2 He maketh me to lie down in green pastures: he leadeth me beside the still waters. 3 He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake. 4 Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
        gradientSeed: 1,
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
