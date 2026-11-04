import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { canView, memorialRole } from "@/lib/memorials";
import { extractYouTubeId, isMemorialVideoCategory } from "@/lib/youtube";

/**
 * GET  /api/memorials/[id]/videos — approved videos for the public; ALL
 *      statuses (incl. pending/rejected) only for managers/admins. Pending
 *      videos are NEVER exposed through public responses.
 * POST /api/memorials/[id]/videos — memorial managers add a YouTube video.
 *      Body: { url, title, description?, category? }
 *      The URL is validated server-side and only the extracted 11-char video
 *      id is stored for embedding — arbitrary iframe HTML / scripts are
 *      rejected. New videos stay "pending" until an admin approves them.
 */
const MAX_VIDEOS_PER_MEMORIAL = 30;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  const viewer = session.user;

  try {
    const m = await db.memorial.findUnique({
      where: { id },
      select: { status: true, visibility: true },
    });
    if (!m) return jsonError("Memorial not found", 404);
    const role = await memorialRole(id, viewer?.id);
    const isAdmin = viewer?.role === "admin";
    if (!canView(m, role, isAdmin)) return jsonError("Memorial not found", 404);

    const rows = await db.memorialVideo.findMany({
      where: { memorialId: id, ...(role || isAdmin ? {} : { status: "approved" }) },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true, videoId: true, title: true, description: true,
        category: true, status: true, rejectionReason: true,
        addedByName: true, createdAt: true,
      },
    });
    return Response.json({ videos: rows });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/videos] list failed:", err);
    return jsonError("Could not load the videos", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Sign in to add a video", 401);
  const me = session.user;

  if (!rateLimit(`memorial-video:${me.id}`, 20, 60 * 60 * 1000)) {
    return jsonError("Too many video submissions — try again later", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  // Only memorial managers (or admins) may add videos.
  const role = await memorialRole(id, me.id);
  if (!role && me.role !== "admin") {
    return jsonError("Only the memorial managers can add videos", 403);
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) return jsonError("Please paste the YouTube link");
  const videoId = extractYouTubeId(rawUrl);
  if (!videoId) {
    return jsonError(
      "That is not a valid YouTube video link. Use a youtube.com/watch, youtu.be, or YouTube Shorts link.",
    );
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 150) : "";
  if (title.length < 2) return jsonError("Please enter a video title");

  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 1000) || null : null;
  const categoryInput = typeof body.category === "string" ? body.category : "other";
  const category = isMemorialVideoCategory(categoryInput) ? categoryInput : "other";

  try {
    const m = await db.memorial.findUnique({ where: { id }, select: { id: true } });
    if (!m) return jsonError("Memorial not found", 404);

    const count = await db.memorialVideo.count({ where: { memorialId: id } });
    if (count >= MAX_VIDEOS_PER_MEMORIAL) {
      return jsonError(`This memorial already has the maximum of ${MAX_VIDEOS_PER_MEMORIAL} videos`, 409);
    }

    const author = await db.user.findUnique({
      where: { id: me.id },
      select: { name: true, username: true },
    });

    const video = await db.memorialVideo.create({
      data: {
        memorialId: id,
        videoId,
        url: rawUrl.slice(0, 500), // audit trail — embeds rebuild from videoId
        title,
        description,
        category,
        status: "pending",
        addedById: me.id,
        addedByName: author?.name || author?.username || "Family",
      },
      select: { id: true, videoId: true, status: true },
    });
    return Response.json(
      { success: true, video, message: "Video submitted — it will appear once a Koino admin approves it" },
      { status: 201 },
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return jsonError("Memorial not found", 404);
    console.error("[memorials/videos] create failed:", err);
    return jsonError("Could not add the video", 500);
  }
}
