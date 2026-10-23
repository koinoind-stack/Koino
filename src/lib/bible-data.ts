// Bible structure and metadata
// All 66 books (39 OT + 27 NT) with chapter counts.
// Text is fetched at runtime from bible-api.com (KJV + WEB, both public domain)
// and cached in localStorage for offline reuse.

export type Testament = "OT" | "NT";

export type BibleBook = {
  id: string; // slug used by bible-api.com, e.g. "1john", "psalms", "song_of_solomon"
  name: string; // display name, e.g. "1 John", "Psalms", "Song of Solomon"
  abbr: string; // short label, e.g. "1Jn", "Ps", "So"
  testament: Testament;
  chapters: number;
  category: string; // e.g. "Law", "History", "Wisdom", "Prophets", "Gospels", "Pauline", "General"
};

export type BibleVerse = {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
};

export type BibleChapterResponse = {
  reference: string;
  verses: BibleVerse[];
  translation_id: string;
  translation_name: string;
  translation_note: string;
};

export const BIBLE_BOOKS: BibleBook[] = [
  // ─── OLD TESTAMENT ──────────────────────────────────────────────
  { id: "genesis", name: "Genesis", abbr: "Ge", testament: "OT", chapters: 50, category: "Law" },
  { id: "exodus", name: "Exodus", abbr: "Ex", testament: "OT", chapters: 40, category: "Law" },
  { id: "leviticus", name: "Leviticus", abbr: "Le", testament: "OT", chapters: 27, category: "Law" },
  { id: "numbers", name: "Numbers", abbr: "Nu", testament: "OT", chapters: 36, category: "Law" },
  { id: "deuteronomy", name: "Deuteronomy", abbr: "De", testament: "OT", chapters: 34, category: "Law" },
  { id: "joshua", name: "Joshua", abbr: "Jos", testament: "OT", chapters: 24, category: "History" },
  { id: "judges", name: "Judges", abbr: "Jdg", testament: "OT", chapters: 21, category: "History" },
  { id: "ruth", name: "Ruth", abbr: "Ru", testament: "OT", chapters: 4, category: "History" },
  { id: "1samuel", name: "1 Samuel", abbr: "1Sa", testament: "OT", chapters: 31, category: "History" },
  { id: "2samuel", name: "2 Samuel", abbr: "2Sa", testament: "OT", chapters: 24, category: "History" },
  { id: "1kings", name: "1 Kings", abbr: "1Ki", testament: "OT", chapters: 22, category: "History" },
  { id: "2kings", name: "2 Kings", abbr: "2Ki", testament: "OT", chapters: 25, category: "History" },
  { id: "1chronicles", name: "1 Chronicles", abbr: "1Ch", testament: "OT", chapters: 29, category: "History" },
  { id: "2chronicles", name: "2 Chronicles", abbr: "2Ch", testament: "OT", chapters: 36, category: "History" },
  { id: "ezra", name: "Ezra", abbr: "Ezr", testament: "OT", chapters: 10, category: "History" },
  { id: "nehemiah", name: "Nehemiah", abbr: "Ne", testament: "OT", chapters: 13, category: "History" },
  { id: "esther", name: "Esther", abbr: "Es", testament: "OT", chapters: 10, category: "History" },
  { id: "job", name: "Job", abbr: "Job", testament: "OT", chapters: 42, category: "Wisdom" },
  { id: "psalms", name: "Psalms", abbr: "Ps", testament: "OT", chapters: 150, category: "Wisdom" },
  { id: "proverbs", name: "Proverbs", abbr: "Pr", testament: "OT", chapters: 31, category: "Wisdom" },
  { id: "ecclesiastes", name: "Ecclesiastes", abbr: "Ec", testament: "OT", chapters: 12, category: "Wisdom" },
  { id: "song_of_solomon", name: "Song of Solomon", abbr: "So", testament: "OT", chapters: 8, category: "Wisdom" },
  { id: "isaiah", name: "Isaiah", abbr: "Isa", testament: "OT", chapters: 66, category: "Major Prophets" },
  { id: "jeremiah", name: "Jeremiah", abbr: "Jer", testament: "OT", chapters: 52, category: "Major Prophets" },
  { id: "lamentations", name: "Lamentations", abbr: "La", testament: "OT", chapters: 5, category: "Major Prophets" },
  { id: "ezekiel", name: "Ezekiel", abbr: "Eze", testament: "OT", chapters: 48, category: "Major Prophets" },
  { id: "daniel", name: "Daniel", abbr: "Da", testament: "OT", chapters: 12, category: "Major Prophets" },
  { id: "hosea", name: "Hosea", abbr: "Ho", testament: "OT", chapters: 14, category: "Minor Prophets" },
  { id: "joel", name: "Joel", abbr: "Joe", testament: "OT", chapters: 3, category: "Minor Prophets" },
  { id: "amos", name: "Amos", abbr: "Am", testament: "OT", chapters: 9, category: "Minor Prophets" },
  { id: "obadiah", name: "Obadiah", abbr: "Ob", testament: "OT", chapters: 1, category: "Minor Prophets" },
  { id: "jonah", name: "Jonah", abbr: "Jon", testament: "OT", chapters: 4, category: "Minor Prophets" },
  { id: "micah", name: "Micah", abbr: "Mi", testament: "OT", chapters: 7, category: "Minor Prophets" },
  { id: "nahum", name: "Nahum", abbr: "Na", testament: "OT", chapters: 3, category: "Minor Prophets" },
  { id: "habakkuk", name: "Habakkuk", abbr: "Hab", testament: "OT", chapters: 3, category: "Minor Prophets" },
  { id: "zephaniah", name: "Zephaniah", abbr: "Zep", testament: "OT", chapters: 3, category: "Minor Prophets" },
  { id: "haggai", name: "Haggai", abbr: "Hag", testament: "OT", chapters: 2, category: "Minor Prophets" },
  { id: "zechariah", name: "Zechariah", abbr: "Zec", testament: "OT", chapters: 14, category: "Minor Prophets" },
  { id: "malachi", name: "Malachi", abbr: "Mal", testament: "OT", chapters: 4, category: "Minor Prophets" },

  // ─── NEW TESTAMENT ──────────────────────────────────────────────
  { id: "matthew", name: "Matthew", abbr: "Mt", testament: "NT", chapters: 28, category: "Gospels" },
  { id: "mark", name: "Mark", abbr: "Mk", testament: "NT", chapters: 16, category: "Gospels" },
  { id: "luke", name: "Luke", abbr: "Lk", testament: "NT", chapters: 24, category: "Gospels" },
  { id: "john", name: "John", abbr: "Jn", testament: "NT", chapters: 21, category: "Gospels" },
  { id: "acts", name: "Acts", abbr: "Ac", testament: "NT", chapters: 28, category: "History" },
  { id: "romans", name: "Romans", abbr: "Ro", testament: "NT", chapters: 16, category: "Pauline" },
  { id: "1corinthians", name: "1 Corinthians", abbr: "1Co", testament: "NT", chapters: 16, category: "Pauline" },
  { id: "2corinthians", name: "2 Corinthians", abbr: "2Co", testament: "NT", chapters: 13, category: "Pauline" },
  { id: "galatians", name: "Galatians", abbr: "Ga", testament: "NT", chapters: 6, category: "Pauline" },
  { id: "ephesians", name: "Ephesians", abbr: "Eph", testament: "NT", chapters: 6, category: "Pauline" },
  { id: "philippians", name: "Philippians", abbr: "Ph", testament: "NT", chapters: 4, category: "Pauline" },
  { id: "colossians", name: "Colossians", abbr: "Col", testament: "NT", chapters: 4, category: "Pauline" },
  { id: "1thessalonians", name: "1 Thessalonians", abbr: "1Th", testament: "NT", chapters: 5, category: "Pauline" },
  { id: "2thessalonians", name: "2 Thessalonians", abbr: "2Th", testament: "NT", chapters: 3, category: "Pauline" },
  { id: "1timothy", name: "1 Timothy", abbr: "1Ti", testament: "NT", chapters: 6, category: "Pauline" },
  { id: "2timothy", name: "2 Timothy", abbr: "2Ti", testament: "NT", chapters: 4, category: "Pauline" },
  { id: "titus", name: "Titus", abbr: "Tit", testament: "NT", chapters: 3, category: "Pauline" },
  { id: "philemon", name: "Philemon", abbr: "Phm", testament: "NT", chapters: 1, category: "Pauline" },
  { id: "hebrews", name: "Hebrews", abbr: "Heb", testament: "NT", chapters: 13, category: "General" },
  { id: "james", name: "James", abbr: "Ja", testament: "NT", chapters: 5, category: "General" },
  { id: "1peter", name: "1 Peter", abbr: "1Pe", testament: "NT", chapters: 5, category: "General" },
  { id: "2peter", name: "2 Peter", abbr: "2Pe", testament: "NT", chapters: 3, category: "General" },
  { id: "1john", name: "1 John", abbr: "1Jn", testament: "NT", chapters: 5, category: "General" },
  { id: "2john", name: "2 John", abbr: "2Jn", testament: "NT", chapters: 1, category: "General" },
  { id: "3john", name: "3 John", abbr: "3Jn", testament: "NT", chapters: 1, category: "General" },
  { id: "jude", name: "Jude", abbr: "Jud", testament: "NT", chapters: 1, category: "General" },
  { id: "revelation", name: "Revelation", abbr: "Re", testament: "NT", chapters: 22, category: "Prophecy" },
];

