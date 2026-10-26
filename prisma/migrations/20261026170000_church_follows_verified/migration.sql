-- Churches upgrade: real follows + verification badge. ADDITIVE only.
-- (No existing rows are modified.)

-- 1) Church.verified — admin-confirmed real congregation (badge)
ALTER TABLE "Church" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

-- 2) ChurchFollow — one follow per (church, user), DB-enforced
CREATE TABLE "ChurchFollow" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChurchFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChurchFollow_churchId_userId_key" ON "ChurchFollow"("churchId", "userId");
CREATE INDEX "ChurchFollow_userId_idx" ON "ChurchFollow"("userId");

ALTER TABLE "ChurchFollow" ADD CONSTRAINT "ChurchFollow_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChurchFollow" ADD CONSTRAINT "ChurchFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
