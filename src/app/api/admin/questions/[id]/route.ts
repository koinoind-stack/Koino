import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

// Admin auth helper
async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user, response: null };
}

/**
 * DELETE /api/admin/questions/[id]
 * Admin-only — permanently deletes a user question.
 *
 * Use for spam, abuse, or test questions. For moderation of legitimate
 * questions, prefer 'close' (archived) instead of delete.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing question id" }, { status: 400 });
    }

    const existing = await db.userQuestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await db.userQuestion.delete({ where: { id } });

    console.log(`[api/admin/questions DELETE] Question ${id} deleted by ${auth.user.email}`);

    try { revalidatePath("/", "layout"); } catch {}

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("[api/admin/questions DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
