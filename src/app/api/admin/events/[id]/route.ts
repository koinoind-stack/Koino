import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

/**
 * DELETE /api/admin/events/[id]
 * Admin-only — permanently deletes an event record.
 *
 * Use this for spam, abuse, or test events. For moderation of legitimate
 * submissions, prefer REJECT or CANCEL instead of DELETE (those preserve
 * the audit trail).
 *
 * Server-side admin check via getAuthUser(). NEVER trust client roles.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await db.event.delete({ where: { id } });

    console.log(`[api/admin/events DELETE] Event ${id} deleted by ${user.email}`);

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/admin/events DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
