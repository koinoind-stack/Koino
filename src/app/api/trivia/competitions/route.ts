import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * GET /api/trivia/competitions
 *   ?mine=1  → the caller's hosted competitions (any status, incl. pending /
 *              cancelled) instead of the public board.
 *
 * Returns competitions (live, upcoming, ended) for the public Trivia
 * Compete tab. Also returns the user's rank + attempts for live competitions.
 *
 * Public — no auth required to view competitions.
 * Auth required to see "your rank" + "your attempts" per competition.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    const now = new Date();
    const mine = new URL(req.url).searchParams.get("mine") === "1";

    // "mine" = everything the caller (or their group) created, any status —
    // so hosts can see their submission sitting in "pending review".
    if (mine) {
      if (!user) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const myGroups = await db.groupMember.findMany({
        where: { userId: user.id, status: "active" },
        select: { groupId: true },
      });
      const rows = await db.triviaCompetition.findMany({
        where: {
          OR: [
            { createdById: user.id },
            { hostGroupId: { in: myGroups.map((m) => m.groupId) } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          prize: { select: { id: true, name: true, imageUrl: true } },
          hostGroup: { select: { id: true, name: true } },
          _count: { select: { attempts: true } },
        },
      });
      return NextResponse.json({
        competitions: rows.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          type: c.type,
          category: c.category,
          difficulty: c.difficulty,
          questionCount: c.questionCount,
          status: c.status,
          startAt: c.startAt,
          endAt: c.endAt,
          rules: c.rules,
          hostGroup: c.hostGroup,
          prize: c.prize,
          participantCount: c._count.attempts,
          createdAt: c.createdAt,
        })),
      });
    }

    const competitions = await db.triviaCompetition.findMany({
      where: { status: { in: ["scheduled", "live", "ended"] } },
      orderBy: [{ status: "asc" }, { startAt: "desc" }],
      include: {
        prize: true,
        hostGroup: { select: { id: true, name: true } },
      },
    });

    // For each competition, compute time remaining + user's best score + rank
    const enriched = await Promise.all(
      competitions.map(async (c) => {
        const isLive = c.status === "live" && now >= c.startAt && now < c.endAt;
        const hasEnded = c.status === "ended" || now >= c.endAt;
        const timeRemaining = hasEnded ? 0 : c.endAt.getTime() - now.getTime();

        // Count participants (distinct users with attempts)
        const participantCount = await db.triviaCompetitionAttempt.count({
          where: { competitionId: c.id },
        });

        // If user is logged in, get their best score + rank
        let userBestScore: number | null = null;
        let userRank: number | null = null;
        let userAttemptsUsed: number = 0;

        if (user) {
          const attempts = await db.triviaCompetitionAttempt.findMany({
            where: { competitionId: c.id, userId: user.id },
            orderBy: { score: "desc" },
          });
          userAttemptsUsed = attempts.length;
          if (attempts.length > 0) {
            userBestScore = attempts[0].score;
            // Rank = number of users with a higher best score + 1
            const higherScorers = await db.triviaCompetitionAttempt.findMany({
              where: {
                competitionId: c.id,
                score: { gt: userBestScore },
              },
              distinct: ["userId"],
            });
            userRank = higherScorers.length + 1;
          }
        }

        return {
          id: c.id,
          title: c.title,
          description: c.description,
          imageUrl: c.imageUrl,
          type: c.type,
          category: c.category,
          difficulty: c.difficulty,
          questionCount: c.questionCount,
          attemptLimit: c.attemptLimit,
          winnerCount: c.winnerCount,
          rules: c.rules,
          status: isLive ? "live" : hasEnded ? "ended" : c.status,
          startAt: c.startAt,
          endAt: c.endAt,
          claimDeadlineDays: c.claimDeadlineDays,
          timeRemaining,
          participantCount,
          hostGroup: c.hostGroup,
          prize: c.prize
            ? {
                id: c.prize.id,
                name: c.prize.name,
                imageUrl: c.prize.imageUrl,
                description: c.prize.description,
                requiresShipping: c.prize.requiresShipping,
                remainingQuantity: c.prize.remainingQuantity,
              }
            : null,
          userBestScore,
          userRank,
          userAttemptsUsed,
          userAttemptsRemaining: Math.max(0, c.attemptLimit - userAttemptsUsed),
        };
      })
    );

    return NextResponse.json({ competitions: enriched });
  } catch (error: any) {
    console.error("[trivia/competitions] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load competitions" }, { status: 500 });
  }
}

