-- Migration: add_churches_table
-- Creates the Church table for user-submitted Christian churches with a
-- moderation workflow: PENDING (default) → PUBLISHED / REJECTED / CANCELLED.
--
-- Public /api/churches ONLY returns status='PUBLISHED'.
-- Admin /api/admin/churches returns ALL churches with optional status filter.
--
-- Safe to run on production — CREATE TABLE IF NOT EXISTS + CREATE INDEX IF
-- NOT EXISTS. Does NOT touch any existing tables or data.

CREATE TABLE IF NOT EXISTS "Church" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "denomination"    TEXT NOT NULL DEFAULT '',

    "country"         TEXT NOT NULL DEFAULT 'India',
    "state"           TEXT,
    "city"            TEXT,
    "address"         TEXT,
    "postalCode"      TEXT,
    "location"        TEXT NOT NULL,

    "pastorName"      TEXT,
    "contactName"     TEXT,
    "contactEmail"    TEXT,
    "contactPhone"    TEXT,
    "whatsappNumber"  TEXT,
    "website"         TEXT,

    "serviceTimes"   TEXT NOT NULL DEFAULT '[]',
    "languages"       TEXT NOT NULL DEFAULT '[]',

    "coverImage"     TEXT,
    "coverGradient"  INTEGER NOT NULL DEFAULT 0,

    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "featured"       BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "reviewedBy"     TEXT,
    "reviewedAt"     TIMESTAMP(3),

    "createdById"     TEXT,
    "createdByEmail" TEXT,

    "followersCount"  INTEGER NOT NULL DEFAULT 0,

    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Church_status_idx"        ON "Church" ("status");
CREATE INDEX IF NOT EXISTS "Church_state_city_idx"    ON "Church" ("state", "city");
CREATE INDEX IF NOT EXISTS "Church_denomination_idx"   ON "Church" ("denomination");
CREATE INDEX IF NOT EXISTS "Church_featured_idx"      ON "Church" ("featured");
CREATE INDEX IF NOT EXISTS "Church_createdById_idx"   ON "Church" ("createdById");
