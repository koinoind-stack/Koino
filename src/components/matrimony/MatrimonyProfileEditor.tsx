"use client";

/**
 * ─── MATRIMONY PROFILE EDITOR (Task 74 Stage B) ─────────────────────────────
 *
 * Mobile-first form for the member's own matrimony profile. All validation is
 * mirrored server-side (zod in src/lib/matrimony.ts) — this form only gives
 * fast feedback; the server remains the authority.
 *
 * DOB / gender are sourced from the member's Koino account and shown as
 * read-only facts (age only for DOB — the date itself never reaches the
 * client). State & city are editable here and write through to the account.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

import {
  MATRIMONY_LANGUAGES,
  MATRIMONY_INTENTIONS,
  MATRIMONY_TIMELINES,
  MATRIMONY_LIMITS,
} from "@/lib/matrimony";
import type { SerializedMatrimonyProfile } from "@/lib/matrimony/server";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export type EditorProfile = SerializedMatrimonyProfile;

type AccountFacts = {
  age: number | null;
  gender: string | null;
  state: string | null;
  city: string | null;
};

export default function MatrimonyProfileEditor({
  profile,
  account,
  onSaved,
}: {
  profile: EditorProfile;
  account: AccountFacts;
  onSaved: (p: EditorProfile) => void;
}) {
  const t = useTranslation();
  const [languages, setLanguages] = useState<string[]>(profile.languages);
  const [intention, setIntention] = useState(profile.intention ?? "");
  const [timeline, setTimeline] = useState(profile.timeline ?? "");
  const [denomination, setDenomination] = useState(profile.denomination ?? "");
  const [education, setEducation] = useState(profile.education ?? "");
  const [profession, setProfession] = useState(profile.profession ?? "");
  const [heightCm, setHeightCm] = useState(profile.heightCm ? String(profile.heightCm) : "");
  const [aboutMe, setAboutMe] = useState(profile.aboutMe ?? "");
  const [stateField, setStateField] = useState(account.state ?? "");
  const [cityField, setCityField] = useState(account.city ?? "");
  const [saving, setSaving] = useState(false);

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang)
        ? prev.filter((l) => l !== lang)
        : prev.length >= MATRIMONY_LIMITS.languagesMax
          ? prev // silent cap; helper text explains
          : [...prev, lang]
    );
  };

  const save = async () => {
    if (languages.length === 0) {
      toast.error(t("matrimony.editor.errorLanguages"));
      return;
    }
    if (!intention || !timeline) {
      toast.error(t("matrimony.editor.errorIntention"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/matrimony/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languages,
          intention,
          timeline,
          denomination: denomination || null,
          education: education || null,
          profession: profession || null,
          heightCm: heightCm ? Number(heightCm) : null,
          aboutMe: aboutMe || null,
          state: stateField || null,
          city: cityField || null,
          photoVisibility: profile.photoVisibility,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error || t("matrimony.editor.saveFailed"));
        return;
      }
      onSaved(j.profile);
      toast.success(t("matrimony.editor.saved"));
    } catch {
      toast.error(t("common.error.network"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#7C3AED]/50 transition-colors";
  const labelCls = "block text-[11px] font-black uppercase tracking-wider text-[#64748B] mb-1.5";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-4 md:p-5">
      {/* Account-sourced facts (read-only) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5">
          <span className={labelCls}>{t("matrimony.editor.age")}</span>
          <span className="text-[13.5px] text-white font-bold">{account.age ?? "—"}</span>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5">
          <span className={labelCls}>{t("matrimony.editor.gender")}</span>
          <span className="text-[13.5px] text-white font-bold">
            {account.gender === "male" ? t("matrimony.gender.man") : account.gender === "female" ? t("matrimony.gender.woman") : account.gender === "prefer_not_to_say" ? t("matrimony.gender.preferNotToSay") : "—"}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[#64748B]">
        {t("matrimony.editor.accountNote")}
      </p>

      {/* Languages */}
      <div className="mt-5">
        <span className={labelCls}>
          {t("matrimony.editor.languages")} <span className="text-[#F39B9B]">*</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {MATRIMONY_LANGUAGES.map((lang) => {
            const active = languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${
                  active
                    ? "bg-[#7C3AED]/20 border-[#7C3AED]/40 text-white"
                    : "bg-white/[0.03] border-white/[0.08] text-[#94A3B8] hover:text-white"
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-[#64748B]">
          {t("matrimony.editor.languagesHint", { n: MATRIMONY_LIMITS.languagesMax })}
        </p>
      </div>

      {/* Intention + timeline */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="m-intention">{t("matrimony.editor.intention")} <span className="text-[#F39B9B]">*</span></label>
          <select id="m-intention" value={intention} onChange={(e) => setIntention(e.target.value)} className={inputCls}>
            <option value="">{t("common.choose")}</option>
            {MATRIMONY_INTENTIONS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="m-timeline">{t("matrimony.editor.timeline")} <span className="text-[#F39B9B]">*</span></label>
          <select id="m-timeline" value={timeline} onChange={(e) => setTimeline(e.target.value)} className={inputCls}>
            <option value="">{t("common.choose")}</option>
            {MATRIMONY_TIMELINES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Location (writes to account) */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="m-state">{t("matrimony.editor.state")} <span className="text-[#F39B9B]">*</span></label>
          <input id="m-state" value={stateField} onChange={(e) => setStateField(e.target.value)} maxLength={100} className={inputCls} placeholder={t("matrimony.editor.statePlaceholder")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="m-city">{t("matrimony.editor.city")} <span className="text-[#F39B9B]">*</span></label>
          <input id="m-city" value={cityField} onChange={(e) => setCityField(e.target.value)} maxLength={100} className={inputCls} placeholder={t("matrimony.editor.cityPlaceholder")} />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-[#64748B]">
        {t("matrimony.editor.locationNote")}
      </p>

      {/* Optional fields */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="m-denom">{t("matrimony.editor.denomination")} <span className="text-[#64748B] normal-case font-bold">{t("common.optional")}</span></label>
          <input id="m-denom" value={denomination} onChange={(e) => setDenomination(e.target.value)} maxLength={MATRIMONY_LIMITS.denominationMax} className={inputCls} placeholder={t("matrimony.editor.denominationPlaceholder")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="m-edu">{t("matrimony.editor.education")} <span className="text-[#64748B] normal-case font-bold">{t("common.optional")}</span></label>
          <input id="m-edu" value={education} onChange={(e) => setEducation(e.target.value)} maxLength={MATRIMONY_LIMITS.educationMax} className={inputCls} placeholder={t("matrimony.editor.educationPlaceholder")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="m-prof">{t("matrimony.editor.profession")} <span className="text-[#64748B] normal-case font-bold">{t("common.optional")}</span></label>
          <input id="m-prof" value={profession} onChange={(e) => setProfession(e.target.value)} maxLength={MATRIMONY_LIMITS.professionMax} className={inputCls} placeholder={t("matrimony.editor.professionPlaceholder")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="m-height">{t("matrimony.editor.height")} <span className="text-[#64748B] normal-case font-bold">{t("common.optional")}</span></label>
          <input id="m-height" type="number" min={MATRIMONY_LIMITS.heightMinCm} max={MATRIMONY_LIMITS.heightMaxCm} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={inputCls} placeholder={t("matrimony.editor.heightPlaceholder")} />
        </div>
      </div>

      {/* About me */}
      <div className="mt-4">
        <label className={labelCls} htmlFor="m-about">{t("matrimony.editor.aboutMe")} <span className="text-[#64748B] normal-case font-bold">{t("common.optional")}</span></label>
        <textarea
          id="m-about"
          value={aboutMe}
          onChange={(e) => setAboutMe(e.target.value.slice(0, MATRIMONY_LIMITS.aboutMeMax))}
          rows={5}
          maxLength={MATRIMONY_LIMITS.aboutMeMax}
          className={`${inputCls} resize-y`}
          placeholder={t("matrimony.editor.aboutMePlaceholder")}
        />
        <p className="mt-1 text-[11px] text-[#64748B] text-right">
          {aboutMe.length}/{MATRIMONY_LIMITS.aboutMeMax}
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-[#F39B9B] to-[#EC4899] text-white text-sm font-black hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {profile.status === "draft" && !profile.id ? t("matrimony.editor.saveDraft") : t("matrimony.editor.saveChanges")}
      </button>
    </div>
  );
}
