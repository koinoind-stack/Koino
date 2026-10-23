import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * GET /api/trivia/history
 *
 * Returns the authenticated user's Faith Point transaction history.
 * This is the auditable log — every point earned/spent is recorded.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const transactions = await db.triviaPointTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50, // last 50 transactions
    });

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        points: t.points,
        reason: t.reason,
        questionId: t.questionId,
        quizSessionId: t.quizSessionId,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[trivia/history] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
