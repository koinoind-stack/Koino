import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * GET /api/churches/[id]/events — upcoming PUBLISHED events linked to this
 * church. The Event model stores the church as a free-text name
 * (Event.church), so the connection is a case-insensitive name match on
 * the published church — honest and data-driven: when no event names this
 * church, the list is simply empty (nothing invented).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const church = await db.church.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });
    if (!church || church.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Church not found" }, { status: 404 });
    }

    const events = await db.event.findMany({
      where: {
        status: "PUBLISHED",
        startDate: { gte: new Date() }, // upcoming only
        church: { equals: church.name, mode: "insensitive" },
      },
      orderBy: { startDate: "asc" },
      take: 10,
      select: {
        id: true, title: true, description: true, startDate: true, startTime: true,
        allDay: true, location: true, venueName: true, city: true, state: true,
        eventType: true, isOnline: true, category: true,
      },
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        when: e.allDay
          ? e.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : `${e.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${e.startTime ? ` · ${e.startTime}` : ""}`,
        where: e.isOnline
          ? "Online"
          : [e.venueName || e.location, e.city].filter(Boolean).join(", "),
        isOnline: e.isOnline,
        category: e.category,
      })),
    });
  } catch (err) {
    console.error("[api/churches/id/events] GET failed:", err);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
