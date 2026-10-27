import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import { getExcludedUserIds } from "@/lib/social/server";
import {
  requireMatrimonyMember,
  parseLanguages,
} from "@/lib/matrimony/server";
import {
  ageFromDOB,
  birthDateRangeFromAges,
  encodeDiscoveryCursor,
  MATRIMONY_DISCOVERY_LIMITS,
  MATRIMONY_MIN_AGE,
  matrimonyDiscoveryQuerySchema,
  parseDiscoveryCursor,
} from "@/lib/matrimony";

/**
 * ─── /api/matrimony/discover (Task 74 Stage C) ──────────────────────────────
 *
 * GET — browse ACTIVE matrimony profiles. Read-only; nothing here mutates
 * any row.
 *
 * ENFORCEMENT ORDER (auth before validation → unauthenticated probes cost
 * nothing and touch nothing):
 *   1. requireMatrimonyMember()  — auth + active account + DOB present + 18+.
 *      FIRST statement of the handler, same as every matrimony route.
 *   2. rateLimit                 — per-member sliding window (60/min).
 *   3. zod query validation      — fails closed with 400.
 *
 * WHAT CAN APPEAR HERE (all server-side, never client-asserted):
 *   - profile.status = "active" ONLY (draft/paused/restricted/removed never).
 *   - owner's User.accountStatus = "active" (defense in depth — a suspended
 *     account's profile disappears from discovery even before an admin
 *     restricts it, Stage E).
 *   - owner NOT the viewer, and no Block in either direction.
 *   - age computed server-side from User.dateOfBirth; the DOB itself is
 *     NEVER selected into a response — only the computed age leaves.
 *
 * PHOTO RULES (unchanged from Stage B, enforced again here):
 *   - A card carries a photo ONLY when the owner chose ELIGIBLE_MEMBERS and a
 *     ready position-0 photo exists. The <img> still hits the authorized
 *     route /api/matrimony/photos/[id], which re-checks everything per view.
 *   - CONNECTIONS_ONLY stays owner-only until the connection system ships
 *     (Stage D) — the card shows a placeholder instead, never the photo.
 *
 * PAGINATION — keyset on (updatedAt DESC, id DESC) via an opaque compound
 * cursor; ids only break ties, so ordering stays deterministic even when two
 * profiles share an updatedAt. Ordering by updatedAt keeps recently-active
 * profiles near the top (freshness-ranked discovery).
 *
 * SEARCH — `q` matches ONLY card-visible fields (city, state, denomination,
 * education, profession, aboutMe). It deliberately does NOT match name or
 * username: those are never shown on a card, so matching them would surface
 * results the member cannot explain.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // 1. ── THE gate — auth before anything else, zero-leak on failure.
  const gate = await requireMatrimonyMember();
  if (!gate.member) return gate.response;

  // 2. ── Rate limit (per member, in-memory sliding window).
  if (
    !rateLimit(
      `matrimony-discover:${gate.member.id}`,
      MATRIMONY_DISCOVERY_LIMITS.requestsPerMinute,
      60_000
    )
  ) {
    return NextResponse.json(
      { error: "Too many requests — please slow down.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  // 3. ── Validate query params (fail closed).
  const sp = new URL(req.url).searchParams;
  const parsed = matrimonyDiscoveryQuerySchema.safeParse({
    q: sp.get("q") ?? undefined,
    gender: sp.get("gender") ?? undefined,
    state: sp.get("state") ?? undefined,
    city: sp.get("city") ?? undefined,
    language: sp.get("language") ?? undefined,
    ageMin: sp.get("ageMin") ?? undefined,
    ageMax: sp.get("ageMax") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search filters.", code: "VALIDATION" },
      { status: 400 }
    );
  }
  const filters = parsed.data;

  if (
    filters.ageMin !== undefined &&
    filters.ageMax !== undefined &&
    filters.ageMin > filters.ageMax
  ) {
    return NextResponse.json(
      { error: "Minimum age cannot be greater than maximum age.", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const cursor = parseDiscoveryCursor(filters.cursor);
  if (filters.cursor && !cursor) {
    return NextResponse.json(
      { error: "Invalid pagination cursor.", code: "VALIDATION" },
      { status: 400 }
    );
  }

  // 4. ── Exclusions: blocked pairs (either direction) + the viewer themself.
  const blockedIds = await getExcludedUserIds(gate.member.id);
  const excludedUserIds = blockedIds.length
    ? [...new Set([...blockedIds, gate.member.id])]
    : [gate.member.id];

  // 5. ── Build the where clause — every row is an ACTIVE profile of an
  //      active, unblocked, non-viewer member, inside the requested age band.
  const birthRange = birthDateRangeFromAges({ ageMin: filters.ageMin, ageMax: filters.ageMax });
  const and: Prisma.MatrimonyProfileWhereInput[] = [
    { status: "active" },
    { userId: { notIn: excludedUserIds } },
    { user: { accountStatus: "active" } },
  ];
  if (birthRange.gte || birthRange.lte) {
    and.push({ user: { dateOfBirth: birthRange } });
  }
  if (filters.gender) and.push({ user: { gender: filters.gender } });
  if (filters.state) and.push({ user: { state: filters.state } });
  if (filters.city) and.push({ user: { city: filters.city } });
  if (filters.language) {
    // languages is a JSON string[] column — match the quoted element so
    // "Hindi" cannot substring-match into a longer value.
    and.push({ languages: { contains: `"${filters.language}"` } });
  }
  if (filters.q) {
    const like = { contains: filters.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { user: { city: like } },
        { user: { state: like } },
        { denomination: like },
        { education: like },
        { profession: like },
        { aboutMe: like },
      ],
    });
  }
  if (cursor) {
    // Strict keyset step: strictly-older updatedAt, or the same updatedAt
    // with a strictly-smaller id tiebreaker.
    and.push({
      OR: [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: { equals: cursor.updatedAt }, id: { lt: cursor.id } },
      ],
    });
  }

  const take = filters.limit ?? MATRIMONY_DISCOVERY_LIMITS.pageDefault;

  // 6. ── Fetch. The select is a whitelist: no name, username, email, DOB,
  //      restrictedReason, or storagePath can ever reach the client.
  try {
    const rows = await db.matrimonyProfile.findMany({
      where: { AND: and },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        languages: true,
        intention: true,
        timeline: true,
        denomination: true,
        education: true,
        profession: true,
        aboutMe: true,
        heightCm: true,
        photoVisibility: true,
        updatedAt: true,
        user: {
          select: {
            gender: true,
            state: true,
            city: true,
            dateOfBirth: true, // server-only input for the computed age
          },
        },
        photos: {
          select: { id: true, position: true, status: true, width: true, height: true },
          orderBy: { position: "asc" },
        },
      },
    });

    const lastRaw = rows.length > 0 ? rows[rows.length - 1] : null;
    const hasMore = rows.length === take && lastRaw !== null;

    const profiles = rows
      .map((r) => {
        const age = ageFromDOB(r.user.dateOfBirth);
        // Defensive: active profiles are 18+ by construction (activation and
        // DOB-change both re-check), but never let a bad row through.
        if (age < MATRIMONY_MIN_AGE) return null;

        const primary = r.photos.find((p) => p.position === 0 && p.status === "ready");
        // CONNECTIONS_ONLY (default) → no photo for anyone but the owner,
        // and the owner never appears in their own discovery results. The
        // Stage D connection check plugs into canViewMatrimonyPhoto, which
        // the authorized photo route already consults per view.
        const photo =
          r.photoVisibility === "ELIGIBLE_MEMBERS" && primary
            ? {
                id: primary.id,
                url: `/api/matrimony/photos/${primary.id}`,
                width: primary.width,
                height: primary.height,
              }
            : null;

        return {
          id: r.id,
          age,
          gender: r.user.gender,
          state: r.user.state,
          city: r.user.city,
          languages: parseLanguages(r.languages),
          intention: r.intention,
          timeline: r.timeline,
          denomination: r.denomination,
          education: r.education,
          profession: r.profession,
          aboutMe: r.aboutMe,
          heightCm: r.heightCm,
          photoVisibility: r.photoVisibility,
          photo,
          updatedAt: r.updatedAt.toISOString(),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    return NextResponse.json({
      profiles,
      nextCursor:
        hasMore && lastRaw
          ? encodeDiscoveryCursor({ updatedAt: lastRaw.updatedAt, id: lastRaw.id })
          : null,
    });
  } catch (e) {
    console.error("[matrimony/discover] query failed:", e);
    return NextResponse.json(
      {
        error: "Could not load profiles right now. Please try again.",
        code: "DISCOVERY_UNAVAILABLE",
      },
      { status: 500 }
    );
  }
}
