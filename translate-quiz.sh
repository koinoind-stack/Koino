#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Believ — Quiz Translation Script (Mac/Linux)
#  Run this script to translate all quiz questions to all 12
#  Indian languages using OpenAI.
#
#  Usage:
#    chmod +x translate-quiz.sh
#    ./translate-quiz.sh
# ═══════════════════════════════════════════════════════════

set -e

echo ""
echo "═══ Believ Quiz Translation ═══"
echo ""
echo "This script will translate all 800 quiz questions to all 12 Indian"
echo "languages using OpenAI's gpt-4o-mini model."
echo ""
echo "Cost: ~\$2 total (on your OpenAI account)"
echo "Time: ~30-60 minutes"
echo ""
echo "Press Enter to start, or Ctrl+C to cancel."
read -r

echo ""
echo "[1/3] Checking prerequisites..."

if ! command -v bun &> /dev/null; then
  echo "❌ Bun is not installed. Install it from https://bun.sh/"
  echo "   Or run: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
echo "✅ Bun found"

if ! command -v git &> /dev/null; then
  echo "❌ Git is not installed."
  exit 1
fi
echo "✅ Git found"

echo ""
echo "[2/3] Checking for .env file..."

if [ ! -f ".env" ]; then
  echo "❌ .env file not found in project root!"
  echo ""
  echo "   Create a file named .env in the same folder as this script"
  echo "   with these two lines:"
  echo ""
  echo "   DATABASE_URL=postgresql://postgres.[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
  echo "   OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE"
  echo ""
  echo "   Replace YOUR_KEY_HERE with your actual OpenAI API key."
  exit 1
fi
echo "✅ .env found"

echo ""
echo "[3/3] Installing dependencies (one-time)..."
bun install

echo ""
echo "═══ Starting translation ═══"
echo ""
echo "This will translate to ALL 12 languages sequentially."
echo "You can close this window to stop. Progress is saved automatically."
echo ""
bunx tsx scripts/translate-quiz-questions-openai.ts all

echo ""
echo "═══ Done! ═══"
echo ""
echo "Translations saved to your Supabase database."
echo "The deployed site will automatically serve them."
echo ""
