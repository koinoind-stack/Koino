import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  TaxonomyError,
  assertSlugAvailable,
  buildSlug,
  listAllTopicsAdmin,
} from "@/lib/taxonomy-server";

/**
 * Admin Taxonomy panel — Topics (Plan v2 §2.4/§5.3).
 *
 * GET  /api/admin/taxonomy/topics   — full admin list with parent category
 *                                     and usage counts (includes deactivated).
 * POST /api/admin/taxonomy/topics   — create a topic under a parent category.
 *
 * `legacyKey` is deliberately NOT settable through this API: it is reserved
 * for the canonical seed (six SPA ids backing UserQuestion.category) so an
 * admin can never accidentally break the Q&A pipeline.
 *
 * Admin-only — 401 / 403 semantics per Phase 1 (fix 12a).
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

const HEX = /^#[0-9A-Fa-f]{6}$/;

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentCategoryId: z.string().min(1),
  slug: z.string().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  iconKey: z.string().trim().max(60).optional(),
  color: z.string().regex(HEX, "color must be a #RRGGBB hex value").nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const topics = await listAllTopicsAdmin();
    return NextResponse.json({ topics });
  } catch (e: any) {
    console.error("[admin/taxonomy/topics] GET error:", e);
    return NextResponse.json({ error: "Failed to list topics." }, { status: 500 });
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
        { error: parsed.error.issues[0]?.message || "Invalid topic payload." },
        { status: 400 }
      );
    }
    const parent = await db.category.findUnique({
      where: { id: parsed.data.parentCategoryId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent category does not exist." }, { status: 400 });
    }
    const slug = buildSlug(parsed.data.name, parsed.data.slug);
    await assertSlugAvailable(slug);
    const topic = await db.topic.create({
      data: {
        name: parsed.data.name,
        slug,
        legacyKey: null, // reserved for the canonical seed — see header
        parentCategoryId: parsed.data.parentCategoryId,
        description: parsed.data.description ?? null,
        iconKey: parsed.data.iconKey ?? null,
        color: parsed.data.color ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: true,
      },
    });
    return NextResponse.json({ topic }, { status: 201 });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/topics] POST error:", e);
    return NextResponse.json({ error: "Failed to create topic." }, { status: 500 });
  }
}
