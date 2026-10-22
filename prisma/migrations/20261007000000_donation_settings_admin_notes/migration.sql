-- Migration: add_donation_settings_and_admin_notes
-- Adds:
--   1. DonationSettings singleton model (admin-configured UPI/QR/bank)
--   2. adminNotes, reviewedBy, reviewedAt, updatedAt to ContactMessage
--      + status workflow expanded: new → read → replied → closed
--   3. adminNotes, reviewedBy, reviewedAt, updatedAt to PartnerInquiry
--   4. scheduledAt, canonicalUrl, relatedArticleIds to BlogPost
--
-- Safe to run on production — all new columns are nullable / have defaults.

-- ─── 1. DonationSettings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DonationSettings" (
    "id"                  TEXT NOT NULL DEFAULT 'default',
    "upiId"               TEXT,
    "qrCodeUrl"           TEXT,
    "accountName"         TEXT,
    "accountNumber"       TEXT,
    "ifsc"                TEXT,
    "bankName"            TEXT,
    "branch"              TEXT,
    "donationMessage"     TEXT,
    "acceptingDonations"  BOOLEAN NOT NULL DEFAULT true,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonationSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so admin can upsert without creating first.
INSERT INTO "DonationSettings" ("id", "acceptingDonations")
VALUES ('default', true)
ON CONFLICT ("id") DO NOTHING;

-- ─── 2. ContactMessage — add admin workflow fields ─────────────────────
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Status workflow expanded: existing 'archived' values remain valid;
-- new values: 'new' | 'read' | 'replied' | 'closed'

-- ─── 3. PartnerInquiry — add admin workflow fields ─────────────────────
ALTER TABLE "PartnerInquiry" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "PartnerInquiry" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "PartnerInquiry" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "PartnerInquiry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── 4. BlogPost — scheduling, canonical, related articles ─────────────
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "relatedArticleIds" TEXT NOT NULL DEFAULT '[]';
