/**
 * Seed script — reads questions from trivia-questions.json and upserts them.
 * Idempotent: safe to run multiple times (uses upsert).
 *
 * Run with: bun run db:seed
 */

import { db } from "../src/lib/db";
import triviaData from "./trivia-questions.json";

type QuestionData = {
  questionId: string;
  question: string;
  options: string; // JSON string
  correctAnswer: number;
  explanation: string;
  scriptureReference: string | null;
  difficulty: string;
  category: string;
  basePoints: number;
  bibleBook: string | null;
  topic: string;
};

const DEFAULT_GIFTS = [
  { giftId: "g1", title: "Believ T-Shirt", description: "Premium cotton tee with the Believ logo. Available in S, M, L, XL.", imageUrl: "https://images.unsplash.com/photo-1438032005730-c779502df39b?crop=entropy&cs=srgb&fm=jpg&w=400&q=80", pointsRequired: 3000, tier: "bronze", stock: 50 },
  { giftId: "g2", title: "Personalized Bible (ESV)", description: "English Standard Version Bible with your name embossed. Genuine leather.", imageUrl: "https://images.unsplash.com/photo-1546484959-f9a381d1330d?crop=entropy&cs=srgb&fm=jpg&w=400&q=80", pointsRequired: 5000, tier: "silver", stock: 20 },
  { giftId: "g3", title: "Olive Wood Cross from Bethlehem", description: "Hand-carved olive wood cross from Bethlehem. Certificate of authenticity.", imageUrl: "https://images.unsplash.com/photo-1565728744382-61accd4aa148?crop=entropy&cs=srgb&fm=jpg&w=400&q=80", pointsRequired: 10000, tier: "gold", stock: 10 },
  { giftId: "g4", title: "Premium T-Shirt OR Phone Cover", description: "Choose a premium Believ t-shirt OR a custom phone cover.", imageUrl: "https://images.unsplash.com/photo-1438032005730-c779502df39b?crop=entropy&cs=srgb&fm=jpg&w=400&q=80", pointsRequired: 20000, tier: "gold", stock: 30 },
  { giftId: "g5", title: "Premium T-Shirt + Phone Cover", description: "Both the premium t-shirt AND a custom phone cover — bundled together.", imageUrl: "https://images.unsplash.com/photo-1520637836862-4d197d17c91a?crop=entropy&cs=srgb&fm=jpg&w=400&q=80", pointsRequired: 30000, tier: "platinum", stock: 15 },
  { giftId: "g6", title: "Premium Merchandise Bundle", description: "Complete bundle: t-shirt, phone cover, Bible cover, and devotional book.", imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=srgb&fm=jpg&w=400&q=80", pointsRequired: 50000, tier: "platinum", stock: 5 },
];

async function seed() {
  const questions = triviaData as QuestionData[];
  console.log(`🌱 Seeding ${questions.length} trivia questions...`);

  for (const q of questions) {
    await db.triviaQuestion.upsert({
      where: { questionId: q.questionId },
      create: {
        questionId: q.questionId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        scriptureReference: q.scriptureReference,
        difficulty: q.difficulty,
        category: q.category,
        bibleBook: q.bibleBook,
        topic: q.topic,
        basePoints: q.basePoints,
      },
      update: {},
    });
  }
  console.log(`✅ Seeded ${questions.length} questions`);

  console.log("🎁 Seeding gifts...");
  for (const g of DEFAULT_GIFTS) {
    await db.gift.upsert({
      where: { giftId: g.giftId },
      create: g,
      update: {},
    });
  }
  console.log(`✅ Seeded ${DEFAULT_GIFTS.length} gifts`);

  // Summary
  
  const counts: Record<string, number> = {};
  for (const q of questions) {
    const key = `${q.difficulty}_${q.category}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  console.log("\n📊 Question count by difficulty × category:");
  const difficulties = ["beginners", "intermediate", "skilled", "expert"];
  const categories = ["full_bible", "new_testament", "old_testament", "apologetics"];
  for (const d of difficulties) {
    const row = categories.map(c => counts[`${d}_${c}`] || 0);
    console.log(`  ${d.padEnd(15)} ${row.join(", ")}`);
  }
  console.log(`  Total: ${questions.length} questions`);
  console.log(`  Gifts: ${DEFAULT_GIFTS.length}`);
  console.log("\n✨ Seed complete!");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
