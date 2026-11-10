import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { BIBLE_BOOKS } from "@/lib/bible-data";
import { db } from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/service";
import sharp from "sharp";

/**
 * POST /api/admin/comics/upload
 *
 * Dedicated comic artwork upload endpoint for the Bible Comics CMS.
 * This is the backend for ComicArtworkUploader.tsx (used by PanelFormModal
 * in BibleComicsAdmin). Before this route existed the CMS uploader got a 404
 * and real artwork files could not be stored — panels had no working upload path.
 *
 * Flow:
 *   Admin selects image → POST multipart here → validate → sharp convert to
 *   WebP (max 1600px wide, quality 85) → upload to Supabase Storage bucket
 *   `believ-comic-artwork` at `comics/<bookId>/<chapter>/<panelId>.webp`
 *   (upsert — replacing artwork overwrites the same object) → return the
 *   public URL with a `?v=<timestamp>` cache-buster.
 *
 * Request (multipart/form-data):
 *   file       — required, PNG / JPG / WEBP, max 10 MB
 *   bookId     — required, must match BIBLE_BOOKS[].id (e.g. "genesis")
 *   chapter    — required, integer >= 1
 *   panelId    — required, stable panel identifier used as the filename
 *                (e.g. "GEN2-P01"); restricted to [A-Za-z0-9_-] to prevent
 *                path traversal.
 *   chapterId  — optional ComicChapter.id. When provided AND a panel with the
 *                given panelId already exists in that chapter (edit mode),
 *                the uploaded URL is also persisted to ComicPanel.artworkUrl
 *                and `dbUpdated: true` is returned.
 *   target     — optional. "panel" (default) uploads page artwork;
 *                "cover" uploads the STORY COVER: the object is stored at
 *                comics/<bookId>/<chapter>/cover.webp and, when chapterId is
 *                provided, the URL is persisted to ComicChapter.coverArtUrl.
 *                In cover mode panelId is ignored ("cover" is used instead).
 *
 * Response:
 *   201 { success: true, artworkUrl, url, optimizedSize, originalSize, dbUpdated }
 *   400 { error }  — bad file / type / size / path params
 *   401 { error }  — not authenticated
 *   403 { error }  — not an admin
 *   500 { error }  — storage misconfigured or upload failed
 *
 * Does NOT accept base64 data URLs — artwork is always stored as real files
 * in Supabase Storage (language-independent, one image per panel).
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const BUCKET_NAME = "believ-comic-artwork";
const PANEL_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logStage(stage: string, extra?: Record<string, unknown>) {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[COMIC ARTWORK UPLOAD] ${stage}`, extra);
  } else {
    console.log(`[COMIC ARTWORK UPLOAD] ${stage}`);
  }
}

export async function POST(req: NextRequest) {
  let stage = "REQUEST_RECEIVED";
  try {
    logStage("request received");

    // 1. Auth — admin only (same gate as the rest of the comics CMS).
    stage = "AUTH";
    const user = await getAuthUser();
    if (!user) {
      logStage("FAILURE", { stage, message: "Not authenticated" });
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (user.role !== "admin") {
      logStage("FAILURE", { stage, message: "Admin access required" });
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    logStage("authenticated", { userId: user.id });

    // 2. Supabase service client must be configured.
    stage = "SUPABASE_CONFIG";
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder-service-role-key"
    ) {
      logStage("FAILURE", { stage, message: "Supabase service role key not configured" });
      return NextResponse.json(
        { error: "Server storage is not configured. Contact an administrator.", missing: "SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    // 3. Parse multipart form.
    stage = "FORM_PARSE";
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      logStage("FAILURE", { stage, message: "Expected multipart/form-data" });
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 },
      );
    }

    // 4. Path params — bookId / chapter / panelId become the storage path.
    stage = "PARAM_VALIDATE";
    const bookId = String(formData.get("bookId") || "").trim();
    const chapterRaw = String(formData.get("chapter") || "").trim();
    const panelId = String(formData.get("panelId") || "").trim();
    const chapterId = String(formData.get("chapterId") || "").trim() || null;
    const target = String(formData.get("target") || "panel").trim() || "panel";

    if (target !== "panel" && target !== "cover") {
      return NextResponse.json(
        { error: 'target must be "panel" or "cover".' },
        { status: 400 },
      );
    }
    // In cover mode the panelId filename slot is the fixed "cover" object.
    const objectKey = target === "cover" ? "cover" : panelId;

    if (!BIBLE_BOOKS.some((b) => b.id === bookId)) {
      return NextResponse.json(
        { error: "Invalid bookId — must match a BIBLE_BOOKS id (e.g. 'genesis')." },
        { status: 400 },
      );
    }
    const chapter = parseInt(chapterRaw, 10);
    if (isNaN(chapter) || chapter < 1) {
      return NextResponse.json({ error: "chapter must be a positive integer." }, { status: 400 });
    }
    if (!PANEL_ID_RE.test(objectKey)) {
      return NextResponse.json(
        { error: "Invalid panelId — use 1-64 characters: letters, numbers, dashes, underscores." },
        { status: 400 },
      );
    }
    logStage("params validated", { bookId, chapter, panelId: objectKey, target, hasChapterId: !!chapterId });

    // 5. File presence + type + size.
    stage = "FILE_VALIDATE";
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      logStage("FAILURE", { stage, message: "No file field provided" });
      return NextResponse.json({ error: "No file provided. Use the 'file' field." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      logStage("FAILURE", { stage, message: `Unsupported MIME type: ${file.type}` });
      return NextResponse.json({ error: "Image must be JPG, PNG, or WEBP." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      logStage("FAILURE", { stage, message: `File size ${file.size} bytes exceeds 10 MB` });
      return NextResponse.json({ error: "Image must be under 10 MB." }, { status: 400 });
    }
    logStage("file received", { mimeType: file.type, sizeBytes: file.size });

    // 6. Read into Buffer.
    stage = "BUFFER_READ";
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    if (rawBuffer.length === 0) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
    }

    // 7. Process with sharp: max 1600px wide (panel cards render 16:9),
    //    convert to WebP quality 85, preserve aspect ratio.
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

    // 8. Upload to Supabase Storage. Stable path per object — upsert:true means
    //    Replace Artwork overwrites the same object (URL stays stable, the
    //    cache-buster below forces browsers to refetch).
    stage = "SUPABASE_UPLOAD";
    const storagePath = `comics/${bookId}/${chapter}/${objectKey}.webp`;
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

    // 9. Resolve public URL + cache-buster.
    stage = "PUBLIC_URL";
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) {
      logStage("FAILURE", { stage, message: "Supabase returned no public URL" });
      return NextResponse.json(
        { error: "Upload succeeded but no URL was returned." },
        { status: 500 },
      );
    }
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;

    // 10. Optional DB persist (edit mode — the object already exists in this chapter).
    let dbUpdated = false;
    if (chapterId) {
      stage = "DB_PERSIST";
      try {
        if (target === "cover") {
          const result = await db.comicChapter.updateMany({
            where: { id: chapterId, bookId },
            data: { coverArtUrl: versionedUrl },
          });
          dbUpdated = result.count > 0;
        } else {
          const result = await db.comicPanel.updateMany({
            where: { panelId, comicChapterId: chapterId },
            data: { artworkUrl: versionedUrl },
          });
          dbUpdated = result.count > 0;
        }
      } catch (dbErr: any) {
        // Non-fatal — the CMS save step will persist the URL anyway.
        logStage("DB persist skipped", { message: dbErr?.message || String(dbErr) });
      }
    }

    logStage("upload successful", { path: storagePath, dbUpdated });
    return NextResponse.json(
      {
        success: true,
        artworkUrl: versionedUrl,
        url: versionedUrl,
        optimizedSize: processedBuffer.length,
        originalSize: file.size,
        dbUpdated,
      },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("[COMIC ARTWORK UPLOAD] FAILURE", {
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
