#!/usr/bin/env python3
"""Wire useTranslation() into signin page."""
from pathlib import Path

FILE = Path("/home/z/my-project/src/app/auth/signin/page.tsx")
content = FILE.read_text()

# Add useTranslation import + hook
content = content.replace(
    'import {\n  Mail,\n  User,\n  ArrowRight,\n  Sparkles,\n  AlertCircle,\n  Lock,\n} from "lucide-react";',
    'import {\n  Mail,\n  User,\n  ArrowRight,\n  Sparkles,\n  AlertCircle,\n  Lock,\n} from "lucide-react";\nimport { useTranslation } from "@/lib/i18n/LanguageContext";\nimport LanguageSwitcher from "@/components/crosscrafted/LanguageSwitcher";',
    1,
)

# Add t = useTranslation() inside the component
content = content.replace(
    "function SignInForm() {\n  const router = useRouter();",
    "function SignInForm() {\n  const router = useRouter();\n  const t = useTranslation();",
    1,
)

# Wire key visible strings — be conservative to avoid breaking form logic
REPLACEMENTS = [
    # Signin page hero
    ('<h1 className="text-2xl font-extrabold text-white">Believ</h1>',
     '<h1 className="text-2xl font-extrabold text-white">{t("brand.name")}</h1>'),
    # The subtitle
    ('Believe. Connect. Grow. — Sign in to track your Faith Points',
     '{t("signin.subtitle")}'),
    # Google button label
    ('{googleLoading ? "Redirecting..." : "Continue with Google"}',
     '{googleLoading ? t("signin.google.loading") : t("signin.google")}'),
    # Divider text
    ('or {mode === "signin" ? "sign in" : "sign up"} with email',
     '{mode === "signin" ? t("signin.divider.signin") : t("signin.divider.signup")}'),
    # Email label
    ('<Mail size={10} className="inline mr-0.5" /> Email',
     '<Mail size={10} className="inline mr-0.5" /> {t("signin.email")}'),
    ('placeholder="you@example.com"',
     'placeholder={t("signin.emailPlaceholder")}'),
    # Password label
    ('<Lock size={10} className="inline mr-0.5" /> Password',
     '<Lock size={10} className="inline mr-0.5" /> {t("signin.password")}'),
    # Submit button
    ('{loading\n                ? (mode === "signup" ? "Creating account..." : "Signing in...")\n                : (mode === "signup" ? "Create account" : "Sign in")}',
     '{loading\n                ? (mode === "signup" ? t("signin.submit.signupLoading") : t("signin.submit.signinLoading"))\n                : (mode === "signup" ? t("signin.submit.signup") : t("signin.submit.signin"))}'),
    # Toggle links
    ('{mode === "signin" ? (\n                <>Don\'t have an account? <span className="text-[#A78BFA] font-bold">Sign up</span></>\n              ) : (\n                <>Already have an account? <span className="text-[#A78BFA] font-bold">Sign in</span></>\n              )}',
     '{mode === "signin" ? (\n                <>{t("signin.toggle.toSignup")} <span className="text-[#A78BFA] font-bold">{t("signin.toggle.toSignupLink")}</span></>\n              ) : (\n                <>{t("signin.toggle.toSignin")} <span className="text-[#A78BFA] font-bold">{t("signin.toggle.toSigninLink")}</span></>\n              )}'),
    # Back button
    ('← Back to home',
     '← {t("signin.back")}'),
    # Faith Points banner
    ('<p className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8]">Faith Points</p>',
     '<p className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8]">{t("signin.fpBanner.title")}</p>'),
    # Name (optional) label
    ('<User size={10} className="inline mr-0.5" /> Name (optional)',
     '<User size={10} className="inline mr-0.5" /> {t("signin.name")}'),
]

changes = 0
for old, new in REPLACEMENTS:
    if old in content:
        content = content.replace(old, new)
        changes += 1
        print(f"  ✅ {old[:60]!r}")
    else:
        print(f"  ❌ not found: {old[:60]!r}")

# Add LanguageSwitcher right under the title area
content = content.replace(
    '<h1 className="text-2xl font-extrabold text-white">{t("brand.name")}</h1>\n          <p className="text-sm text-[#A09DB1] mt-1">{t("signin.subtitle")}</p>\n        </div>',
    '<h1 className="text-2xl font-extrabold text-white">{t("brand.name")}</h1>\n          <p className="text-sm text-[#A09DB1] mt-1">{t("signin.subtitle")}</p>\n          <div className="mt-3"><LanguageSwitcher /></div>\n        </div>',
)

FILE.write_text(content)
print(f"\nTotal replacements: {changes}")
