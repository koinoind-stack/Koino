import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/comic/share/[panelId]?lang=hi&format=square
 *
 * Legacy comic panel share-card endpoint (Task 87). Since Task 121 the
 * universal generator lives at /api/share-card — this route is a thin
 * redirect so any existing bookmarks/integrations keep working while ALL
 * card rendering flows through ONE pipeline (no duplicated generators).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ panelId: string }> }
) {
  const { panelId } = await params;
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") || "en";
  const format = url.searchParams.get("format") || "square";

  const target = new URL(`/api/share-card`, url.origin);
  target.searchParams.set("type", "comic-panel");
  target.searchParams.set("panel", panelId);
  target.searchParams.set("lang", lang);
  target.searchParams.set("format", format);
  return NextResponse.redirect(target, 307);
}
