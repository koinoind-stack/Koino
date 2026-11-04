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
 *     - profile         → tabs: Discover · My Profile · Photos · Preview · Privacy
 *
 * Stage B scope: profile CRUD, photos (private bucket), visibility control.
 * Stage C scope: Discover tab — view-only browse of ACTIVE profiles
 * (search/filter/paginate). Interest & messaging arrive later — the UI
 * says so honestly.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Heart, ShieldCheck, Camera, Eye, Info, PauseCircle,
  PlayCircle, Trash2, CheckCircle2, AlertTriangle, Search,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n/LanguageContext";

import MatrimonyDiscover from "./MatrimonyDiscover";
import MatrimonyProfileEditor, { type EditorProfile } from "./MatrimonyProfileEditor";
import MatrimonyPhotos from "./MatrimonyPhotos";
import MatrimonyProfilePreview from "./MatrimonyProfilePreview";
import { MATRIMONY_PHOTO_VISIBILITY } from "@/lib/matrimony";

type GateCode = "DOB_REQUIRED" | "AGE_NOT_ELIGIBLE" | "ACCOUNT_INACTIVE";

type TabId = "discover" | "profile" | "photos" | "preview" | "privacy";

const TABS: { id: TabId; label: string; icon: typeof Heart }[] = [
  { id: "discover", label: "matrimony.tabs.discover", icon: Search },
  { id: "profile", label: "matrimony.tabs.profile", icon: Heart },
  { id: "photos", label: "matrimony.tabs.photos", icon: Camera },
  { id: "preview", label: "matrimony.tabs.preview", icon: Eye },
  { id: "privacy", label: "matrimony.tabs.privacy", icon: ShieldCheck },
];

