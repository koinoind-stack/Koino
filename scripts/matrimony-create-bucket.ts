/**
 * ─── MATRIMONY PRIVATE BUCKET SETUP (Task 74 Stage B) ───────────────────────
 *
 * One-time creation of the PRIVATE `matrimony-photos` Supabase Storage bucket.
 *
 * ⚠️ REQUIRES EXPLICIT APPROVAL before running against production:
 *    1. Put the real credentials in .env (NEXT_PUBLIC_SUPABASE_URL +
 *       SUPABASE_SERVICE_ROLE_KEY).
 *    2. Run:  npx tsx scripts/matrimony-create-bucket.ts --yes
 *
 * Alternatively (no script): Supabase Dashboard → Storage → New bucket:
 *   Name: matrimony-photos · Public bucket: OFF
 *   File size limit: 10 MB · Allowed MIME types: image/webp
 *
 * The bucket is PRIVATE (public: false). Objects are read ONLY by the
 * service-role key inside the authorized serving route
 * (/api/matrimony/photos/[id]) and returned as 60-second signed URLs.
 * No bucket policies for anon keys are needed — anon users get nothing.
 * Existing public buckets are NOT touched.
 */

import { createClient } from "@supabase/supabase-js";
import { MATRIMONY_PHOTOS_BUCKET } from "../src/lib/matrimony";

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "REFUSING to run: this creates a storage bucket in the Supabase project\n" +
      "pointed to by your env vars. Review the config below, then re-run with --yes\n" +
      "to confirm you intend to run it against THAT environment.\n\n" +
      `  Target bucket : ${MATRIMONY_PHOTOS_BUCKET} (public: false)\n` +
      `  SUPABASE_URL  : ${process.env.NEXT_PUBLIC_SUPABASE_URL || "(not set)"}\n` +
      `  SERVICE_KEY   : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "(set)" : "(not set)"}`
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "placeholder-service-role-key") {
    console.error("Missing real NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotent: skip if it already exists.
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Could not list buckets:", listError.message);
    process.exit(1);
  }
  const existing = buckets?.find((b) => b.name === MATRIMONY_PHOTOS_BUCKET);
  if (existing) {
    console.log(`Bucket "${MATRIMONY_PHOTOS_BUCKET}" already exists.`);
    console.log(`  public: ${existing.public} (must be false)`);
    if (existing.public) {
      console.error("⚠️ This bucket is PUBLIC — fix it in the dashboard before launch.");
      process.exit(2);
    }
    return;
  }

  const { data, error } = await supabase.storage.createBucket(MATRIMONY_PHOTOS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // processed WebP output; inputs are capped at 4 MB
    allowedMimeTypes: ["image/webp"],
  });
  if (error) {
    console.error("Bucket creation failed:", error.message);
    process.exit(1);
  }
  console.log(`✅ Created PRIVATE bucket "${data?.name ?? MATRIMONY_PHOTOS_BUCKET}"`);
  console.log("   public: false · size limit: 10 MB · mime: image/webp");
}

main();
