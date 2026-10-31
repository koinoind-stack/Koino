"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Heart,
  MessageCircle,
  Sparkles,
  User,
  Calendar,
  MapPin,
  Phone,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useSupabaseUser, notifyProfileUpdated } from "@/lib/supabase/use-user";
import { INDIAN_STATES, getCitiesForState, LANGUAGES } from "@/lib/crosscrafted-data";
import { COMMUNITY_ROLES, COMMUNITY_ROLE_OTHER, COMMUNITY_ROLE_OTHER_MAX } from "@/lib/community-roles";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Step = 0 | 1 | 2 | 3; // 0=welcome, 1=profile, 2=faith, 3=whatsapp

type Props = {
  onComplete: () => void;
};

export default function OnboardingView({ onComplete }: Props) {
  const t = useTranslation();
  const { user } = useSupabaseUser();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState("https://whatsapp.com/channel/0029Vb96qSoBFLgTRTxI5v2q");

  // Profile fields
  const [name, setName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string>("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Faith fields
  const [faithStatus, setFaithStatus] = useState("");
  const [faithJourney, setFaithJourney] = useState("");

  // Community role (optional, self-reported — never implies verification)
  const [communityRole, setCommunityRole] = useState("");
  const [communityRoleOther, setCommunityRoleOther] = useState("");
  const [communityRoleVisible, setCommunityRoleVisible] = useState(true);

  // Load existing partial profile (resume from where user left off)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile/setup", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const p = data.profile;
          if (p) {
            if (p.name) setName(p.name);
            if (p.image) setProfilePhoto(p.image);
            if (p.username) setUsername(p.username);
            if (p.dateOfBirth) {
              const d = new Date(p.dateOfBirth);
              setDateOfBirth(d.toISOString().split("T")[0]);
            }
            if (p.gender) setGender(p.gender);
            if (p.state) setState(p.state);
            if (p.city) setCity(p.city);
            if (p.mobileNumber) setMobileNumber(p.mobileNumber);
            if (p.faithStatus) setFaithStatus(p.faithStatus);
            if (p.faithJourney) setFaithJourney(p.faithJourney);
            if (p.communityRole) setCommunityRole(p.communityRole);
            if (p.communityRoleOther) setCommunityRoleOther(p.communityRoleOther);
            if (p.communityRoleVisible === false) setCommunityRoleVisible(false);
            // If user already has profile fields, start from the appropriate step
            if (p.username && p.state && p.city && p.mobileNumber) {
              setStep(2); // skip to faith
            }
          }
        }
      } catch {}
    })();

    // Fetch WhatsApp channel URL from config endpoint
    fetch("/api/config/whatsapp-channel")
      .then((r) => r.json())
      .then((data) => { if (data.url) setWhatsappUrl(data.url); })
      .catch(() => {});
  }, []);

  // Suggest username from Google display name ONLY as a placeholder suggestion.
  // The user must be free to replace it with any username they choose.
  // Do NOT auto-set the username from email prefix or Google name.
  // The suggestion appears in the input as a starting point the user can edit.
  useEffect(() => {
    // Only suggest if user hasn't entered anything yet
    if (!username && user?.user_metadata?.full_name) {
      const suggested = (user.user_metadata.full_name as string)
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, "")
        .slice(0, 20);
      if (suggested.length >= 3) {
        setUsername(suggested);
      }
    }
    // Use Google profile photo as initial suggestion (only if no photo is set yet)
    if (!profilePhoto && user?.user_metadata?.avatar_url) {
      setProfilePhoto(user.user_metadata.avatar_url as string);
    }
  }, [user, username, profilePhoto]);

  // Debounced username availability check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/check-username?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
        setUsernameSuggestions(data.suggestions || []);
      } catch {
        setUsernameAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const [usernameError, setUsernameError] = useState<string | null>(null);

  const validateUsername = (val: string): string | null => {
    if (!val || val.trim().length === 0) return t("onboarding.username.required");
    if (val.trim().length < 3) return t("onboarding.username.short");
    if (!/^[a-zA-Z0-9_.]+$/.test(val)) return t("onboarding.username.chars");
    if (usernameAvailable === false) return t("onboarding.username.taken");
    return null;
  };

  const validateProfile = (): string | null => {
    const uErr = validateUsername(username);
    if (uErr) return uErr;
    if (!mobileNumber) return t("onboarding.error.mobile");
    if (!state) return t("onboarding.error.state");
    if (!city) return t("onboarding.error.city");
    return null;
  };

  const saveProfile = async () => {
    // Client-side validation BEFORE calling the API
    const uErr = validateUsername(username);
    if (uErr) {
      setUsernameError(uErr);
      return;
    }
    setUsernameError(null);
    if (!mobileNumber || !state || !city) {
      toast.error(t("common.fillRequired"));
      return;
    }
    // Don't proceed if username availability check is still loading
    if (usernameAvailable !== true) {
      toast.error(t("onboarding.error.usernamePending"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "profile",
          name,
          image: profilePhoto || undefined,
          username,
          dateOfBirth,
          gender: gender || undefined,
          state,
          city,
          mobileNumber: mobileNumber || undefined,
          communityRole: communityRole || undefined,
          communityRoleOther: communityRole === COMMUNITY_ROLE_OTHER && communityRoleOther.trim()
            ? communityRoleOther.trim()
            : undefined,
          communityRoleVisible,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field === "username") {
          setUsernameError(data.error);
        }
        throw new Error(data.error || t("onboarding.error.saveProfile"));
      }
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || t("onboarding.error.saveProfile"));
    } finally {
      setLoading(false);
    }
  };

  const saveFaith = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "faith",
          faithStatus: faithStatus || undefined,
          faithJourney: faithJourney || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("onboarding.error.saveFaith"));
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || t("onboarding.error.save"));
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async (whatsappClicked: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "complete",
          whatsappChannelClicked: whatsappClicked,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If the server says a step is incomplete, go back to that step
        if (data.step === "profile") {
          toast.error(t("onboarding.error.profileFirst"));
          setStep(1);
        } else if (data.step === "faith") {
          toast.error(t("onboarding.error.faithFirst"));
          setStep(2);
        } else {
          throw new Error(data.error || t("onboarding.error.complete"));
        }
        return;
      }
      toast.success(t("onboarding.toast.welcome"));
      // Refresh profileCompleted in every useSupabaseUser consumer BEFORE
      // onComplete navigates — otherwise the hook's stale profileCompleted
      // sends completed users straight back into onboarding.
      notifyProfileUpdated();
      onComplete();
    } catch (e: any) {
      toast.error(e.message || t("onboarding.error.completeGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Welcome", "Profile", "Faith", "Connect"];

  return (
    <div className="min-h-screen bg-[#12101A] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  i <= step ? "bg-[#F39B9B]" : "bg-white/15"
                }`}
              />
              {i < steps.length - 1 && (
                <div className={`w-6 h-px ${i < step ? "bg-[#F39B9B]" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── STEP 0: WELCOME ─── */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-3xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#F39B9B] to-[#7C3AED] flex items-center justify-center">
                <Sparkles size={28} className="text-white" />
              </div>
              <h1 className="text-xl font-black text-white mb-2">{t("onboarding.welcome.title")}</h1>
              <p className="text-sm text-[#A09DB1] leading-relaxed mb-5">
                {t("onboarding.welcome.desc")}
              </p>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px flex items-center justify-center gap-2"
              >
                {t("onboarding.cta.getStarted")} <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ─── STEP 1: PROFILE ─── */}
          {step === 1 && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-3xl p-5"
            >
              <h2 className="text-base font-bold text-white mb-1">{t("onboarding.profile.title")}</h2>
              <p className="text-[11px] text-[#94A3B8] mb-4">{t("onboarding.profile.requiredNote")}</p>

              <div className="space-y-3">
                {/* Profile Photo */}
                <ProfilePhotoUpload
                  photoUrl={profilePhoto}
                  onChange={setProfilePhoto}
                />

                {/* Username */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    {t("onboarding.profile.username")}
                  </label>
                  <p className="text-[9px] text-[#64748B] mb-1">{t("onboarding.profile.usernameHint")}</p>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 20);
                      setUsername(val);
                      // Clear error when user types
                      if (usernameError) setUsernameError(null);
                    }}
                    className={`neo-input text-sm ${usernameError ? "border-[#EF4444]/40" : ""}`}
                    placeholder={t("onboarding.profile.usernamePlaceholder")}
                  />
                  {/* Inline username validation error */}
                  {usernameError && (
                    <p className="text-[10px] text-[#EF4444] font-bold mt-1">⚠ {usernameError}</p>
                  )}
                  {/* Username availability (only show if no error) */}
                  {!usernameError && usernameAvailable === false && (
                    <div className="mt-1">
                      <p className="text-[10px] text-[#EF4444] font-bold">⚠ {t("onboarding.username.taken")}</p>
                      {usernameSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {usernameSuggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setUsername(s);
                                setUsernameError(null);
                              }}
                              className="px-2 py-0.5 rounded-md bg-[#7C3AED]/15 text-[#A78BFA] text-[10px] font-bold hover:bg-[#7C3AED]/25 transition-all"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!usernameError && usernameAvailable === true && (
                    <p className="text-[10px] text-[#22C55E] font-bold mt-1 flex items-center gap-0.5">
                      <Check size={10} /> {t("onboarding.username.available")}
                    </p>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    {t("onboarding.profile.dob")} <span className="text-[#64748B] normal-case font-normal">{t("common.optional")}</span>
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="neo-input text-sm"
                  />
                </div>

                {/* Gender (optional) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    {t("onboarding.profile.gender")} <span className="text-[#64748B] normal-case font-normal">{t("common.optional")}</span>
                  </label>
                  <div className="flex gap-1.5">
                    {[
                      { v: "male", l: t("onboarding.gender.male") },
                      { v: "female", l: t("onboarding.gender.female") },
                      { v: "prefer_not_to_say", l: t("onboarding.gender.preferNot") },
                    ].map((g) => (
                      <button
                        key={g.v}
                        onClick={() => setGender(g.v)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                          gender === g.v
                            ? "bg-[#7C3AED] text-white"
                            : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                        }`}
                      >
                        {g.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Community role (optional, self-reported) */}
                <div>
                  <label className="block text-[11px] font-bold tracking-wider text-[#94A3B8] mb-1">
                    {t("onboarding.role.question")}{" "}
                    <span className="text-[#64748B] font-normal">{t("common.optional")}</span>
                  </label>
                  <select
                    value={communityRole}
                    onChange={(e) => setCommunityRole(e.target.value)}
                    className="neo-input text-sm"
                  >
                    <option value="">{t("onboarding.role.selectPlaceholder")}</option>
                    {COMMUNITY_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {communityRole === COMMUNITY_ROLE_OTHER && (
                    <input
                      type="text"
                      value={communityRoleOther}
                      onChange={(e) => setCommunityRoleOther(e.target.value)}
                      maxLength={COMMUNITY_ROLE_OTHER_MAX}
                      placeholder={t("onboarding.role.otherPlaceholder")}
                      className="neo-input text-sm mt-2"
                    />
                  )}
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={communityRoleVisible}
                      onChange={(e) => setCommunityRoleVisible(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#7C3AED]"
                    />
                    <span className="text-[10px] text-[#94A3B8] font-semibold">
                      {t("onboarding.role.visibleLabel")}
                    </span>
                  </label>
                </div>

                {/* State */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    {t("onboarding.profile.state")}
                  </label>
                  <select
                    value={state}
                    onChange={(e) => { setState(e.target.value); setCity(""); }}
                    className="neo-input text-sm"
                  >
                    <option value="">{t("common.selectState")}</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    {t("onboarding.profile.city")}
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!state}
                    className="neo-input text-sm disabled:opacity-50"
                  >
                    <option value="">{state ? t("common.selectCity") : t("common.selectStateFirst")}</option>
                    {state && getCitiesForState(state).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Mobile Number (required) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    {t("onboarding.profile.mobile")}
                  </label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="neo-input text-sm"
                    placeholder={t("common.whatsappPlaceholder")}
                  />
                  <p className="text-[9px] text-[#64748B] mt-1">
                    {t("onboarding.profile.mobileHint")}
                  </p>
                </div>
              </div>

              <button
                onClick={saveProfile}
                disabled={loading || !username || usernameAvailable !== true || !mobileNumber || !state || !city}
                className="w-full mt-4 py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>{t("onboarding.cta.continue")} <ArrowRight size={16} /></>}
              </button>
            </motion.div>
          )}

          {/* ─── STEP 2: FAITH ─── */}
          {step === 2 && (
            <motion.div
              key="faith"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-3xl p-5"
            >
              <div className="flex items-center gap-2 mb-1">
                <Heart size={14} className="text-[#F39B9B]" />
                <h2 className="text-base font-bold text-white">{t("onboarding.faith.title")}</h2>
              </div>
              <p className="text-[11px] text-[#94A3B8] mb-4">
                {t("onboarding.faith.desc")}
              </p>

              {/* Question 1 */}
              <div className="mb-4">
                <p className="text-[11px] font-bold text-[#A09DB1] mb-2">{t("onboarding.faith.q1")}</p>
                <div className="space-y-1.5">
                  {[
                    { v: "follows_jesus", l: t("onboarding.faithStatus.followsJesus") },
                    { v: "exploring", l: t("onboarding.faithStatus.exploring") },
                    { v: "new_to_christianity", l: t("onboarding.faithStatus.newToChristianity") },
                    { v: "prefer_not_to_say", l: t("onboarding.gender.preferNot") },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setFaithStatus(opt.v)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs font-bold transition-all ${
                        faithStatus === opt.v
                          ? "bg-[#7C3AED]/15 border-[#7C3AED]/40 text-white"
                          : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2 */}
              <div className="mb-4">
                <p className="text-[11px] font-bold text-[#A09DB1] mb-2">{t("onboarding.faith.q2")}</p>
                <div className="space-y-1.5">
                  {[
                    { v: "growing", l: t("onboarding.faithJourney.growing") },
                    { v: "new_to_jesus", l: t("onboarding.faithJourney.newToJesus") },
                    { v: "exploring_christianity", l: t("onboarding.faithJourney.exploring") },
                    { v: "looking_for_church", l: t("onboarding.faithJourney.lookingForChurch") },
                    { v: "learn_and_connect", l: t("onboarding.faithJourney.learnAndConnect") },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setFaithJourney(opt.v)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs font-bold transition-all ${
                        faithJourney === opt.v
                          ? "bg-[#7C3AED]/15 border-[#7C3AED]/40 text-white"
                          : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[9px] text-[#64748B] mb-4">
                {t("onboarding.faith.privacyNote")}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white font-bold text-sm transition-all"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  onClick={saveFaith}
                  disabled={loading || !faithStatus || !faithJourney}
                  className="flex-1 py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <>{t("onboarding.cta.continue")} <ArrowRight size={16} /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 3: WHATSAPP ─── */}
          {step === 3 && (
            <motion.div
              key="whatsapp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-3xl p-5 text-center"
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#25D366]/15 flex items-center justify-center">
                <MessageCircle size={24} className="text-[#25D366]" />
              </div>
              <h2 className="text-base font-bold text-white mb-1">{t("onboarding.connect.title")}</h2>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed mb-5">
                {t("onboarding.connect.desc")}
              </p>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // Track click — but do NOT claim user joined the channel
                  // (we can't verify that). The /api/profile/setup endpoint
                  // stores whatsappChannelClicked=true when completeOnboarding
                  // is called with whatsappClicked=true.
                }}
                className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1FB855] text-white font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px flex items-center justify-center gap-2 mb-2"
              >
                <MessageCircle size={16} /> {t("onboarding.connect.whatsappCta")}
                <ExternalLink size={12} className="opacity-80" />
              </a>

              <button
                onClick={() => completeOnboarding(false)}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white font-bold text-xs transition-all"
              >
                {t("onboarding.connect.skip")}
              </button>

              <button
                onClick={() => completeOnboarding(true)}
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px flex items-center justify-center gap-2 disabled:opacity-30"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>{t("landing.cta.enterKoino")} <ArrowRight size={16} /></>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── PROFILE PHOTO UPLOAD ──────────────────────────────────────────────────
// Circular avatar upload with preview. Uploads to Supabase Storage via
// /api/profile/upload-avatar (server-side, userId from auth session).
// Optional — user can continue without a photo.

function ProfilePhotoUpload({
  photoUrl,
  onChange,
}: {
  photoUrl: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslation();

  const handleFile = async (file: File) => {
    setError(null);

    // Client-side validation
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError(t("common.image.typeError"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("common.image.sizeError"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.uploadFailed"));

      onChange(data.url);
    } catch (e: any) {
      setError(e.message || t("onboarding.photo.error"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Avatar preview */}
      <div className="w-16 h-16 rounded-full overflow-hidden bg-[#0f0f1a] border border-white/[0.08] flex items-center justify-center shrink-0">
        {photoUrl ? (
          <img src={photoUrl} alt={t("onboarding.photo.alt")} className="w-full h-full object-cover" />
        ) : (
          <User size={20} className="text-[#475569]" />
        )}
      </div>

      <div className="flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
          {t("onboarding.photo.label")} <span className="text-[#64748B] normal-case font-normal">{t("common.optional")}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-[10px] font-bold hover:bg-[#7C3AED]/25 transition-all disabled:opacity-50"
          >
            {uploading ? <Loader2 size={11} className="animate-spin" /> : photoUrl ? t("onboarding.photo.change") : t("onboarding.photo.upload")}
          </button>
          {photoUrl && !uploading && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
            >
              {t("common.remove")}
            </button>
          )}
        </div>
        {error && <p className="text-[9px] text-[#EF4444] font-bold mt-1">⚠ {error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />
    </div>
  );
}
