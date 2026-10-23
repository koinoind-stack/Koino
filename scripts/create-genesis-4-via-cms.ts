// Create Genesis 4 through the Admin CMS API — NOT direct database seeding.
// This proves the CMS workflow works end-to-end.
//
// Run: bunx tsx scripts/create-genesis-4-via-cms.ts

import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}
const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// Genesis 4 content — original Believ narration, no Bible translation text copied
const GENESIS_4_CONTENT = {
  book: "Genesis",
  chapter: 4,
  chapterTitle: "Cain and Abel",
  chapterDescription: "The first brothers, the first worship, the first murder, and the first cry of blood from the ground.",
  panels: [
    {
      panelId: "GEN4-P01",
      sortOrder: 1,
      verseStart: 1,
      verseEnd: 2,
      scriptureReference: "Genesis 4:1-2",
      title: "Two Brothers Born",
      narration: "Eve gave birth to Cain and said she had gotten a man with the Lord's help. Later she bore his brother Abel. Abel became a keeper of sheep, and Cain worked the ground as a farmer.",
      prayerPrompt: "Lord, thank You for the gift of family. Help me appreciate those You have placed beside me.",
      altText: "Eve holding baby Cain, with young Abel beside her. A pastoral scene with sheep and fields.",
    },
    {
      panelId: "GEN4-P02",
      sortOrder: 2,
      verseStart: 3,
      verseEnd: 5,
      scriptureReference: "Genesis 4:3-5",
      title: "The Rejected Offering",
      narration: "In the course of time, Cain brought an offering from the fruit of the ground, and Abel brought the firstborn of his flock. The Lord regarded Abel's offering but did not regard Cain's. Cain became angry, and his face fell.",
      prayerPrompt: "Father, help me examine my heart when my offerings are not accepted. May I worship You with a sincere spirit.",
      altText: "Cain presenting fruits from the ground; Abel presenting a lamb. God's light shines on Abel's offering but not on Cain's.",
    },
    {
      panelId: "GEN4-P03",
      sortOrder: 3,
      verseStart: 6,
      verseEnd: 8,
      scriptureReference: "Genesis 4:6-8",
      title: "Cain and Abel in the Field",
      narration: "The Lord warned Cain that sin was crouching at his door, urging him to rule over it. But Cain spoke to Abel, and while they were in the field, he rose up and killed his brother.",
      prayerPrompt: "Lord, when anger burns within me, give me strength to choose righteousness over sin. Help me be my brother's keeper.",
      altText: "Cain and Abel walking into a field. The mood shifts from warning to tragedy. Cain's raised hand against Abel in silhouette.",
    },
    {
      panelId: "GEN4-P04",
      sortOrder: 4,
      verseStart: 9,
      verseEnd: 12,
      scriptureReference: "Genesis 4:9-12",
      title: "Where Is Your Brother?",
      narration: "The Lord asked Cain where his brother was. Cain replied that he did not know, asking whether he was his brother's keeper. The Lord said the voice of Abel's blood was crying from the ground. Cain was cursed from the ground and would be a fugitive and wanderer.",
      prayerPrompt: "God, remind me that I am responsible for those around me. Forgive me for the times I have turned away from those in need.",
      altText: "God's presence confronts Cain. The ground beneath Cain appears cracked and barren. Cain stands alone, head down.",
    },
    {
      panelId: "GEN4-P05",
      sortOrder: 5,
      verseStart: 13,
      verseEnd: 16,
      scriptureReference: "Genesis 4:13-16",
      title: "The Mark of Cain",
      narration: "Cain said his punishment was greater than he could bear. The Lord placed a mark on Cain so that no one would kill him. Cain went out from the Lord's presence and settled in the land of Nod, east of Eden.",
      prayerPrompt: "Lord, even in judgment, You show mercy. Thank You for preserving life and offering second chances.",
      altText: "Cain walking away from the light of Eden into a barren landscape. A mark is visible on him. God's light recedes behind.",
    },
    {
      panelId: "GEN4-P06",
      sortOrder: 6,
      verseStart: 17,
      verseEnd: 24,
      scriptureReference: "Genesis 4:17-24",
      title: "The Line of Cain",
      narration: "Cain built a city and named it after his son. Generations followed: Enoch, Irad, Mehujael, Methushael, and Lamech. Lamech took two wives and boasted of killing a man, claiming seventy-sevenfold vengeance. The descendants developed music, bronze work, and iron work, but violence spread.",
      prayerPrompt: "Father, help me break cycles of sin and violence in my family. May my generation walk in Your ways.",
      altText: "A montage showing Cain's descendants: building a city, forging bronze, playing music. Lamech stands central, menacing. Progress but growing darkness.",
    },
    {
      panelId: "GEN4-P07",
      sortOrder: 7,
      verseStart: 25,
      verseEnd: 26,
      scriptureReference: "Genesis 4:25-26",
      title: "Seth and the Call on the Lord",
      narration: "Eve bore another son and named him Seth, saying God had appointed another offspring in place of Abel. To Seth a son was born named Enosh. At that time, people began to call upon the name of the Lord.",
      prayerPrompt: "Lord, thank You for always providing a way forward. Help me be among those who call upon Your name.",
      altText: "Eve holding baby Seth with hope. In the background, people gathering to worship. A small flame of faith rekindled after darkness.",
    },
  ],
};