const STATUS_BANNERS: Record<string, { text: string; cls: string }> = {
  draft: {
    text: "matrimony.banner.draft",
    cls: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
  },
  active: {
    text: "matrimony.banner.active",
    cls: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
  },
  paused: {
    text: "matrimony.banner.paused",
    cls: "border-slate-400/20 bg-slate-400/[0.07] text-slate-300",
  },
  restricted: {
    text: "matrimony.banner.restricted",
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
  const t = useTranslation();
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
      toast.error(t("matrimony.error.load"));
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
        toast.error(j.error || t("matrimony.error.status"));
        return;
      }
      setProfile(j.profile);
      toast.success(
        action === "activate" ? t("matrimony.toast.activated") :
        action === "pause" ? t("matrimony.toast.paused") :
        t("matrimony.toast.resumed")
      );
      // Activation pays off immediately: land on Discover. Other status
      // changes keep the member on the Privacy tab where the controls live.
      setTab(action === "activate" ? "discover" : "privacy");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const sure = window.confirm(
      t("matrimony.confirm.delete")
    );
    if (!sure) return;
    setBusy(true);
    try {
      const res = await fetch("/api/matrimony/profile", { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || t("matrimony.error.delete"));
        return;
      }
      setProfile(null);
      setTab("profile");
      toast.success(t("matrimony.toast.deleted"));
    } catch {
      toast.error(t("common.error.network"));
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
        toast.error(j.error || t("matrimony.error.visibility"));
        return;
      }
      setProfile(j.profile);
      toast.success(t("matrimony.toast.visibilityUpdated"));
    } catch {
      toast.error(t("common.error.network"));
    } finally {
      setBusy(false);
    }
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-2xl bg-[#13294A]" />
          <div className="h-10 rounded-xl bg-[#13294A] w-2/3" />
          <div className="h-64 rounded-2xl bg-[#13294A]" />
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
        <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#1A3A66]/60 to-[#13294A] p-6 md:p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#F97316]/20 to-[#2563EB]/20 flex items-center justify-center">
            <Heart size={26} className="text-[#F97316]" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">{t("matrimony.title")}</h1>
          <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
            {t("matrimony.intro.subtitle")}
          </p>
          <ul className="mt-5 space-y-2 text-left text-[13px] text-[#B7C0D0]">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> {t("matrimony.intro.point1")}</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> {t("matrimony.intro.point2")}</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> {t("matrimony.intro.point3")}</li>
          </ul>
          <button
            onClick={() => setProfile({
              id: "", status: "draft", languages: [], intention: null, timeline: null,
              denomination: null, education: null, profession: null, aboutMe: null,
              heightCm: null, photoVisibility: "CONNECTIONS_ONLY", restrictedReason: null,
              activatedAt: null, createdAt: "", updatedAt: "", photos: [],
            })}
            className="mt-6 w-full md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F97316] text-white text-sm font-black hover:opacity-90 transition-opacity"
          >
            {t("matrimony.cta.create")}
          </button>
          <p className="mt-3 text-[11px] text-[#64748B]">
            {t("matrimony.intro.draftNote")}
          </p>
        </div>
        <button onClick={onBack} className="mt-5 mx-auto flex items-center gap-1.5 text-xs text-[#64748B] hover:text-white transition-colors">
          <ArrowLeft size={14} /> {t("matrimony.backToApp")}
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316]/20 to-[#2563EB]/20 flex items-center justify-center shrink-0">
          <Heart size={18} className="text-[#F97316]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-white leading-tight">{t("matrimony.title")}</h1>
          <p className="text-[11px] text-[#64748B]">{t("matrimony.header.badge")}</p>
        </div>
      </div>

      {/* Status banner */}
      {banner && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium ${banner.cls}`}>
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>{t(banner.text)}</span>
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
                ? "bg-[#2563EB]/15 text-white border-[#2563EB]/30"
                : "text-[#94A3B8] hover:text-white bg-[#13294A] border-white/[0.06]"
            }`}
          >
            <Icon size={14} /> {t(label)}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="mt-4">
        {tab === "discover" && <MatrimonyDiscover />}

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
            <section className="rounded-2xl border border-white/[0.06] bg-[#13294A] p-4 md:p-5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#2563EB]" /> {t("matrimony.privacy.photoVisibility")}
              </h3>
              <div className="mt-3 space-y-2">
                {MATRIMONY_PHOTO_VISIBILITY.map((v) => (
                  <label
                    key={v}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      profile.photoVisibility === v
                        ? "border-[#2563EB]/40 bg-[#2563EB]/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="photoVisibility"
                      className="mt-1 accent-[#2563EB]"
                      checked={profile.photoVisibility === v}
                      disabled={busy}
                      onChange={() => changeVisibility(v)}
                    />
                    <span className="text-[13px]">
                      <span className="font-bold text-white block">
                        {v === "CONNECTIONS_ONLY" ? t("matrimony.privacy.connectionsOnly") : t("matrimony.privacy.eligibleMembers")}
                      </span>
                      <span className="text-[#94A3B8]">
                        {v === "CONNECTIONS_ONLY"
                          ? t("matrimony.privacy.connectionsOnlyDesc")
                          : t("matrimony.privacy.eligibleMembersDesc")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[#64748B] leading-relaxed">
                {t("matrimony.privacy.photoNote")}
              </p>
            </section>

            {/* Status controls */}
            <section className="rounded-2xl border border-white/[0.06] bg-[#13294A] p-4 md:p-5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <PauseCircle size={15} className="text-[#2563EB]" /> {t("matrimony.privacy.statusTitle")}
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {profile.status === "draft" && (
                  <button
                    onClick={() => applyStatus("activate")}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F97316] text-white text-sm font-black hover:opacity-90 disabled:opacity-50"
                  >
                    {t("matrimony.privacy.activate")}
                  </button>
                )}
                {profile.status === "active" && (
                  <button
                    onClick={() => applyStatus("pause")}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <PauseCircle size={15} /> {t("matrimony.privacy.pause")}
                  </button>
                )}
                {profile.status === "paused" && (
                  <button
                    onClick={() => applyStatus("resume")}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F97316] text-white text-sm font-black hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <PlayCircle size={15} /> {t("matrimony.privacy.resume")}
                  </button>
                )}
                {profile.status === "restricted" && (
                  <p className="text-[12.5px] text-[#94A3B8] flex items-start gap-2">
                    <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                    {t("matrimony.privacy.restrictedNote")}
                  </p>
                )}
              </div>
              {profile.status === "draft" && (
                <p className="mt-2 text-[11px] text-[#64748B]">
                  {t("matrimony.privacy.activationNeeds")}
                </p>
              )}
            </section>

            {/* Danger zone */}
            <section className="rounded-2xl border border-red-400/15 bg-red-400/[0.03] p-4 md:p-5">
              <h3 className="text-sm font-black text-red-300 flex items-center gap-2">
                <Trash2 size={15} /> {t("matrimony.danger.title")}
              </h3>
              <p className="mt-2 text-[12px] text-[#94A3B8] leading-relaxed">
                {t("matrimony.danger.desc")}
              </p>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="mt-3 w-full py-2.5 rounded-xl border border-red-400/30 text-red-300 text-sm font-bold hover:bg-red-400/10 disabled:opacity-50"
              >
                {t("matrimony.danger.cta")}
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
  const t = useTranslation();

  if (code === "DOB_REQUIRED") {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-[#13294A] p-6 md:p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 flex items-center justify-center">
          <Info size={26} className="text-amber-400" strokeWidth={1.8} />
        </div>
        <h1 className="mt-4 text-xl font-black text-white">{t("matrimony.gate.dob.title")}</h1>
        <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
          {t("matrimony.gate.dob.body")}
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onOpenAccountSettings}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F97316] text-white text-sm font-black hover:opacity-90"
          >
            {t("matrimony.gate.dob.openSettings")}
          </button>
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
          >
            {t("matrimony.gate.dob.checkAgain")}
          </button>
        </div>
        <button onClick={onBack} className="mt-4 mx-auto flex items-center gap-1.5 text-xs text-[#64748B] hover:text-white transition-colors">
          <ArrowLeft size={14} /> {t("matrimony.backToApp")}
        </button>
      </div>
    );
  }

  if (code === "AGE_NOT_ELIGIBLE") {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-[#13294A] p-6 md:p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2563EB]/10 flex items-center justify-center">
          <ShieldCheck size={26} className="text-[#93C5FD]" strokeWidth={1.8} />
        </div>
        <h1 className="mt-4 text-xl font-black text-white">{t("matrimony.gate.age.title")}</h1>
        <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
          {t("matrimony.gate.age.body")}
        </p>
        <button
          onClick={onBack}
          className="mt-5 px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
        >
          {t("matrimony.gate.backToKoino")}
        </button>
      </div>
    );
  }

  // ACCOUNT_INACTIVE / auth issues
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-[#13294A] p-6 md:p-8 text-center">
      <h1 className="text-xl font-black text-white">{t("matrimony.gate.auth.title")}</h1>
      <p className="mt-2 text-sm text-[#94A3B8]">
        {t("matrimony.gate.auth.body")}
      </p>
      <button
        onClick={onBack}
        className="mt-5 px-6 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.09]"
      >
        {t("matrimony.backToApp")}
      </button>
    </div>
  );
}
