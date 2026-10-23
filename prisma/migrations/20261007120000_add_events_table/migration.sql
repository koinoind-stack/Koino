-- Migration: add_events_table
-- Creates the Event table for user-submitted Christian events with a
-- moderation workflow: PENDING (default) → PUBLISHED / REJECTED / CANCELLED.
--
-- Public /api/events ONLY returns status='PUBLISHED'.
-- Admin /api/admin/events returns ALL events with optional status filter.
--
-- Safe to run on production — creates a new table only, no destructive ops.

CREATE TABLE IF NOT EXISTS "Event" (
    "id"               TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT NOT NULL,
    "startDate"        TIMESTAMP(3) NOT NULL,
    "endDate"          TIMESTAMP(3),
    "startTime"        TEXT,
    "endTime"          TEXT,
    "allDay"           BOOLEAN NOT NULL DEFAULT false,

    "country"          TEXT NOT NULL DEFAULT 'India',
    "state"            TEXT,
    "city"             TEXT,
    "address"          TEXT,
    "venueName"        TEXT,
    "location"         TEXT NOT NULL,

    "eventType"        TEXT NOT NULL DEFAULT 'in-person',
    "isOnline"         BOOLEAN NOT NULL DEFAULT false,
    "onlineUrl"        TEXT,

    "registrationType" TEXT NOT NULL DEFAULT 'free',
    "ticketUrl"        TEXT,
    "isFree"           BOOLEAN NOT NULL DEFAULT true,
    "price"            DOUBLE PRECISION NOT NULL DEFAULT 0,

    "organizerName"    TEXT,
    "organizerEmail"   TEXT,
    "organizerPhone"   TEXT,
    "organizerWebsite" TEXT,
    "whatsappNumber"   TEXT,

    "category"         TEXT NOT NULL,
    "languages"        TEXT NOT NULL DEFAULT '[]',
    "church"           TEXT,

    "coverImage"       TEXT,
    "coverGradient"    INTEGER NOT NULL DEFAULT 0,

    "status"           TEXT NOT NULL DEFAULT 'PENDING',
    "featured"         BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason"  TEXT,
    "reviewedBy"       TEXT,
    "reviewedAt"       TIMESTAMP(3),

    "createdById"      TEXT,
    "createdByEmail"   TEXT,

    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Event_status_idx"        ON "Event" ("status");
CREATE INDEX IF NOT EXISTS "Event_startDate_idx"     ON "Event" ("startDate");
CREATE INDEX IF NOT EXISTS "Event_state_city_idx"     ON "Event" ("state", "city");
CREATE INDEX IF NOT EXISTS "Event_category_idx"      ON "Event" ("category");
CREATE INDEX IF NOT EXISTS "Event_featured_idx"      ON "Event" ("featured");
CREATE INDEX IF NOT EXISTS "Event_createdById_idx"   ON "Event" ("createdById");
