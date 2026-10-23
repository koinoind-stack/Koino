// Seed Genesis 3 Comic Bible content from the JSON content file.
// Run: bunx tsx prisma/seed-comic-genesis-3.ts

import { PrismaClient } from "@prisma/client";
import content from "./genesis-3-comic-content.json";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function main() {
  console.log("🌱 Seeding Genesis 3 Comic Bible...\n");

  const { book, chapter, chapterTitle, chapterDescription, panels } = content;

  // Create the comic chapter (status = "draft" — admin can review + publish)
  const comicChapter = await db.comicChapter.upsert({
    where: { comicId: `${book.toLowerCase()}-${chapter}` },
    create: {
      comicId: `${book.toLowerCase()}-${chapter}`,
      bookId: book.toLowerCase(),
      chapter: chapter,
      title: chapterTitle,
      description: chapterDescription,
      sortOrder: 2, // after Genesis 2
      status: "draft",
      isActive: true,
    },
    update: {
      title: chapterTitle,
      description: chapterDescription,
    },
  });
  console.log(`✅ Comic chapter: ${comicChapter.comicId} (id: ${comicChapter.id})`);
  console.log(`   Status: ${comicChapter.status}`);
  console.log(`   Title: ${chapterTitle}`);

  // Create panels + English translations
  for (const panelData of panels) {
    const panel = await db.comicPanel.upsert({
      where: { panelId: panelData.panelId },
      create: {
        panelId: panelData.panelId,
        comicChapterId: comicChapter.id,
        sortOrder: panelData.sortOrder,
        artworkUrl: `/comic/genesis-3/panel-${panelData.sortOrder}.svg`, // placeholder
        verseStart: panelData.verseStart,
        verseEnd: panelData.verseEnd,
        bookId: book.toLowerCase(),
        chapter: chapter,
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
        captions: JSON.stringify([]),
      },
      update: {
        title: panelData.title,
        narration: panelData.narration,
        captions: JSON.stringify([]),
      },
    });

    console.log(`  ✅ Panel ${panelData.panelId}: ${panelData.title} (${book} ${chapter}:${panelData.verseStart}-${panelData.verseEnd})`);
  }

  // Link existing Trivia questions about Genesis 3
  const genesis3Questions = await db.triviaQuestion.findMany({
    where: {
      isActive: true,
      bibleBook: "Genesis",
      OR: [
        { scriptureReference: { contains: "3:" } },
        { scriptureReference: { contains: "Genesis 3" } },
      ],
    },
    select: { questionId: true },
  });

  console.log(`\n📚 Found ${genesis3Questions.length} Genesis 3 trivia questions to link`);

  for (let i = 0; i < genesis3Questions.length; i++) {
    const q = genesis3Questions[i];
    await db.comicChapterQuiz.upsert({
      where: { comicChapterId_questionId: { comicChapterId: comicChapter.id, questionId: q.questionId } },
      create: {
        comicChapterId: comicChapter.id,
        questionId: q.questionId,
        sortOrder: i + 1,
      },
      update: {},
    });
  }

  console.log(`✅ Linked ${genesis3Questions.length} quiz questions to Genesis 3 comic\n`);
  console.log("✨ Genesis 3 Comic Bible seed complete!");
  console.log(`   Chapter ID: ${comicChapter.id}`);
  console.log(`   Panels: ${panels.length}`);
  console.log(`   Quiz questions linked: ${genesis3Questions.length}`);
  console.log(`   Status: draft (admin can review and publish via CMS)`);
  console.log("");
  console.log("📋 To publish:");
  console.log("   1. Go to Admin → Bible Comics");
  console.log("   2. Open Genesis 3");
  console.log("   3. Review panels");
  console.log("   4. Upload artwork for each panel");
  console.log("   5. Click Publish");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
