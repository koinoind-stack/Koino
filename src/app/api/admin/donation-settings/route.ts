import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

// Single PrismaClient instance at module scope — same pattern as other admin routes.
const db = new PrismaClient();

// Fields the admin is allowed to set. `id` is locked to "default" (singleton).
const UPDATABLE_FIELDS = [
  "upiId",
  "qrCodeUrl",
  "accountName",
  "accountNumber",
  "ifsc",
  "bankName",
  "branch",
  "donationMessage",
  "acceptingDonations",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

// Admin auth helper — same pattern as /api/admin/comics etc.
// Returns the authenticated admin user object, or throws a 401/403 response.
// We distinguish 401 (not signed in) from 403 (signed in but not admin) per
// the API spec for this route.
async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user, response: null };
}

// Coerce a string-ish body value into `string | null`.
// Empty/whitespace-only strings become null so the public /support page can
// cleanly hide sections that aren't configured. Non-string values are coerced
// to string (defensive — admins may send numbers etc.).
function coerceString(raw: unknown): string | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Coerce a boolean-ish body value into `boolean`.
function coerceBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw === "true" || raw === "1";
  return true;
}

/**
 * GET /api/admin/donation-settings
 *
 * Admin-only. Returns the full DonationSettings singleton row (including
 * updatedAt) so the admin form can show "last saved" info.
 *
 * If the singleton row doesn't exist yet (migration not applied), we create
 * it lazily here so the admin form always has something to bind to.
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    let row = await db.donationSettings.findUnique({
      where: { id: "default" },
    });

    if (!row) {
      // Lazy-create the singleton if the seed from the migration didn't run.
      row = await db.donationSettings.create({
        data: { id: "default", acceptingDonations: true },
      });
    }

    return NextResponse.json({
      settings: {
        id: row.id,
        upiId: row.upiId,
        qrCodeUrl: row.qrCodeUrl,
        accountName: row.accountName,
        accountNumber: row.accountNumber,
        ifsc: row.ifsc,
        bankName: row.bankName,
        branch: row.branch,
        donationMessage: row.donationMessage,
        acceptingDonations: row.acceptingDonations,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (e: any) {
    console.error("[admin/donation-settings] GET error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load donation settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/donation-settings
 *
 * Admin-only. Upserts the singleton row with the provided fields.
 * Unknown fields in the body are ignored. Empty strings are normalized
 * to null so the public /support page can cleanly hide empty sections.
 *
 * Body shape (all optional):
 *   {
 *     upiId?:              string | null,
 *     qrCodeUrl?:          string | null,
 *     accountName?:        string | null,
 *     accountNumber?:      string | null,
 *     ifsc?:               string | null,
 *     bankName?:           string | null,
 *     branch?:             string | null,
 *     donationMessage?:    string | null,
 *     acceptingDonations?: boolean
 *   }
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const body = (await req.json()) as Record<string, unknown>;

    // Build a properly-typed Prisma payload. String fields become `string | null`
    // (empty strings normalized to null); acceptingDonations is always a boolean.
    type StringFields = Exclude<UpdatableField, "acceptingDonations">;
    const stringFields: StringFields[] = [
      "upiId",
      "qrCodeUrl",
      "accountName",
      "accountNumber",
      "ifsc",
      "bankName",
      "branch",
      "donationMessage",
    ];

    const data: {
      upiId?: string | null;
      qrCodeUrl?: string | null;
      accountName?: string | null;
      accountNumber?: string | null;
      ifsc?: string | null;
      bankName?: string | null;
      branch?: string | null;
      donationMessage?: string | null;
      acceptingDonations?: boolean;
    } = {};

    for (const key of stringFields) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        data[key] = coerceString(body[key]);
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "acceptingDonations")) {
      data.acceptingDonations = coerceBool(body["acceptingDonations"]);
    }

    const row = await db.donationSettings.upsert({
      where: { id: "default" },
      // Create + update share the same payload — if the row was already
      // seeded by the migration, this just updates the changed fields.
      create: {
        id: "default",
        ...data,
        acceptingDonations: data.acceptingDonations ?? true,
      },
      update: data,
    });

    return NextResponse.json({
      success: true,
      settings: {
        id: row.id,
        upiId: row.upiId,
        qrCodeUrl: row.qrCodeUrl,
        accountName: row.accountName,
        accountNumber: row.accountNumber,
        ifsc: row.ifsc,
        bankName: row.bankName,
        branch: row.branch,
        donationMessage: row.donationMessage,
        acceptingDonations: row.acceptingDonations,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (e: any) {
    console.error("[admin/donation-settings] PUT error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to save donation settings" },
      { status: 500 }
    );
  }
}
