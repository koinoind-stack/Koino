import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireContributor } from "@/lib/apologetics-server";
import { canonicalizeBibleRef } from "@/lib/bible-ref";

const APOLOGETICS_CATEGORIES = [
  "God & Existence", "Jesus Christ", "Resurrection", "Bible", "Science & Faith",
  "Suffering & Evil", "Morality & Ethics", "Other Worldviews", "Doubt & Faith",
  "Culture & Christianity", "Salvation",
];

function coerceString(raw: unknown): string | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function coerceTags(raw: unknown): string {
  if (raw == null) return "[]";
  let arr: string[] = [];
  if (Array.isArray(raw)) {
    arr = raw.map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim())).filter(Boolean);
  } else if (typeof raw === "string") {
    arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return JSON.stringify(arr.slice(0, 10).map((t) => t.slice(0, 40)));
}

function canonicalizeRefs(raw: unknown): { refs: string[] } | { error: string } {
  if (raw == null) return { refs: [] };
  const list = Array.isArray(raw)
    ? raw.map((v) => (typeof v === "string" ? v : String(v ?? "")))
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const refs: string[] = [];
  for (const item of list) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const result = canonicalizeBibleRef(trimmed);
    if ("error" in result) return { error: `Bible reference "${trimmed}": ${result.error}` };
    if (!refs.includes(result.canonical)) refs.push(result.canonical);
    if (refs.length >= 20) break;
  }
  return { refs };
}

/**
 * PATCH /api/contributor/articles/[id] — edit the contributor's OWN article.
 *
 * Editable only while status ∈ { draft, submitted, changes_requested }.
 * Published / rejected / archived articles are admin-managed (403).
 *
 * Special transitions:
 *  - status "submitted" → sends/resends for review (clears nothing; admin's
 *    reviewNotes stay visible until an admin acts)
 *  - status "draft" → back to a private draft
 * Contributors can NEVER set status to published/approved/rejected/archived.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireContributor("CAN_WRITE_ARTICLES");
    if (guard.response) return guard.response;
    const contributor = guard.contributor;

    const { id } = await params;
    const existing = await db.koinoArticle.findUnique({ where: { id } });
    if (!existing || existing.contentType !== "APOLOGETICS") {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    // OWNERSHIP + server-side authorization: the article must belong to this
    // contributor. This is the check that keeps contributors out of other
    // people's (and admin-created) articles.
    if (existing.authorId !== contributor.id) {
      return NextResponse.json({ error: "This article belongs to another contributor" }, { status: 403 });
    }

    const editableStatuses = ["draft", "submitted", "changes_requested"];
    if (!editableStatuses.includes(existing.status)) {
      return NextResponse.json(
        { error: `Articles with status "${existing.status}" can only be edited by an admin` },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: any = {};

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const t = typeof body.title === "string" ? body.title.trim() : "";
      if (!t || t.length > 300) {
        return NextResponse.json({ error: "Title is required (max 300 chars)" }, { status: 400 });
      }
      data.title = t;
    }
    if (Object.prototype.hasOwnProperty.call(body, "content")) {
      const c = typeof body.content === "string" ? body.content : "";
      if (!c.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 });
      if (c.length > 200_000) return NextResponse.json({ error: "Content is too long" }, { status: 400 });
      data.content = c;
    }
    if (Object.prototype.hasOwnProperty.call(body, "category")) {
      const category = coerceString(body.category);
      if (category && !APOLOGETICS_CATEGORIES.includes(category)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
      data.category = category;
    }
    if (Object.prototype.hasOwnProperty.call(body, "subcategory")) data.subcategory = coerceString(body.subcategory);
    if (Object.prototype.hasOwnProperty.call(body, "excerpt")) data.excerpt = coerceString(body.excerpt)?.slice(0, 500) ?? null;
    if (Object.prototype.hasOwnProperty.call(body, "shortAnswer")) data.shortAnswer = coerceString(body.shortAnswer)?.slice(0, 2000) ?? null;
    if (Object.prototype.hasOwnProperty.call(body, "coverImageUrl")) data.coverImageUrl = coerceString(body.coverImageUrl);
    if (Object.prototype.hasOwnProperty.call(body, "difficulty")) {
      const d = coerceString(body.difficulty);
      if (d && !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(d)) {
        return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
      }
      data.difficulty = d;
    }
    if (Object.prototype.hasOwnProperty.call(body, "tags")) data.tags = coerceTags(body.tags);

    if (Object.prototype.hasOwnProperty.call(body, "bibleRefs")) {
      const refs = canonicalizeRefs(body.bibleRefs);
      if ("error" in refs) return NextResponse.json({ error: refs.error }, { status: 400 });
      data.bibleRefs = JSON.stringify(refs.refs);
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const raw = typeof body.status === "string" ? body.status.toLowerCase() : "";
      if (raw === "submitted" || raw === "draft") {
        data.status = raw;
        if (raw === "submitted") {
          data.reviewedAt = new Date();
        }
      } else if (raw !== existing.status) {
        return NextResponse.json(
          { error: "Contributors can only set status to draft or submitted — publishing is done by admins" },
          { status: 403 }
        );
      }
    }

    const updated = await db.koinoArticle.update({ where: { id }, data });

    try { revalidatePath("/", "layout"); } catch {}

    return NextResponse.json({
      success: true,
      article: { id: updated.id, slug: updated.slug, status: updated.status },
    });
  } catch (error: any) {
    console.error("[api/contributor/articles/[id] PATCH] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update article" }, { status: 500 });
  }
}
