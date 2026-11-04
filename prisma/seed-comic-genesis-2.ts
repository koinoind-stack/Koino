// Seed Genesis 2 Comic Bible content.
// Creates 7 panels covering Genesis 2:1–25 with original narration.
//
// Run: bunx tsx prisma/seed-comic-genesis-2.ts

import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// Genesis 2 comic panels — 7 scenes
const GENESIS_2_PANELS = [
  {
    panelId: "GEN2-P01",
    sortOrder: 1,
    verseStart: 1,
    verseEnd: 3,
    artworkUrl: "/comic/genesis-2/panel-1.svg",
    title: "The Seventh Day",
    narration:
      "Thus the heavens and the earth were finished, and all the host of them. And on the seventh day God finished his work that he had done, and he rested on the seventh day from all his work that he had done. So God blessed the seventh day and made it holy.",
    captions: [],
  },
  {
    panelId: "GEN2-P02",
    sortOrder: 2,
    verseStart: 4,
    verseEnd: 7,
    artworkUrl: "/comic/genesis-2/panel-2.svg",
    title: "The Creation of Man",
    narration:
      "In the day that the Lord God made the earth and the heavens, no shrub had yet sprung up, for the Lord God had not caused it to rain. Then the Lord God formed the man of dust from the ground and breathed into his nostrils the breath of life, and the man became a living creature.",
    captions: [],
  },
  {
    panelId: "GEN2-P03",
    sortOrder: 3,
    verseStart: 8,
    verseEnd: 14,
    artworkUrl: "/comic/genesis-2/panel-3.svg",
    title: "The Garden of Eden",
    narration:
      "And the Lord God planted a garden in Eden, in the east, and there he put the man whom he had formed. A river flowed out of Eden to water the garden, dividing into four rivers: Pishon, Gihon, Tigris, and the Euphrates.",
    captions: [],
  },
  {
    panelId: "GEN2-P04",
    sortOrder: 4,
    verseStart: 15,
    verseEnd: 17,
    artworkUrl: "/comic/genesis-2/panel-4.svg",
    title: "Adam in the Garden",
    narration:
      "The Lord God took the man and put him in the garden of Eden to work it and keep it. And the Lord God commanded the man, saying, 'You may surely eat of every tree of the garden, but of the tree of the knowledge of good and evil you shall not eat, for in the day that you eat of it you shall surely die.'",
    captions: [],
  },
  {
    panelId: "GEN2-P05",
    sortOrder: 5,
    verseStart: 18,
    verseEnd: 20,
    artworkUrl: "/comic/genesis-2/panel-5.svg",
    title: "Adam and the Animals",
    narration:
      "Then the Lord God said, 'It is not good that the man should be alone; I will make him a helper fit for him.' Out of the ground the Lord God formed every beast of the field and every bird of the heavens, and brought them to the man to see what he would call them. Whatever the man called every living creature, that was its name.",
    captions: [],
  },
  {
    panelId: "GEN2-P06",
    sortOrder: 6,
    verseStart: 21,
    verseEnd: 22,
    artworkUrl: "/comic/genesis-2/panel-6.svg",
    title: "The Creation of Woman",
    narration:
      "So the Lord God caused a deep sleep to fall upon the man. While he slept, He took one of his ribs and closed up its place with flesh. And the rib that the Lord God had taken from the man he made into a woman and brought her to the man.",
    captions: [],
  },
  {
    panelId: "GEN2-P07",
    sortOrder: 7,
    verseStart: 23,
    verseEnd: 25,
    artworkUrl: "/comic/genesis-2/panel-7.svg",
    title: "Adam and Woman",
    narration:
      "Then the man said, 'This at last is bone of my bones and flesh of my flesh; she shall be called Woman, because she was taken out of Man.' Therefore a man shall leave his father and his mother and hold fast to his wife, and they shall become one flesh. The man and his wife were both naked and were not ashamed.",
    captions: [],
  },
];

