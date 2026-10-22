import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * POST /api/admin/comics/[id]/unpublish
 *
 * Reverts a chapter back to "draft" status and hides it from end users
 * (isActive = false). No validation is required — admins can unpublish
 * at any time, even if the chapter is already a draft.
 *
 * This is the safety valve for catching issues after publish: a typo in
 * a panel, a wrong verse range, an inappropriate image — admins hit
 * Unpublish, fix the issue, then hit Publish again.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.comicChapter.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const updated = await db.comicChapter.update({
      where: { id },
      data: { status: "draft", isActive: false },
    });

    return NextResponse.json({
      success: true,
      status: updated.status,
      message: `Chapter "${updated.title}" is now unpublished — no longer visible to users`,
    });
  } catch (e: any) {
    console.error("[admin/comics/[id]/unpublish] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to unpublish chapter" }, { status: 500 });
  }
}
