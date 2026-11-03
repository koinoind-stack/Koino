import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { reorderTaxonomy } from "@/lib/taxonomy-server";

/**
 * Admin Taxonomy panel — batch topic reorder (Plan v2 §2.4).
 *
 * POST /api/admin/taxonomy/topics/reorder — body { ids: string[] } in the
 * desired display order; array position becomes sortOrder (1-based). Unknown
 * ids are rejected — no silent partial reorders.
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

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const body = await req.json().catch(() => null);
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Provide the ordered id list." },
        { status: 400 }
      );
    }
    const updated = await reorderTaxonomy("topic", parsed.data.ids);
    return NextResponse.json({ success: true, updated });
  } catch (e: any) {
    console.error("[admin/taxonomy/topics/reorder] POST error:", e);
    return NextResponse.json({ error: "Failed to reorder topics." }, { status: 500 });
  }
}