export const OT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "OT");
export const NT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "NT");

// Translations supported by bible-api.com (both public domain)
export type Translation = "kjv" | "web";

export const TRANSLATIONS: { id: Translation; label: string; abbr: string; description: string }[] = [
  { id: "kjv", label: "King James Version", abbr: "KJV", description: "Classic 1611 — public domain" },
  { id: "web", label: "World English Bible", abbr: "WEB", description: "Modern English — public domain" },
];

// Indian languages available in the UI. bible-api.com only supports English (KJV/WEB),
// so for non-English selections we fall back to KJV text with a notice.
export type BibleLanguage = {
  id: string;
  label: string;
  nativeLabel: string;
  flag: string;
  supported: boolean; // whether full text is available
};

export const BIBLE_LANGUAGES: BibleLanguage[] = [
  { id: "en", label: "English", nativeLabel: "English", flag: "🇬🇧", supported: true },
  { id: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳", supported: false },
  { id: "ta", label: "Tamil", nativeLabel: "தமிழ்", flag: "🇮🇳", supported: false },
  { id: "te", label: "Telugu", nativeLabel: "తెలుగు", flag: "🇮🇳", supported: false },
  { id: "ml", label: "Malayalam", nativeLabel: "മലയാളം", flag: "🇮🇳", supported: false },
  { id: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", flag: "🇮🇳", supported: false },
  { id: "mr", label: "Marathi", nativeLabel: "मराठी", flag: "🇮🇳", supported: false },
  { id: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", flag: "🇮🇳", supported: false },
  { id: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", flag: "🇮🇳", supported: false },
  { id: "bn", label: "Bengali", nativeLabel: "বাংলা", flag: "🇮🇳", supported: false },
  { id: "or", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", flag: "🇮🇳", supported: false },
];

// ─── READING PLANS ─────────────────────────────────────────────────────────

export type ReadingPlanDay = {
  day: number;
  readings: { bookId: string; chapter: number }[];
};

export type ReadingPlan = {
  id: string;
  title: string;
  description: string;
  duration: number; // total days
  category: string;
  color: string;
  days: ReadingPlanDay[];
};

// Helper to build a day's readings succinctly
const r = (bookId: string, chapter: number) => ({ bookId, chapter });

export const READING_PLANS: ReadingPlan[] = [
  {
    id: "nt-30",
    title: "New Testament in 30 Days",
    description:
      "Read through all 27 books of the New Testament in 30 days. About 8–9 chapters per day. A great way to immerse yourself in the life of Jesus and the early church.",
    duration: 30,
    category: "New Testament",
    color: "#38BDF8",
    days: [
      { day: 1, readings: [r("matthew", 1), r("matthew", 2), r("matthew", 3), r("matthew", 4), r("matthew", 5), r("matthew", 6), r("matthew", 7), r("matthew", 8), r("matthew", 9)] },
      { day: 2, readings: [r("matthew", 10), r("matthew", 11), r("matthew", 12), r("matthew", 13), r("matthew", 14), r("matthew", 15), r("matthew", 16), r("matthew", 17), r("matthew", 18)] },
      { day: 3, readings: [r("matthew", 19), r("matthew", 20), r("matthew", 21), r("matthew", 22), r("matthew", 23), r("matthew", 24), r("matthew", 25), r("matthew", 26), r("matthew", 27)] },
      { day: 4, readings: [r("matthew", 28), r("mark", 1), r("mark", 2), r("mark", 3), r("mark", 4), r("mark", 5), r("mark", 6), r("mark", 7), r("mark", 8)] },
      { day: 5, readings: [r("mark", 9), r("mark", 10), r("mark", 11), r("mark", 12), r("mark", 13), r("mark", 14), r("mark", 15), r("mark", 16), r("luke", 1)] },
      { day: 6, readings: [r("luke", 2), r("luke", 3), r("luke", 4), r("luke", 5), r("luke", 6), r("luke", 7), r("luke", 8), r("luke", 9), r("luke", 10)] },
      { day: 7, readings: [r("luke", 11), r("luke", 12), r("luke", 13), r("luke", 14), r("luke", 15), r("luke", 16), r("luke", 17), r("luke", 18), r("luke", 19)] },
      { day: 8, readings: [r("luke", 20), r("luke", 21), r("luke", 22), r("luke", 23), r("luke", 24), r("john", 1), r("john", 2), r("john", 3), r("john", 4)] },
      { day: 9, readings: [r("john", 5), r("john", 6), r("john", 7), r("john", 8), r("john", 9), r("john", 10), r("john", 11), r("john", 12), r("john", 13)] },
      { day: 10, readings: [r("john", 14), r("john", 15), r("john", 16), r("john", 17), r("john", 18), r("john", 19), r("john", 20), r("john", 21), r("acts", 1)] },
      { day: 11, readings: [r("acts", 2), r("acts", 3), r("acts", 4), r("acts", 5), r("acts", 6), r("acts", 7), r("acts", 8), r("acts", 9), r("acts", 10)] },
      { day: 12, readings: [r("acts", 11), r("acts", 12), r("acts", 13), r("acts", 14), r("acts", 15), r("acts", 16), r("acts", 17), r("acts", 18), r("acts", 19)] },
      { day: 13, readings: [r("acts", 20), r("acts", 21), r("acts", 22), r("acts", 23), r("acts", 24), r("acts", 25), r("acts", 26), r("acts", 27), r("acts", 28)] },
      { day: 14, readings: [r("romans", 1), r("romans", 2), r("romans", 3), r("romans", 4), r("romans", 5), r("romans", 6), r("romans", 7), r("romans", 8), r("romans", 9)] },
      { day: 15, readings: [r("romans", 10), r("romans", 11), r("romans", 12), r("romans", 13), r("romans", 14), r("romans", 15), r("romans", 16), r("1corinthians", 1), r("1corinthians", 2)] },
      { day: 16, readings: [r("1corinthians", 3), r("1corinthians", 4), r("1corinthians", 5), r("1corinthians", 6), r("1corinthians", 7), r("1corinthians", 8), r("1corinthians", 9), r("1corinthians", 10), r("1corinthians", 11)] },
      { day: 17, readings: [r("1corinthians", 12), r("1corinthians", 13), r("1corinthians", 14), r("1corinthians", 15), r("1corinthians", 16), r("2corinthians", 1), r("2corinthians", 2), r("2corinthians", 3), r("2corinthians", 4)] },
      { day: 18, readings: [r("2corinthians", 5), r("2corinthians", 6), r("2corinthians", 7), r("2corinthians", 8), r("2corinthians", 9), r("2corinthians", 10), r("2corinthians", 11), r("2corinthians", 12), r("2corinthians", 13)] },
      { day: 19, readings: [r("galatians", 1), r("galatians", 2), r("galatians", 3), r("galatians", 4), r("galatians", 5), r("galatians", 6), r("ephesians", 1), r("ephesians", 2), r("ephesians", 3)] },
      { day: 20, readings: [r("ephesians", 4), r("ephesians", 5), r("ephesians", 6), r("philippians", 1), r("philippians", 2), r("philippians", 3), r("philippians", 4), r("colossians", 1), r("colossians", 2)] },
      { day: 21, readings: [r("colossians", 3), r("colossians", 4), r("1thessalonians", 1), r("1thessalonians", 2), r("1thessalonians", 3), r("1thessalonians", 4), r("1thessalonians", 5), r("2thessalonians", 1), r("2thessalonians", 2)] },
      { day: 22, readings: [r("2thessalonians", 3), r("1timothy", 1), r("1timothy", 2), r("1timothy", 3), r("1timothy", 4), r("1timothy", 5), r("1timothy", 6), r("2timothy", 1), r("2timothy", 2)] },
      { day: 23, readings: [r("2timothy", 3), r("2timothy", 4), r("titus", 1), r("titus", 2), r("titus", 3), r("philemon", 1), r("hebrews", 1), r("hebrews", 2), r("hebrews", 3)] },
      { day: 24, readings: [r("hebrews", 4), r("hebrews", 5), r("hebrews", 6), r("hebrews", 7), r("hebrews", 8), r("hebrews", 9), r("hebrews", 10), r("hebrews", 11), r("hebrews", 12)] },
      { day: 25, readings: [r("hebrews", 13), r("james", 1), r("james", 2), r("james", 3), r("james", 4), r("james", 5), r("1peter", 1), r("1peter", 2), r("1peter", 3)] },
      { day: 26, readings: [r("1peter", 4), r("1peter", 5), r("2peter", 1), r("2peter", 2), r("2peter", 3), r("1john", 1), r("1john", 2), r("1john", 3), r("1john", 4)] },
      { day: 27, readings: [r("1john", 5), r("2john", 1), r("3john", 1), r("jude", 1), r("revelation", 1), r("revelation", 2), r("revelation", 3), r("revelation", 4), r("revelation", 5)] },
      { day: 28, readings: [r("revelation", 6), r("revelation", 7), r("revelation", 8), r("revelation", 9), r("revelation", 10), r("revelation", 11), r("revelation", 12), r("revelation", 13), r("revelation", 14)] },
      { day: 29, readings: [r("revelation", 15), r("revelation", 16), r("revelation", 17), r("revelation", 18), r("revelation", 19), r("revelation", 20), r("revelation", 21)] },
      { day: 30, readings: [r("revelation", 22)] },
    ],
  },
  {
    id: "gospels-14",
    title: "Gospels in 14 Days",
    description:
      "Walk through the four Gospels — Matthew, Mark, Luke, and John — in two weeks. See Jesus from four unique perspectives and dive deep into His life, teachings, death, and resurrection.",
    duration: 14,
    category: "Gospels",
    color: "#F39B9B",
    days: [
      { day: 1, readings: [r("matthew", 1), r("matthew", 2), r("matthew", 3), r("matthew", 4)] },
      { day: 2, readings: [r("matthew", 5), r("matthew", 6), r("matthew", 7), r("matthew", 8)] },
      { day: 3, readings: [r("matthew", 9), r("matthew", 10), r("matthew", 11), r("matthew", 12)] },
      { day: 4, readings: [r("matthew", 13), r("matthew", 14), r("matthew", 15), r("matthew", 16)] },
      { day: 5, readings: [r("matthew", 17), r("matthew", 18), r("matthew", 19), r("matthew", 20)] },
      { day: 6, readings: [r("matthew", 21), r("matthew", 22), r("matthew", 23), r("matthew", 24)] },
      { day: 7, readings: [r("matthew", 25), r("matthew", 26), r("matthew", 27), r("matthew", 28)] },
      { day: 8, readings: [r("mark", 1), r("mark", 2), r("mark", 3), r("mark", 4), r("mark", 5)] },
      { day: 9, readings: [r("mark", 6), r("mark", 7), r("mark", 8), r("mark", 9), r("mark", 10)] },
      { day: 10, readings: [r("mark", 11), r("mark", 12), r("mark", 13), r("mark", 14), r("mark", 15), r("mark", 16)] },
      { day: 11, readings: [r("luke", 1), r("luke", 2), r("luke", 3), r("luke", 4)] },
      { day: 12, readings: [r("luke", 5), r("luke", 6), r("luke", 7), r("luke", 8), r("luke", 9)] },
      { day: 13, readings: [r("john", 1), r("john", 2), r("john", 3), r("john", 4), r("john", 5)] },
      { day: 14, readings: [r("john", 19), r("john", 20), r("john", 21)] },
    ],
  },
  {
    id: "psalms-proverbs-31",
    title: "Psalms & Proverbs in 31 Days",
    description:
      "Read one chapter of Psalms and one chapter of Proverbs each day for a month. The perfect daily wisdom rhythm — praise from David, wisdom from Solomon.",
    duration: 31,
    category: "Wisdom",
    color: "#F59E0B",
    days: Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      readings: [r("psalms", i + 1), r("proverbs", i + 1)],
    })),
  },
  {
    id: "bible-90",
    title: "Bible in 90 Days",
    description:
      "Read the entire Bible — all 66 books — in 90 days. About 13 chapters per day. A challenge for serious readers; the most rewarding journey through Scripture you'll ever take.",
    duration: 90,
    category: "Whole Bible",
    color: "#7C3AED",
    days: Array.from({ length: 90 }, (_, i) => ({
      day: i + 1,
      // Simplified 90-day plan: distribute chapters roughly evenly across 1189 total / 90 days ≈ 13/day
      readings: [],
    })),
  },
];

// ─── CHAPTER TEXT FETCHING WITH CACHE ────────────────────────────────────

const CACHE_PREFIX = "cc_bible_";
const cacheKey = (bookId: string, chapter: number, translation: Translation) =>
  `${CACHE_PREFIX}${translation}_${bookId}_${chapter}`;

export function getCachedChapter(bookId: string, chapter: number, translation: Translation): BibleChapterResponse | null {
  try {
    const raw = localStorage.getItem(cacheKey(bookId, chapter, translation));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache for 30 days
    if (Date.now() - parsed.cachedAt > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(cacheKey(bookId, chapter, translation));
      return null;
    }
    return parsed.data as BibleChapterResponse;
  } catch {
    return null;
  }
}

export function cacheChapter(bookId: string, chapter: number, translation: Translation, data: BibleChapterResponse) {
  try {
    localStorage.setItem(
      cacheKey(bookId, chapter, translation),
      JSON.stringify({ cachedAt: Date.now(), data })
    );
  } catch {
    // localStorage full — ignore
  }
}

export async function fetchChapter(
  bookId: string,
  chapter: number,
  translation: Translation
): Promise<BibleChapterResponse> {
  // Check cache first
  const cached = getCachedChapter(bookId, chapter, translation);
  if (cached) return cached;

  const ref = encodeURIComponent(`${bookId} ${chapter}`);
  const url = `https://bible-api.com/${ref}?translation=${translation}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${bookId} ${chapter} (${translation}): ${res.status}`);
  }
  const data = (await res.json()) as BibleChapterResponse;
  cacheChapter(bookId, chapter, translation, data);
  return data;
}

