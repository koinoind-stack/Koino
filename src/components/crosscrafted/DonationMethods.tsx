"use client";

import { useState } from "react";
import { Copy, Check, Download, QrCode, Landmark, Wallet } from "lucide-react";

// Shape returned by GET /api/donation-settings (public fields only — no id/updatedAt).
// Kept in sync with src/app/api/donation-settings/route.ts.
export type PublicDonationSettings = {
  upiId: string | null;
  qrCodeUrl: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
  branch: string | null;
  donationMessage: string | null;
  acceptingDonations: boolean;
};

/**
 * Interactive donation methods section.
 *
 * Renders up to three cards based on which fields the admin has configured:
 *   - UPI card        (shown if upiId is set)
 *   - QR code card    (shown if qrCodeUrl is set)
 *   - Bank transfer   (shown only if accountName, accountNumber, ifsc AND
 *                      bankName are ALL set — branch is optional display)
 *
 * This is a client component because it needs clipboard + download actions.
 * The parent /support page is a Server Component that fetches settings from
 * Prisma directly and passes them in as props.
 */
export default function DonationMethods({
  settings,
}: {
  settings: PublicDonationSettings;
}) {
  const showUpi = Boolean(settings.upiId);
  const showQr = Boolean(settings.qrCodeUrl);
  // Bank card requires ALL core fields — branch is optional for display only.
  const showBank =
    Boolean(settings.accountName) &&
    Boolean(settings.accountNumber) &&
    Boolean(settings.ifsc) &&
    Boolean(settings.bankName);

  const hasAnyCard = showUpi || showQr || showBank;

  if (!hasAnyCard) {
    // Nothing configured yet — show a gentle "no methods" state.
    return (
      <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-6 text-center">
        <p className="text-sm text-[#A09DB1]">
          Donation methods haven&apos;t been configured yet. Please check back
          soon, or{" "}
          <a href="/contact" className="text-[#A78BFA] underline">
            contact us
          </a>{" "}
          to support Koino.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {showUpi && <UpiCard upiId={settings.upiId!} />}
      {showQr && <QrCard qrCodeUrl={settings.qrCodeUrl!} />}
      {showBank && <BankCard settings={settings} />}
    </div>
  );
}

// ─── UPI card ───────────────────────────────────────────────────────────
function UpiCard({ upiId }: { upiId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be blocked (e.g. insecure context / older browser).
      // Fallback: select-and-copy via a hidden textarea.
      try {
        const ta = document.createElement("textarea");
        ta.value = upiId;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        // Give up silently — user can still read + manually copy the UPI ID.
      }
    }
  };

  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5 flex flex-col">
      <div className="w-10 h-10 rounded-xl bg-[#F39B9B]/15 border border-[#F39B9B]/25 flex items-center justify-center mb-3">
        <Wallet size={18} className="text-[#F39B9B]" />
      </div>
      <h3 className="text-base font-bold text-white mb-1">UPI</h3>
      <p className="text-[11px] text-[#A09DB1] mb-3 leading-relaxed">
        Pay directly to our UPI ID from any UPI-enabled app.
      </p>
      <div className="flex-1" />
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 mb-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] mb-0.5">
          UPI ID
        </p>
        <p className="text-sm font-extrabold text-white break-all">{upiId}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="w-full py-2.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-xs uppercase tracking-wider transition-all hover:-translate-y-px flex items-center justify-center gap-1.5"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied!" : "Copy UPI ID"}
      </button>
    </div>
  );
}

// ─── QR code card ───────────────────────────────────────────────────────
function QrCard({ qrCodeUrl }: { qrCodeUrl: string }) {
  // Use a plain <a download> for download — this works for same-origin
  // URLs (Supabase Storage public URLs are same-origin-ish / CORS-enabled)
  // and falls back to opening the image in a new tab if download fails.
  // We deliberately do NOT fetch+create a blob here because Supabase Storage
  // public URLs are already direct links and `download` works natively.
  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5 flex flex-col">
      <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex items-center justify-center mb-3">
        <QrCode size={18} className="text-[#A78BFA]" />
      </div>
      <h3 className="text-base font-bold text-white mb-1">Scan &amp; Pay</h3>
      <p className="text-[11px] text-[#A09DB1] mb-3 leading-relaxed">
        Scan this QR code with any UPI app to give.
      </p>
      <div className="flex-1 flex items-center justify-center my-2">
        {/* Use a plain <img> — Next/Image requires remote domains to be
            whitelisted in next.config.js, but admin may paste arbitrary
            Supabase Storage URLs. A regular <img> avoids that friction. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCodeUrl}
          alt="Donation QR code"
          className="w-44 h-44 object-contain rounded-xl bg-white p-2 border border-white/[0.06]"
          loading="lazy"
        />
      </div>
      <a
        href={qrCodeUrl}
        download="koino-donation-qr.png"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-2.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-xs uppercase tracking-wider transition-all hover:-translate-y-px flex items-center justify-center gap-1.5"
      >
        <Download size={13} />
        Download QR Code
      </a>
    </div>
  );
}

// ─── Bank transfer card ─────────────────────────────────────────────────
function BankCard({ settings }: { settings: PublicDonationSettings }) {
  const rows: { label: string; value: string }[] = [
    { label: "Account Name", value: settings.accountName! },
    { label: "Account Number", value: settings.accountNumber! },
    { label: "IFSC Code", value: settings.ifsc! },
    { label: "Bank Name", value: settings.bankName! },
  ];
  if (settings.branch) {
    rows.push({ label: "Branch", value: settings.branch });
  }

  return (
    <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5 flex flex-col">
      <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/25 flex items-center justify-center mb-3">
        <Landmark size={18} className="text-[#38BDF8]" />
      </div>
      <h3 className="text-base font-bold text-white mb-1">Bank Transfer</h3>
      <p className="text-[11px] text-[#A09DB1] mb-3 leading-relaxed">
        Direct NEFT / IMPS / RTGS transfer to Koino&apos;s account.
      </p>
      <div className="flex-1 space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] shrink-0">
              {r.label}
            </span>
            <span className="text-xs font-bold text-white text-right break-all">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
