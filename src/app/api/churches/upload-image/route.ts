import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
// Reuse the existing public-read bucket (same convention as event flyers
// and avatars — no new bucket or policy needed).
const BUCKET_NAME = "believ-comic-artwork";

/**
 * POST /api/churches/upload-image
 * Uploads a church listing photo. Authenticated users only (the same users
 * who can create/edit listings), rate limited. Stores in Supabase Storage
 * and returns a permanent public URL.
 *
 * WHY THIS EXISTS: the listing forms used to embed picked photos as base64
 * data URLs — but every API that accepts cover images truncates them to
 * 1000 chars for safety, which silently corrupts anything bigger than
 * ~750 bytes of image. A real storage URL (~120 chars) fits comfortably
 * and keeps the public directory payload small.
 *
 * Response: { success: true, url: "https://…/churches/<uid>/<ts>.webp?v=<ts>" }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key") {
      return NextResponse.json({ error: "Supabase Storage is not configured." }, { status: 500 });
    }

    if (!rateLimit(`churches:upload:${user.id}`, 20, 10 * 60_000)) {
      return NextResponse.json(
        { error: "You're uploading images quickly. Please wait a little." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Please upload a JPG, PNG or WEBP image." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Please choose an image smaller than 5 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Process: max 1200px (matches the client-side picker limit), WebP q85,
    // preserve aspect ratio — typically 60-150 KB per cover photo.
    const processedBuffer = await sharp(buffer)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const timestamp = Date.now();
    const storagePath = `churches/${user.id}/${timestamp}.webp`;

    const supabase = createServiceClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, processedBuffer, { contentType: "image/webp", upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: "Unable to upload image. Please try again." }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) return NextResponse.json({ error: "Upload succeeded but no URL returned" }, { status: 500 });

    return NextResponse.json({ success: true, url: `${publicUrl}?v=${timestamp}` });
  } catch (error: any) {
    console.error("[churches/upload-image] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to upload" }, { status: 500 });
  }
}