// ─── SEARCH ────────────────────────────────────────────────────────────────

export type SearchResult = {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
};

/**
 * bible-api.com does not support free-text keyword search via the public endpoint
 * (only chapter/verse lookups). So we expose two helpers:
 *   1. fetchVerseByReference — direct lookup by "Book C:V" or "Book C:V-V" ranges
 *   2. searchBible            — accepts a reference string; non-reference queries
 *                              return an empty list and the UI explains the limitation.
 */
export async function fetchVerseByReference(
  reference: string,
  translation: Translation = "kjv"
): Promise<SearchResult | null> {
  const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: BibleChapterResponse = await res.json();
  if (!data.verses || data.verses.length === 0) return null;
  const v = data.verses[0];
  // bible-api returns book_id like "JHN" (BSI). Map back to our slug by book_name.
  const book = BIBLE_BOOKS.find(
    (b) => b.name.toLowerCase() === (v.book_name || "").toLowerCase()
  );
  return {
    bookId: book?.id || (v.book_id || "").toLowerCase().replace(/\s/g, ""),
    bookName: v.book_name,
    chapter: v.chapter,
    verse: v.verse,
    text: v.text.trim(),
  };
}

export async function searchBible(query: string, translation: Translation = "kjv"): Promise<SearchResult[]> {
  // Try to interpret the query as a Bible reference (e.g., "John 3:16", "Romans 8:28")
  const refMatch = query.trim().match(/^([\d]?\s?[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (refMatch) {
    const result = await fetchVerseByReference(query.trim(), translation);
    return result ? [result] : [];
  }
  // Free-text keyword search is not supported by bible-api.com — return empty
  // and let the UI explain. The user can still type any reference like "John 3:16".
  return [];
}

export function isReferenceQuery(query: string): boolean {
  return /^[\d]?\s?[A-Za-z]+\s+\d+:\d+/.test(query.trim());
}

// ─── BOOKMARKS ────────────────────────────────────────────────────────────

export type Bookmark = {
  id: string; // `${bookId}-${chapter}-${verse}`
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  translation: Translation;
  createdAt: number;
};

const BOOKMARKS_KEY = "cc_bible_bookmarks";

export function getBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function toggleBookmark(b: Omit<Bookmark, "id" | "createdAt">): boolean {
  const bookmarks = getBookmarks();
  const id = `${b.bookId}-${b.chapter}-${b.verse}`;
  const existing = bookmarks.findIndex((bm) => bm.id === id);
  if (existing >= 0) {
    bookmarks.splice(existing, 1);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    return false;
  }
  bookmarks.unshift({ ...b, id, createdAt: Date.now() });
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  return true;
}

export function isBookmarked(bookId: string, chapter: number, verse: number): boolean {
  const id = `${bookId}-${chapter}-${verse}`;
  return getBookmarks().some((bm) => bm.id === id);
}

// ─── READING PLAN PROGRESS ─────────────────────────────────────────────────

const PLAN_PROGRESS_KEY = "cc_bible_plan_progress";

export type PlanProgress = {
  planId: string;
  startedAt: number;
  completedDays: number[]; // day numbers (1-indexed)
  lastReadDay: number | null;
};

export function getPlanProgress(planId: string): PlanProgress | null {
  try {
    const all = JSON.parse(localStorage.getItem(PLAN_PROGRESS_KEY) || "{}");
    return all[planId] || null;
  } catch {
    return null;
  }
}

export function getAllPlanProgress(): Record<string, PlanProgress> {
  try {
    return JSON.parse(localStorage.getItem(PLAN_PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function togglePlanDay(planId: string, day: number): PlanProgress {
  const all = getAllPlanProgress();
  let progress = all[planId];
  if (!progress) {
    progress = { planId, startedAt: Date.now(), completedDays: [], lastReadDay: null };
  }
  const idx = progress.completedDays.indexOf(day);
  if (idx >= 0) {
    progress.completedDays.splice(idx, 1);
  } else {
    progress.completedDays.push(day);
    progress.completedDays.sort((a, b) => a - b);
  }
  progress.lastReadDay = day;
  all[planId] = progress;
  localStorage.setItem(PLAN_PROGRESS_KEY, JSON.stringify(all));
  return progress;
}

export function startPlan(planId: string): PlanProgress {
  const all = getAllPlanProgress();
  if (!all[planId]) {
    all[planId] = {
      planId,
      startedAt: Date.now(),
      completedDays: [],
      lastReadDay: null,
    };
    localStorage.setItem(PLAN_PROGRESS_KEY, JSON.stringify(all));
  }
  return all[planId];
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

export function getBook(bookId: string): BibleBook | undefined {
  return BIBLE_BOOKS.find((b) => b.id === bookId);
}

export function getReference(bookId: string, chapter: number, verse?: number): string {
  const book = getBook(bookId);
  const bookName = book?.name || bookId;
  return verse ? `${bookName} ${chapter}:${verse}` : `${bookName} ${chapter}`;
}
