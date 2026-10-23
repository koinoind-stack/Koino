import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { createServiceClient } from "@/lib/supabase/service";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const BUCKET_NAME = "believ-comic-artwork";

/**
 * POST /api/events/upload-image
 * Uploads an event flyer image (portrait/vertical preferred).
 * Authenticated users only. Stores in Supabase Storage.
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

    // Process: resize to max 1080px wide, convert to WebP, preserve aspect ratio
    const processedBuffer = await sharp(buffer)
      .resize(1080, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const timestamp = Date.now();
    const storagePath = `events/${user.id}/${timestamp}.webp`;

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

    const versionedUrl = `${publicUrl}?v=${timestamp}`;
    return NextResponse.json({ success: true, url: versionedUrl });
  } catch (error: any) {
    console.error("[events/upload-image] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to upload" }, { status: 500 });
  }
}
