// Quick test: Can we access Supabase Storage with the configured keys?
// Run: bunx tsx scripts/test-supabase-storage.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceKey || serviceKey === "placeholder-service-role-key") {
  console.log("❌ SUPABASE_SERVICE_ROLE_KEY is not set or is still placeholder");
  console.log("   Set it in .env locally, or on Vercel for production.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Supabase URL:", supabaseUrl);
  console.log("Service key:", serviceKey.substring(0, 20) + "...");
  console.log("");

  // List existing buckets
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("❌ Failed to list buckets:", listError.message);
    process.exit(1);
  }

  console.log("✅ Connected to Supabase Storage!");
  console.log("Existing buckets:", buckets.map((b) => b.name));
  console.log("");

  // Check if our bucket exists
  const bucketName = "believ-comic-artwork";
  const exists = buckets.some((b) => b.name === bucketName);

  if (exists) {
    console.log(`✅ Bucket "${bucketName}" already exists`);
  } else {
    console.log(`📦 Creating bucket "${bucketName}"...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ["image/webp", "image/png", "image/jpeg"],
      fileSizeLimit: 10 * 1024 * 1024,
    });

    if (createError) {
      console.error("❌ Failed to create bucket:", createError.message);
      process.exit(1);
    }
    console.log(`✅ Bucket "${bucketName}" created (public)`);
  }

  // Test upload a tiny WebP file
  console.log("");
  console.log("Testing upload...");
  const testPath = "bible-comics/test/test-panel.webp";
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(testPath, Buffer.from("test"), {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) {
    console.error("❌ Upload test failed:", uploadError.message);
  } else {
    console.log("✅ Upload test succeeded!");

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(testPath);
    console.log("   Public URL:", urlData.publicUrl);

    // Clean up test file
    await supabase.storage.from(bucketName).remove([testPath]);
    console.log("   Test file cleaned up");
  }

  console.log("");
  console.log("✨ Supabase Storage is ready for comic artwork!");
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
