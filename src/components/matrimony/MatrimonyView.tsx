"use client";

/**
 * ─── MATRIMONY VIEW (Task 74 Stage B) ───────────────────────────────────────
 *
 * Member-only, in-app (SPA) matrimony section — never a public route, never
 * search-engine indexed. Rendered inside the authenticated HomeApp shell.
 *
 * Flow:
 *   gate check (GET /api/matrimony/profile) →
 *     - DOB missing     → friendly card + link to account settings
 *     - under 18        → respectful block
 *     - account problem → block
 *     - no profile      → intro + "Create my profile"
 *     - profile         → tabs: My Profile · Photos · Preview · Privacy
 *
 * Stage B scope: profile CRUD, photos (private bucket), visibility control.
 * NO discovery/search/interests/messaging yet — the UI says so honestly.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Heart, ShieldCheck, Camera, Eye, Info, PauseCircle,
  PlayCircle, Trash2, CheckCircle2, AlertTriangle,
} from "lucide-react";

import MatrimonyProfileEditor, { type EditorProfile } from "./MatrimonyProfileEditor";
import MatrimonyPhotos from "./MatrimonyPhotos";
import MatrimonyProfilePreview from "./MatrimonyProfilePreview";
import { MATRIMONY_PHOTO_VISIBILITY } from "@/lib/matrimony";

type GateCode = "DOB_REQUIRED" | "AGE_NOT_ELIGIBLE" | "ACCOUNT_INACTIVE";

type TabId = "profile" | "photos" | "preview" | "privacy";

const TABS: { id: TabId; label: string; icon: typeof Heart }[] = [
  { id: "profile", label: "My Profile", icon: Heart },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
];

const STATUS_BANNERS: Record<string, { text: string; cls: string }> = {
  draft: {
    text: "Draft — only you can see this profile. Activate it from the Privacy tab when you're ready.",
    cls: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
  },
  active: {
    text: "Active — your profile is ready. Matching & discovery arrive in the next update.",
    cls: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
  },
  paused: {
    text: "Paused — your profile is hidden from other members. Resume any time.",
    cls: "border-slate-400/20 bg-slate-400/[0.07] text-slate-300",
  },
  restricted: {
    text: "Restricted — this profile is under review. Please contact support for help.",
    cls: "border-red-400/20 bg-red-400/[0.07] text-red-300",
  },
};

export default function MatrimonyView({
  onBack,
  onOpenAccountSettings,
}: {
  onBack: () => void;
  onOpenAccountSettings: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [gateCode, setGateCode] = useState<GateCode | null>(null);
  const [profile, setProfile] = useState<EditorProfile | null>(null);
  const [account, setAccount] = useState<{
    age: number | null; gender: string | null; state: string | null; city: string | null;
  }>({ age: null, gender: null, state: null, city: null });
  const [tab, setTab] = useState<TabId>("profile");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/matrimony/profile", { cache: "no-store" });
      if (res.status === 401) {
        setGateCode("ACCOUNT_INACTIVE"); // treated as generic re-auth prompt
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setGateCode((j.code as GateCode) || "ACCOUNT_INACTIVE");
        return;
      }
      const j = await res.json();
      setGateCode(null);
      setProfile(j.profile);
      setAccount({ age: j.age ?? null, gender: j.gender ?? null, state: j.state ?? null, city: j.city ?? null });
    } catch {
      toast.error("Could not load Matrimony. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = useCallback((p: EditorProfile) => {
    setProfile(p);
  }, []);

  const applyStatus = async (action: "activate" | "pause" | "resume") => {
    setBusy(true);
    try {
      const res = await fetch("/api/matrimony/profile/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error || "Could not update your profile status.");
        return;
      }
      setProfile(j.profile);
      toast.success(
        action === "activate" ? "Profile activated." :
        action === "pause" ? "Profile paused — hidden from other members." :
        "Profile resumed."
      );
      setTab("privacy");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const sure = window.confirm(
      "Delete your Matrimony profile?\n\nYour profile, photos and details will be removed. Your Koino account and everything else stay untouched. This cannot be undone."
    );
    if (!sure) return;
    setBusy(true);
    try {
      const res = await fetch("/api/matrimony/profile", { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Could not delete your profile.");
        return;
      }
      setProfile(null);
      setTab("profile");
      toast.success("Your Matrimony profile was deleted.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const changeVisibility = async (value: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      const res = await fetch("/api/matrimony/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languages: profile.languages.length ? profile.languages : ["English"],
          intention: profile.intention || "seeking_life_partner",
          timeline: profile.timeline || "gods_timing",
          photoVisibility: value,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error || "Could not update visibility.");
        return;
      }
      setProfile(j.profile);
      toast.success("Photo visibility updated.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-2xl bg-[#1C1929]" />
          <div className="h-10 rounded-xl bg-[#1C1929] w-2/3" />
          <div className="h-64 rounded-2xl bg-[#1C1929]" />
        </div>
      </div>
    );
  }

  // ─── Gates ───
  if (gateCode) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-10">
        <GateCard code={gateCode} onBack={onBack} onOpenAccountSettings={onOpenAccountSettings} onRetry={load} />
      </div>
    );
  }

  // ─── No profile yet: intro ───
  if (!profile) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-6 md:py-10">
        <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#2B254E]/60 to-[#1C1929] p-6 md:p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#F39B9B]/20 to-[#7C3AED]/20 flex items-center justify-center">
            <Heart size={26} className="text-[#F39B9B]" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">Koino Matrimony</h1>
          <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
            Find a life partner in a trusted Christian community. Your matrimony
            profile is private — only eligible, signed-in Koino members can ever
            see it, and photos are shared only on your terms.
          </p>
          <ul className="mt-5 space-y-2 text-left text-[13px] text-[#B7C0D0]">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> For members 18 and older — verified on every action, server-side</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> Photos are private by default — visible only after a mutual connection (coming soon)</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> Pause, hide or delete your profile any time — your Koino account is never affected</li>
          </ul>
          <button
            onClick={() => setProfile({
              id: "", status: "draft", languages: [], intention: null, timeline: null,
              denomination: null, education: null, profession: null, aboutMe: null,
              heightCm: null, photoVisibility: "CONNECTIONS_ONLY", restrictedReason: null,
              activatedAt: null, createdAt: "", updatedAt: "", photos: [],
            })}
            className="mt-6 w-full md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-[#F39B9B] to-[#EC4899] text-white text-sm font-black hover:opacity-90 transition-opacity"
          >
            Create my profile
          </button>
          <p className="mt-3 text-[11px] text-[#64748B]">
            It saves as a draft — nothing is visible to anyone until you activate it.
          </p>
        </div>
        <button onClick={onBack} className="mt-5 mx-auto flex items-center gap-1.5 text-xs text-[#64748B] hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to app
        </button>
      </div>
    );
  }

  // ─── Profile exists ───
  const banner = STATUS_BANNERS[profile.status];

  return (
    <div className="max-w-[680px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F39B9B]/20 to-[#7C3AED]/20 flex items-center justify-center shrink-0">
          <Heart size={18} className="text-[#F39B9B]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-white leading-tight">Koino Matrimony</h1>
          <p className="text-[11px] text-[#64748B]">Private · Members only · 18+</p>
        </div>
      </div>

      {/* Status banner */}
      {banner && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium ${banner.cls}`}>
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>{banner.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all border ${
              tab === id
                ? "bg-[#7C3AED]/15 text-white border-[#7C3AED]/30"
                : "text-[#94A3B8] hover:text-white bg-[#1C1929] border-white/[0.06]"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="mt-4">
        {tab === "profile" && (
          <MatrimonyProfileEditor profile={profile} account={account} onSaved={handleSaved} />
        )}

        {tab === "photos" && (
          <MatrimonyPhotos
            photos={profile.photos}
            visibility={profile.photoVisibility}
            onChanged={load}
          />
        )}

        {tab === "preview" && (
          <MatrimonyProfilePreview profile={profile} account={account} />
        )}

        {tab === "privacy" && (
          <div className="space-y-4">
            {/* Photo visibility */}
            <section className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-4 md:p-5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#7C3AED]" /> Photo visibility
              </h3>
              <div className="mt-3 space-y-2">
                {MATRIMONY_PHOTO_VISIBILITY.map((v) => (
                  <label
                    key={v}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      profile.photoVisibility === v
                        ? "border-[#7C3AED]/40 bg-[#7C3AED]/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="photoVisibility"
                      className="mt-1 accent-[#7C3AED]"
                      checked={profile.photoVisibility === v}
                      disabled={busy}
                      onChange={() => changeVisibility(v)}
                    />
                    <span className="text-[13px]">
                      <span className="font-bold text-white block">
                        {v === "CONNECTIONS_ONLY" ? "Connections only (recommended)" : "Eligible members"}
                      </span>
                      <span className="text-[#94A3B8]">
                        {v === "CONNECTIONS_ONLY"
                          ? "Only you — and, once matching launches, members you mutually connect with — can see your photos."
                          : "Any signed-in, 18+ Koino Matrimony member can see your photos."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[#64748B] leading-relaxed">
                Photos are stored privately and checked on the server for every
                single view. Please note: no system can fully prevent someone
                taking a screenshot — share thoughtfully.
              </p>
            </section>

            {/* Status controls */}
            <section className="rounded-2xl border border-white/[0.06] bg-[#1C1929] p-4 md:p-5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <PauseCircle size={15} className="text-[#7C3AED]" /> Profile status
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {profile.status === "draft" && (
                  <button
                    onClick={() => applyStatus("activate")}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F39B9B] to-[#EC4899] text-white text-sm font-black hover:opacity-90 disabled:opacity-50"
                  >
                    Activate profile
                  </button>
                )}
                {profile.status === "active" && (
                  <button
                    onClick={() => applyStatus("pause")}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <PauseCircle size={15} /> Pause profile (hide from everyone)
                  </button>
                )}
                {profile.status === "paused" && (
                  <button
                    onClick={() => applyStatus("resume")}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F39B9B] to-[#EC4899] text-white text-sm font-black hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <PlayCircle size={15} /> Resume profile
                  </button>
                )}
                {profile.status === "restricted" && (
                  <p className="text-[12.5px] text-[#94A3B8] flex items-start gap-2">
                    <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                    This profile is restricted. Contact support if you believe this is a mistake.
                  </p>
                )}
              </div>
              {profile.status === "draft" && (
                <p className="mt-2 text-[11px] text-[#64748B]">
                  Activation needs your languages, intention, timeline and your
                  account's state &amp; city — fill them in on the My Profile tab first.
                </p>
              )}
            </section>

            {/* Danger zone */}
            <section className="rounded-2xl border border-red-400/15 bg-red-400/[0.03] p-4 md:p-5">
              <h3 className="text-sm font-black text-red-300 flex items-center gap-2">
                <Trash2 size={15} /> Delete matrimony profile
              </h3>
              <p className="mt-2 text-[12px] text-[#94A3B8] leading-relaxed">
                Removes your matrimony profile and photos permanently. Your
                Koino account, feed, and everything else are NOT affected.
              </p>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="mt-3 w-full py-2.5 rounded-xl border border-red-400/30 text-red-300 text-sm font-bold hover:bg-red-400/10 disabled:opacity-50"
              >
                Delete my matrimony profile
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Gate cards ─────────────────────────────────────────────────────────────
function GateCard({
  code, onBack, onOpenAccountSettings, onRetry,
}: {
  code: GateCode;
  onBack: () => void;
  onOpenAccountSettings: () => void;
  onRetry: () => void;
}) {
  if (code === "DOB_REQUIRED") {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-[#1C1929] p-6 md:p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 flex items-center justify-center">
          <Info size={26} className="text-amber-400" strokeWidth={1.8} />
        </div>
        <h1 className="mt-4 text-xl font-black text-white">One thing first</h1>
        <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
          Matrimony is for members 18 and older. We need your date of birth to
          confirm that — add it in your Koino profile settings, then come back.
          Your date of birth stays private; others only ever see your age.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onOpenAccountSettings}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F39B9B] to-[#EC4899] text-white text-sm font-black hover:opacity-90"
          >
            Open profile settings
          </button>
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
          >
            I've added it — check again
          </button>
        </div>
        <button onClick={onBack} className="mt-4 mx-auto flex items-center gap-1.5 text-xs text-[#64748B] hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to app
        </button>
      </div>
    );
  }

  if (code === "AGE_NOT_ELIGIBLE") {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-[#1C1929] p-6 md:p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
          <ShieldCheck size={26} className="text-[#C4B5FD]" strokeWidth={1.8} />
        </div>
        <h1 className="mt-4 text-xl font-black text-white">Matrimony is 18+</h1>
        <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
          Thank you for your interest — Matrimony is reserved for adult members
          (18 and older) because of the personal nature of the service. There's
          still so much for you on Koino: the feed, Bible study, trivia,
          groups, and more.
        </p>
        <button
          onClick={onBack}
          className="mt-5 px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
        >
          Back to Koino
        </button>
      </div>
    );
  }

  // ACCOUNT_INACTIVE / auth issues
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-[#1C1929] p-6 md:p-8 text-center">
      <h1 className="text-xl font-black text-white">Sign in to continue</h1>
      <p className="mt-2 text-sm text-[#94A3B8]">
        Matrimony is available to signed-in Koino members.
      </p>
      <button
        onClick={onBack}
        className="mt-5 px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
      >
        Back to app
      </button>
    </div>
  );
}