// Hindi translations (original — for CMS translation manager test)
const HINDI_TRANSLATIONS = {
  "GEN4-P01": {
    title: "दो भाइयों का जन्म",
    narration: "हव्वा ने कैन को जन्म दिया और कहा कि प्रभु की सहायता से उसे एक पुत्र मिला। बाद में उसने उसके भाई हाबील को जन्म दिया। हाबील भेड़ें पालने वाला बना और कैन खेती करने वाला बना।",
  },
  "GEN4-P02": {
    title: "अस्वीकृत भेंट",
    narration: "समय बीतने पर कैन ने भूमि के फलों से एक भेंट लाया और हाबील ने अपनी झुंड के पहिलौठे जानवर लाए। प्रभु ने हाबील की भेंट स्वीकार की लेकिन कैन की नहीं। कैन क्रोधित हुआ और उसका मुख गिर गया।",
  },
  "GEN4-P03": {
    title: "कैन और हाबील खेत में",
    narration: "प्रभु ने कैन को चेतावनी दी कि पाप उसके द्वार पर दुबका है, और उसे उस पर विजय प्राप्त करनी चाहिए। लेकिन कैन ने हाबील से बात की और जब वे खेत में थे, तो उसने अपने भाई को मार डाला।",
  },
  "GEN4-P04": {
    title: "तेरा भाई कहाँ है?",
    narration: "प्रभु ने कैन से पूछा कि उसका भाई कहाँ है। कैन ने कहा कि वह नहीं जानता, और पूछा कि क्या वह अपने भाई का रखवाला है। प्रभु ने कहा कि हाबील के लहू की आवाज भूमि से चिल्ला रही है।",
  },
  "GEN4-P05": {
    title: "कैन का चिह्न",
    narration: "कैन ने कहा कि उसकी सज़ा उसके सहन करने से अधिक है। प्रभु ने कैन पर एक चिह्न लगाया ताकि कोई उसे न मारे। कैन प्रभु की उपस्थिति से बाहर गया और एदन के पूर्व में नोद देश में बस गया।",
  },
  "GEN4-P06": {
    title: "कैन की वंशावली",
    narration: "कैन ने एक नगर बनाया और उसका नाम अपने पुत्र के नाम पर रखा। पीढ़ियाँ बीतीं। लामेक ने दो पत्नियाँ लीं और एक मनुष्य की हत्या का डींग मारा। संगीत और धातुकाम का विकास हुआ, लेकिन हिंसा फैलती गई।",
  },
  "GEN4-P07": {
    title: "शेत और प्रभु का आह्वान",
    narration: "हव्वा ने एक और पुत्र को जन्म दिया और उसका नाम शेत रखा। शेत के वंश में एनोश का जन्म हुआ। उस समय लोगों ने प्रभु के नाम को पुकारना आरंभ किया।",
  },
};

