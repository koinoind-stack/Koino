import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/videos/[slug]/share — share a library video to the feed.
 *
 * EXPLICIT consent (same model as memorial announcements): the user presses
 * "Share to feed" on the watch page. Nothing is auto-published. Creates a
 * published Post linked via Post.videoId so the feed card renders a
 * thumbnail + title + "Watch Now" banner instead of flooding the feed with
 * separate video posts.
 *
 * Body: { caption? } — optional caption (≤500 chars).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`video-share:${me.id}`, 10, 60 * 60 * 1000)) {
    return jsonError("Too many shares — try again later", 429);
  }

  let caption: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.caption === "string" && body.caption.trim()) {
      caption = body.caption.trim().slice(0, 500);
    }
  } catch {
    // no body — use the default share text
  }

  try {
    const video = await db.video.findUnique({
      where: { slug },
      select: { id: true, title: true, summary: true, status: true, category: true },
    });
    if (!video || video.status !== "published") return jsonError("Video not found", 404);

    const content = caption || `Watching "${video.title}" — a blessed watch for every believer.`;

    const post = await db.post.create({
      data: {
        content,
        published: true,
        authorId: me.id,
        mediaType: "text",
        videoId: video.id,
      },
      select: { id: true },
    });
    return Response.json({ success: true, postId: post.id }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022" || code === "P2025") {
      return jsonError("Video not found", 404);
    }
    console.error("[videos/share] failed:", err);
    return jsonError("Could not share the video", 500);
  }
}
