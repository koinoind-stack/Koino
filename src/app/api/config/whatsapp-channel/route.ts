import { NextResponse } from "next/server";

/**
 * GET /api/config/whatsapp-channel
 *
 * Returns the official Koino WhatsApp Channel URL.
 * This is the SINGLE SOURCE OF TRUTH for the WhatsApp Channel URL —
 * all frontend components should call this endpoint instead of hardcoding
 * the URL in multiple places.
 *
 * Admin can update this URL via PUT /api/admin/config/whatsapp-channel.
 *
 * Returns: { url: string }
 */
export async function GET() {
  // Default URL — can be overridden by the admin via the admin config endpoint.
  // In production, this would read from a settings table or env var.
  // For now, we use a sensible default that admins can change.
  const url = process.env.KOINO_WHATSAPP_CHANNEL_URL ||
    "https://whatsapp.com/channel/0029Vb96qSoBFLgTRTxI5v2q";

  return NextResponse.json({
    url,
    label: "Follow Koino on WhatsApp",
  });
}
