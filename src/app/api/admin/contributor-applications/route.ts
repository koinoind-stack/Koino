import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

// Admin auth helper — distinguishes 401 (not signed in) from 403 (not admin).
async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user, response: null };
}

// Allowed status values for ContributorApplication workflow.
const ALLOWED_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "suspended",
] as const;

// Maps the action keyword sent by the admin UI → new status string.
const ACTION_TO_STATUS: Record<string, string> = {
  start_review: "under_review",
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reopen: "pending",
};

// JSON columns stored as TEXT in SQLite — always fall back to [] if malformed.
function safeParseArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Generates a unique slug for a Contributor. If `base` collides with an
// existing slug, append a short random suffix. Retries a few times in the
// (vanishingly rare) case the suffixed slug also collides.
async function generateUniqueSlug(base: string): Promise<string> {
  const cleaned = base || `contributor-${Date.now()}`;
  // Keep room for "-xxxx" suffix.
  const truncated = cleaned.slice(0, 45);
  let candidate = truncated;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.contributor.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${truncated}-${suffix}`.slice(0, 50);
  }
  // Last resort: timestamp.
  return `${truncated}-${Date.now().toString(36)}`.slice(0, 50);
}

function serializeApplication(a: any) {
  return {
    id: a.id,
    fullName: a.fullName,
    email: a.email,
    userId: a.userId,
    profilePhoto: a.profilePhoto,
    church: a.church,
    churchRole: a.churchRole,
    city: a.city,
    state: a.state,
    country: a.country,
    bio: a.bio,
    expertise: safeParseArray(a.expertise),
    website: a.website,
    socialLinks: safeParseArray(a.socialLinks),
    whyContribute: a.whyContribute,
    contentInterests: safeParseArray(a.contentInterests),
    sampleUrl: a.sampleUrl,
    status: a.status,
    adminNotes: a.adminNotes,
    reviewedBy: a.reviewedBy,
    reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function serializeContributor(c: any) {
  return {
    id: c.id,
    userId: c.userId,
    displayName: c.displayName,
    slug: c.slug,
    verified: c.verified,
    status: c.status,
    applicationId: c.applicationId,
  };
}

/**
 * GET /api/admin/contributor-applications
 *
 * Admin-only. Returns every ContributorApplication record, newest first.
 * Supports optional `?status=` filter. Also returns the linked Contributor
 * record (if any) so the admin UI can show verified status / slug.
 *
 * The response includes `adminNotes`, `reviewedBy`, and `reviewedAt` —
 * these fields are admin-only and MUST NOT be exposed by any public API.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: { status?: string } = {};
    if (status && (ALLOWED_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }

    const applications = await db.contributorApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contributor: {
          select: {
            id: true,
            userId: true,
            displayName: true,
            slug: true,
            verified: true,
            status: true,
            applicationId: true,
          },
        },
      },
    });

    // Compute per-status counts across the unfiltered set so chip badges
    // in the UI stay consistent regardless of the active filter.
    const allApps = status
      ? await db.contributorApplication.findMany({ select: { status: true } })
      : applications;
    const counts: Record<string, number> = {
      total: allApps.length,
      pending: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
    };
    for (const a of allApps) {
      const s = (a as any).status as string;
      if (s in counts) counts[s] += 1;
    }

    return NextResponse.json({
      applications: applications.map((a) => ({
        ...serializeApplication(a),
        contributor: a.contributor ? serializeContributor(a.contributor) : null,
      })),
      counts,
    });
  } catch (error: any) {
    console.error("[admin/contributor-applications] GET error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load" }, { status: 500 });
  }
}

/**
 * POST /api/admin/contributor-applications
 *
 * Admin-only. Body: `{ id, action }` where action is one of
 * `start_review`, `approve`, `reject`, `suspend`, `reopen`.
 *
 * Approval side-effect: creates a linked Contributor record (idempotent —
 * if one already exists for this applicationId, just promotes status to
 * "approved"). The slug is generated from `fullName` and is guaranteed
 * unique (a short random suffix is appended on collision). `verified`
 * defaults to false — the admin can flip it separately via the [id]
 * PATCH endpoint.
 *
 * If `userId` is set on the application, it is linked to the new
 * Contributor's `userId` field.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const body = await req.json();
    const { id, action } = body || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (!action || !(action in ACTION_TO_STATUS)) {
      return NextResponse.json(
        { error: `action must be one of: ${Object.keys(ACTION_TO_STATUS).join(", ")}` },
        { status: 400 }
      );
    }

    const application = await db.contributorApplication.findUnique({ where: { id } });
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const newStatus = ACTION_TO_STATUS[action];

    // Update application status + audit fields.
    await db.contributorApplication.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: auth.user.email,
        reviewedAt: new Date(),
      },
    });

    let contributor: any = null;

    if (action === "approve") {
      // Idempotency: Contributor.applicationId is @unique, so look up by it.
      contributor = await db.contributor.findUnique({ where: { applicationId: id } });

      if (!contributor) {
        // Determine userId for the new Contributor row.
        // Contributor.userId is @unique. If application.userId is set AND
        // a Contributor already exists for that userId, reuse it (this
        // covers the rare case of one user submitting multiple applications).
        let userIdForContributor: string;
        if (application.userId) {
          const existingForUser = await db.contributor.findUnique({
            where: { userId: application.userId },
          });
          if (existingForUser) {
            // Reuse: link the existing Contributor to this application.
            contributor = await db.contributor.update({
              where: { id: existingForUser.id },
              data: {
                applicationId: id,
                status: "approved",
                // Refresh display fields from the latest approved application.
                displayName: application.fullName,
                profilePhoto: application.profilePhoto,
                bio: application.bio,
                church: application.church,
                churchRole: application.churchRole,
                expertise: application.expertise,
                website: application.website,
                socialLinks: application.socialLinks,
              },
            });
            userIdForContributor = existingForUser.userId;
          } else {
            userIdForContributor = application.userId;
          }
        } else {
          // No linked Koino user — use a placeholder so the @unique
          // constraint isn't violated by future applications.
          userIdForContributor = `pending-${id}`;
        }

        if (!contributor) {
          const slug = await generateUniqueSlug(slugify(application.fullName));
          contributor = await db.contributor.create({
            data: {
              userId: userIdForContributor,
              displayName: application.fullName,
              slug,
              profilePhoto: application.profilePhoto,
              bio: application.bio,
              church: application.church,
              churchRole: application.churchRole,
              location:
                application.city || application.state
                  ? [application.city, application.state].filter(Boolean).join(", ")
                  : null,
              expertise: application.expertise,
              website: application.website,
              socialLinks: application.socialLinks,
              verified: false, // admin flips this separately via PATCH [id]
              status: "approved",
              permissions: JSON.stringify(["CAN_WRITE_ARTICLES"]),
              applicationId: id,
            },
          });
        }
      } else {
        // Already exists (idempotent re-approval) — just ensure status is approved.
        contributor = await db.contributor.update({
          where: { id: contributor.id },
          data: { status: "approved" },
        });
      }
    } else if (action === "suspend") {
      // Cascade: also flip the linked Contributor to suspended + unverified.
      const linked = await db.contributor.findUnique({ where: { applicationId: id } });
      if (linked) {
        contributor = await db.contributor.update({
          where: { id: linked.id },
          data: { status: "suspended", verified: false },
        });
      }
    } else if (action === "reject" || action === "reopen") {
      // On reject/reopen, leave the linked Contributor (if any) untouched —
      // the admin can delete it separately if needed.
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      contributor: contributor ? serializeContributor(contributor) : null,
    });
  } catch (error: any) {
    console.error("[admin/contributor-applications] POST error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update" }, { status: 500 });
  }
}
