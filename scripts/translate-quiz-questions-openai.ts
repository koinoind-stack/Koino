// Translate TriviaQuestion content (question + options + explanation) into
// all 12 Indian languages using OpenAI's gpt-4o-mini model.
//
// Why OpenAI? ZAI's API rate-limited us (429). OpenAI's gpt-4o-mini:
//   - 500 requests/min on standard tier
//   - 200 input + 800 output tokens per request ~ $0.0002/translation
//   - 800 questions × 12 languages × $0.0002 = ~$1.92 total
//   - Should complete in ~30-60 minutes
//
// Storage: translations are saved to the `translations` JSON column on
// TriviaQuestion (added in the schema migration). Format:
//   {
//     "hi": { "question": "...", "options": [...], "explanation": "..." },
//     "te": { ... }, ...
//   }
//
// Usage:
//   OPENAI_API_KEY=sk-... bunx tsx scripts/translate-quiz-questions-openai.ts hi
//   OPENAI_API_KEY=sk-... bunx tsx scripts/translate-quiz-questions-openai.ts all
//
// Resume-friendly: skips questions that already have the target language
// translation. Run multiple times safely.

import OpenAI from "openai";
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

type Lang = { code: string; name: string; nativeName: string };

const ALL_LANGUAGES: Lang[] = [
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
];

const BATCH_SIZE = 5; // 5 questions per LLM call (OpenAI can handle much more)
const DELAY_MS = 200; // 200ms delay between batches (OpenAI rate limit = 500/min)
const MODEL = "gpt-4o-mini";

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

function buildPrompt(questions: Question[], lang: Lang): { system: string; user: string } {
  const items = questions.map((q) => ({
    id: q.questionId,
    question: q.question,
    options: q.options,
    explanation: q.explanation,
  }));

  const system = `You are a professional translator for ${lang.name} (${lang.nativeName}), working on a Christian Bible trivia app called "Believ".

CRITICAL RULES:
1. Translate the question, ALL options (preserve order!), and the explanation.
2. Use respectful, fluent Christian-friendly ${lang.name}.
3. Keep Bible book names recognizable (e.g., "John", "Genesis" — transliterate if natural for ${lang.name}).
4. Keep scripture references like "John 3:16" as-is.
5. The number of input items MUST equal the number of output items, in the SAME ORDER.
6. Return ONLY a valid JSON array — no markdown, no commentary, no code fences.`;

  const user = `Translate the following ${questions.length} quiz items from English to ${lang.name}. Each item must have: "id", "question", "options" (array), "explanation".

INPUT:
${JSON.stringify(items, null, 2)}

OUTPUT (JSON array, same length, same order):`;

  return { system, user };
}

async function translateBatch(
  openai: OpenAI,
  questions: Question[],
  lang: Lang
): Promise<Record<string, Translation>> {
  const { system, user } = buildPrompt(questions, lang);

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3, // low temperature for consistent translations
    max_tokens: 4000,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  // Strip markdown code fences if present
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
    // Validate option count matches (correctness check)
    const original = questions.find((q) => q.questionId === item.id);
    if (original && item.options.length !== original.options.length) {
      console.warn(`  ⚠️ ${item.id}: option count mismatch (${item.options.length} vs ${original.options.length}) — skipping`);
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
  openai: OpenAI,
  lang: Lang
): Promise<{ translated: number; skipped: number; failed: number }> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`→ Translating quiz content to ${lang.name} (${lang.nativeName}) [${lang.code}]`);

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
    if (existing[lang.code]?.question) continue;
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

  const batches: Question[][] = [];
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    batches.push(toTranslate.slice(i, i + BATCH_SIZE));
  }
  console.log(`   Split into ${batches.length} batches of ~${BATCH_SIZE} questions`);

  let translated = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    process.stdout.write(`   batch ${b + 1}/${batches.length} (${batch.length} Qs)... `);

    let translations: Record<string, Translation> | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        translations = await translateBatch(openai, batch, lang);
        consecutiveFailures = 0;
        break;
      } catch (e) {
        lastError = e as Error;
        if (attempt < 3) {
          const wait = 2000 * attempt;
          process.stdout.write(`(retry ${attempt} in ${wait / 1000}s) `);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }

    if (!translations) {
      process.stdout.write(`❌ ${lastError?.message?.slice(0, 80)}\n`);
      failed += batch.length;
      consecutiveFailures++;
      // If we've failed 5 batches in a row, abort this language
      if (consecutiveFailures >= 5) {
        console.log(`   🛑 5 consecutive failures — aborting ${lang.code}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    // Save translations to DB
    for (const q of batch) {
      const translation = translations[q.questionId];
      if (!translation) {
        console.warn(`\n  ⚠️ No translation returned for ${q.questionId}`);
        failed++;
        continue;
      }
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

    if (DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`   ✅ Done: ${translated} translated, ${failed} failed`);
  return { translated, failed, skipped: allQuestions.length - toTranslate.length };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY environment variable is required.");
    console.error("   Example: OPENAI_API_KEY=sk-... bunx tsx scripts/translate-quiz-questions-openai.ts hi");
    process.exit(1);
  }

  const targetArg = process.argv[2] || "all";
  const langs = targetArg === "all" ? ALL_LANGUAGES : ALL_LANGUAGES.filter((l) => l.code === targetArg);

  if (langs.length === 0) {
    console.error(`Unknown language code: ${targetArg}`);
    console.error(`Valid codes: ${ALL_LANGUAGES.map((l) => l.code).join(", ")}, or 'all'`);
    process.exit(1);
  }

  console.log(`Initializing OpenAI client (model: ${MODEL})...`);
  const openai = new OpenAI({ apiKey });

  const summary: { lang: string; translated: number; failed: number; skipped: number }[] = [];
  for (const lang of langs) {
    try {
      const result = await processLanguage(openai, lang);
      summary.push({ lang: lang.code, ...result });
    } catch (e) {
      console.error(`❌ ${lang.code} failed entirely: ${(e as Error).message}`);
      summary.push({ lang: lang.code, translated: 0, failed: 0, skipped: 0 });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY:");
  let totalTranslated = 0;
  let totalFailed = 0;
  for (const s of summary) {
    console.log(`  ${s.lang}: ${s.translated} translated, ${s.failed} failed, ${s.skipped} skipped`);
    totalTranslated += s.translated;
    totalFailed += s.failed;
  }
  console.log(`\n  TOTAL: ${totalTranslated} translated, ${totalFailed} failed`);
  console.log(`  Estimated cost: $${(totalTranslated * 0.0002).toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
