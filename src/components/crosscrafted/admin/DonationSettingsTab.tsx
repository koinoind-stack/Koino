"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HandHeart, Loader2, Save, RotateCcw } from "lucide-react";

// Shape returned by GET /api/admin/donation-settings.
// Includes `id` + `updatedAt` (admin-only) in addition to public fields.
type DonationSettings = {
  id: string;
  upiId: string | null;
  qrCodeUrl: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
  branch: string | null;
  donationMessage: string | null;
  acceptingDonations: boolean;
  updatedAt: string;
};

// Form state — every field is a string (or boolean for the toggle) so the
// controlled inputs can be empty without fighting Prisma null types.
// We convert empty strings → null on save (server does the same).
type FormState = {
  upiId: string;
  qrCodeUrl: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string;
  donationMessage: string;
  acceptingDonations: boolean;
};

const EMPTY_FORM: FormState = {
  upiId: "",
  qrCodeUrl: "",
  accountName: "",
  accountNumber: "",
  ifsc: "",
  bankName: "",
  branch: "",
  donationMessage: "",
  acceptingDonations: true,
};

function toFormState(s: DonationSettings | null): FormState {
  if (!s) return { ...EMPTY_FORM };
  return {
    upiId: s.upiId ?? "",
    qrCodeUrl: s.qrCodeUrl ?? "",
    accountName: s.accountName ?? "",
    accountNumber: s.accountNumber ?? "",
    ifsc: s.ifsc ?? "",
    bankName: s.bankName ?? "",
    branch: s.branch ?? "",
    donationMessage: s.donationMessage ?? "",
    acceptingDonations: s.acceptingDonations,
  };
}

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

/**
 * Admin "Donations" tab — manages the DonationSettings singleton row.
 *
 * Loads the existing settings on mount via GET /api/admin/donation-settings,
 * and saves the whole form via PUT on submit. Uses `sonner` toasts for
 * success/error feedback (same pattern as RedemptionsTab).
 */
export default function DonationSettingsTab() {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/donation-settings");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { settings: DonationSettings };
        if (cancelled) return;
        setForm(toFormState(data.settings));
        setUpdatedAt(data.settings.updatedAt);
        setLoaded(true);
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message || "Failed to load donation settings");
          setLoaded(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/donation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { settings: DonationSettings };
      setForm(toFormState(data.settings));
      setUpdatedAt(data.settings.updatedAt);
      toast.success("Donation settings saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save donation settings");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    // Reset form fields to empty (without touching the DB). Lets the admin
    // start over if they made a mess of the inputs before saving.
    setForm({ ...EMPTY_FORM });
    toast.info("Form reset — click Save Settings to clear stored values.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F39B9B] animate-spin" />
      </div>
    );
  }

  // Helper: a labelled text input.
  const field = (
    key: keyof Omit<FormState, "acceptingDonations">,
    label: string,
    opts: { placeholder?: string; required?: boolean; mono?: boolean } = {}
  ) => (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
        {label} {opts.required && <span className="text-[#F39B9B]">*</span>}
      </label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="neo-input text-sm"
        placeholder={opts.placeholder}
        style={opts.mono ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } : undefined}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-[#F39B9B]" />
        <h2 className="text-sm font-bold text-white">Donation Settings</h2>
        {loaded && updatedAt && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F39B9B]/15 text-[#F39B9B]">
            Last saved {formatUpdatedAt(updatedAt)}
          </span>
        )}
      </div>

      {/* Intro / honesty banner */}
      <div className="bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3">
        <p className="text-[11px] text-[#A09DB1] leading-relaxed">
          These settings control the <span className="font-bold text-white">/support</span> page.
          Fill in only the methods you want to enable. Empty sections are hidden
          from users automatically — never use fake/placeholder bank details.
          Koino does <span className="font-bold text-white">not</span> process online payments.
        </p>
      </div>

      {/* Accepting toggle */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">Accepting Donations</p>
            <p className="text-[11px] text-[#A09DB1] mt-0.5">
              When off, the /support page shows a &ldquo;Donations are
              temporarily paused&rdquo; notice instead of the cards.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.acceptingDonations}
            onClick={() => set("acceptingDonations", !form.acceptingDonations)}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
              form.acceptingDonations ? "bg-[#22C55E]" : "bg-white/[0.1]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                form.acceptingDonations ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* UPI */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HandHeart size={14} className="text-[#F39B9B]" />
          <h3 className="text-sm font-bold text-white">UPI</h3>
        </div>
        {field("upiId", "UPI ID", {
          placeholder: "koino@upi",
          mono: true,
        })}
      </div>

      {/* QR code */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HandHeart size={14} className="text-[#A78BFA]" />
          <h3 className="text-sm font-bold text-white">QR Code</h3>
        </div>
        {field("qrCodeUrl", "QR Code Image URL", {
          placeholder: "https://<supabase-storage>/donations/qr.png",
          mono: true,
        })}
        <p className="text-[10px] text-[#94A3B8] leading-relaxed">
          Paste a public Supabase Storage URL to a QR code image. File upload
          is out of scope — upload the image to Supabase Storage first, then
          paste the public URL here.
        </p>
        {form.qrCodeUrl && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.qrCodeUrl}
              alt="QR preview"
              className="w-12 h-12 object-contain rounded-lg bg-white p-1"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-[10px] text-[#94A3B8] break-all line-clamp-2">
              {form.qrCodeUrl}
            </span>
          </div>
        )}
      </div>

      {/* Bank transfer */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HandHeart size={14} className="text-[#38BDF8]" />
          <h3 className="text-sm font-bold text-white">Bank Transfer</h3>
        </div>
        <p className="text-[10px] text-[#94A3B8] leading-relaxed">
          All four core fields (Account Name, Account Number, IFSC, Bank Name)
          are required for the bank card to appear on /support. Branch is
          optional display info.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("accountName", "Account Name", { placeholder: "Koino Foundation" })}
          {field("accountNumber", "Account Number", { placeholder: "1234567890", mono: true })}
          {field("ifsc", "IFSC Code", { placeholder: "HDFC0001234", mono: true })}
          {field("bankName", "Bank Name", { placeholder: "HDFC Bank" })}
          {field("branch", "Branch (optional)", { placeholder: "Bengaluru MG Road" })}
        </div>
      </div>

      {/* Donation message */}
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">Donation Message</h3>
        <p className="text-[10px] text-[#94A3B8] leading-relaxed">
          Optional. Shown as a callout above the donation cards on /support.
          Use it for a thank-you note, a Bible verse, or a current need.
        </p>
        <textarea
          value={form.donationMessage}
          onChange={(e) => set("donationMessage", e.target.value)}
          className="neo-input text-sm h-20 resize-none"
          placeholder={"e.g. \"Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.\" — 2 Corinthians 9:7"}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          <RotateCcw size={13} />
          Reset Form
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all hover:-translate-y-px"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={14} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
