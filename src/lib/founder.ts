/**
 * ─── FOUNDER & DONATION CONFIGURATION — SINGLE SOURCE OF TRUTH ───
 *
 * All founder-page anchors and donation payment details live here so the
 * photo, WhatsApp number, UPI ID and amount presets can be updated without
 * touching any page or component code.
 *
 * Client-safe: contains no secrets. The UPI ID is a public payee address
 * (it is the account donations are sent TO), safe to ship in client code.
 * Koino never collects UPI PINs, banking passwords or OTPs.
 */

export const FOUNDER = {
  name: "Josh Govada",
  role: "Founder of Koino.in",
  tagline: "Faith. Fellowship. Belong.",
  /** Swap the file in /public/images to update the photo — no code change needed. */
  image: "/images/founder.jpg",
  imageAlt: "Josh Govada, founder of Koino.in.",
} as const;

/** Official WhatsApp deep link (wa.me) with a pre-filled, URL-encoded message. */
export const FOUNDER_WHATSAPP = {
  displayNumber: "+91 77998 74374",
  url: `https://wa.me/917799874374?text=${encodeURIComponent(
    "Hello Josh, I visited Koino.in and would like to connect with you."
  )}`,
} as const;

export const DONATION_CONFIG = {
  /** UPI payee address (VPA) — the account donations are sent to. */
  upiId: "bookingjosh@okhdfcbank",
  /** Payee name the donor's UPI app will display. */
  payeeName: "Koino Support",
  currency: "INR",
  /** Payment note attached to the UPI intent. */
  note: "Support Koino",
  /** Preset amount buttons (₹). */
  presets: [100, 250, 500],
  /** Custom amount limits (₹) — enforced in validateDonationAmount(). */
  minAmount: 10,
  maxAmount: 100000,
} as const;

export type AmountValidation =
  | { ok: true; amount: number }
  | { ok: false; error: string };

/**
 * Validate a donation amount from raw user input.
 * Rejects blank values, zero, negatives, invalid numbers, non-finite values,
 * malformed input and out-of-range amounts. Re-run before constructing the
 * UPI payment intent.
 */
export function validateDonationAmount(raw: string | number): AmountValidation {
  const str = (typeof raw === "number" ? raw.toString() : raw).trim();

  if (str === "") {
    return { ok: false, error: "Please enter an amount first." };
  }
  // Digits only, optional 1-2 decimal places — rejects NaN, Infinity,
  // negatives, signs, exponents, separators and any stray URL characters.
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return { ok: false, error: "Please enter a valid amount in rupees, e.g. 250 or 99.50." };
  }
  const amount = Number(str);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Please enter an amount greater than zero." };
  }
  if (amount < DONATION_CONFIG.minAmount) {
    return { ok: false, error: `The minimum amount is ₹${DONATION_CONFIG.minAmount}.` };
  }
  if (amount > DONATION_CONFIG.maxAmount) {
    return { ok: false, error: "For larger gifts, please contact Josh directly on WhatsApp." };
  }
  return { ok: true, amount };
}

/** Format an amount for display: 100 -> "₹100", 99.5 -> "₹99.50". */
export function formatINR(amount: number): string {
  return `₹${amount.toFixed(Number.isInteger(amount) ? 0 : 2)}`;
}

/**
 * Build a standards-compatible UPI intent URI (NPCI format) from a VALIDATED
 * amount. All parameters are percent-encoded. This link only opens the
 * donor's own UPI app — it does not create, process or verify any payment.
 */
export function buildUpiUri(amount: number): string {
  const c = DONATION_CONFIG;
  const am = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return (
    `upi://pay?pa=${encodeURIComponent(c.upiId)}` +
    `&pn=${encodeURIComponent(c.payeeName)}` +
    `&am=${encodeURIComponent(am)}` +
    `&cu=${encodeURIComponent(c.currency)}` +
    `&tn=${encodeURIComponent(c.note)}`
  );
}
