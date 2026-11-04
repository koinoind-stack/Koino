"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  HandHeart,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  DONATION_CONFIG,
  buildUpiUri,
  formatINR,
  validateDonationAmount,
} from "@/lib/founder";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Voluntary donation card (Google Pay / UPI intent).
 *
 * Honesty guarantees (per spec):
 * - No preselected amount; the donate button stays disabled until a valid
 *   amount is chosen.
 * - The UPI intent is built programmatically from the validated amount —
 *   nothing is hardcoded per donation.
 * - There is NO success state: opening a UPI app does not prove a payment
 *   happened, so we only ever show a neutral, grateful status with manual
 *   fallback details. Reliable confirmation would require a payment gateway
 *   with server-side verification (deliberately out of scope here).
 */
type Status = "idle" | "opening" | "initiated";

export default function DonationCard() {
  const t = useTranslation();
  const [selection, setSelection] = useState<number | "other" | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const validation = useMemo(() => {
    if (selection === null) return null;
    return validateDonationAmount(
      selection === "other" ? custom : String(selection)
    );
  }, [selection, custom]);

  const hasValidAmount = validation?.ok === true;
  const selectedAmount = hasValidAmount ? validation.amount : null;

  // Live validation message while typing a custom amount — the donate button
  // is intentionally disabled for invalid input, so the message must surface
  // as the user types instead of on click.
  const liveError =
    selection === "other" && custom.trim() !== "" && validation && !validation.ok
      ? validation.error
      : null;
  const shownError = error ?? liveError;

  // After the UPI intent is opened: if the donor returns to the tab (or the
  // app never took focus on desktop), show the honest "we can't verify" panel.
  useEffect(() => {
    if (status !== "opening") return;
    const onBack = () => {
      if (document.visibilityState === "visible") setStatus("initiated");
    };
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setStatus("initiated");
    }, 2500);
    document.addEventListener("visibilitychange", onBack);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [status]);

  const donate = () => {
    if (status === "opening") return;
    // Validate again immediately before constructing the payment intent.
    const v = validateDonationAmount(
      selection === "other" ? custom : String(selection ?? "")
    );
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError(null);
    setStatus("opening");
    window.location.href = buildUpiUri(v.amount);
  };

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(DONATION_CONFIG.upiId);
      toast.success(t("donation.copied"));
    } catch {
      toast.error(t("donation.error.copy", { upi: DONATION_CONFIG.upiId }));
    }
  };

  // The QR encodes the exact same single-source URI as the donate button.
  // With a valid amount selected it is amount-locked; otherwise it is an
  // open-amount QR (no `am` parameter) and the donor chooses in their app.
  const qrTileRef = useRef<HTMLDivElement>(null);
  const qrValue = useMemo(
    () => buildUpiUri(selectedAmount ?? undefined),
    [selectedAmount]
  );
  const qrFileName =
    selectedAmount !== null
      ? `koino-upi-qr-${selectedAmount}.png`
      : "koino-upi-qr.png";

  const downloadQr = () => {
    const canvas = qrTileRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error(t("donation.qr.notReady"));
      return;
    }
    try {
      const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = qrFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error(t("donation.qr.downloadFailed"));
    }
  };

  return (
    <section className="py-12 px-6" aria-labelledby="donate-heading">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2
            id="donate-heading"
            className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2"
          >
            {t("donation.heading")}
          </h2>
          <p className="text-sm text-[#A09DB1]">
            {t("donation.subheading")}
          </p>
        </div>

        <div className="relative rounded-3xl bg-gradient-to-b from-[#0B1120] to-[#0F2038] border border-[#F59E0B]/15 p-6 sm:p-8 shadow-[0_0_80px_-20px_rgba(245,158,11,0.12)]">
          {/* Card header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 flex items-center justify-center">
              <HandHeart size={20} className="text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-sm font-black text-white">
                {t("donation.cardTitle")}
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                {t("donation.cardSubtitle")}
              </p>
            </div>
          </div>

          {status !== "initiated" ? (
            <>
              {/* Amount selection */}
              <fieldset className="mb-4" disabled={status === "opening"}>
                <legend className="sr-only">
                  {t("donation.legend")}
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {DONATION_CONFIG.presets.map((amt) => {
                    const checked = selection === amt;
                    return (
                      <label
                        key={amt}
                        className={`relative flex items-center justify-center rounded-2xl border py-4 cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#F59E0B]/50 ${
                          checked
                            ? "border-[#F59E0B] bg-[#F59E0B]/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/25"
                        }`}
                      >
                        <input
                          type="radio"
                          name="donation-amount"
                          value={amt}
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            setSelection(amt);
                            setError(null);
                          }}
                        />
                        {checked && (
                          <Check
                            size={13}
                            className="absolute top-1.5 right-1.5 text-[#F59E0B]"
                          />
                        )}
                        <span
                          className={`text-lg font-black ${
                            checked ? "text-white" : "text-[#C9C5DA]"
                          }`}
                        >
                          ₹{amt}
                        </span>
                      </label>
                    );
                  })}
                  <label
                    className={`relative flex items-center justify-center rounded-2xl border py-4 cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#F59E0B]/50 ${
                      selection === "other"
                        ? "border-[#F59E0B] bg-[#F59E0B]/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="donation-amount"
                      value="other"
                      className="sr-only"
                      checked={selection === "other"}
                      onChange={() => {
                        setSelection("other");
                        setError(null);
                      }}
                    />
                    {selection === "other" && (
                      <Check
                        size={13}
                        className="absolute top-1.5 right-1.5 text-[#F59E0B]"
                      />
                    )}
                    <span
                      className={`text-lg font-black ${
                        selection === "other" ? "text-white" : "text-[#C9C5DA]"
                      }`}
                    >
                      {t("donation.other")}
                    </span>
                  </label>
                </div>
              </fieldset>

              {/* Custom amount input */}
              {selection === "other" && (
                <div className="mb-4">
                  <label
                    htmlFor="custom-amount"
                    className="block text-xs font-bold text-[#94A3B8] mb-1.5"
                  >
                    {t("donation.customLabel")}
                  </label>
                  <input
                    id="custom-amount"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={t("donation.customPlaceholder")}
                    value={custom}
                    autoFocus
                    onChange={(e) => {
                      setCustom(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") donate();
                    }}
                    aria-invalid={shownError ? true : undefined}
                    aria-describedby={
                      shownError ? "donation-amount-error" : undefined
                    }
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-white placeholder:text-[#726E88] focus:outline-none focus:border-[#F59E0B]/60 focus:ring-2 focus:ring-[#F59E0B]/20"
                  />
                </div>
              )}

              {/* Selected amount + payee (shown before payment) */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 mb-4 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-[#94A3B8]">
                  {selectedAmount !== null
                    ? t("donation.chosenAmount", { amt: formatINR(selectedAmount) })
                    : t("donation.choosePrompt")}
                </p>
                <p className="text-xs font-bold text-white">
                  {DONATION_CONFIG.payeeName}{" "}
                  <span className="text-[#726E88] font-normal">
                    ({DONATION_CONFIG.upiId})
                  </span>
                </p>
              </div>

              {shownError && (
                <p
                  id="donation-amount-error"
                  aria-live="polite"
                  className="text-xs font-bold text-[#F87171] mb-3"
                >
                  {shownError}
                </p>
              )}

              {/* Primary CTA */}
              <button
                type="button"
                onClick={donate}
                disabled={!hasValidAmount || status === "opening"}
                className="w-full py-3.5 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {status === "opening" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t("donation.opening")}
                  </>
                ) : (
                  <>
                    <Smartphone size={16} /> {t("donation.donate")}
                  </>
                )}
              </button>
              <p className="text-[11px] text-[#726E88] text-center mt-2.5 leading-relaxed">
                {t("donation.helper")}
              </p>

              {/* Scan & Pay — QR built from the same single-source UPI builder */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode
                    size={14}
                    className="text-[#F59E0B]"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-black text-white">
                    {t("donation.scanPay")}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div
                    ref={qrTileRef}
                    role="img"
                    aria-label={
                      selectedAmount !== null
                        ? t("donation.qr.ariaFixed", { amount: formatINR(selectedAmount), name: DONATION_CONFIG.payeeName, upi: DONATION_CONFIG.upiId })
                        : t("donation.qr.ariaOpen", { name: DONATION_CONFIG.payeeName, upi: DONATION_CONFIG.upiId })
                    }
                    className="shrink-0 rounded-xl bg-white p-2.5"
                  >
                    <QRCodeCanvas
                      value={qrValue}
                      size={512}
                      marginSize={2}
                      level="Q"
                      bgColor="#ffffff"
                      fgColor="#0F2038"
                      style={{ width: 160, height: 160, display: "block" }}
                    />
                  </div>
                  <div className="min-w-0 text-center sm:text-left">
                    <p className="text-xs text-[#A09DB1] leading-relaxed">
                      {selectedAmount !== null
                        ? t("donation.qr.paysFixed", { amount: formatINR(selectedAmount), name: DONATION_CONFIG.payeeName })
                        : t("donation.qr.paysOpen")}
                    </p>
                    <p className="text-[11px] text-[#726E88] mt-1.5 leading-relaxed">
                      {t("donation.qr.howTo")}
                    </p>
                    <button
                      type="button"
                      onClick={downloadQr}
                      className="mt-2.5 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download size={13} /> {t("donation.qr.download")}
                      {selectedAmount !== null
                        ? ` — ${formatINR(selectedAmount)}`
                        : ""}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-[#726E88] mt-3 leading-relaxed">
                  {t("donation.qrNote")}
                </p>
              </div>

              {/* Manual / desktop fallback */}
              <details className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-[#94A3B8] hover:text-white transition-colors">
                  {t("donation.manual.pay")}
                </summary>
                <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] text-[#726E88]">
                      {t("donation.manual.open")}
                    </p>
                    <p className="text-sm font-black text-white select-all">
                      {DONATION_CONFIG.upiId}
                    </p>
                    <p className="text-[11px] text-[#726E88]">
                      {t("donation.manual.payee", { name: DONATION_CONFIG.payeeName })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyUpiId}
                    className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Copy size={13} /> {t("donation.manual.copy")}
                  </button>
                </div>
              </details>
            </>
          ) : (
            /* Honest post-intent status — never a fake "payment successful" */
            <div className="text-center py-2" role="status">
              <div className="h-12 w-12 mx-auto rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/25 flex items-center justify-center mb-3">
                <HandHeart size={20} className="text-[#F59E0B]" />
              </div>
              <p className="text-sm font-black text-white mb-1.5">
                {t("donation.thanks")}
              </p>
              <p className="text-xs text-[#94A3B8] leading-relaxed max-w-md mx-auto">
                {t("donation.postIntent")}
              </p>
              <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-left">
                <div>
                  <p className="text-[11px] text-[#726E88]">
                    {t("donation.didntOpen")}
                  </p>
                  <p className="text-sm font-black text-white select-all">
                    {DONATION_CONFIG.upiId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyUpiId}
                  className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={13} /> {t("donation.manual.copy")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-4 text-xs font-bold text-[#F39B9B] hover:text-[#E27B7B] transition-colors"
              >
                {t("donation.chooseAnother")}
              </button>
            </div>
          )}

          {/* Voluntary-donation disclaimer */}
          <p className="text-[10px] text-[#726E88] text-center leading-relaxed mt-5 pt-4 border-t border-white/[0.06] flex items-start justify-center gap-1.5">
            <ShieldCheck
              size={13}
              className="shrink-0 mt-px text-[#4ade80]"
              aria-hidden="true"
            />
            <span className="text-left sm:text-center">
              {t("donation.disclaimer")}
            </span>
          </p>

          {/* Bible verse — subtle and elegant */}
          <div className="mt-5 text-center">
            <p className="text-sm italic text-[#E8D9A0]/90">
              &ldquo;{t("donation.verse")}&rdquo;
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F59E0B]/80 mt-1">
              {t("donation.verseRef")}
            </p>
          </div>

          <p className="text-[11px] text-[#726E88] text-center mt-4">
            {t("donation.founderLine")}
          </p>
        </div>
      </div>
    </section>
  );
}
