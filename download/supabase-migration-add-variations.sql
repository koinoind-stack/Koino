-- Add variations & attributes columns to Gift table
ALTER TABLE "Gift" ADD COLUMN IF NOT EXISTS "variations" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Gift" ADD COLUMN IF NOT EXISTS "attributes" TEXT NOT NULL DEFAULT '[]';

-- Add selectedVariations column to GiftRedemption table
ALTER TABLE "GiftRedemption" ADD COLUMN IF NOT EXISTS "selectedVariations" TEXT NOT NULL DEFAULT '[]';

-- Verify columns exist
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('Gift', 'GiftRedemption')
  AND column_name IN ('variations', 'attributes', 'selectedVariations')
ORDER BY table_name, column_name;
