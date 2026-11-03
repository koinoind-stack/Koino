// ─────────────────────────────────────────────────────────────────────────────
// Articles & Knowledge — Phase 2: taxonomy server (Plan v2 §2.5)
// ─────────────────────────────────────────────────────────────────────────────
// The SINGLE runtime source of category/topic data. Every picker, filter and
// public page reads the database through this module — never the static seed
// in content-taxonomy.ts (which validates and defaults only).
// All writes go through here too so invariants (slug uniqueness, inactive
// assignment guards, cascade shape) live in ONE place.

import { db } from "@/lib/db";
import {
  MAX_TOPICS_PER_ARTICLE,
  isValidSlug,
  slugify,
} from "@/lib/content-taxonomy";

/** Typed error the admin APIs map straight onto HTTP responses. */
export class TaxonomyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ─── Public reads (landing page, pickers, filters) ───────────────────────────

/** Active categories in admin-defined order — the public browsing spine. */
export function listActiveCategories() {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconKey: true,
      imageUrl: true,
    },
  });
}

/** Active topics with their parent category — picker + navigation chips.
 *  Deactivated topics are EXCLUDED here but still resolve for existing
 *  associations (they are soft-deleted, never rewritten). */
export function listActiveTopics() {
  return db.topic.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      legacyKey: true,
      parentCategory: {
        select: { id: true, name: true, slug: true, iconKey: true },
      },
    },
  });
}

/** Topics grouped under their active parent category — the landing page's
 *  category → topic navigation. Never throws on an empty taxonomy (fresh
 *  installs pre-seed): returns empty arrays so the page renders its
 *  "no categories yet" state instead of 500ing. */
export async function getTaxonomyLanding() {
  const categories = await listActiveCategories();
  const topics = await listActiveTopics();
  const byCategory = new Map<string, typeof topics>();
  for (const t of topics) {
    const list = byCategory.get(t.parentCategory.id) ?? [];
    list.push(t);
    byCategory.set(t.parentCategory.id, list);
  }
  return categories.map((c) => ({ ...c, topics: byCategory.get(c.id) ?? [] }));
}

/** Legacy-key resolver — the bridge the Q&A pipeline will use in later
 *  phases: `UserQuestion.category` stores legacy ids (gods_existence …). */
export function resolveTopicByLegacyKey(legacyKey: string) {
  return db.topic.findUnique({ where: { legacyKey } });
}

// ─── Admin reads (Taxonomy panel) ────────────────────────────────────────────

export function listAllCategoriesAdmin() {
  return db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { topics: true, articles: true } },
    },
  });
}

export function listAllTopicsAdmin() {
  return db.topic.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parentCategory: { select: { id: true, name: true, slug: true } },
      _count: { select: { articles: true } },
    },
  });
}

// ─── Slug helpers ────────────────────────────────────────────────────────────

/** Validated + de-duplicated slug for a category/topic. Throws 400 on an
 *  explicitly provided but malformed slug; slugifies names otherwise. */
export function buildSlug(name: string, provided?: unknown): string {
  if (provided !== undefined && provided !== null && provided !== "") {
    if (typeof provided !== "string" || !isValidSlug(provided)) {
      throw new TaxonomyError(
        "Invalid slug — use lowercase letters, numbers and single hyphens (e.g. \"problem-of-evil\").",
        400
      );
    }
    return provided;
  }
  const generated = slugify(name);
  if (!isValidSlug(generated)) {
    throw new TaxonomyError(
      "Could not derive a valid slug from the name — provide one explicitly.",
      400
    );
  }
  return generated;
}

/** Uniqueness across BOTH taxonomy tables (a topic and a category sharing a
 *  slug would collide in future unified URLs). `excludeId` supports edits. */
export async function assertSlugAvailable(
  slug: string,
  excludeId?: string
): Promise<void> {
  const [category, topic] = await Promise.all([
    db.category.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } }),
    db.topic.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } }),
  ]);
  if (category || topic) {
    throw new TaxonomyError(`Slug "${slug}" is already in use.`, 409);
  }
}

// ─── Article ↔ topic associations ────────────────────────────────────────────

export async function getArticleTopicIds(articleId: string): Promise<string[]> {
  const rows = await db.articleTopic.findMany({
    where: { articleId },
    select: { topicId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.topicId);
}

/** Replace-set the topics of an article (admin capability, Plan v2 §2.4).
 *  Guards: article must exist; every topic must exist AND be active —
 *  deactivated topics cannot be NEWLY assigned (existing associations are
 *  preserved untouched; removing is always allowed). */
export async function setArticleTopics(
  articleId: string,
  topicIds: string[]
): Promise<string[]> {
  if (topicIds.length > MAX_TOPICS_PER_ARTICLE) {
    throw new TaxonomyError(
      `An article can carry at most ${MAX_TOPICS_PER_ARTICLE} topics.`,
      400
    );
  }
  const unique = [...new Set(topicIds)];
  const article = await db.koinoArticle.findUnique({
    where: { id: articleId },
    select: { id: true },
  });
  if (!article) throw new TaxonomyError("Article not found.", 404);

  const topics = await db.topic.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, isActive: true },
  });
  if (topics.length !== unique.length) {
    throw new TaxonomyError("One or more topics do not exist.", 400);
  }
  const inactive = topics.filter((t) => !t.isActive).map((t) => t.name);
  if (inactive.length > 0) {
    throw new TaxonomyError(
      `These topics are deactivated and cannot be newly assigned: ${inactive.join(", ")}.`,
      409
    );
  }
  await db.$transaction(async (tx) => {
    await tx.articleTopic.deleteMany({ where: { articleId } });
    if (unique.length > 0) {
      await tx.articleTopic.createMany({
        data: unique.map((topicId) => ({ articleId, topicId })),
      });
    }
  });
  return unique;
}

// ─── Reorder (batch sortOrder update, Plan v2 §2.4) ──────────────────────────

/** Apply admin-defined order: the array position becomes sortOrder. Unknown
 *  ids are rejected (no silent partial reorders). */
export async function reorderTaxonomy(
  kind: "category" | "topic",
  ids: string[]
): Promise<number> {
  if (ids.length === 0) throw new TaxonomyError("Provide the ordered id list.", 400);
  const known =
    kind === "category"
      ? await db.category.findMany({ where: { id: { in: ids } }, select: { id: true } })
      : await db.topic.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (known.length !== ids.length) {
    throw new TaxonomyError("One or more ids do not exist.", 400);
  }
  await db.$transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      const data = { sortOrder: i + 1 };
      if (kind === "category") {
        await tx.category.update({ where: { id: ids[i] }, data });
      } else {
        await tx.topic.update({ where: { id: ids[i] }, data });
      }
    }
  });
  return ids.length;
}
