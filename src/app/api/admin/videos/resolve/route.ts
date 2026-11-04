import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { parseYouTubeId, youtubeThumbnail, youtubeWatchUrl } from "@/lib/videos";

/**
 * Admin: resolve a pasted YouTube URL/ID against YouTube's official oEmbed
 * endpoint (no API key, no scraping, no downloading). Used by the admin form's
 * "Fetch from YouTube" button to prefill title/author/thumbnail.
 *
 * POST /api/admin/videos/resolve { url }
 *   200 { ok: true, youtubeId, title, author, thumbnailUrl, watchUrl, embeddable }
 *   400 { ok: false, reason: "invalid" }         — not a YouTube URL/id
 *   404 { ok: false, reason: "not_found" }       — deleted/private video
 *   403 { ok: false, reason: "embedding_disabled" } — owner disabled embedding
 *   502 { ok: false, reason: "youtube_unreachable" } — network failure
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  const youtubeId = parseYouTubeId(url);
  if (!youtubeId) {
    return NextResponse.json(
      { ok: false, reason: "invalid", error: "Please paste a valid YouTube URL or 11-character video id" },
      { status: 400 },
    );
  }

  const watchUrl = youtubeWatchUrl(youtubeId);
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (res.status === 404 || res.status === 400) {
      return NextResponse.json({
        ok: false,
        reason: "not_found",
        error: "YouTube reports this video as unavailable (deleted, private, or the id is wrong)",
      }, { status: 404 });
    }
    if (res.status === 401 || res.status === 403) {
      // Known YouTube oEmbed behavior: embedding disabled by the owner.
      return NextResponse.json({
        ok: false,
        reason: "embedding_disabled",
        error: "The owner of this video does not allow it to be embedded. You can still add it as a link-out entry.",
      }, { status: 403 });
    }
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        reason: "youtube_unreachable",
        error: "YouTube could not be reached — try again in a moment",
      }, { status: 502 });
    }
    const meta = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return NextResponse.json({
      ok: true,
      youtubeId,
      title: meta.title || "",
      author: meta.author_name || "",
      thumbnailUrl: meta.thumbnail_url || youtubeThumbnail(youtubeId),
      watchUrl,
      embeddable: true,
    });
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === "TimeoutError";
    console.error("[admin/videos/resolve] oEmbed failed:", aborted ? "timeout" : err);
    return NextResponse.json({
      ok: false,
      reason: "youtube_unreachable",
      error: "YouTube could not be reached — try again in a moment",
    }, { status: 502 });
  }
}
