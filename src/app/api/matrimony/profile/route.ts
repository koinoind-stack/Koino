import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/service";
import {
  requireMatrimonyMember,
  logMatrimonyAudit,
  serializeMatrimonyProfile,
  matrimonyProfileInclude,
} from "@/lib/matrimony/server";
import {
  matrimonyProfileInputSchema,
  MATRIMONY_PHOTOS_BUCKET,
} from "@/lib/matrimony";

/**
 * ─── /api/matrimony/profile (Task 74 Stage B) ───────────────────────────────
 *
 * GET     — the signed-in member's own matrimony profile (or null) plus the
 *           account facts the editor needs (age, gender, state, city).
 *           Full DOB is NEVER returned — only the computed age.
 * PUT     — create (as draft) or update the member's own profile. Server-side
 *           zod validation; the client can never set `status`.
 * DELETE  — hard-deletes the member's OWN matrimony profile + photo rows
 *           (cascade) + private storage objects. This is clearly distinct
 *           from deleting the Koino account (which stays untouched).
 *
 * Ownership: there is no user-id parameter — the session user is always the
 * target, so no IDOR surface exists. Every route requires the full
 * eligibility gate (auth + active account + DOB present + 18+).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── GET: my profile ────────────────────────────────────────────────────────
export async function GET() {
  const gate = await requireMatrimonyMember();
  if (!gate.member) return gate.response;

  const profile = await db.matrimonyProfile.findUnique({
    where: { userId: gate.member.id },
    include: matrimonyProfileInclude,
  });

  return NextResponse.json({
    profile: profile ? serializeMatrimonyProfile(profile) : null,
    // Account facts for the editor (DOB stays server-side; age only).
    age: gate.member.age,
    gender: gate.member.gender,
    state: gate.member.state,
    city: gate.member.city,
    name: gate.member.name,
  });
}

// ─── PUT: create or update my profile ───────────────────────────────────────
export async function PUT(req: NextRequest) {
  const gate = await requireMatrimonyMember();
  if (!gate.member) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = matrimonyProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid profile data.", code: "VALIDATION" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const profileData = {
    languages: JSON.stringify(data.languages),
    intention: data.intention,
    timeline: data.timeline,
    denomination: data.denomination || null,
    education: data.education || null,
    profession: data.profession || null,
    aboutMe: data.aboutMe || null,
    heightCm: data.heightCm ?? null,
    photoVisibility: data.photoVisibility,
  };

  // Upsert own profile. New profiles always start as "draft" — activation is
  // a separate, explicitly validated action (POST .../status). A restricted
  // profile keeps its status: the member may edit content but discovery and
  // upload stay blocked until an admin releases it (Stage E).
  const profile = await db.matrimonyProfile.upsert({
    where: { userId: gate.member.id },
    create: { ...profileData, userId: gate.member.id, status: "draft" },
    update: profileData,
    include: matrimonyProfileInclude,
  });

  // Convenience sync of the member's account location (single source of
  // truth for state/city is User — the matrimony editor writes through).
  if (data.state !== undefined || data.city !== undefined) {
    await db.user.update({
      where: { id: gate.member.id },
      data: {
        ...(data.state !== undefined ? { state: data.state || null } : {}),
        ...(data.city !== undefined ? { city: data.city || null } : {}),
      },
    });
  }

  return NextResponse.json({
    profile: serializeMatrimonyProfile(profile),
    age: gate.member.age,
    gender: gate.member.gender,
    state: data.state !== undefined ? data.state : gate.member.state,
    city: data.city !== undefined ? data.city : gate.member.city,
  });
}

// ─── DELETE: remove my matrimony profile (NOT my Koino account) ─────────────
export async function DELETE() {
  const gate = await requireMatrimonyMember();
  if (!gate.member) return gate.response;

  const profile = await db.matrimonyProfile.findUnique({
    where: { userId: gate.member.id },
    // storagePath is needed here for storage cleanup — server-side only,
    // never serialized to the client.
    include: { photos: { select: { id: true, storagePath: true } } },
  });
  if (!profile) {
    return NextResponse.json({ error: "No matrimony profile to delete." }, { status: 404 });
  }

  // Best-effort storage cleanup of every private photo object.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && profile.photos.length > 0) {
    try {
      const supabase = createServiceClient();
      const paths = profile.photos.map((p) => p.storagePath);
      await supabase.storage.from(MATRIMONY_PHOTOS_BUCKET).remove(paths);
    } catch (e) {
      console.error("[matrimony/profile] storage cleanup failed:", e);
      // Non-fatal: orphaned private objects remain unreachable (no DB row).
    }
  }

  await db.matrimonyProfile.delete({ where: { id: profile.id } });

  await logMatrimonyAudit({
    actorId: gate.member.id,
    actorRole: "member",
    action: "profile_deleted_by_owner",
    targetUserId: gate.member.id,
    targetType: "matrimony_profile",
    targetId: profile.id,
    outcome: "ok",
    metadata: { photosRemoved: profile.photos.length },
  });

  return NextResponse.json({ success: true });
}
