// Translate ONE batch of 5 quiz questions.
// Called repeatedly by the shell script. Each call is a fresh process
// so no SDK state accumulation or memory leaks.
//
// Usage: bunx tsx scripts/translate-one-batch.ts <batch_num> <lang_code>

import ZAI from "z-ai-web-dev-sdk";
import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}
const BATCH_SIZE = 5;

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi (Devanagari)", bn: "Bengali", te: "Telugu", mr: "Marathi",
  ta: "Tamil", gu: "Gujarati", ur: "Urdu (Nastaliq)", kn: "Kannada",
  or: "Odia", ml: "Malayalam", pa: "Punjabi (Gurmukhi)", as: "Assamese",
};

async function main() {
  const batchNum = parseInt(process.argv[2] || "1");
  const langCode = process.argv[3] || "hi";
  const langName = LANG_NAMES[langCode] || langCode;

  const db = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  try {
    // Load all questions that need translation for this language
    const allQuestions = await db.triviaQuestion.findMany({
      where: { isActive: true },
      select: { id: true, questionId: true, question: true, options: true, explanation: true, translations: true },
    });

    const needTranslation = allQuestions.filter(q => {
      try {
        const t = JSON.parse(q.translations || "{}");
        return !t[langCode]?.question;
      } catch { return true; }
    });

    const startIdx = (batchNum - 1) * BATCH_SIZE;
    const batch = needTranslation.slice(startIdx, startIdx + BATCH_SIZE);

    if (batch.length === 0) {
      console.log("DONE"); // Signal to shell script that all batches are complete
      return;
    }

    // Build prompt
    const items = batch.map(q => ({
      id: q.questionId,
      question: q.question,
      options: JSON.parse(q.options),
      explanation: q.explanation,
    }));

    const prompt = `You are a professional translator for ${langName}. Translate this Bible trivia quiz JSON from English to ${langName}. Keep Bible references like "John 3:16" as-is. Return ONLY a valid JSON array with the same structure: [{"id":"...","question":"...","options":[...],"explanation":"..."}]. No markdown, no code fences, no commentary.

INPUT:
${JSON.stringify(items, null, 2)}

OUTPUT (JSON array only):`;

    // Call ZAI with a hard 45s timeout
    const zai = await ZAI.create();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 45000)
    );

    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        thinking: { type: "disabled" },
      }),
      timeoutPromise,
    ]);

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    const translations = JSON.parse(cleaned);

    if (!Array.isArray(translations)) throw new Error("not array");

    // Save to DB
    let saved = 0;
    for (const t of translations) {
      const q = batch.find(b => b.questionId === t.id);
      if (!q || !t.question || !Array.isArray(t.options)) continue;
      if (t.options.length !== JSON.parse(q.options).length) continue;

      const existingTranslations = JSON.parse(q.translations || "{}");
      existingTranslations[langCode] = {
        question: String(t.question),
        options: t.options.map(String),
        explanation: String(t.explanation || ""),
      };

      await db.triviaQuestion.update({
        where: { id: q.id },
        data: { translations: JSON.stringify(existingTranslations) },
      });
      saved++;
    }

    console.log(`OK ${saved}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch(e => {
  console.error(`ERROR: ${e.message.slice(0, 100)}`);
  process.exit(1);
});
