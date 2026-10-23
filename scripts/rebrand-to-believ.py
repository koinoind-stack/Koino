#!/usr/bin/env python3
"""Bulk-replace 'crosscrafted' / 'CrossCrafted' brand text with 'Believ'.

Strategy:
- Skip filenames: imports like '@/lib/crosscrafted-data' and '@/components/crosscrafted/Foo'
  stay as-is — those are file paths, not user-facing text. Renaming the underlying
  files would require touching every import. Leaving as-is is safe & invisible
  to end users.
- Skip localStorage keys: 'crosscrafted_admin_gifts', 'crosscrafted_streaks'
  keep their names so existing user data isn't lost.
- Skip URL paths: 'crosscrafted.app' — that's the domain.
- Replace user-facing brand mentions: page titles, share text, welcome messages,
  competition organizers, gift titles, etc.
"""
from pathlib import Path
import re

ROOT = Path("/home/z/my-project/src")

# Files to process (already-handled files excluded)
SKIP_FILES = {
    "src/app/layout.tsx",         # already updated
    "src/app/page.tsx",           # already updated
    "src/app/auth/signin/page.tsx",  # already updated
    "src/components/crosscrafted/LandingHero.tsx",  # already updated
}

# Targeted replacements (string → replacement). Use these for cases where a
# global substring replace would break things (e.g., file paths).
TARGETED = [
    # Sample data brand mentions
    ('"CrossCrafted T-Shirt"', '"Believ T-Shirt"'),
    ("the CrossCrafted logo", "the Believ logo"),
    ('organizer: "CrossCrafted"', 'organizer: "Believ"'),
    ('"organizer": "CrossCrafted"', '"organizer": "Believ"'),
    ('"CrossCrafted + Grace City Church"', '"Believ + Grace City Church"'),
    ('Featured spot on CrossCrafted home page', 'Featured spot on Believ home page'),
    ('CrossCrafted merchandise', 'Believ merchandise'),
    ('CrossCrafted T-Shirts', 'Believ T-Shirts'),
    # Share text
    ("invited you to join a Bible Trivia competition on CrossCrafted",
     "invited you to join a Bible Trivia competition on Believ"),
    ("Come play Bible Trivia with me on CrossCrafted",
     "Come play Bible Trivia with me on Believ"),
    ("Join me on CrossCrafted", "Join me on Believ"),
    ("I just reached ${newTier.title} ${newTier.icon} on CrossCrafted",
     "I just reached ${newTier.title} ${newTier.icon} on Believ"),
    ('title: "CrossCrafted Level Up!"', 'title: "Believ Level Up!"'),
    ('title: "CrossCrafted Bible Trivia"', 'title: "Believ Bible Trivia"'),
    ("Welcome to CrossCrafted!", "Welcome to Believ!"),
    ("Play now on CrossCrafted!", "Play now on Believ!"),
    ('title: "Join me on CrossCrafted"', 'title: "Join me on Believ"'),
    # Churches share text
    ("I found you on CrossCrafted", "I found you on Believ"),
    # Events share text
    ('Check out "${e.title}" on CrossCrafted',
     'Check out "${e.title}" on Believ'),
    # Admin placeholder text
    ('placeholder="e.g. CrossCrafted Hoodie"', 'placeholder="e.g. Believ Hoodie"'),
    # ListYourEntity thank-you message
    ("Thanks for adding your {variant === \"church\" ? \"church\" : \"business\"} to crosscrafted.",
     "Thanks for adding your {variant === \"church\" ? \"church\" : \"business\"} to Believ."),
]

def process_file(path: Path):
    rel = str(path.relative_to(ROOT.parent))
    if rel in SKIP_FILES:
        return 0

    content = path.read_text()
    original = content
    changes = 0

    for old, new in TARGETED:
        if old in content:
            count = content.count(old)
            content = content.replace(old, new)
            changes += count

    if content != original:
        path.write_text(content)
        print(f"  {rel}: {changes} replacements")
        return changes
    return 0

# Find all .ts/.tsx files in src/
total = 0
for path in sorted(ROOT.rglob("*.ts*")):
    total += process_file(path)

print(f"\nTotal replacements: {total}")
