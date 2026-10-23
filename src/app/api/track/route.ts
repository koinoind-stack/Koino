import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/track
 * Simple analytics event tracker. Non-blocking, non-authenticated.
 * Currently logs to console — can be connected to a real analytics system later.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body.event;
    const source = body.source || "unknown";
    // In production, this would write to an analytics table/service
    // For now, just acknowledge
    return NextResponse.json({ tracked: true });
  } catch {
    return NextResponse.json({ tracked: false }, { status: 200 });
  }
}
