#!/bin/bash
# Translate quiz questions using z-ai CLI (avoids Node.js SDK hanging issue)
# Processes one language at a time, one batch at a time.
#
# Strategy:
#   1. Export questions that need translation from DB to a temp JSON file
#   2. For each batch of 5 questions, call `z-ai chat` via CLI
#   3. Parse the JSON response
#   4. Write translations back to DB
#
# Usage: bash scripts/translate-quiz-cli.sh hi
#        bash scripts/translate-quiz-cli.sh all

set -e

: "${DATABASE_URL:?Error: DATABASE_URL environment variable is required (see .env.example)}"
export DATABASE_URL

LANG_ARG="${1:-all}"
LANGS="hi bn te mr ta gu ur kn or ml pa as"

if [ "$LANG_ARG" != "all" ]; then
  LANGS="$LANG_ARG"
fi

for LANG_CODE in $LANGS; do
  echo ""
  echo "============================================================"
  echo "→ Translating quiz content to language: $LANG_CODE"
  echo "============================================================"

  # Step 1: Export questions that need translation for this language
  echo "  Exporting questions from DB..."
  bunx tsx -e "
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    (async () => {
      const all = await db.triviaQuestion.findMany({
        where: { isActive: true },
        select: { id: true, questionId: true, question: true, options: true, explanation: true, translations: true }
      });
      const need = all.filter(q => {
        try {
          const t = JSON.parse(q.translations || '{}');
          return !t['${LANG_CODE}']?.question;
        } catch { return true; }
      }).map(q => ({
        id: q.id,
        questionId: q.questionId,
        question: q.question,
        options: JSON.parse(q.options),
        explanation: q.explanation,
        existingTranslations: JSON.parse(q.translations || '{}')
      }));
      const fs = require('fs');
      fs.writeFileSync('/tmp/quiz-to-translate.json', JSON.stringify(need));
      console.log('  Total:', all.length, '| Already translated:', all.length - need.length, '| Need:', need.length);
      await db.\$disconnect();
    })();
  " 2>&1 | grep -v "prisma:"

  NEED_COUNT=$(cat /tmp/quiz-to-translate.json | bunx tsx -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length)")
  if [ "$NEED_COUNT" = "0" ]; then
    echo "  ✅ All questions already translated for $LANG_CODE — skipping"
    continue
  fi

  echo "  Need to translate: $NEED_COUNT questions"
  echo "  Starting batch translation (5 questions per call)..."

  # Step 2 + 3: Process in batches of 5
  TOTAL_BATCHES=$(( (NEED_COUNT + 4) / 5 ))
  BATCH=0
  TRANSLATED=0
  FAILED=0

  while true; do
    BATCH=$((BATCH + 1))

    # Extract the next batch of 5 questions
    bunx tsx -e "
      const fs = require('fs');
      const all = JSON.parse(fs.readFileSync('/tmp/quiz-to-translate.json', 'utf8'));
      const batch = all.slice(($BATCH - 1) * 5, $BATCH * 5);
      if (batch.length === 0) { process.exit(99); }
      fs.writeFileSync('/tmp/quiz-batch.json', JSON.stringify(batch));
      console.log(batch.length);
    " 2>/dev/null > /tmp/quiz-batch-count.txt
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 99 ]; then
      break
    fi
    BATCH_COUNT=$(cat /tmp/quiz-batch-count.txt)

    printf "  batch %d/%d (%d Qs)... " "$BATCH" "$TOTAL_BATCHES" "$BATCH_COUNT"

    # Build the prompt
    LANG_NAME=$(case $LANG_CODE in
      hi) echo "Hindi (Devanagari)";; bn) echo "Bengali";; te) echo "Telugu";;
      mr) echo "Marathi";; ta) echo "Tamil";; gu) echo "Gujarati";;
      ur) echo "Urdu (Nastaliq)";; kn) echo "Kannada";; or) echo "Odia";;
      ml) echo "Malayalam";; pa) echo "Punjabi (Gurmukhi)";; as) echo "Assamese";;
    esac)

    # Read the batch questions and build prompt
    bunx tsx -e "
      const fs = require('fs');
      const batch = JSON.parse(fs.readFileSync('/tmp/quiz-batch.json', 'utf8'));
      const items = batch.map(q => ({ id: q.questionId, question: q.question, options: q.options, explanation: q.explanation }));
      const prompt = 'You are a professional translator for ${LANG_NAME}. Translate this quiz JSON from English to ${LANG_NAME}. Keep Bible references like John 3:16 as-is. Return ONLY a JSON array with the same structure: [{id, question, options, explanation}]. No markdown, no code fences.\n\n' + JSON.stringify(items, null, 2);
      fs.writeFileSync('/tmp/quiz-prompt.txt', prompt);
    " 2>/dev/null

    # Call z-ai CLI
    z-ai chat -p "$(cat /tmp/quiz-prompt.txt)" -o /tmp/quiz-response.json 2>/dev/null

    if [ $? -ne 0 ]; then
      printf "❌ (API error)\n"
      FAILED=$((FAILED + BATCH_COUNT))
      sleep 5
      continue
    fi

    # Parse response and save to DB
    SAVE_RESULT=$(bunx tsx -e "
      const fs = require('fs');
      const { PrismaClient } = require('@prisma/client');
      const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
      (async () => {
        try {
          const resp = JSON.parse(fs.readFileSync('/tmp/quiz-response.json', 'utf8'));
          const text = resp.choices?.[0]?.message?.content || '';
          const cleaned = text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`\s*$/i, '').trim();
          const translations = JSON.parse(cleaned);
          if (!Array.isArray(translations)) throw new Error('not array');
          
          const batch = JSON.parse(fs.readFileSync('/tmp/quiz-batch.json', 'utf8'));
          let saved = 0;
          for (const t of translations) {
            const q = batch.find(b => b.questionId === t.id);
            if (!q || !t.question || !Array.isArray(t.options)) continue;
            if (t.options.length !== q.options.length) continue;
            q.existingTranslations['${LANG_CODE}'] = {
              question: String(t.question),
              options: t.options.map(String),
              explanation: String(t.explanation || '')
            };
            await db.triviaQuestion.update({
              where: { id: q.id },
              data: { translations: JSON.stringify(q.existingTranslations) }
            });
            saved++;
          }
          console.log(saved);
          await db.\$disconnect();
        } catch (e) {
          console.log('0');
          console.error(e.message);
        }
      })();
    " 2>&1 | head -1)

    if [ "$SAVE_RESULT" = "0" ]; then
      printf "❌ (parse error)\n"
      FAILED=$((FAILED + BATCH_COUNT))
    else
      printf "✅ %s translated\n" "$SAVE_RESULT"
      TRANSLATED=$((TRANSLATED + SAVE_RESULT))
    fi

    sleep 2
  done

  echo ""
  echo "  ✅ Done $LANG_CODE: $TRANSLATED translated, $FAILED failed"
done

echo ""
echo "════════════════════════════════════"
echo "All languages complete!"
echo "════════════════════════════════════"

# Cleanup
rm -f /tmp/quiz-to-translate.json /tmp/quiz-batch.json /tmp/quiz-prompt.txt /tmp/quiz-response.json /tmp/quiz-batch-count.txt
