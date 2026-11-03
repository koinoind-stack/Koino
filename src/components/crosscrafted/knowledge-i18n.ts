import type { ContentType } from "@/lib/content-taxonomy";

// Dictionary-key mapping for the six unified content types. The English
// labels in content-taxonomy.ts stay canonical for admin panels and SEO
// metadata; public pages render localized labels through the i18n
// dictionaries via this map.
export const KNOWLEDGE_TYPE_KEYS: Record<ContentType, { label: string; desc: string }> = {
  BLOG: { label: "knowledge.type.blog", desc: "knowledge.type.blog.desc" },
  ARTICLE: { label: "knowledge.type.article", desc: "knowledge.type.article.desc" },
  BIBLE_STUDY: { label: "knowledge.type.bibleStudy", desc: "knowledge.type.bibleStudy.desc" },
  DEVOTIONAL: { label: "knowledge.type.devotional", desc: "knowledge.type.devotional.desc" },
  TESTIMONY: { label: "knowledge.type.testimony", desc: "knowledge.type.testimony.desc" },
  APOLOGETICS: { label: "knowledge.type.apologetics", desc: "knowledge.type.apologetics.desc" },
};
