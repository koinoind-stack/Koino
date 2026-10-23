#!/bin/bash
# Runs translate-one-batch.ts in a loop, one batch at a time.
# Each batch gets a fresh process (no SDK state accumulation).
# If a batch hangs, the 60s timeout kills it and we move on.
#
# Usage: bash scripts/translate-quiz-loop.sh <lang_code>
# Example: bash scripts/translate-quiz-loop.sh hi

LANG_CODE="${1:-hi}"
BATCH=1
TRANSLATED=0
FAILED=0
CONSECUTIVE_FAILS=0

echo "═══ Quiz Translation: $LANG_CODE ═══"
echo ""

while true; do
  printf "  batch %d... " "$BATCH"

  # Run one batch with a 60s hard timeout
  RESULT=$(timeout 60 bunx tsx scripts/translate-one-batch.ts "$BATCH" "$LANG_CODE" 2>/dev/null)

  if [ "$RESULT" = "DONE" ]; then
    printf "✅ All batches complete!\n"
    break
  elif echo "$RESULT" | grep -q "^OK"; then
    COUNT=$(echo "$RESULT" | sed 's/OK //')
    printf "✅ %s translated\n" "$COUNT"
    TRANSLATED=$((TRANSLATED + COUNT))
    CONSECUTIVE_FAILS=0
  else
    printf "❌ %s\n" "$RESULT"
    FAILED=$((FAILED + 1))
    CONSECUTIVE_FAILS=$((CONSECUTIVE_FAILS + 1))
    if [ $CONSECUTIVE_FAILS -ge 10 ]; then
      printf "🛑 10 consecutive failures — stopping\n"
      break
    fi
    sleep 5
  fi

  BATCH=$((BATCH + 1))
  sleep 1
done

echo ""
echo "═══ Summary: $TRANSLATED translated, $FAILED failed ═══"
