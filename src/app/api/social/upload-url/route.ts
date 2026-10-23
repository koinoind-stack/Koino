import { NextRequest } from "next/server";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/social/upload-url — issue a SIGNED UPLOAD URL for direct
 * client → Supabase Storage upload.
 *
 * WHY: Vercel serverless caps request bodies at ~4.5 MB. Videos cannot pass
 * through an API route. Instead the client asks for a signed URL, then PUTs
 * the bytes straight to Storage — which also gives real XHR upload progress.
 *
 * Ownership model:
 *   - Type/size/extension are validated HERE, before any URL is issued.
 *   - Storage paths are namespaced per user: social/{userId}/... so a user
 *     can only write inside their own namespace.
 *   - Publish-time re-validation happens in POST /api/social/posts.
 *
 * Buckets: reuses the existing public-read bucket (believ-comic-artwork) —
 * consistent with avatars/admin images.
 */
const BUCKET = "believ-comic-artwork";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webp", // extension fixed below — webm handled explicitly
  "video/quicktime": "mov",
};
const MAX_IMAGE = 10 * 1024 * 1024; // 10MB per image
const MAX_VIDEO = 100 * 1024 * 1024; // 100MB per video

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`upload-url:${me.id}`, 60, 60 * 60 * 1000)) {
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
  const kind = body.kind === "video" || body.kind === "story-video" ? "video" : "image";

  const max = kind === "video" ? MAX_VIDEO : MAX_IMAGE;
  if (!size || size <= 0 || size > max) {
    return jsonError(
      kind === "video"
        ? "Videos must be larger than 0 and smaller than 100 MB"
        : "Images must be larger than 0 and smaller than 10 MB",
    );
  }

  let ext: string | undefined;
  if (kind === "video") {
    if (contentType === "video/webm") ext = "webm";
    else ext = VIDEO_TYPES[contentType];
    if (!ext) return jsonError("Supported video formats: MP4, WebM, MOV");
  } else {
    ext = IMAGE_TYPES[contentType];
    if (!ext) return jsonError("Supported image formats: JPG, PNG, WEBP");
  }

  const folder = kind === "video" ? "social-video" : "social-images";
  const path = `social/${me.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[social/upload-url] createSignedUploadUrl failed:", error?.message);
      return jsonError("Could not prepare the upload — try again", 500);
    }

    // Public read URL (bucket is public-read) with a token-free GET path.
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return Response.json({
      uploadUrl: data.signedUrl,
      path,
      publicUrl: pub.publicUrl,
      bucket: BUCKET,
    });
  } catch (err) {
    console.error("[social/upload-url] failed:", err);
    return jsonError("Could not prepare the upload — try again", 500);
  }
}
