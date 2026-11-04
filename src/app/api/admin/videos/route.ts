import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  isVideoCategory, isVideoLanguage, parseYouTubeId,
  slugifyTitle, youtubeThumbnail, youtubeWatchUrl,
} from "@/lib/videos";

/**
 * Admin: Video Library management (Part 5).
 *
 * GET  /api/admin/videos?status=&q= — list ALL videos (any status) with
 *      pending report counts. Admin only.
 * POST /api/admin/videos — create a video entry (draft or published).
 *      Body: { title, youtubeUrlOrId | youtubeId, category, language,
 *              summary?, description?, durationSec?, subtitleLanguages?,
 *              dubLanguages?, originalLanguage?, contentWarning?, sourceName?,
 *              rightsNote?, thumbnailUrl?, bibleRefs?, status?, featured? }
 *      Validation: title 2–150, valid category/language codes, YouTube id
 *      parseable. Bible refs are stored as separate rows (VideoBibleRef).
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
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string").slice(0, max);
  }
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

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const status = ["draft", "published", "unpublished"].includes(statusParam || "") ? statusParam! : null;

    const where: Record<string, unknown> = {};
    if (q) where.title = { contains: q, mode: "insensitive" };
    if (status) where.status = status;

    const rows = await db.video.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, slug: true, title: true, summary: true, thumbnailUrl: true,
        youtubeId: true, durationSec: true, category: true, language: true,
        status: true, featured: true, embeddable: true, viewCount: true,
        createdAt: true, publishedAt: true,
        _count: { select: { bibleRefs: true, saves: true } },
      },
    });

    const reportCounts = await db.report.groupBy({
      by: ["targetId"],
      where: { targetType: "video", status: "pending" },
      _count: { id: true },
    });
    const reportMap = new Map(reportCounts.map((r) => [r.targetId, r._count.id]));

    return NextResponse.json({
      videos: rows.map((v) => ({
        ...v,
        pendingReports: reportMap.get(v.id) || 0,
      })),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ videos: [] });
    }
    console.error("[admin/videos] list failed:", err);
    return NextResponse.json({ error: "Could not load videos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (title.length < 2 || title.length > 150) {
      return NextResponse.json({ error: "Title must be 2–150 characters" }, { status: 400 });
    }
    const category = typeof body?.category === "string" ? body.category : "";
    if (!isVideoCategory(category)) {
      return NextResponse.json({ error: "Please choose a valid category" }, { status: 400 });
    }
    const language = typeof body?.language === "string" && body.language ? body.language : "en";
    if (!isVideoLanguage(language)) {
      return NextResponse.json({ error: "Unknown language code" }, { status: 400 });
    }

    const urlInput = typeof body?.youtubeUrlOrId === "string" ? body.youtubeUrlOrId : "";
    const youtubeId = parseYouTubeId(urlInput);
    if (!youtubeId) {
      return NextResponse.json(
        { error: "Please paste a valid YouTube URL or 11-character video id" },
        { status: 400 },
      );
    }

    const subs = parseJsonStringArray(body?.subtitleLanguages, 13);
    const dubs = parseJsonStringArray(body?.dubLanguages, 13);
    if (subs === null || dubs === null) {
      return NextResponse.json({ error: "Invalid language list" }, { status: 400 });
    }
    for (const code of [...subs, ...dubs]) {
      if (!isVideoLanguage(code)) {
        return NextResponse.json({ error: `Unknown language in list: ${code}` }, { status: 400 });
      }
    }

    const refs = parseBibleRefs(body?.bibleRefs);
    if (refs === null) {
      return NextResponse.json({ error: "Invalid Bible reference rows" }, { status: 400 });
    }

    const durationSec = body?.durationSec == null ? null : Number(body.durationSec);
    if (durationSec != null && (!Number.isFinite(durationSec) || durationSec < 0 || durationSec > 24 * 3600)) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }

    const status = body?.status === "published" ? "published" : "draft";
    const str = (key: string, max: number): string | null => {
      const v = body?.[key];
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t ? t.slice(0, max) : null;
    };

    const created = await db.$transaction(async (tx) => {
      const row = await tx.video.create({
        data: {
          slug: slugifyTitle(title),
          title,
          summary: str("summary", 300),
          description: str("description", 10000),
          source: "youtube",
          youtubeId,
          canonicalUrl: youtubeWatchUrl(youtubeId),
          thumbnailUrl: str("thumbnailUrl", 600) || youtubeThumbnail(youtubeId),
          durationSec: durationSec != null ? Math.floor(durationSec) : null,
          category,
          language,
          subtitleLanguages: JSON.stringify(subs),
          dubLanguages: JSON.stringify(dubs),
          originalLanguage: str("originalLanguage", 20),
          contentWarning: str("contentWarning", 300),
          status,
          featured: body?.featured === true,
          sourceName: str("sourceName", 200),
          rightsNote: str("rightsNote", 2000),
          createdById: user.id,
          publishedAt: status === "published" ? new Date() : null,
        },
        select: { id: true, slug: true, status: true },
      });
      if (refs.length) {
        await tx.videoBibleRef.createMany({
          data: refs.map((r) => ({ ...r, videoId: row.id })),
        });
      }
      return row;
    });

    return NextResponse.json({ success: true, video: created }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        { error: "The video library is not ready yet — the database tables need to be created first" },
        { status: 503 },
      );
    }
    console.error("[admin/videos] create failed:", err);
    return NextResponse.json({ error: "Could not create the video" }, { status: 500 });
  }
}
