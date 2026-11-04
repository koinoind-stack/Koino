#!/bin/bash
# Runs quiz translation for ALL 12 languages, sequentially.
# Each language runs the "slow" translator (1 question at a time, 3s delay).
# Starts a fresh process per language to avoid SDK memory issues.
#
# Just run this and wait. Progress is saved to DB after each question.
# If it dies, just re-run — it skips already-translated questions.

: "${DATABASE_URL:?Error: DATABASE_URL environment variable is required (see .env.example)}"
export DATABASE_URL

LANGS="hi bn te mr ta gu ur kn or ml pa as"

for LANG in $LANGS; do
  echo ""
  echo "████████████████████████████████████████████████████"
  echo "  Starting language: $LANG"
  echo "████████████████████████████████████████████████████"

  bunx tsx scripts/translate-quiz-slow.ts "$LANG"

  echo "  Finished $LANG — moving to next language"
  sleep 5
done

echo ""
echo "══════════════════════════════════════════════════"
echo "  ALL 12 LANGUAGES COMPLETE!"
echo "══════════════════════════════════════════════════"