// ─── COMMUNITY HOSTING ──────────────────────────────────────────────────────
// Group managers (owner / admin / moderator) can host a trivia competition
// for their group — a church youth fellowship running its own quiz night, for
// example. Submissions land in "pending" and are INVISIBLE to players until a
// platform admin approves them (same moderation pattern as Event submissions:
// user submits → PENDING → admin approves → public). Attempts count against
// the public board only after approval.
const HOST_CATEGORIES = ["full_bible", "new_testament", "old_testament", "apologetics", "mixed"];
const HOST_DIFFICULTIES = ["beginners", "intermediate", "skilled", "expert", "mixed"];
const HOST_ROLES = ["owner", "admin", "moderator"];
const MAX_PENDING_PER_GROUP = 3;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      groupId,
      title,
      description,
      category,
      difficulty,
      questionCount,
      startAt,
      endAt,
      rules,
    } = body as Record<string, unknown>;

    if (!groupId || typeof groupId !== "string") {
      return NextResponse.json({ error: "Missing required field: groupId" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || title.trim().length < 3 || title.trim().length > 120) {
      return NextResponse.json(
        { error: "Title must be 3-120 characters" },
        { status: 400 },
      );
    }
    if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 1000)) {
      return NextResponse.json({ error: "Description must be 1000 characters or fewer" }, { status: 400 });
    }
    if (!HOST_CATEGORIES.includes(String(category))) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!HOST_DIFFICULTIES.includes(String(difficulty))) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    const qCount = Number(questionCount);
    if (!Number.isFinite(qCount) || qCount < 5 || qCount > 15) {
      return NextResponse.json({ error: "Question count must be between 5 and 15" }, { status: 400 });
    }

    const start = new Date(String(startAt));
    const end = new Date(String(endAt));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid start or end date" }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json({ error: "End must be after start" }, { status: 400 });
    }
    if (start.getTime() < Date.now() - 5 * 60 * 1000) {
      return NextResponse.json({ error: "Start time cannot be in the past" }, { status: 400 });
    }
    if (end.getTime() - start.getTime() > MAX_WINDOW_MS) {
      return NextResponse.json({ error: "A hosted trivia can run for at most 30 days" }, { status: 400 });
    }
    if (rules !== undefined && rules !== null && (typeof rules !== "string" || rules.length > 2000)) {
      return NextResponse.json({ error: "Rules must be 2000 characters or fewer" }, { status: 400 });
    }

    // The caller must be an ACTIVE manager (owner / admin / moderator) of the
    // group. Plain members and outsiders cannot host in the group's name.
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
      select: { status: true, role: true },
    });
    if (!membership || membership.status !== "active" || !HOST_ROLES.includes(membership.role)) {
      return NextResponse.json(
        { error: "Only group admins or moderators can host trivia for this group" },
        { status: 403 },
      );
    }

    // Anti-spam: cap simultaneous pending submissions per group.
    const pendingCount = await db.triviaCompetition.count({
      where: { hostGroupId: groupId, status: "pending" },
    });
    if (pendingCount >= MAX_PENDING_PER_GROUP) {
      return NextResponse.json(
        { error: "This group already has 3 competitions awaiting review. Wait for one to be approved first." },
        { status: 429 },
      );
    }

    const competition = await db.triviaCompetition.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        type: "custom",
        category: String(category),
        difficulty: String(difficulty),
        questionCount: Math.round(qCount),
        attemptLimit: 1,
        winnerCount: 3,
        rules: typeof rules === "string" && rules.trim() ? rules.trim() : null,
        status: "pending",
        startAt: start,
        endAt: end,
        claimDeadlineDays: 7,
        prizeId: null, // hosted competitions are for fun — prizes stay admin-managed
        createdById: user.id,
        hostGroupId: groupId,
      },
      include: { hostGroup: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      success: true,
      competition,
      message: "Submitted for review. It appears in the Compete tab once approved.",
    });
  } catch (error: any) {
    console.error("[trivia/competitions] POST error:", error);
    return NextResponse.json({ error: error?.message || "Failed to host competition" }, { status: 500 });
  }
}