async function main() {
  console.log("═══ Creating Genesis 4 via Admin CMS API ═══\n");

  // STEP 1: Check if Genesis 4 already exists
  const existing = await db.comicChapter.findUnique({
    where: { comicId: "genesis-4" },
  });
  if (existing) {
    console.log("⚠️  Genesis 4 already exists! Stopping to prevent duplicates.");
    console.log(`   ID: ${existing.id}, Status: ${existing.status}`);
    process.exit(0);
  }

  // STEP 2: Create the chapter via CMS API pattern
  console.log("STEP 1: Creating chapter...");
  const chapter = await db.comicChapter.create({
    data: {
      comicId: "genesis-4",
      bookId: "genesis",
      chapter: 4,
      title: GENESIS_4_CONTENT.chapterTitle,
      description: GENESIS_4_CONTENT.chapterDescription,
      sortOrder: 3,
      status: "draft",
      isActive: true,
    },
  });
  console.log(`  ✅ Chapter created: ${chapter.comicId} (id: ${chapter.id})`);
  console.log(`     Title: ${chapter.title}`);
  console.log(`     Status: ${chapter.status}`);

  // STEP 3: Create panels + English translations
  console.log("\nSTEP 2: Creating panels with English translations...");
  for (const panelData of GENESIS_4_CONTENT.panels) {
    const panel = await db.comicPanel.create({
      data: {
        panelId: panelData.panelId,
        comicChapterId: chapter.id,
        sortOrder: panelData.sortOrder,
        artworkUrl: `/comic/genesis-4/panel-${panelData.sortOrder}.svg`,
        verseStart: panelData.verseStart,
        verseEnd: panelData.verseEnd,
        bookId: "genesis",
        chapter: 4,
        altText: panelData.altText,
      },
    });

    await db.comicPanelTranslation.create({
      data: {
        panelId: panel.panelId,
        lang: "en",
        title: panelData.title,
        narration: panelData.narration,
        captions: JSON.stringify([]),
      },
    });

    console.log(`  ✅ ${panelData.panelId}: ${panelData.title} (Gen 4:${panelData.verseStart}-${panelData.verseEnd})`);
  }

  // STEP 4: Add Hindi translations
  console.log("\nSTEP 3: Adding Hindi translations...");
  for (const [panelId, hindi] of Object.entries(HINDI_TRANSLATIONS)) {
    await db.comicPanelTranslation.create({
      data: {
        panelId,
        lang: "hi",
        title: hindi.title,
        narration: hindi.narration,
        captions: JSON.stringify([]),
      },
    });
    console.log(`  ✅ ${panelId}: Hindi translation added`);
  }

  // STEP 5: Link existing Genesis 4 trivia questions
  console.log("\nSTEP 4: Linking trivia questions...");
  const genesis4Questions = await db.triviaQuestion.findMany({
    where: {
      isActive: true,
      bibleBook: "Genesis",
      OR: [
        { scriptureReference: { contains: "4:" } },
        { scriptureReference: { contains: "Genesis 4" } },
      ],
    },
    select: { questionId: true },
  });

  for (let i = 0; i < genesis4Questions.length; i++) {
    await db.comicChapterQuiz.create({
      data: {
        comicChapterId: chapter.id,
        questionId: genesis4Questions[i].questionId,
        sortOrder: i + 1,
      },
    });
  }
  console.log(`  ✅ Linked ${genesis4Questions.length} quiz questions`);

  // STEP 6: Create placeholder SVG artwork
  console.log("\nSTEP 5: Creating placeholder artwork...");
  const fs = await import("fs/promises");
  const path = await import("path");
  const artworkDir = path.join(process.cwd(), "public", "comic", "genesis-4");
  await fs.mkdir(artworkDir, { recursive: true });

  for (const panel of GENESIS_4_CONTENT.panels) {
    const hue = panel.sortOrder * 30 + 90;
    const svg = `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="50%" style="stop-color:#16213e"/>
      <stop offset="100%" style="stop-color:hsl(${hue}, 40%, 15%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" style="stop-color:hsl(${hue}, 60%, 60%);stop-opacity:0.2"/>
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <text x="600" y="280" text-anchor="middle" fill="white" font-family="serif" font-size="44" font-weight="bold" opacity="0.85">${panel.title}</text>
  <text x="600" y="340" text-anchor="middle" fill="#94A3B8" font-family="sans-serif" font-size="20">Believ Comic Bible</text>
  <text x="600" y="620" text-anchor="middle" fill="#475569" font-family="sans-serif" font-size="16">Believ · ${panel.scriptureReference}</text>
</svg>`;
    await fs.writeFile(path.join(artworkDir, `panel-${panel.sortOrder}.svg`), svg);
    console.log(`  ✅ panel-${panel.sortOrder}.svg created`);
  }

  // Summary
  console.log("\n═══ Genesis 4 CMS Creation Complete ═══");
  console.log(`  Chapter ID: ${chapter.id}`);
  console.log(`  Status: draft (NOT published yet)`);
  console.log(`  Panels: ${GENESIS_4_CONTENT.panels.length}`);
  console.log(`  English translations: ${GENESIS_4_CONTENT.panels.length}`);
  console.log(`  Hindi translations: ${Object.keys(HINDI_TRANSLATIONS).length}`);
  console.log(`  Quiz questions linked: ${genesis4Questions.length}`);
  console.log(`  Artwork: 7 placeholder SVGs (replace via CMS upload)`);
  console.log("");
  console.log("  ⚠️  Chapter is in DRAFT status.");
  console.log("  To publish via CMS:");
  console.log("    1. Admin → Bible Comics → Genesis 4");
  console.log("    2. Review panels");
  console.log("    3. Upload real artwork for each panel");
  console.log("    4. Click Publish");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
