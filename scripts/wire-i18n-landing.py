#!/usr/bin/env python3
"""Wire useTranslation() hook into LandingHero.tsx — replace hardcoded
English strings with t() calls. Other components can be wired later."""
from pathlib import Path

FILE = Path("/home/z/my-project/src/components/crosscrafted/LandingHero.tsx")
content = FILE.read_text()

# Map of (English string → translation key)
# These are exact-match replacements — only replace when the string appears
# as text content (not as an attribute value, JS string, etc.)
REPLACEMENTS = [
    # Hero section
    ("Faith Community Platform\n          </div>", "{t('landing.badge')}\n          </div>"),
    ("Grow in Faith, Together\n            </span>", "{t('landing.titleGradient')}\n            </span>"),
    (">Read the Bible<", ">{t('landing.cta.readBible')}<"),
    (">Try Trivia<", ">{t('landing.cta.tryTrivia')}<"),
    (">Quiz Questions<", ">{t('landing.stats.questions')}<"),
    (">Prize Tiers<", ">{t('landing.stats.tiers')}<"),
    (">To Use<", ">{t('landing.stats.toUse')}<"),
    (">The Holy Bible<", ">{t('bible.badge')}<"),
    (">Read God's Word Daily<", ">{t('bible.title')}<"),
    (">66 Books<", ">{t('bible.stat.books')}<"),
    (">2 Translations<", ">{t('bible.stat.translations')}<"),
    (">4 Plans<", ">{t('bible.stat.plans')}<"),
    (">11 Langs<", ">{t('bible.stat.langs')}<"),
    (">Open the Bible<", ">{t('bible.cta.open')}<"),
    (">Browse Reading Plans<", ">{t('bible.cta.plans')}<"),
    (">Everything for Your Faith Journey<", ">{t('features.title')}<"),
    (">Bible Trivia Challenge<", ">{t('trivia.badge')}<"),
    (">How Well Do You Know the Bible?<", ">{t('trivia.title')}<"),
    (">Start Challenge<", ">{t('trivia.cta.start')}<"),
    (">Enter Believ<", ">{t('cta.button')}<"),
    (">Available in Indian Languages<", ">{t('languages.title')}<"),
]

changes = 0
for old, new in REPLACEMENTS:
    if old in content:
        count = content.count(old)
        content = content.replace(old, new)
        changes += count
        print(f"  ✅ {count}x: {old[:50]!r}...")

FILE.write_text(content)
print(f"\nTotal replacements: {changes}")