// Prayer prompts for each panel (used by the PRAY button)
export const GENESIS_2_PRAYER_PROMPTS = [
  "Lord, thank You for the gift of rest. Help me honor the Sabbath and find peace in Your completed work.",
  "Father, thank You for creating me with purpose. You breathed life into dust — remind me that I am fearfully and wonderfully made.",
  "Lord, thank You for providing a place for me to dwell. Like Eden, may my life be a garden where Your presence flows.",
  "God, give me wisdom to obey Your commands. Help me choose life and resist the things that separate me from You.",
  "Father, thank You for the gift of companionship. Help me be a good steward of the relationships and responsibilities You've given me.",
  "Lord, thank You for the gift of family. May my relationships reflect Your love and the covenant You designed from the beginning.",
  "God, thank You for the beauty of marriage and intimacy. Help me honor the relationships You've blessed me with, walking in transparency and love.",
];

async function main() {
  console.log("🌱 Seeding Genesis 2 Comic Bible...\n");

  // Create the comic chapter
  const chapter = await db.comicChapter.upsert({
    where: { comicId: "genesis-2" },
    create: {
      comicId: "genesis-2",
      bookId: "genesis",
      chapter: 2,
      title: "Genesis 2 — The Creation of Man",
      sortOrder: 1,
      isActive: true,
    },
    update: {},
  });
  console.log(`✅ Comic chapter: ${chapter.comicId} (id: ${chapter.id})`);

  // Create panels + English translations
  for (const panelData of GENESIS_2_PANELS) {
    const panel = await db.comicPanel.upsert({
      where: { panelId: panelData.panelId },
      create: {
        panelId: panelData.panelId,
        comicChapterId: chapter.id,
        sortOrder: panelData.sortOrder,
        artworkUrl: panelData.artworkUrl,
        verseStart: panelData.verseStart,
        verseEnd: panelData.verseEnd,
        bookId: "genesis",
        chapter: 2,
      },
      update: {},
    });

    // English translation
    await db.comicPanelTranslation.upsert({
      where: { panelId_lang: { panelId: panel.panelId, lang: "en" } },
      create: {
        panelId: panel.panelId,
        lang: "en",
        title: panelData.title,
        narration: panelData.narration,
        captions: JSON.stringify(panelData.captions),
      },
      update: {
        title: panelData.title,
        narration: panelData.narration,
        captions: JSON.stringify(panelData.captions),
      },
    });

    console.log(`  ✅ Panel ${panelData.panelId}: ${panelData.title} (Gen 2:${panelData.verseStart}-${panelData.verseEnd})`);
  }

  // Link existing Trivia questions that are about Genesis 2
  // Find questions with bibleBook = "Genesis" that cover chapter 2 topics
  const genesisQuestions = await db.triviaQuestion.findMany({
    where: {
      isActive: true,
      bibleBook: "Genesis",
      // Questions whose scriptureReference mentions "2:" (Genesis 2)
      OR: [
        { scriptureReference: { contains: "2:" } },
        { scriptureReference: { contains: "Genesis 2" } },
      ],
    },
    select: { questionId: true },
  });

  console.log(`\n📚 Found ${genesisQuestions.length} Genesis 2 trivia questions to link`);

  for (let i = 0; i < genesisQuestions.length; i++) {
    const q = genesisQuestions[i];
    await db.comicChapterQuiz.upsert({
      where: { comicChapterId_questionId: { comicChapterId: chapter.id, questionId: q.questionId } },
      create: {
        comicChapterId: chapter.id,
        questionId: q.questionId,
        sortOrder: i + 1,
      },
      update: {},
    });
  }

  console.log(`✅ Linked ${genesisQuestions.length} quiz questions to Genesis 2 comic\n`);
  console.log("✨ Genesis 2 Comic Bible seed complete!");
  console.log(`   Chapter ID: ${chapter.id}`);
  console.log(`   Panels: ${GENESIS_2_PANELS.length}`);
  console.log(`   Quiz questions linked: ${genesisQuestions.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
