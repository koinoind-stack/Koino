import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import {
  TaxonomyError,
  getArticleTopicIds,
  setArticleTopics,
} from "@/lib/taxonomy-server";

/**
 * Admin Taxonomy panel — article ↔ topic associations (Plan v2 §2.4: "one
 * article may carry multiple topics").
 *
 * GET /api/admin/taxonomy/articles/[id]/topics — current topic ids of an
 *     article (editor modal hydration).
 * PUT /api/admin/taxonomy/articles/[id]/topics — replace-set the article's
 *     topics. Guards enforced in taxonomy-server: the article must exist;
 *     every topic must exist AND be active — deactivated topics cannot be
 *     NEWLY assigned (removing is always allowed); ceiling of
 *     MAX_TOPICS_PER_ARTICLE associations.
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

const putSchema = z.object({
  topicIds: z.array(z.string().min(1)).max(50),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const { id } = await params;
    const topicIds = await getArticleTopicIds(id);
    return NextResponse.json({ articleId: id, topicIds });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/articles/[id]/topics] GET error:", e);
    return NextResponse.json({ error: "Failed to read article topics." }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid topic list." },
        { status: 400 }
      );
    }
    const topicIds = await setArticleTopics(id, parsed.data.topicIds);
    return NextResponse.json({ success: true, articleId: id, topicIds });
  } catch (e: any) {
    if (e instanceof TaxonomyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/taxonomy/articles/[id]/topics] PUT error:", e);
    return NextResponse.json({ error: "Failed to update article topics." }, { status: 500 });
  }
}
