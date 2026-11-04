// Ultra-conservative quiz translation: 1 question at a time, 10s delay.
// Each question is a fresh process. If this hangs, nothing will work.
//
// Usage: bunx tsx scripts/translate-quiz-slow.ts hi
import ZAI from "z-ai-web-dev-sdk";
import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi (Devanagari)", bn: "Bengali", te: "Telugu", mr: "Marathi",
  ta: "Tamil", gu: "Gujarati", ur: "Urdu (Nastaliq)", kn: "Kannada",
  or: "Odia", ml: "Malayalam", pa: "Punjabi (Gurmukhi)", as: "Assamese",
};

const langCode = process.argv[2] || "hi";
const langName = LANG_NAMES[langCode] || langCode;

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function main() {
  // Find questions that need translation
  const all = await db.triviaQuestion.findMany({
    where: { isActive: true },
    select: { id: true, questionId: true, question: true, options: true, explanation: true, translations: true },
    orderBy: { questionId: "asc" },
  });

  const need = all.filter(q => {
    try {
      const t = JSON.parse(q.translations || "{}");
      return !t[langCode]?.question;
    } catch { return true; }
  });

  console.log(`Language: ${langName} (${langCode})`);
  console.log(`Total: ${all.length} | Done: ${all.length - need.length} | Need: ${need.length}`);
  console.log("");

  if (need.length === 0) {
    console.log("✅ All done!");
    return;
  }

  const zai = await ZAI.create();
  let translated = 0;
  let failed = 0;

  for (let i = 0; i < need.length; i++) {
    const q = need[i];
    process.stdout.write(`[${i + 1}/${need.length}] ${q.questionId}: `);

    const items = [{
      id: q.questionId,
      question: q.question,
      options: JSON.parse(q.options),
      explanation: q.explanation,
    }];

    const prompt = `Translate this Bible trivia quiz JSON from English to ${langName}. Keep Bible references like "John 3:16" as-is. Return ONLY a JSON array: [{"id":"${q.questionId}","question":"...","options":[...],"explanation":"..."}]. No markdown.

${JSON.stringify(items)}`;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 30000)
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

      if (!Array.isArray(translations) || translations.length === 0) throw new Error("empty");

      const t = translations[0];
      if (!t.question || !Array.isArray(t.options)) throw new Error("malformed");

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

      translated++;
      process.stdout.write(`✅ ${t.question.substring(0, 40)}...\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`❌ ${(e as Error).message.slice(0, 60)}\n`);
    }

    // 3 second delay between questions
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\n✅ Done: ${translated} translated, ${failed} failed`);
}

main()
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
