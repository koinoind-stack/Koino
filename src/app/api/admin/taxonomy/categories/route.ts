import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  TaxonomyError,
  assertSlugAvailable,
  buildSlug,
  listAllCategoriesAdmin,
} from "@/lib/taxonomy-server";

/**
 * Admin Taxonomy panel — Categories (Plan v2 §2.3/§5.3).
 *
 * GET  /api/admin/taxonomy/categories   — full admin list with usage counts
 *                                        (includes deactivated rows; the
 *                                        public surfaces use taxonomy-server's
 *                                        active-only reads).
 * POST /api/admin/taxonomy/categories   — create a category (slug optional:
 *                                        derived from the name when omitted).
 *
 * Admin-only. 401 for unauthenticated callers, 403 for non-admins — the
 * shared 401/403 semantics established in Phase 1 (fix 12a).
 */

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

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  iconKey: z.string().trim().max(60).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const categories = await listAllCategoriesAdmin();
    return NextResponse.json({ categories });
  } catch (e: any) {
    console.error("[admin/taxonomy/categories] GET error:", e);
    return NextResponse.json({ error: "Failed to list categories." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid category payload." },
        { status: 400 }
      );
    }
    const slug = buildSlug(parsed.data.name, parsed.data.slug);
    await assertSlugAvailable(slug);
    const category = await db.category.create({
      data: {
        name: parsed.data.name,
        slug,
        description: parsed.data.description ?? null,
        iconKey: parsed.data.iconKey ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: true,
      },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/categories] POST error:", e);
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}
