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
 * POST /api/trivia/competitions/[id]/finalize
 *
 * Calculates winners for a competition. IDEMPOTENT — running it twice
 * does NOT create duplicate winners or allocate prizes twice.
 *
 * Winner selection (tie-breaking order):
 *   1. Higher competition score
 *   2. More correct answers
 *   3. Higher accuracy
 *   4. Faster completion time (lower durationMs)
 *   5. Earlier achievement of final score (earlier createdAt)
 *
 * Uses a database transaction to:
 *   - Select top N attempts (where N = winnerCount)
 *   - Create TriviaWinner records (with @@unique to prevent duplicates)
 *   - Decrement prize.remainingQuantity (prevent over-allocation)
 *
 * Admin-only — can be called manually or by a cron job.
 *
 * Returns: { winners: [...], prizeAllocated: number }
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

    const { id: competitionId } = await params;

    const competition = await db.triviaCompetition.findUnique({
      where: { id: competitionId },
      include: { prize: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    // ─── IDEMPOTENCY CHECK ───
    // If winners already exist for this competition, don't re-calculate.
    // This makes the endpoint safe to run multiple times.
    const existingWinners = await db.triviaWinner.count({
      where: { competitionId },
    });
    if (existingWinners > 0) {
      const currentWinners = await db.triviaWinner.findMany({
        where: { competitionId },
        orderBy: { rank: "asc" },
        include: { user: { select: { username: true, name: true } }, prize: true },
      });
      return NextResponse.json({
        message: "Winners already finalized (idempotent)",
        winners: currentWinners,
        alreadyFinalized: true,
      });
    }

    // ─── 1. Get the best attempt per user (one per user, highest score) ───
    // Tie-breaking: score DESC, correctCount DESC, accuracy DESC, durationMs ASC, createdAt ASC
    const allAttempts = await db.triviaCompetitionAttempt.findMany({
      where: { competitionId },
      orderBy: [
        { score: "desc" },
        { correctCount: "desc" },
        { accuracy: "desc" },
        { durationMs: "asc" },
        { createdAt: "asc" },
      ],
    });

    // Deduplicate by userId (keep only the best attempt per user)
    const bestPerUser = new Map<string, typeof allAttempts[0]>();
    for (const attempt of allAttempts) {
      if (!bestPerUser.has(attempt.userId)) {
        bestPerUser.set(attempt.userId, attempt);
      }
    }

    const rankedAttempts = Array.from(bestPerUser.values()).slice(0, competition.winnerCount);

    if (rankedAttempts.length === 0) {
      // No attempts → no winners. Mark competition as ended.
      await db.triviaCompetition.update({
        where: { id: competitionId },
        data: { status: "ended" },
      });
      return NextResponse.json({ message: "No attempts — no winners", winners: [] });
    }

    // ─── 2. Transaction: create winner records + allocate prizes ───
    const winners = await db.$transaction(async (tx) => {
      const created: any[] = [];

      for (let i = 0; i < rankedAttempts.length; i++) {
        const attempt = rankedAttempts[i];
        const rank = i + 1;

        // Check prize inventory — don't allocate more than available
        let prizeId: string | null = null;
        if (competition.prizeId && competition.prize) {
          // Re-read prize inside the transaction for accurate inventory
          const prize = await tx.triviaPrize.findUnique({
            where: { id: competition.prizeId },
          });
          if (prize && prize.remainingQuantity > 0) {
            prizeId = prize.id;
            // Decrement remaining, increment assigned
            await tx.triviaPrize.update({
              where: { id: prize.id },
              data: {
                remainingQuantity: { decrement: 1 },
                assignedQuantity: { increment: 1 },
              },
            });
          }
        }

        // Create winner record — @unique([competitionId, userId]) prevents duplicates
        // If this user was already a winner (shouldn't happen due to idempotency check),
        // the transaction will fail safely.
        const winner = await tx.triviaWinner.create({
          data: {
            competitionId,
            userId: attempt.userId,
            rank,
            score: attempt.score,
            correctCount: attempt.correctCount,
            accuracy: attempt.accuracy,
            durationMs: attempt.durationMs,
            prizeId,
            status: prizeId ? "pending_verification" : "no_prize",
          },
        });
        created.push({ winner, attempt });
      }

      // Mark competition as ended
      await tx.triviaCompetition.update({
        where: { id: competitionId },
        data: { status: "ended" },
      });

      return created;
    });

    // ─── 3. Fetch full winner records for response ───
    const finalWinners = await db.triviaWinner.findMany({
      where: { competitionId },
      orderBy: { rank: "asc" },
      include: {
        user: { select: { id: true, username: true, name: true, image: true } },
        prize: { select: { id: true, name: true, imageUrl: true } },
      },
    });

    return NextResponse.json({
      success: true,
      winners: finalWinners,
      prizeAllocated: finalWinners.filter((w) => w.prizeId).length,
    });
  } catch (error: any) {
    console.error("[trivia/competitions/finalize] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to finalize" }, { status: 500 });
  }
}
