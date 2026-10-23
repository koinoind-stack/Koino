import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { claimGift } from "@/lib/trivia-server";

/**
 * POST /api/trivia/claim-gift
 *
 * Body: { giftId, selectedVariations? }
 *  - selectedVariations: [{ name: "Size", value: "L" }, { name: "Color", value: "Black" }]
 *
 * Server:
 * 1. Validates user is authenticated
 * 2. Checks totalPoints >= gift.pointsRequired (from DB, not client)
 * 3. Checks no existing redemption (unique constraint)
 * 4. Deducts points atomically (transaction)
 * 5. Creates redemption record (persists in DB) with selected variations
 *
 * Race-condition safe: @@unique([userId, giftId]) prevents double-claim.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { giftId, selectedVariations } = body;

    if (!giftId || typeof giftId !== "string") {
      return NextResponse.json({ error: "Missing giftId" }, { status: 400 });
    }

    // Normalize selectedVariations: only keep objects with both name & value.
    const normalizedVariations: { name: string; value: string }[] = Array.isArray(selectedVariations)
      ? selectedVariations
          .map((v: any) => ({
            name: typeof v?.name === "string" ? v.name.trim() : "",
            value: typeof v?.value === "string" ? v.value.trim() : "",
          }))
          .filter((v: { name: string; value: string }) => v.name && v.value)
      : [];

    const result = await claimGift(user.id, giftId, normalizedVariations);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[trivia/claim-gift] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to claim gift" },
      { status: 400 }
    );
  }
}
