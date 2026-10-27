"use client";

/**
 * ─── MATRIMONY PROFILE PREVIEW (Task 74 Stage B) ────────────────────────────
 *
 * Owner's preview of how their profile card will appear to eligible members
 * once discovery ships. Shows ONLY fields that will actually be shared:
 * computed age (never DOB), gender, state/city, languages, intention,
 * timeline, and the optional fields. No verified badge exists yet — none is
 * shown (no fake claims).
 */

import { Heart, MapPin, Languages, GraduationCap, Briefcase, Ruler } from "lucide-react";

import { MATRIMONY_INTENTIONS, MATRIMONY_TIMELINES } from "@/lib/matrimony";
import type { EditorProfile } from "./MatrimonyProfileEditor";

type AccountFacts = {
  age: number | null;
  gender: string | null;
  state: string | null;
  city: string | null;
};

export default function MatrimonyProfilePreview({
  profile,
  account,
}: {
  profile: EditorProfile;
  account: AccountFacts;
}) {
  const primary = profile.photos.find((p) => p.position === 0);
  const intention = MATRIMONY_INTENTIONS.find((i) => i.value === profile.intention);
  const timeline = MATRIMONY_TIMELINES.find((t) => t.value === profile.timeline);

  return (
    <div>
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#2B254E]/40 to-[#1C1929] overflow-hidden">
        {/* Photo */}
        <div className="relative aspect-[4/3] bg-white/[0.03]">
          {primary ? (
            <img
              src={primary.url}
              alt="Primary profile photo"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Heart size={40} className="text-white/10" strokeWidth={1.4} />
            </div>
          )}
          <span className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur text-[10px] font-black text-[#94A3B8] uppercase tracking-wide">
            Preview
          </span>
        </div>

        {/* Body */}
        <div className="p-4 md:p-5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-black text-white">
              {account.age ?? "—"}
            </span>
            <span className="text-[13px] text-[#94A3B8]">
              {account.gender === "male" ? "Man" : account.gender === "female" ? "Woman" : "Member"}
            </span>
          </div>

          {(account.state || account.city) && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#B7C0D0]">
              <MapPin size={13} className="text-[#7C3AED]" />
              {[account.city, account.state].filter(Boolean).join(", ")}
            </p>
          )}

          {profile.languages.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] text-[#B7C0D0]">
              <Languages size={13} className="text-[#7C3AED] mt-0.5 shrink-0" />
              <span>{profile.languages.join(" · ")}</span>
            </p>
          )}

          {(intention || timeline) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {intention && (
                <span className="px-2.5 py-1 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[11px] font-bold text-[#F39B9B]">
                  {intention.label}
                </span>
              )}
              {timeline && (
                <span className="px-2.5 py-1 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[11px] font-bold text-[#C4B5FD]">
                  {timeline.label}
                </span>
              )}
            </div>
          )}

          {profile.aboutMe && (
            <p className="mt-3 text-[13px] text-[#B7C0D0] leading-relaxed whitespace-pre-wrap break-words">
              {profile.aboutMe}
            </p>
          )}

          {(profile.education || profile.profession || profile.heightCm) && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5">
              {profile.education && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-[#94A3B8]">
                  <GraduationCap size={13} className="text-[#64748B]" /> {profile.education}
                </p>
              )}
              {profile.profession && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-[#94A3B8]">
                  <Briefcase size={13} className="text-[#64748B]" /> {profile.profession}
                </p>
              )}
              {profile.heightCm && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-[#94A3B8]">
                  <Ruler size={13} className="text-[#64748B]" /> {profile.heightCm} cm
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#64748B] text-center leading-relaxed">
        This is how eligible members will see your profile once matching
        launches. Your date of birth, contact details and account info are
        never shown.
      </p>
    </div>
  );
}
