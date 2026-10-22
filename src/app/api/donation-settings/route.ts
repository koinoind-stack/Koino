import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// Single PrismaClient instance at module scope — same pattern as other routes.
const db = new PrismaClient();

/**
 * GET /api/donation-settings
 *
 * Public endpoint used by the /support page (and any other public surface)
 * to render the admin-configured donation methods (UPI / QR / Bank).
 *
 * Returns ONLY the display fields — never returns `id` or `updatedAt`.
 *
 * If the singleton row has not been seeded yet (e.g. migration not run),
 * we return a fully-null payload with acceptingDonations=true so the page
 * can safely hide every section.
 */
export async function GET() {
  try {
    const row = await db.donationSettings.findUnique({
      where: { id: "default" },
    });

    // Don't leak internal fields — strip `id` and `updatedAt`.
    return NextResponse.json({
      upiId: row?.upiId ?? null,
      qrCodeUrl: row?.qrCodeUrl ?? null,
      accountName: row?.accountName ?? null,
      accountNumber: row?.accountNumber ?? null,
      ifsc: row?.ifsc ?? null,
      bankName: row?.bankName ?? null,
      branch: row?.branch ?? null,
      donationMessage: row?.donationMessage ?? null,
      acceptingDonations: row?.acceptingDonations ?? true,
    });
  } catch (e: any) {
    console.error("[donation-settings] GET error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load donation settings" },
      { status: 500 }
    );
  }
}
