import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  TaxonomyError,
  assertSlugAvailable,
  buildSlug,
} from "@/lib/taxonomy-server";

/**
 * Admin Taxonomy panel — one Category (Plan v2 §2.3).
 *
 * PATCH  /api/admin/taxonomy/categories/[id] — edit name/slug/description/
 *        icon/image/sortOrder, or flip isActive (soft deactivation is the
 *        default path: pickers hide the row, existing article references and
 *        topic parents survive untouched).
 * DELETE /api/admin/taxonomy/categories/[id] — hard delete, restricted to
 *        categories with ZERO topics and ZERO associated articles (409
 *        otherwise with the blocking counts). Deactivate instead.
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

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z.string().max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  iconKey: z.string().trim().max(60).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const { id } = await params;
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid category payload." },
        { status: 400 }
      );
    }
    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.slug !== undefined && parsed.data.slug !== existing.slug) {
      // Renaming the slug is allowed (SEO-editable per Plan §2.3) but must
      // re-pass format + uniqueness — future unified URLs depend on it.
      const slug = buildSlug(parsed.data.name ?? existing.name, parsed.data.slug);
      await assertSlugAvailable(slug, id);
      data.slug = slug;
    }
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.iconKey !== undefined) data.iconKey = parsed.data.iconKey;
    if (parsed.data.imageUrl !== undefined) data.imageUrl = parsed.data.imageUrl;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

    const category = await db.category.update({ where: { id }, data });
    return NextResponse.json({ category });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/categories/[id]] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const { id } = await params;
    const existing = await db.category.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { topics: true, articles: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    if (existing._count.topics > 0 || existing._count.articles > 0) {
      return NextResponse.json(
        {
          error: `Category "${existing.name}" is in use (${existing._count.topics} topic(s), ${existing._count.articles} article(s)). Deactivate it instead — hard delete is reserved for unused rows.`,
        },
        { status: 409 }
      );
    }
    await db.category.delete({ where: { id } });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/categories/[id]] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
