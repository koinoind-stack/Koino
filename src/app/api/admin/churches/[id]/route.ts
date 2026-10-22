import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

/**
 * DELETE /api/admin/churches/[id]
 * Admin-only — permanently deletes a church record.
 *
 * Use this for spam, abuse, or test churches. For moderation of legitimate
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
      return NextResponse.json({ error: "Missing church id" }, { status: 400 });
    }

    const existing = await db.church.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Church not found" }, { status: 404 });
    }

    await db.church.delete({ where: { id } });

    console.log(`[api/admin/churches DELETE] Church ${id} deleted by ${user.email}`);

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/admin/churches DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete church" }, { status: 500 });
  }
}
