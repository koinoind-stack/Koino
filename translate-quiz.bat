@echo off
REM ═══════════════════════════════════════════════════════════
REM  Believ — Quiz Translation Script (Windows)
REM  Double-click this file to translate all quiz questions to
REM  all 12 Indian languages using OpenAI.
REM ═══════════════════════════════════════════════════════════

echo.
echo ═══ Believ Quiz Translation ═══
echo.
echo This script will translate all 800 quiz questions to all 12 Indian
echo languages using OpenAI's gpt-4o-mini model.
echo.
echo Cost: ~$2 total (on your OpenAI account)
echo Time: ~30-60 minutes
echo.
echo Press any key to start, or close this window to cancel.
pause >nul

echo.
echo [1/3] Checking prerequisites...

where bun >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ Bun is not installed. Install it from https://bun.sh/
  echo    Or run this in PowerShell: irm bun.sh/install.ps1 ^| iex
  pause
  exit /b 1
)
echo ✅ Bun found

where git >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ Git is not installed. Install it from https://git-scm.com/download/win
  pause
  exit /b 1
)
echo ✅ Git found

echo.
echo [2/3] Checking for .env file...

if not exist ".env" (
  echo ❌ .env file not found in project root!
  echo.
  echo    Create a file named ".env" in the same folder as this script
  echo    with these two lines:
  echo.
  echo    DATABASE_URL=postgresql://postgres.[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
  echo    OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
  echo.
  echo    Replace YOUR_KEY_HERE with your actual OpenAI API key.
  echo.
  pause
  exit /b 1
)
echo ✅ .env found

echo.
echo [3/3] Installing dependencies (one-time)...
call bun install

echo.
echo ═══ Starting translation ═══
echo.
echo This will translate to ALL 12 languages sequentially.
echo You can close this window to stop. Progress is saved automatically.
echo.
bunx tsx scripts/translate-quiz-questions-openai.ts all

echo.
echo ═══ Done! ═══
echo.
echo Translations saved to your Supabase database.
echo The deployed site will automatically serve them.
echo.
pause
