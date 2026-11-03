// ─────────────────────────────────────────────────────────────────────────────
// Articles & Knowledge — Phase 2: static taxonomy module (Plan v2 §2.5)
// ─────────────────────────────────────────────────────────────────────────────
// This module is DEMOTED by design. After Phase 2 it holds exactly three
// things and nothing more:
//   (a) SEED DATA consumed by `prisma/scripts/seed-taxonomy.ts`
//   (b) SERVER-SIDE VALIDATION ENUMS (the six content types, slug rules)
//   (c) DEFAULTS for new articles
// It is NOT the runtime source of topic or category lists: every picker,
// filter and public page reads the DATABASE through `src/lib/taxonomy-server.ts`.
// Static constants may validate and default; they no longer define.
// (The legacy `BLOG_CATEGORIES` in src/lib/blog.ts and `APOLOGETICS_TOPICS`
// in src/lib/crosscrafted-data.ts remain untouched fallbacks until the
// Phase 4/6 cutovers — see Plan v2 §2.4 backward-compatibility note.)

// ─── (b) Content types — the fixed six-value list (Plan v2 Table 3) ─────────

export const CONTENT_TYPES = [
  "BLOG", // member-written articles (assigned to every imported BlogPost in Phase 3)
  "ARTICLE", // general knowledge and feature articles
  "BIBLE_STUDY", // structured studies (bibleRefs support already fits)
  "DEVOTIONAL", // short-form devotional writing
  "TESTIMONY", // personal testimony — the value added by the v2 revision
  "APOLOGETICS", // today's exercised type; Q&A linkage preserved
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  BLOG: "Blog",
  ARTICLE: "Article",
  BIBLE_STUDY: "Bible Study",
  DEVOTIONAL: "Devotional",
  TESTIMONY: "Testimony",
  APOLOGETICS: "Apologetics",
};

export function isContentType(value: unknown): value is ContentType {
  return (
    typeof value === "string" &&
    (CONTENT_TYPES as readonly string[]).includes(value)
  );
}

/** Public routes that already exist per content type (Phase 2 foundation).
 *  Types without a unified public route yet surface as "coming soon". */
export const CONTENT_TYPE_ROUTES: Partial<Record<ContentType, string>> = {
  BLOG: "/blog",
  APOLOGETICS: "/apologetics",
};

// ─── (b) Slug rules — shared by admin taxonomy APIs and the seed ─────────────

export const SLUG_MAX_LENGTH = 80;

/** URL-safe slugs only: lowercase alphanumerics separated by single hyphens,
 *  no leading/trailing hyphen. Admin-editable but always validated. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= SLUG_MAX_LENGTH &&
    SLUG_PATTERN.test(value)
  );
}

/** Best-effort slugifier for admin convenience — output is ALWAYS re-validated
 *  with isValidSlug before use; the admin sees and can edit the result. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[''`]/g, "") // strip apostrophes (God's → gods-existence)
    .replace(/&/g, " and ") // "&" → "and" (labels keep "&", slugs use "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

// ─── (a) Seed data — six canonical categories, in review order (Plan v2 §2.3)

export interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  iconKey: string;
  sortOrder: number;
}

export const CATEGORY_SEED: CategorySeed[] = [
  {
    name: "Apologetics",
    slug: "apologetics",
    description: "Reasons for faith — answering hard questions about God, Scripture and worldviews.",
    iconKey: "ShieldCheck",
    sortOrder: 1,
  },
  {
    name: "Bible Study",
    slug: "bible-study",
    description: "Structured studies through books, passages and themes of Scripture.",
    iconKey: "BookOpen",
    sortOrder: 2,
  },
  {
    name: "Christian Living",
    slug: "christian-living",
    description: "Everyday discipleship — faith at home, at work and in community.",
    iconKey: "Heart",
    sortOrder: 3,
  },
  {
    name: "Church and Ministry",
    slug: "church-and-ministry",
    description: "Serving, leadership and the life of the local church.",
    iconKey: "Church",
    sortOrder: 4,
  },
  {
    name: "Community",
    slug: "community",
    description: "Stories and news from the Koino community and the wider church.",
    iconKey: "Users",
    sortOrder: 5,
  },
  {
    name: "Prayer and Encouragement",
    slug: "prayer-and-encouragement",
    description: "Prayer, testimony and words that lift the soul.",
    iconKey: "HeartHandshake",
    sortOrder: 6,
  },
];

// ─── (a) Seed data — topics, legacy ids preserved (Plan v2 Tables 5+6) ───────
// The six existing SPA topic ids (src/lib/crosscrafted-data.ts APOLOGETICS_TOPICS)
// are preserved EXACTLY — same key, same color; labels refined per the review.
// The five new apologetics topics come from the 11 legacy apologetics category
// labels (ApologeticsTab.tsx); Forgiveness is the review's non-apologetics
// example under Christian Living.

export interface TopicSeed {
  name: string;
  slug: string;
  /** Six preserved SPA ids; null for new topics. */
  legacyKey: string | null;
  parentCategorySlug: string;
  color: string | null;
  description: string;
  sortOrder: number;
}

