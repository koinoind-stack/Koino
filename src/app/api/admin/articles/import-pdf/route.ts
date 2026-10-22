import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { extractPdfText } from "@/lib/pdf/extract-pdf-text";

const db = new PrismaClient();

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB

export const runtime = "nodejs";

// ─── Admin auth helper ────────────────────────────────────────────────────
async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (user.role !== "admin") return { user: null, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  return { user, response: null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input.toString().toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "").replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 80);
}

async function generateUniqueSlug(base: string): Promise<string> {
  const root = base || "article";
  let candidate = root;
  let n = 2;
  while (n < 22) {
    const existing = await db.koinoArticle.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
  return `${root}-${Date.now()}`;
}

// ─── Bible reference detection ────────────────────────────────────────────
const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "Samuel", "Kings", "Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalm", "Psalms", "Proverbs", "Ecclesiastes",
  "Song of Solomon", "Song of Songs", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "Corinthians",
  "Galatians", "Ephesians", "Philippians", "Colossians", "Thessalonians",
  "Timothy", "Titus", "Philemon", "Hebrews", "James", "Peter", "Jude",
  "Revelation",
];

const BIBLE_REF_REGEX = new RegExp(
  `\\b(?:[1-3]\\s)?(?:${BIBLE_BOOKS.join("|")})\\s+\\d+(?::\\d+(?:-\\d+)?)?`, "gi"
);

function detectBibleRefs(text: string): string[] {
  const matches = text.match(BIBLE_REF_REGEX) || [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of matches) {
    const ref = raw.replace(/\s+/g, " ").trim();
    const key = ref.toLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(ref); }
  }
  return result;
}

// ─── PDF text cleanup ─────────────────────────────────────────────────────
function cleanupPdfText(rawText: string): {
  title: string;
  content: string;
  excerpt: string;
} {
  const lines = rawText.split(/\r?\n/);
  const cleanedLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d{1,4}$/.test(trimmed)) continue;
    if (/^page\s+\d+\s+(of\s+\d+)?$/i.test(trimmed)) continue;
    cleanedLines.push(line);
  }
  let content = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  let title = "";
  const firstLineMatch = content.match(/^\s*([^\n]+)/);
  if (firstLineMatch) {
    const firstLine = firstLineMatch[1].trim();
    if (firstLine.length > 0 && firstLine.length <= 120 && !/[.;]$/.test(firstLine)) {
      title = firstLine;
      content = content.slice(firstLineMatch[0].length).replace(/^\n+/, "").trim();
    }
  }
  if (!title) title = "Imported PDF Article";
  const flat = content.replace(/\s+/g, " ").trim();
  const excerpt = flat.slice(0, 200).trim() + (flat.length > 200 ? "…" : "");
  return { title, content, excerpt };
}

// ─── Stage logger ─────────────────────────────────────────────────────────
// Emits a single line per stage so Vercel logs are easy to grep.
function logStage(stage: string, extra?: Record<string, unknown>) {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[PDF IMPORT] ${stage}`, extra);
  } else {
    console.log(`[PDF IMPORT] ${stage}`);
  }
}

// ─── POST /api/admin/articles/import-pdf ──────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { user } = auth;

  try {
    // 1. Parse multipart form data.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Expected multipart/form-data with a 'file' field." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided. Upload a PDF using the 'file' field." }, { status: 400 });
    }

    // 2. Validate type / extension / size.
    const isValidMime = file.type === "application/pdf" || file.type === "application/octet-stream" || file.type === "";
    if (!isValidMime) {
      return NextResponse.json({ error: `File must be a PDF (got MIME type: ${file.type}).` }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must have a .pdf extension." }, { status: 400 });
    }
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: "PDF must be under 20 MB." }, { status: 400 });
    }

    // 3. Read PDF into a Buffer.
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    if (pdfBuffer.length === 0) {
      return NextResponse.json({ error: "PDF buffer is empty — the file may not have uploaded correctly." }, { status: 400 });
    }

    // 4. Extract text using pdf-parse (PRIMARY step).
    //    The helper module guarantees import order:
    //      1. pdf-parse/worker  (installs globalThis.DOMMatrix / Path2D / ImageData)
    //      2. pdf-parse         (evaluates PDFParse safely)
    //      3. new PDFParse({ data, CanvasFactory })
    let rawText: string;
    try {
      const extracted = await extractPdfText(pdfBuffer, logStage);
      rawText = extracted.text;
    } catch (e: any) {
      console.error("[PDF IMPORT] FAILURE", {
        stage: "TEXT_EXTRACTION",
        name: e instanceof Error ? e.name : typeof e,
        message: e instanceof Error ? e.message : String(e),
      });
      return NextResponse.json({ error: "PDF processing failed on the server. Please try again." }, { status: 500 });
    }

    // 5. Check for scanned / image-only PDFs.
    const totalText = rawText.replace(/\s+/g, " ").trim();
    if (totalText.length < 100) {
      return NextResponse.json({
        error: "This PDF appears to be scanned or image-based. Text could not be extracted automatically.",
        scanned: true,
      }, { status: 400 });
    }

    // 6. Clean up text + derive title / excerpt / Bible refs.
    const { title, content, excerpt } = cleanupPdfText(rawText);
    const bibleRefs = detectBibleRefs(content);

    // 7. Cover image: best-effort, does NOT block article creation.
    //    Cover generation from PDF first-page rendering is disabled on Vercel.
    //    Admin uploads cover manually via the existing ImageUploader in the article editor.
    const coverImageUrl: string | null = null;

    // 8. Generate a unique slug from the title.
    const baseSlug = slugify(title) || "imported-pdf-article";
    const slug = await generateUniqueSlug(baseSlug);

    // 9. Author name.
    const authorName = user.name?.trim() || "Koino";

    // 10. Create the KoinoArticle as a DRAFT.
    logStage("creating article");
    const created = await db.koinoArticle.create({
      data: {
        title,
        slug,
        contentType: "APOLOGETICS",
        content,
        excerpt: excerpt || null,
        coverImageUrl,
        authorName,
        status: "draft",
        difficulty: "BEGINNER",
        bibleRefs: JSON.stringify(bibleRefs),
        reviewedBy: user.id,
        reviewedAt: new Date(),
        seoTitle: title,
        seoDescription: excerpt || null,
      },
    });
    logStage("article created", { articleId: created.id, slug: created.slug });

    // 11. Revalidate.
    try { revalidatePath("/", "layout"); } catch {}

    return NextResponse.json({
      success: true,
      articleId: created.id,
      coverGenerated: false,
      message: "PDF imported successfully. Upload a cover image manually in the editor if needed.",
    }, { status: 201 });
  } catch (e: any) {
    console.error("[PDF IMPORT] FAILURE", {
      stage: "UNKNOWN",
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: e?.message || "Failed to import PDF" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: "Method not allowed — use POST" }, { status: 405 });
}
