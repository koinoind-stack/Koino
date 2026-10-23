import { NextRequest } from "next/server";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * Part 4 — POST /api/memorials/upload-url
 *
 * Signed upload URL for memorial portrait photos. Reuses the SAME public
 * bucket and the SAME signed-URL flow as the social uploader (spec: reuse
 * existing storage) — files are namespaced under memorials/{userId}/ so
 * memorial media stays grouped.
 *
 * Portraits are images only, max 10 MB, matching the social image limits.
 */
const BUCKET = "believ-comic-artwork";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`memorial-upload:${me.id}`, 30, 60 * 60 * 1000)) {
    return jsonError("Too many upload requests — try again in a few minutes", 429);
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key"
  ) {
    return jsonError("Storage is not configured", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const contentType = String(body.contentType || "");
  const size = Number(body.size || 0);
  const ext = IMAGE_TYPES[contentType];
  if (!ext) return jsonError("Supported image formats: JPG, PNG, WEBP");
  if (!size || size <= 0 || size > MAX_IMAGE) {
    return jsonError("Photos must be larger than 0 and smaller than 10 MB");
  }

  const path = `memorials/${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[memorial-upload] createSignedUploadUrl failed:", error?.message);
      return jsonError("Could not prepare the upload — try again", 500);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return Response.json({
      uploadUrl: data.signedUrl,
      path,
      publicUrl: pub.publicUrl,
      bucket: BUCKET,
    });
  } catch (err) {
    console.error("[memorial-upload] failed:", err);
    return jsonError("Could not prepare the upload — try again", 500);
  }
}
