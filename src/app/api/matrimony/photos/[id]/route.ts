import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { areBlocked } from "@/lib/social/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  requireMatrimonyMember,
  logMatrimonyAudit,
} from "@/lib/matrimony/server";
import {
  canViewMatrimonyPhoto,
  isMatrimonyPhotoVisibility,
  MATRIMONY_PHOTOS_BUCKET,
  MATRIMONY_LIMITS,
} from "@/lib/matrimony";

/**
 * ─── /api/matrimony/photos/[id] (Task 74 Stage B) ───────────────────────────
 *
 * GET    — the ONLY way any matrimony photo bytes ever leave the private
 *          bucket. Authorization matrix (canViewMatrimonyPhoto) runs before
 *          anything is served; any failure is closed (404/403 — a denial for
 *          a non-owner is indistinguishable from a missing photo).
 * DELETE — owner-only photo removal (object + row).
 *
 * GET decision order (fail closed at every step):
 *   1. 401 unless signed in — unauthenticated visitors NEVER get photos.
 *   2. 404 unless the photo row + owning profile exist.
 *   3. Owner → allowed (owner preview of their own photos).
 *   4. Everyone else must pass the full matrimony gate (active account,
 *      DOB present, 18+) — else 404.
 *   5. Social blocks (either direction, existing Block model) → 404.
 *   6. Profile must be ACTIVE (draft/paused/restricted are owner-only).
 *   7. Visibility: CONNECTIONS_ONLY → owner + accepted connections ONLY.
 *      ⚠️ STAGE B INTEGRATION POINT: the connection system does not exist
 *      yet, so `hasAcceptedConnection` is hardwired false — connections-only
 *      photos are inaccessible to every other member until Stage C ships
 *      the real check (pass it here once the model exists).
 *      ELIGIBLE_MEMBERS → any eligible member passes.
 *   8. Serve: short-lived signed URL (60s) via 302 redirect. Responses are
 *      `Cache-Control: private, no-store` so private images are never
 *      cached publicly or shared across users. Storage errors → 404.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denyNotFound() {
  return NextResponse.json(
    { error: "Photo not available.", code: "PHOTO_UNAVAILABLE" },
    { status: 404, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Must be signed in at all.
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required.", code: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const { id } = await params;
    if (!id || !/^[a-zA-Z0-9_-]{5,40}$/.test(id)) return denyNotFound();

    // 2. Photo + owning profile must exist.
    const photo = await db.matrimonyPhoto.findUnique({
      where: { id },
      select: {
        id: true,
        storagePath: true,
        status: true,
        profileId: true,
        profile: {
          select: {
            userId: true,
            status: true,
            photoVisibility: true,
          },
        },
      },
    });
    if (!photo) return denyNotFound();

    const ownerId = photo.profile.userId;
    const isOwner = auth.id === ownerId;

    // 3–5. Non-owners: full eligibility gate + social block check.
    let requesterEligible = false;
    if (!isOwner) {
      const gate = await requireMatrimonyMember();
      if (!gate.member) return denyNotFound();
      requesterEligible = true;
      if (await areBlocked(auth.id, ownerId)) return denyNotFound();
    }

    // 6–7. Visibility + profile state via the shared, unit-tested matrix.
    const visibility = isMatrimonyPhotoVisibility(photo.profile.photoVisibility)
      ? photo.profile.photoVisibility
      : "CONNECTIONS_ONLY";
    const allowed = canViewMatrimonyPhoto({
      requesterId: auth.id,
      ownerId,
      requesterEligible: isOwner ? true : requesterEligible,
      profileStatus: photo.profile.status,
      visibility,
      blocked: false, // blocks already returned above (checked only when needed)
      // ⚠️ STAGE C INTEGRATION POINT — replace with the real accepted-
      // connection lookup once connections exist:
      hasAcceptedConnection: false,
    });
    if (!allowed) return denyNotFound();

    // A photo row only serves while its bytes are actually ready.
    if (photo.status !== "ready") return denyNotFound();

    // 8. Authorized short-lived access. Never a permanent public URL.
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key"
    ) {
      return denyNotFound();
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage
      .from(MATRIMONY_PHOTOS_BUCKET)
      .createSignedUrl(photo.storagePath, MATRIMONY_LIMITS.photoSignedUrlTtlSec);
    if (error || !data?.signedUrl) {
      console.error("[MATRIMONY PHOTO SERVE] signed URL failed:", error?.message);
      return denyNotFound();
    }

    return NextResponse.redirect(data.signedUrl, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e: unknown) {
    console.error("[MATRIMONY PHOTO SERVE] FAILURE", {
      name: e instanceof Error ? e.name : typeof e,
    });
    return denyNotFound();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Owner-only removal — the full gate applies (18+, active account).
    const gate = await requireMatrimonyMember();
    if (!gate.member) return gate.response;

    const { id } = await params;
    if (!id || !/^[a-zA-Z0-9_-]{5,40}$/.test(id)) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    const photo = await db.matrimonyPhoto.findUnique({
      where: { id },
      select: {
        id: true,
        storagePath: true,
        profileId: true,
        profile: { select: { userId: true } },
      },
    });
    if (!photo || photo.profile.userId !== gate.member.id) {
      // Not yours (or nonexistent) — same answer either way.
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    // Remove the private object (best effort), then the row.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createServiceClient();
        await supabase.storage.from(MATRIMONY_PHOTOS_BUCKET).remove([photo.storagePath]);
      } catch (e) {
        console.error("[MATRIMONY PHOTO DELETE] object removal failed:", e);
        // Non-fatal: without a DB row the object is unreachable anyway.
      }
    }

    await db.matrimonyPhoto.delete({ where: { id: photo.id } });

    await logMatrimonyAudit({
      actorId: gate.member.id,
      actorRole: "member",
      action: "photo_deleted_by_owner",
      targetUserId: gate.member.id,
      targetType: "matrimony_photo",
      targetId: photo.id,
      outcome: "ok",
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("[MATRIMONY PHOTO DELETE] FAILURE", {
      name: e instanceof Error ? e.name : typeof e,
    });
    return NextResponse.json({ error: "Failed to remove photo." }, { status: 500 });
  }
}
