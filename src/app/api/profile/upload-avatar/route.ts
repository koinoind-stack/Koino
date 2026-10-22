import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { createServiceClient } from "@/lib/supabase/service";
import sharp from "sharp";

const db = new PrismaClient();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const BUCKET_NAME = "believ-comic-artwork"; // Reuse existing bucket (has public read + admin write)
// We use a separate path prefix for avatars: profiles/{userId}/avatar/{timestamp}.webp

/**
 * POST /api/profile/upload-avatar
 *
 * Uploads a profile photo for the authenticated user.
 * - userId derived from auth session (NOT from body)
 * - Image converted to WebP via sharp (square crop, 256x256)
 * - Stored in Supabase Storage at: profiles/{userId}/avatar/{timestamp}.webp
 * - User.image field updated in Prisma
 * - Returns the public URL
 *
 * Security:
 * - Only the authenticated user can upload their own avatar
 * - Service-role key is server-side only (never exposed to browser)
 * - File type + size validated server-side
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check Supabase service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key") {
      return NextResponse.json(
        { error: "Supabase Storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Please upload a JPG, PNG or WEBP image." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Please choose an image smaller than 5 MB." },
        { status: 400 }
      );
    }

    // Read file buffer + process with sharp (square crop, 256x256, WebP)
    const buffer = Buffer.from(await file.arrayBuffer());
    const processedBuffer = await sharp(buffer)
      .resize(256, 256, { fit: "cover", position: "center" })
      .webp({ quality: 85 })
      .toBuffer();

    // Build storage path: profiles/{userId}/avatar/{timestamp}.webp
    const timestamp = Date.now();
    const storagePath = `profiles/${user.id}/avatar/${timestamp}.webp`;

    // Upload to Supabase Storage
    const supabase = createServiceClient();

    // Ensure bucket exists (reuse existing comic-artwork bucket)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, processedBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      console.error("[upload-avatar] Supabase upload error:", uploadError.message);
      return NextResponse.json(
        { error: "Unable to upload your photo. Please try again." },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json({ error: "Upload succeeded but no URL returned" }, { status: 500 });
    }

    // Add cache-busting version param so the browser fetches the new image
    const versionedUrl = `${publicUrl}?v=${timestamp}`;

    // Update user.image in Prisma
    await db.user.update({
      where: { id: user.id },
      data: { image: versionedUrl },
    });

    return NextResponse.json({
      success: true,
      url: versionedUrl,
      message: "Profile photo updated.",
    });
  } catch (error: any) {
    console.error("[upload-avatar] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload photo" },
      { status: 500 }
    );
  }
}
