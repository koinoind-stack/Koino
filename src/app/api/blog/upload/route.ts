import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/social/rate-limit";
import sharp from "sharp";

/**
 * POST /api/blog/upload
 *
 * Image upload for the community Blog & Articles editor (Task 73) — used by
 * BOTH members and admins for cover images and inline article images.
 *
 * Storage architecture (reuses the existing integration — no new provider):
 *   - Supabase Storage bucket: `believ-comic-artwork` (public read)
 *   - Path scheme:             `blog/<user-id>/<timestamp>.webp`
 *
 * Pipeline matches /api/admin/upload exactly (server-side sharp: max 1600px
 * wide, WebP q85) so every article image is optimized and stripped of any
 * embedded payload — only processed WebP bytes ever reach storage, which
 * structurally blocks executable/unsafe uploads.
 *
 * Auth: any signed-in user with accountStatus "active".
 * Abuse protection: 30 uploads/hour/user via the shared in-memory limiter.
 *
 * Accepts multipart/form-data, field `file`: JPG / PNG / WEBP, max 10 MB.
 * Returns 201 { success, url } (public URL + ?v= cache-buster).
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const BUCKET_NAME = "believ-comic-artwork";
const UPLOAD_LIMIT = 30; // per hour per user

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — any signed-in user (admins and members share the editor).
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const account = await db.user.findUnique({
      where: { id: user.id },
      select: { accountStatus: true },
    });
    if (!account || account.accountStatus !== "active") {
      return NextResponse.json(
        { error: "Your account cannot upload images." },
        { status: 403 }
      );
    }

    // 2. Abuse protection.
    if (!rateLimit(`blog-upload:${user.id}`, UPLOAD_LIMIT, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429 }
      );
    }

    // 3. Supabase service client must be configured.
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key"
    ) {
      return NextResponse.json(
        { error: "Server storage is not configured. Contact an administrator." },
        { status: 500 }
      );
    }

    // 4. Parse multipart form.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 }
      );
    }

    // 5. File presence + type + size (server-enforced, never client-asserted).
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided. Use the 'file' field." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Image must be JPG, PNG, or WEBP." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be under 10 MB." }, { status: 400 });
    }

    // 6. Process with sharp — also proves the bytes are a real image
    //    (decode failure → reject), matching the existing pipeline.
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    if (rawBuffer.length === 0) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
    }
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(rawBuffer)
        .resize(1600, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "Image could not be processed. Ensure it is a valid JPG, PNG, or WEBP file." },
        { status: 400 }
      );
    }

    // 7. Upload to Supabase Storage under blog/<user-id>/.
    const timestamp = Date.now();
    const storagePath = `blog/${user.id}/${timestamp}.webp`;
    const supabase = createServiceClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, processedBuffer, {
        contentType: "image/webp",
        upsert: true,
      });
    if (uploadError) {
      console.error("[BLOG IMAGE UPLOAD] supabase failed:", uploadError.message);
      return NextResponse.json(
        { error: "Unable to upload image to storage. Please try again." },
        { status: 500 }
      );
    }

    // 8. Public URL + cache-buster.
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json(
        { error: "Upload succeeded but no URL was returned." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, url: `${publicUrl}?v=${timestamp}` },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("[BLOG IMAGE UPLOAD] FAILURE", {
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: e?.message || "Failed to upload image." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed — use POST" },
    { status: 405 }
  );
}
