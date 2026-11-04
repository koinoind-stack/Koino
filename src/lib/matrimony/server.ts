/**
 * ─── MATRIMONY — SERVER HELPERS (Task 74 Stage B) ───────────────────────────
 *
 * Server-only: never import from client code.
 *
 *  - requireMatrimonyMember(): the single eligibility gate — auth + active
 *    account + DOB present + age >= 18. Used by EVERY protected matrimony
 *    route (activation, editing, photo upload, photo serving).
 *  - logMatrimonyAudit(): never-throws audit writer. Callers pass AGES only,
 *    never DOBs (enforced by convention + review; the type makes it hard to
 *    do otherwise).
 *  - serializeMatrimonyProfile(): field whitelist for API responses — no
 *    storagePath, no DOB, no internal status metadata beyond what the owner
 *    legitimately sees.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import {
  ageFromDOB,
  isMatrimonyPhotoVisibility,
  MATRIMONY_MIN_AGE,
  type MatrimonyPhotoVisibility,
} from "@/lib/matrimony";

// ─── Eligibility gate ───────────────────────────────────────────────────────

export type MatrimonyMember = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  image: string | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  age: number;
};

type GateResult =
  | { member: MatrimonyMember; response: null }
  | { member: null; response: NextResponse };

/**
 * Authenticated + active + 18+ (DOB on file). All server-side — a client can
 * neither assert age nor eligibility. Returns a ready-to-send error response
 * on failure so routes stay one-liners:
 *
 *   const gate = await requireMatrimonyMember();
 *   if (!gate.member) return gate.response;
 */
export async function requireMatrimonyMember(): Promise<GateResult> {
  const auth = await getAuthUser();
  if (!auth) {
    return {
      member: null,
      response: NextResponse.json(
        { error: "Authentication required.", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    };
  }

  const user = await db.user.findUnique({
    where: { id: auth.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      image: true,
      gender: true,
      state: true,
      city: true,
      dateOfBirth: true,
      accountStatus: true,
    },
  });

  if (!user || user.accountStatus !== "active") {
    return {
      member: null,
      response: NextResponse.json(
        { error: "Your account cannot use Matrimony.", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      ),
    };
  }

  if (!user.dateOfBirth) {
    return {
      member: null,
      response: NextResponse.json(
        {
          error:
            "Matrimony needs your date of birth to confirm you are 18 or older. Add it in your Koino profile settings, then come back.",
          code: "DOB_REQUIRED",
        },
        { status: 403 }
      ),
    };
  }

  const age = ageFromDOB(user.dateOfBirth);
  if (age < MATRIMONY_MIN_AGE) {
    return {
      member: null,
      response: NextResponse.json(
        {
          error: `Matrimony is available to members ${MATRIMONY_MIN_AGE} and older.`,
          code: "AGE_NOT_ELIGIBLE",
        },
        { status: 403 }
      ),
    };
  }

  return {
    member: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      image: user.image,
      gender: user.gender,
      state: user.state,
      city: user.city,
      age,
    },
    response: null,
  };
}

// ─── Audit logging ──────────────────────────────────────────────────────────

export type MatrimonyAuditInput = {
  actorId: string | null; // null = system
  actorRole: "member" | "admin" | "system";
  action: string;
  targetUserId?: string | null;
  targetType?: "user" | "matrimony_profile" | "matrimony_photo" | null;
  targetId?: string | null;
  outcome?: "eligible" | "restricted" | "ok" | null;
  justification?: string | null;
  /**
   * Non-sensitive JSON-serializable facts ONLY (e.g. { previousAge: 25 }).
   * NEVER pass full DOBs, secrets, or private content — the caller owns this
   * guarantee; values are stringified as-is.
   */
  metadata?: Record<string, unknown> | null;
};

/** Fire-and-forget audit write — a logging failure must never break a flow. */
export async function logMatrimonyAudit(input: MatrimonyAuditInput): Promise<void> {
  try {
    await db.matrimonyAuditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole,
        action: input.action,
        targetUserId: input.targetUserId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        outcome: input.outcome ?? null,
        justification: input.justification ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (e) {
    console.error("[matrimony/audit] write failed:", input.action, e);
  }
}

// ─── Serialization (field whitelists) ───────────────────────────────────────

export type SerializedMatrimonyPhoto = {
  id: string;
  position: number;
  status: string;
  width: number | null;
  height: number | null;
  /** Authorized route path — the client never sees storagePath. */
  url: string;
};

export type SerializedMatrimonyProfile = {
  id: string;
  status: string;
  languages: string[];
  intention: string | null;
  timeline: string | null;
  denomination: string | null;
  education: string | null;
  profession: string | null;
  aboutMe: string | null;
  heightCm: number | null;
  photoVisibility: MatrimonyPhotoVisibility;
  restrictedReason: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  photos: SerializedMatrimonyPhoto[];
};

/** Row shape the serializers accept (photos pre-sorted by position). */
type ProfileRow = {
  id: string;
  status: string;
  languages: string;
  intention: string | null;
  timeline: string | null;
  denomination: string | null;
  education: string | null;
  profession: string | null;
  aboutMe: string | null;
  heightCm: number | null;
  photoVisibility: string;
  restrictedReason: string | null;
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  photos: {
    id: string;
    position: number;
    status: string;
    width: number | null;
    height: number | null;
  }[];
};

/** JSON string[] → string[] (shared by profile + discovery serializers). */
export function parseLanguages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function safeVisibility(v: string): MatrimonyPhotoVisibility {
  return isMatrimonyPhotoVisibility(v) ? v : "CONNECTIONS_ONLY";
}

/** Owner-facing serialization: whitelisted fields, authorized photo URLs. */
export function serializeMatrimonyProfile(row: ProfileRow): SerializedMatrimonyProfile {
  return {
    id: row.id,
    status: row.status,
    languages: parseLanguages(row.languages),
    intention: row.intention,
    timeline: row.timeline,
    denomination: row.denomination,
    education: row.education,
    profession: row.profession,
    aboutMe: row.aboutMe,
    heightCm: row.heightCm,
    photoVisibility: safeVisibility(row.photoVisibility),
    restrictedReason: row.restrictedReason,
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    photos: [...row.photos]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        position: p.position,
        status: p.status,
        width: p.width,
        height: p.height,
        url: `/api/matrimony/photos/${p.id}`,
      })),
  };
}

/** Prisma include for the owner profile query (photos sorted in serializer). */
export const matrimonyProfileInclude = {
  photos: {
    select: { id: true, position: true, status: true, width: true, height: true },
  },
} as const;