export const TOPIC_SEED: TopicSeed[] = [
  // Six existing SPA topics — ids (legacyKey) and colors preserved exactly.
  {
    name: "God's Existence",
    slug: "gods-existence",
    legacyKey: "gods_existence",
    parentCategorySlug: "apologetics",
    color: "#A855F7",
    description: "Cosmological, teleological, moral and experiential arguments for God.",
    sortOrder: 1,
  },
  {
    name: "Problem of Evil",
    slug: "problem-of-evil",
    legacyKey: "problem_of_evil",
    parentCategorySlug: "apologetics",
    color: "#EF4444",
    description: "Why a good and powerful God allows suffering — theodicy and defense.",
    sortOrder: 2,
  },
  {
    name: "Resurrection of Jesus",
    slug: "resurrection-of-jesus",
    legacyKey: "resurrection",
    parentCategorySlug: "apologetics",
    color: "#22C55E",
    description: "Historical evidence and meaning of the resurrection.",
    sortOrder: 3,
  },
  {
    name: "Bible Reliability",
    slug: "bible-reliability",
    legacyKey: "bible_reliability",
    parentCategorySlug: "apologetics",
    color: "#3B82F6",
    description: "Manuscripts, canon, transmission and trustworthiness of Scripture.",
    sortOrder: 4,
  },
  {
    name: "Science & Faith",
    slug: "science-faith",
    legacyKey: "science_faith",
    parentCategorySlug: "apologetics",
    color: "#F59E0B",
    description: "Origins, fine-tuning, evolution and the harmony of science and faith.",
    sortOrder: 5,
  },
  {
    name: "World Religions",
    slug: "world-religions",
    legacyKey: "world_religions",
    parentCategorySlug: "apologetics",
    color: "#EC4899",
    description: "Comparing worldviews — Christianity among the religions.",
    sortOrder: 6,
  },
  // New topics from the 11 legacy apologetics categories (Table 5).
  {
    name: "Jesus Christ",
    slug: "jesus-christ",
    legacyKey: null,
    parentCategorySlug: "apologetics",
    color: null,
    description: "The identity, claims, life and work of Jesus of Nazareth.",
    sortOrder: 7,
  },
  {
    name: "Morality & Ethics",
    slug: "morality-ethics",
    legacyKey: null,
    parentCategorySlug: "apologetics",
    color: null,
    description: "Objective morality, ethics and the moral law.",
    sortOrder: 8,
  },
  {
    name: "Doubt & Faith",
    slug: "doubt-faith",
    legacyKey: null,
    parentCategorySlug: "apologetics",
    color: null,
    description: "Walking through doubt — faith that asks questions honestly.",
    sortOrder: 9,
  },
  {
    name: "Culture & Christianity",
    slug: "culture-christianity",
    legacyKey: null,
    parentCategorySlug: "apologetics",
    color: null,
    description: "Faith in the public square — culture, media and modern life.",
    sortOrder: 10,
  },
  {
    name: "Salvation",
    slug: "salvation",
    legacyKey: null,
    parentCategorySlug: "apologetics",
    color: null,
    description: "Grace, the gospel, and what it means to be saved.",
    sortOrder: 11,
  },
  // Review example under Christian Living (parent movable by admin any time).
  {
    name: "Forgiveness",
    slug: "forgiveness",
    legacyKey: null,
    parentCategorySlug: "christian-living",
    color: null,
    description: "Receiving and extending forgiveness — with God and with people.",
    sortOrder: 12,
  },
];

/** The six legacy keys that MUST exist in the seed — pinned by tests. */
export const LEGACY_TOPIC_KEYS = [
  "gods_existence",
  "problem_of_evil",
  "resurrection",
  "bible_reliability",
  "science_faith",
  "world_religions",
] as const;

// ─── (c) Defaults for new articles ───────────────────────────────────────────

/** Content type assigned to unified articles whose type is not otherwise
 *  determined (the Phase 3 import assigns BLOG to every BlogPost row). */
export const DEFAULT_CONTENT_TYPE: ContentType = "ARTICLE";

/** Default language code for new unified articles (Plan v2 Table 7). */
export const DEFAULT_ARTICLE_LANGUAGE = "en";

/** Taxonomy picker ceiling — topics selectable per article (soft guard). */
export const MAX_TOPICS_PER_ARTICLE = 10;
