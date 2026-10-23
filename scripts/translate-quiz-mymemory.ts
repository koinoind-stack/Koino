// Translate quiz questions using MyMemory API (free, no API key needed).
// MyMemory is a free translation API that works from any IP.
//
// Limits: 5000 chars/day anonymous, 50000 chars/day with email param.
// We'll use a dummy email to get the higher limit.
//
// For each question we translate:
//   - question text
//   - each option (4 options typically)
//   - explanation
// That's 6 API calls per question. With 1s delay: ~10 questions/minute.

import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}
const MYMEMORY_EMAIL = "translate@believ.app"; // gives us 50K chars/day
const DELAY_MS = 800; // 800ms between API calls

const LANG_MAP: Record<string, string> = {
  hi: "hi", bn: "bn", te: "te", mr: "mr", ta: "ta", gu: "gu",
  ur: "ur", kn: "kn", or: "or", ml: "ml", pa: "pa", as: "as",
};

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function translateText(text: string, targetLang: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}&de=${MYMEMORY_EMAIL}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.responseData?.translatedText || text;
}

async function main() {
  const langCode = process.argv[2] || "hi";
  const targetLang = LANG_MAP[langCode] || langCode;

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

  console.log(`Language: ${langCode}`);
  console.log(`Total: ${all.length} | Done: ${all.length - need.length} | Need: ${need.length}`);
  console.log("");

  if (need.length === 0) {
    console.log("✅ All done!");
    return;
  }

  let translated = 0;
  let failed = 0;

  for (let i = 0; i < need.length; i++) {
    const q = need[i];
    process.stdout.write(`[${i + 1}/${need.length}] ${q.questionId}: `);

    try {
      const options = JSON.parse(q.options);

      // Translate question, options, and explanation in parallel (6 calls at once)
      const [tQuestion, ...tOptions] = await Promise.all([
        translateText(q.question, targetLang),
        ...options.map((o: string) => translateText(o, targetLang)),
      ]);
      const tExplanation = await translateText(q.explanation, targetLang);

      // Validate option count matches
      if (tOptions.length !== options.length) {
        throw new Error(`option count mismatch: ${tOptions.length} vs ${options.length}`);
      }

      // Save to DB
      const existingTranslations = JSON.parse(q.translations || "{}");
      existingTranslations[langCode] = {
        question: tQuestion,
        options: tOptions,
        explanation: tExplanation,
      };

      await db.triviaQuestion.update({
        where: { id: q.id },
        data: { translations: JSON.stringify(existingTranslations) },
      });

      translated++;
      process.stdout.write(`✅ ${tQuestion.substring(0, 40)}...\n`);
    } catch (e) {
      failed++;
      process.stdout.write(`❌ ${(e as Error).message.slice(0, 60)}\n`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n✅ Done: ${translated} translated, ${failed} failed`);
}

main()
  .catch(e => { console.error("Fatal:", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
