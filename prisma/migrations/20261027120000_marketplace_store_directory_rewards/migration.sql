-- AlterTable
ALTER TABLE "Gift" ADD COLUMN     "deliveryType" TEXT NOT NULL DEFAULT 'physical',
ADD COLUMN     "eligibilityType" TEXT NOT NULL DEFAULT 'points',
ADD COLUMN     "eligibilityValue" INTEGER;

-- AlterTable
ALTER TABLE "GiftRedemption" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'user_claim';

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "mrp" INTEGER,
    "category" TEXT NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "state" TEXT,
    "city" TEXT,
    "sellerName" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "phone" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "coverGradient" INTEGER NOT NULL DEFAULT 0,
    "sellerType" TEXT NOT NULL DEFAULT 'member',
    "sellerId" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "mrp" INTEGER,
    "category" TEXT NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "variations" TEXT NOT NULL DEFAULT '[]',
    "attributes" TEXT NOT NULL DEFAULT '[]',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "buyUrl" TEXT,
    "contactWhatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "state" TEXT,
    "city" TEXT,
    "address" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "whatsappNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "hours" TEXT,
    "services" TEXT NOT NULL DEFAULT '[]',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "ownerId" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "coverGradient" INTEGER NOT NULL DEFAULT 0,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_createdAt_idx" ON "MarketplaceListing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_category_idx" ON "MarketplaceListing"("category");

-- CreateIndex
CREATE INDEX "MarketplaceListing_state_city_idx" ON "MarketplaceListing"("state", "city");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_idx" ON "MarketplaceListing"("sellerId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_featured_idx" ON "MarketplaceListing"("featured");

-- CreateIndex
CREATE INDEX "StoreProduct_active_featured_idx" ON "StoreProduct"("active", "featured");

-- CreateIndex
CREATE INDEX "StoreProduct_category_idx" ON "StoreProduct"("category");

-- CreateIndex
CREATE INDEX "Business_status_createdAt_idx" ON "Business"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Business_category_idx" ON "Business"("category");

-- CreateIndex
CREATE INDEX "Business_state_city_idx" ON "Business"("state", "city");

-- CreateIndex
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");

-- CreateIndex
CREATE INDEX "Business_verified_idx" ON "Business"("verified");

-- CreateIndex
CREATE INDEX "Business_featured_idx" ON "Business"("featured");

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

