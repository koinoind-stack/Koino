import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/social/rate-limit";
import sharp from "sharp";
import {
  requireMatrimonyMember,
} from "@/lib/matrimony/server";
import { MATRIMONY_PHOTOS_BUCKET, MATRIMONY_LIMITS } from "@/lib/matrimony";

/**
 * ─── /api/matrimony/photos (Task 74 Stage B) ────────────────────────────────
 *
 * POST (multipart/form-data, field "file") — upload one PRIVATE profile photo.
 *
 * Security posture:
 *  - Full eligibility gate (auth + active account + 18+) — photos are a
 *    protected matrimony feature.
 *  - Server-side validation: MIME allowlist + size cap + sharp DECODE (the
 *    re-encode is the content check — only re-encoded WebP bytes ever reach
 *    storage, structurally stripping EXIF and any embedded payload).
 *  - Ownership: no profile-id parameter exists; the photo always attaches to
 *    the SESSION member's own profile. Nobody can upload to another member.
 *  - Max 3 photos per profile enforced server-side (count + free-position
 *    scan + DB unique constraint as backstop).
 *  - Non-guessable object paths: matrimony/<userId>/<crypto-uuid>.webp.
 *  - Bucket is PRIVATE (public: false) — see scripts/matrimony-create-bucket.
 *  - Orphan cleanup: if the DB insert fails after the object was stored, the
 *    object is removed (best effort).
 *  - Restricted profiles cannot upload (fail closed).
 *
 * Returns 201 { photo: { id, position, url } } where url is the AUTHORIZED
 * route path — never a storage URL.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    // 1. Eligibility gate (auth + active account + DOB present + 18+).
    const gate = await requireMatrimonyMember();
    if (!gate.member) return gate.response;
    const memberId = gate.member.id;

    // 2. Abuse protection.
    if (!rateLimit(`matrimony-photo-upload:${memberId}`, MATRIMONY_LIMITS.photoUploadsPerHour, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429 }
      );
    }

    // 3. Storage must be configured (sentinel pattern, matches blog route).
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key"
    ) {
      return NextResponse.json(
        { error: "Server storage is not configured. Contact an administrator." },
        { status: 500 }
      );
    }

    // 4. Own profile must exist and must not be restricted.
    const profile = await db.matrimonyProfile.findUnique({
      where: { userId: memberId },
      select: { id: true, status: true },
    });
    if (!profile) {
      return NextResponse.json(
        { error: "Create your matrimony profile first." },
        { status: 404 }
      );
    }
    if (profile.status === "restricted") {
      return NextResponse.json(
        { error: "This profile is restricted. Photo uploads are disabled.", code: "PROFILE_RESTRICTED" },
        { status: 403 }
      );
    }

    // 5. Count + free slot (max 3, positions 0..2).
    const existing = await db.matrimonyPhoto.findMany({
      where: { profileId: profile.id },
      select: { position: true },
    });
    if (existing.length >= MATRIMONY_LIMITS.photosMax) {
      return NextResponse.json(
        { error: `You can have up to ${MATRIMONY_LIMITS.photosMax} photos. Remove one first.`, code: "PHOTO_LIMIT" },
        { status: 409 }
      );
    }
    const used = new Set(existing.map((p) => p.position));
    let position = -1;
    for (let i = 0; i < MATRIMONY_LIMITS.photosMax; i++) {
      if (!used.has(i)) { position = i; break; }
    }
    if (position === -1) {
      return NextResponse.json({ error: "No free photo slot.", code: "PHOTO_LIMIT" }, { status: 409 });
    }

    // 6. Parse multipart form.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 }
      );
    }
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided. Use the 'file' field." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Photo must be a JPG, PNG, or WEBP image." }, { status: 400 });
    }
    if (file.size > MATRIMONY_LIMITS.photoMaxInputBytes) {
      return NextResponse.json({ error: "Photo must be under 4 MB." }, { status: 400 });
    }

    // 7. Process with sharp — decode failure rejects the file; only
    //    re-encoded WebP bytes reach storage (EXIF/payloads stripped).
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    if (rawBuffer.length === 0) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
    }
    let processed: Buffer;
    let width: number | undefined;
    let height: number | undefined;
    try {
      const result = await sharp(rawBuffer)
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      processed = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch {
      return NextResponse.json(
        { error: "Image could not be processed. Ensure it is a valid JPG, PNG, or WEBP file." },
        { status: 400 }
      );
    }

    // 8. Non-guessable private path + upload.
    const storagePath = `matrimony/${memberId}/${crypto.randomUUID()}.webp`;
    const supabase = createServiceClient();
    const { error: uploadError } = await supabase.storage
      .from(MATRIMONY_PHOTOS_BUCKET)
      .upload(storagePath, processed, { contentType: "image/webp", upsert: false });
    if (uploadError) {
      console.error("[MATRIMONY PHOTO UPLOAD] supabase failed:", uploadError.message);
      return NextResponse.json(
        { error: "Unable to upload photo to storage. Please try again." },
        { status: 500 }
      );
    }

    // 9. Persist metadata; clean the object up if the insert fails.
    try {
      const photo = await db.matrimonyPhoto.create({
        data: {
          profileId: profile.id,
          storagePath,
          status: "ready",
          position,
          width: width ?? null,
          height: height ?? null,
          sizeBytes: processed.length,
        },
        select: { id: true, position: true },
      });
      return NextResponse.json(
        { photo: { id: photo.id, position: photo.position, url: `/api/matrimony/photos/${photo.id}` } },
        { status: 201 }
      );
    } catch (e) {
      try {
        await supabase.storage.from(MATRIMONY_PHOTOS_BUCKET).remove([storagePath]);
      } catch (cleanupErr) {
        console.error("[MATRIMONY PHOTO UPLOAD] orphan cleanup failed:", cleanupErr);
      }
      console.error("[MATRIMONY PHOTO UPLOAD] db insert failed:", e);
      return NextResponse.json(
        { error: "Could not save the photo. Please try again." },
        { status: 500 }
      );
    }
  } catch (e: unknown) {
    console.error("[MATRIMONY PHOTO UPLOAD] FAILURE", {
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Failed to upload photo." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed — use POST" },
    { status: 405 }
  );
}
