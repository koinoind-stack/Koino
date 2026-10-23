import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { createServiceClient } from "@/lib/supabase/service";
import sharp from "sharp";

/**
 * POST /api/admin/upload
 *
 * Uploads a cover / inline image for the Koino admin article editor.
 *
 * Storage architecture (preserved from prior design):
 *   - Supabase Storage bucket: `believ-comic-artwork`
 *   - Path scheme:               `apologetics/<admin-user-id>/<timestamp>.webp`
 *
 * Auth: only authenticated admins (user.role === "admin") may upload.
 *
 * Accepts (matches the client-side rules in ImageUploader.tsx +
 * InlineImagePopover.tsx):
 *   - multipart/form-data with field name `file`
 *   - JPG / JPEG / PNG / WEBP
 *   - max 10 MB
 *
 * Returns:
 *   - 201 { success, url }    — upload succeeded, `url` is the public URL
 *                               with a `?v=<timestamp>` cache-buster so
 *                               previews update after Replace Image.
 *   - 400 { error }            — bad file / size / type
 *   - 401 { error }            — not authenticated
 *   - 403 { error }            — not an admin
 *   - 500 { error }            — Supabase misconfigured or upload failed
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const BUCKET_NAME = "believ-comic-artwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logStage(stage: string, extra?: Record<string, unknown>) {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[ARTICLE IMAGE UPLOAD] ${stage}`, extra);
  } else {
    console.log(`[ARTICLE IMAGE UPLOAD] ${stage}`);
  }
}

export async function POST(req: NextRequest) {
  let stage = "REQUEST_RECEIVED";
  try {
    logStage("request received");

    // 1. Auth — admin only.
    stage = "AUTH";
    const user = await getAuthUser();
    if (!user) {
      logStage("FAILURE", { stage, name: "AuthError", message: "Not authenticated" });
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (user.role !== "admin") {
      logStage("FAILURE", { stage, name: "AuthError", message: "Admin access required" });
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    logStage("authenticated", { userId: user.id });

    // 2. Supabase service client must be configured.
    stage = "SUPABASE_CONFIG";
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key"
    ) {
      logStage("FAILURE", {
        stage,
        name: "ConfigError",
        message: "Supabase service role key not configured",
      });
      return NextResponse.json(
        { error: "Server storage is not configured. Contact an administrator." },
        { status: 500 },
      );
    }

    // 3. Parse multipart form.
    stage = "FORM_PARSE";
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      logStage("FAILURE", {
        stage,
        name: "FormError",
        message: "Expected multipart/form-data",
      });
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 },
      );
    }

    // 4. File presence + type + size.
    stage = "FILE_VALIDATE";
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      logStage("FAILURE", {
        stage,
        name: "FileError",
        message: "No file field provided",
      });
      return NextResponse.json(
        { error: "No file provided. Use the 'file' field." },
        { status: 400 },
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      logStage("FAILURE", {
        stage,
        name: "TypeError",
        message: `Unsupported MIME type: ${file.type}`,
      });
      return NextResponse.json(
        { error: "Image must be JPG, PNG, or WEBP." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      logStage("FAILURE", {
        stage,
        name: "SizeError",
        message: `File size ${file.size} bytes exceeds 10 MB`,
      });
      return NextResponse.json(
        { error: "Image must be under 10 MB." },
        { status: 400 },
      );
    }
    logStage("file received", { mimeType: file.type, sizeBytes: file.size });

    // 5. Read into Buffer.
    stage = "BUFFER_READ";
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    if (rawBuffer.length === 0) {
      logStage("FAILURE", {
        stage,
        name: "BufferError",
        message: "Empty buffer after read",
      });
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 },
      );
    }

    // 6. Process with sharp: max 1600px wide, convert to WebP quality 85,
    //    preserve aspect ratio. This matches the existing events upload-image
    //    pipeline so cover images are reasonably sized for the public web.
    stage = "SHARP_PROCESS";
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(rawBuffer)
        .resize(1600, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (sharpErr: any) {
      logStage("FAILURE", {
        stage,
        name: sharpErr instanceof Error ? sharpErr.name : "SharpError",
        message: sharpErr instanceof Error ? sharpErr.message : String(sharpErr),
      });
      return NextResponse.json(
        { error: "Image could not be processed. Ensure it is a valid JPG, PNG, or WEBP file." },
        { status: 400 },
      );
    }

    // 7. Upload to Supabase Storage under apologetics/<admin-user-id>/.
    stage = "SUPABASE_UPLOAD";
    const timestamp = Date.now();
    const storagePath = `apologetics/${user.id}/${timestamp}.webp`;
    const supabase = createServiceClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, processedBuffer, {
        contentType: "image/webp",
        upsert: true,
      });
    if (uploadError) {
      logStage("FAILURE", {
        stage,
        name: "SupabaseUploadError",
        message: uploadError.message || "Unknown Supabase upload error",
      });
      return NextResponse.json(
        { error: "Unable to upload image to storage. Please try again." },
        { status: 500 },
      );
    }

    // 8. Resolve public URL + append cache-buster so previews refresh after
    //    a Replace Image upload (same path, new content).
    stage = "PUBLIC_URL";
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) {
      logStage("FAILURE", {
        stage,
        name: "PublicUrlError",
        message: "Supabase returned no public URL",
      });
      return NextResponse.json(
        { error: "Upload succeeded but no URL was returned." },
        { status: 500 },
      );
    }

    const versionedUrl = `${publicUrl}?v=${timestamp}`;
    logStage("upload successful", { path: storagePath });
    return NextResponse.json(
      { success: true, url: versionedUrl },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[ARTICLE IMAGE UPLOAD] FAILURE", {
      stage,
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: e?.message || "Failed to upload image." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed — use POST" },
    { status: 405 },
  );
}
