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
 * Admin Taxonomy panel — one Topic (Plan v2 §2.4).
 *
 * PATCH  /api/admin/taxonomy/topics/[id] — edit name/slug/parent/description/
 *        icon/color/sortOrder, or flip isActive (soft deactivation: pickers
 *        hide the topic while existing associations and legacyKey URLs
 *        survive untouched — the Q&A pipeline is unaffected).
 * DELETE /api/admin/taxonomy/topics/[id] — hard delete, restricted to topics
 *        with ZERO article associations (409 otherwise with the count).
 *
 * `legacyKey` is immutable through this API — it is the contract that keeps
 * the six SPA topic ids and UserQuestion.category values working.
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

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z.string().max(80).optional(),
  parentCategoryId: z.string().min(1).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  iconKey: z.string().trim().max(60).nullable().optional(),
  color: z.string().regex(HEX, "color must be a #RRGGBB hex value").nullable().optional(),
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
    const existing = await db.topic.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid topic payload." },
        { status: 400 }
      );
    }
    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.slug !== undefined && parsed.data.slug !== existing.slug) {
      const slug = buildSlug(parsed.data.name ?? existing.name, parsed.data.slug);
      await assertSlugAvailable(slug, id);
      data.slug = slug;
    }
    if (parsed.data.parentCategoryId !== undefined && parsed.data.parentCategoryId !== existing.parentCategoryId) {
      const parent = await db.category.findUnique({
        where: { id: parsed.data.parentCategoryId },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent category does not exist." }, { status: 400 });
      }
      data.parentCategoryId = parsed.data.parentCategoryId;
    }
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.iconKey !== undefined) data.iconKey = parsed.data.iconKey;
    if (parsed.data.color !== undefined) data.color = parsed.data.color;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

    const topic = await db.topic.update({ where: { id }, data });
    return NextResponse.json({ topic });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/topics/[id]] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update topic." }, { status: 500 });
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
    const existing = await db.topic.findUnique({
      where: { id },
      select: { id: true, name: true, legacyKey: true, _count: { select: { articles: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }
    if (existing.legacyKey) {
      return NextResponse.json(
        {
          error: `Topic "${existing.name}" carries a legacy key that the Q&A pipeline resolves against. Deactivate it instead — legacy topics are never hard-deleted.`,
        },
        { status: 409 }
      );
    }
    if (existing._count.articles > 0) {
      return NextResponse.json(
        {
          error: `Topic "${existing.name}" is associated with ${existing._count.articles} article(s). Deactivate it instead — hard delete is reserved for unused rows.`,
        },
        { status: 409 }
      );
    }
    await db.topic.delete({ where: { id } });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/topics/[id]] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete topic." }, { status: 500 });
  }
}
