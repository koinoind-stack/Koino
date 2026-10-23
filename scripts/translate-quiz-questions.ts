// Translate TriviaQuestion content (question + options + explanation) into
// all 12 Indian languages, storing results in the `translations` JSON column.
//
// Strategy:
//   - Process languages one at a time (avoids losing all progress if rate-limited)
//   - Batch ~5 questions per LLM call (smaller = more reliable + under token limits)
//   - Save progress after each batch (resume-friendly)
//   - Retry with exponential backoff on 429 rate limit
//   - Skip questions that already have the target language translation
//
// Usage:
//   bunx tsx scripts/translate-quiz-questions.ts hi     # translate to Hindi only
//   bunx tsx scripts/translate-quiz-questions.ts all    # translate to all 12 languages

import ZAI from "z-ai-web-dev-sdk";
import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. "
      + "Set it in .env (local) or your shell/CI environment before running this script."
  );
}

const db = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
  log: ["error", "warn"],
});

type Lang = { code: string; name: string };

const ALL_LANGUAGES: Lang[] = [
  { code: "hi", name: "Hindi (Devanagari)" },
  { code: "bn", name: "Bengali" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
  { code: "ta", name: "Tamil" },
  { code: "gu", name: "Gujarati" },
  { code: "ur", name: "Urdu (Nastaliq)" },
  { code: "kn", name: "Kannada" },
  { code: "or", name: "Odia" },
  { code: "ml", name: "Malayalam" },
  { code: "pa", name: "Punjabi (Gurmukhi)" },
  { code: "as", name: "Assamese" },
];

const BATCH_SIZE = 5; // 5 questions per call (ZAI can handle this)
const DELAY_MS = 3000; // 3s between calls

type Question = {
  id: string;
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

type Translation = {
  question: string;
  options: string[];
  explanation: string;
};

function parseOptions(optionsStr: string): string[] {
  try {
    const parsed = JSON.parse(optionsStr);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function buildPrompt(questions: Question[], langName: string): string {
  const items = questions.map((q, i) => ({
    id: q.questionId,
    question: q.question,
    options: q.options,
    explanation: q.explanation,
  }));

  return `You are a professional translator for ${langName}, working on a Christian Bible trivia app called "Believ".

TASK: Translate the quiz questions below from English to ${langName}. For EACH item, translate:
1. The "question" field (the quiz question itself)
2. The "options" array (all answer choices — preserve order!)
3. The "explanation" field (the answer explanation with Bible reference)

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no code fences, no commentary.
2. Keep the structure: [{ "id": "...", "question": "...", "options": [...], "explanation": "..." }, ...]
3. Preserve the ORDER of options — the correct answer index is tracked separately and depends on option position.
4. Keep Bible book names recognizable (e.g., "John", "Genesis" can be transliterated or kept in English if that's natural for ${langName}).
5. Use respectful, fluent Christian-friendly tone.
6. Keep scripture references like "John 3:16" as-is.
7. Number of items in input: ${questions.length}. Number of items in output MUST be exactly ${questions.length}.

INPUT (English):
${JSON.stringify(items, null, 2)}

OUTPUT (translated to ${langName} — JSON array only):`;
}

async function translateBatch(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  questions: Question[],
  lang: Lang
): Promise<Record<string, Translation>> {
  const prompt = buildPrompt(questions, lang.name);

  // 90s hard timeout — abort if API hangs
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("API timeout after 90s")), 90000)
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

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array, got ${typeof parsed}`);
  }

  const result: Record<string, Translation> = {};
  for (const item of parsed) {
    if (!item.id || !item.question || !Array.isArray(item.options)) {
      console.warn(`  ⚠️ Skipping malformed item: ${JSON.stringify(item).slice(0, 100)}`);
      continue;
    }
    result[item.id] = {
      question: String(item.question),
      options: item.options.map(String),
      explanation: String(item.explanation || ""),
    };
  }
  return result;
}

async function processLanguage(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  lang: Lang
): Promise<{ translated: number; skipped: number; failed: number }> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`→ Translating quiz content to ${lang.name} (${lang.code})`);

  // Load all questions
  const allQuestions = await db.triviaQuestion.findMany({
    where: { isActive: true },
    select: {
      id: true,
      questionId: true,
      question: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      translations: true,
    },
  });
  console.log(`   Total questions in DB: ${allQuestions.length}`);

  // Filter out questions that already have this language translated
  const toTranslate: Question[] = [];
  for (const q of allQuestions) {
    const existing: Record<string, Translation> = (() => {
      try { return JSON.parse(q.translations || "{}"); } catch { return {}; }
    })();
    if (existing[lang.code]?.question) {
      continue; // already translated
    }
    toTranslate.push({
      id: q.id,
      questionId: q.questionId,
      question: q.question,
      options: parseOptions(q.options),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    });
  }

  console.log(`   Already translated: ${allQuestions.length - toTranslate.length}`);
  console.log(`   Need to translate: ${toTranslate.length}`);

  if (toTranslate.length === 0) {
    console.log(`   ✅ All questions already translated — skipping`);
    return { translated: 0, skipped: allQuestions.length, failed: 0 };
  }

  // Batch the questions
  const batches: Question[][] = [];
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    batches.push(toTranslate.slice(i, i + BATCH_SIZE));
  }
  console.log(`   Split into ${batches.length} batches of ~${BATCH_SIZE} questions`);

  let translated = 0;
  let failed = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    process.stdout.write(`   batch ${b + 1}/${batches.length} (${batch.length} Qs)... `);

    let translations: Record<string, Translation> | null = null;
    let lastError: Error | null = null;

    // Retry up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        translations = await translateBatch(zai, batch, lang);
        break;
      } catch (e) {
        lastError = e as Error;
        if (attempt < 3) {
          const wait = 4000 * attempt; // 4s, 8s, 12s
          process.stdout.write(`(retry ${attempt} in ${wait / 1000}s) `);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }

    if (!translations) {
      process.stdout.write(`❌ ${lastError?.message?.slice(0, 80)}\n`);
      failed += batch.length;
      // Wait 30s after a 429 rate limit error before next batch
      console.log(`   ⏸️  Pausing 30s for rate limit to reset...`);
      await new Promise((r) => setTimeout(r, 30000));
      continue;
    }

    // Save translations to DB
    for (const q of batch) {
      const translation = translations[q.questionId];
      if (!translation) {
        console.warn(`  ⚠️ No translation returned for ${q.questionId}`);
        failed++;
        continue;
      }

      // Load existing translations + merge new one
      const existingQ = allQuestions.find((x) => x.questionId === q.questionId);
      const existingTranslations: Record<string, Translation> = (() => {
        try { return JSON.parse(existingQ?.translations || "{}"); } catch { return {}; }
      })();
      existingTranslations[lang.code] = translation;

      await db.triviaQuestion.update({
        where: { id: q.id },
        data: { translations: JSON.stringify(existingTranslations) },
      });
      translated++;
    }

    process.stdout.write(`✅ ${Object.keys(translations).length} translated\n`);

    // Save progress — wait before next batch
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`   ✅ Done: ${translated} translated, ${failed} failed`);
  return { translated, failed, skipped: allQuestions.length - toTranslate.length };
}

async function main() {
  const targetArg = process.argv[2] || "all";
  const langs = targetArg === "all" ? ALL_LANGUAGES : ALL_LANGUAGES.filter((l) => l.code === targetArg);

  if (langs.length === 0) {
    console.error(`Unknown language code: ${targetArg}`);
    console.error(`Valid codes: ${ALL_LANGUAGES.map((l) => l.code).join(", ")}, or 'all'`);
    process.exit(1);
  }

  console.log(`Initializing ZAI SDK...`);
  const zai = await ZAI.create();

  const summary: { lang: string; translated: number; failed: number; skipped: number }[] = [];
  for (const lang of langs) {
    try {
      const result = await processLanguage(zai, lang);
      summary.push({ lang: lang.code, ...result });
    } catch (e) {
      console.error(`❌ ${lang.code} failed entirely: ${(e as Error).message}`);
      summary.push({ lang: lang.code, translated: 0, failed: 0, skipped: 0 });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY:");
  for (const s of summary) {
    console.log(`  ${s.lang}: ${s.translated} translated, ${s.failed} failed, ${s.skipped} skipped`);
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
