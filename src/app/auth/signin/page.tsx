"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Lock,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/crosscrafted/LanguageSwitcher";

function SignInForm() {
  const router = useRouter();
  const t = useTranslation();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
  );
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // Successful sign-in redirects to /auth/callback, then back to /.
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        // Sign up with email + password + optional name (stored in user_metadata)
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: name.trim() || email.split("@")[0],
              name: name.trim() || email.split("@")[0],
            },
          },
        });

        if (error) throw error;

        // Check if email confirmation is required
        if (data.user && data.session === null) {
          setInfo(
            "Check your inbox — we sent you a confirmation link. Click it to verify your email, then sign in."
          );
          setMode("signin");
        } else if (data.session) {
          // Signed in immediately (email confirmation disabled in Supabase)
          router.push("/");
          router.refresh();
        }
      } else {
        // Sign in with email + password
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) throw error;

        if (data.user) {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#12101A] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/koino-logo.png"
            alt="Koino"
            width={64}
            height={64}
            className="rounded-2xl mb-4 mx-auto"
            priority
          />
          <h1 className="text-2xl font-extrabold text-white">{t("brand.name")}</h1>
          <p className="text-sm text-[#A09DB1] mt-1">{t("signin.subtitle")}</p>
          <div className="mt-3"><LanguageSwitcher /></div>
        </div>

        <div className="bg-[#1C1929] border border-white/[0.08] rounded-3xl p-6 space-y-4">
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-[#EF4444] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[#EF4444] leading-relaxed">{error}</p>
            </div>
          )}

          {info && (
            <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl p-3 flex items-start gap-2">
              <Sparkles size={14} className="text-[#22C55E] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[#22C55E] leading-relaxed">{info}</p>
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3 rounded-xl bg-white text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? t("signin.google.loading") : t("signin.google")}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider">
              {mode === "signin" ? t("signin.divider.signin") : t("signin.divider.signup")}
            </span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* Email + Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  <User size={10} className="inline mr-0.5" /> {t("signin.name")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="neo-input text-sm"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                <Mail size={10} className="inline mr-0.5" /> {t("signin.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neo-input text-sm"
                placeholder={t("signin.emailPlaceholder")}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                <Lock size={10} className="inline mr-0.5" /> {t("signin.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neo-input text-sm"
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}
            >
              {loading
                ? (mode === "signup" ? t("signin.submit.signupLoading") : t("signin.submit.signinLoading"))
                : (mode === "signup" ? t("signin.submit.signup") : t("signin.submit.signin"))}
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Toggle Sign in / Sign up */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="text-[11px] text-[#94A3B8] hover:text-white transition-colors"
            >
              {mode === "signin" ? (
                <>{t("signin.toggle.toSignup")} <span className="text-[#A78BFA] font-bold">{t("signin.toggle.toSignupLink")}</span></>
              ) : (
                <>{t("signin.toggle.toSignin")} <span className="text-[#A78BFA] font-bold">{t("signin.toggle.toSigninLink")}</span></>
              )}
            </button>
          </div>

          <div className="bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={11} className="text-[#38BDF8]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8]">{t("signin.fpBanner.title")}</p>
            </div>
            <p className="text-[11px] text-[#A09DB1] leading-relaxed">
              Sign in to earn and track Faith Points securely. Your points are stored server-side — no more localStorage farming!
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full mt-4 py-2 text-xs text-[#64748B] hover:text-white transition-colors"
        >
          ← {t("signin.back")}
        </button>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#12101A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-white animate-spin" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
