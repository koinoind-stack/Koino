import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { isVideoCategory, isVideoLanguage, parseYouTubeId, youtubeThumbnail, youtubeWatchUrl } from "@/lib/videos";

/**
 * Admin: single video entry.
 *
 * GET    /api/admin/videos/[id] — full row incl. bibleRefs (edit form).
 * PATCH  /api/admin/videos/[id] — edit any field, replace bibleRefs
 *        (bibleRefs present in the body = full replacement), publish/unpublish.
 * DELETE /api/admin/videos/[id] — delete the entry (refs/progress/saves
 *        cascade; posts keep existing via ON DELETE SET NULL).
 */

function parseJsonStringArray(v: unknown, max: number): string[] | null {
  if (v == null) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter((x): x is string => typeof x === "string").slice(0, max);
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").slice(0, max);
  return null;
}

type RefInput = { bookId?: unknown; chapterStart?: unknown; verseStart?: unknown; chapterEnd?: unknown; verseEnd?: unknown };

function parseBibleRefs(v: unknown): { bookId: string; chapterStart: number; verseStart: number | null; chapterEnd: number | null; verseEnd: number | null }[] | null {
  if (v == null) return [];
  if (!Array.isArray(v)) return null;
  const out: { bookId: string; chapterStart: number; verseStart: number | null; chapterEnd: number | null; verseEnd: number | null }[] = [];
  for (const raw of v as RefInput[]) {
    const bookId = typeof raw?.bookId === "string" ? raw.bookId.trim() : "";
    const cs = Number(raw?.chapterStart);
    if (!bookId || !Number.isInteger(cs) || cs < 1 || cs > 150) return null;
    const num = (x: unknown): number | null => {
      if (x == null || x === "") return null;
      const n = Number(x);
      return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : null;
    };
    const ce = num(raw?.chapterEnd);
    const vs = num(raw?.verseStart);
    const ve = num(raw?.verseEnd);
    if (ce && ce < cs) return null;
    out.push({ bookId, chapterStart: cs, verseStart: vs, chapterEnd: ce, verseEnd: ve });
    if (out.length >= 20) break;
  }
  return out;
}

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;
    const { id } = await params;

    const video = await db.video.findUnique({
      where: { id },
      include: {
        bibleRefs: {
          orderBy: [{ bookId: "asc" }, { chapterStart: "asc" }],
        },
      },
    });
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    return NextResponse.json({ video });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ error: "The video library is not ready yet" }, { status: 503 });
    }
    console.error("[admin/videos/id] get failed:", err);
    return NextResponse.json({ error: "Could not load the video" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const existing = await db.video.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (title.length < 2 || title.length > 150) {
        return NextResponse.json({ error: "Title must be 2–150 characters" }, { status: 400 });
      }
      data.title = title;
    }
    if (typeof body.category === "string") {
      if (!isVideoCategory(body.category)) {
        return NextResponse.json({ error: "Please choose a valid category" }, { status: 400 });
      }
      data.category = body.category;
    }
    if (typeof body.language === "string") {
      if (!isVideoLanguage(body.language)) {
        return NextResponse.json({ error: "Unknown language code" }, { status: 400 });
      }
      data.language = body.language;
    }
    if (body.youtubeUrlOrId !== undefined) {
      const youtubeId = parseYouTubeId(String(body.youtubeUrlOrId || ""));
      if (!youtubeId) {
        return NextResponse.json({ error: "Please paste a valid YouTube URL or video id" }, { status: 400 });
      }
      data.youtubeId = youtubeId;
      data.canonicalUrl = youtubeWatchUrl(youtubeId);
      // Refresh the auto thumbnail unless a custom one is being kept.
      if (!body.thumbnailUrl) data.thumbnailUrl = youtubeThumbnail(youtubeId);
    }
    if (body.subtitleLanguages !== undefined) {
      const subs = parseJsonStringArray(body.subtitleLanguages, 13);
      if (subs === null) return NextResponse.json({ error: "Invalid subtitle list" }, { status: 400 });
      for (const c of subs) if (!isVideoLanguage(c)) return NextResponse.json({ error: `Unknown language: ${c}` }, { status: 400 });
      data.subtitleLanguages = JSON.stringify(subs);
    }
    if (body.dubLanguages !== undefined) {
      const dubs = parseJsonStringArray(body.dubLanguages, 13);
      if (dubs === null) return NextResponse.json({ error: "Invalid dub list" }, { status: 400 });
      for (const c of dubs) if (!isVideoLanguage(c)) return NextResponse.json({ error: `Unknown language: ${c}` }, { status: 400 });
      data.dubLanguages = JSON.stringify(dubs);
    }
    if (body.durationSec !== undefined) {
      if (body.durationSec === null) data.durationSec = null;
      else {
        const n = Number(body.durationSec);
        if (!Number.isFinite(n) || n < 0 || n > 24 * 3600) {
          return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
        }
        data.durationSec = Math.floor(n);
      }
    }
    const str = (key: string, max: number): string | null | undefined => {
      if (body[key] === undefined) return undefined;
      const v = body[key];
      if (v === null) return null;
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t ? t.slice(0, max) : null;
    };
    const summary = str("summary", 300);
    if (summary !== undefined) data.summary = summary;
    const description = str("description", 10000);
    if (description !== undefined) data.description = description;
    const thumbnailUrl = str("thumbnailUrl", 600);
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl;
    const contentWarning = str("contentWarning", 300);
    if (contentWarning !== undefined) data.contentWarning = contentWarning;
    const sourceName = str("sourceName", 200);
    if (sourceName !== undefined) data.sourceName = sourceName;
    const rightsNote = str("rightsNote", 2000);
    if (rightsNote !== undefined) data.rightsNote = rightsNote;
    const originalLanguage = str("originalLanguage", 20);
    if (originalLanguage !== undefined) data.originalLanguage = originalLanguage;

    if (body.featured !== undefined) data.featured = body.featured === true;
    if (body.embeddable !== undefined) data.embeddable = body.embeddable !== false;

    // Status transitions: publish/unpublish/draft are admin-managed here
    // (the library is admin-curated content, unlike memorials).
    if (typeof body.status === "string") {
      if (!["draft", "published", "unpublished"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = body.status;
      if (body.status === "published" && existing.status !== "published") {
        data.publishedAt = new Date();
      }
    }

    const refs = body.bibleRefs === undefined ? undefined : parseBibleRefs(body.bibleRefs);
    if (refs === null) {
      return NextResponse.json({ error: "Invalid Bible reference rows" }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.video.update({
        where: { id },
        data,
        select: { id: true, slug: true, status: true },
      });
      if (refs !== undefined) {
        await tx.videoBibleRef.deleteMany({ where: { videoId: id } });
        if (refs.length) {
          await tx.videoBibleRef.createMany({ data: refs.map((r) => ({ ...r, videoId: id })) });
        }
      }
      return row;
    });

    return NextResponse.json({ success: true, video: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ error: "The video library is not ready yet" }, { status: 503 });
    }
    if (code === "P2025") return NextResponse.json({ error: "Video not found" }, { status: 404 });
    console.error("[admin/videos/id] patch failed:", err);
    return NextResponse.json({ error: "Could not update the video" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;
    const { id } = await params;
    await db.video.delete({ where: { id }, select: { id: true } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ error: "The video library is not ready yet" }, { status: 503 });
    }
    if (code === "P2025") return NextResponse.json({ error: "Video not found" }, { status: 404 });
    console.error("[admin/videos/id] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the video" }, { status: 500 });
  }
}
