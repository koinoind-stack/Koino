/**
 * Lordsbook Part 2 — feed utility tests.
 *
 * Covers the pure feed helpers behind GET /api/social/posts:
 *
 *   parseFeedTab   — tab query-parameter whitelist (For You / Following /
 *                    Trending); unknown values must fall back to For You,
 *                    never throw.
 *   trendingScore  — engagement weights (likes ×2 + comments ×3 + reposts ×3)
 *                    shared by the Trending feed and its UI.
 *   rankTrending   — deterministic ordering: score desc, newest first on
 *                    ties, capped; must not mutate the input array.
 *   nextCursorFrom — keyset cursor rule shared by posts/comments/
 *                    notifications pagination (null exactly when the page
 *                    is the last one).
 *
 * These are pure functions — no database, no network, no mocks needed.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseFeedTab,
  trendingScore,
  rankTrending,
  nextCursorFrom,
} from "../src/lib/social/feed-utils";

describe("parseFeedTab", () => {
  test("maps the three known tabs", () => {
    assert.equal(parseFeedTab("discover"), "discover");
    assert.equal(parseFeedTab("following"), "following");
    assert.equal(parseFeedTab("trending"), "trending");
  });

  test("falls back to discover (For You) for anything else", () => {
    assert.equal(parseFeedTab(null), "discover");
    assert.equal(parseFeedTab(undefined), "discover");
    assert.equal(parseFeedTab(""), "discover");
    assert.equal(parseFeedTab("FOR YOU"), "discover");
    assert.equal(parseFeedTab("trending "), "discover"); // no trimming — strict match
    assert.equal(parseFeedTab("reels"), "discover");
  });
});

describe("trendingScore", () => {
  test("weights likes ×2, comments ×3, reposts ×3", () => {
    assert.equal(trendingScore({ likeCount: 1, commentCount: 0, repostCount: 0 }), 2);
    assert.equal(trendingScore({ likeCount: 0, commentCount: 1, repostCount: 0 }), 3);
    assert.equal(trendingScore({ likeCount: 0, commentCount: 0, repostCount: 1 }), 3);
    assert.equal(trendingScore({ likeCount: 10, commentCount: 4, repostCount: 2 }), 20 + 12 + 6);
  });

  test("a repost outweighs a like (reposts spread the gospel further)", () => {
    assert.ok(
      trendingScore({ likeCount: 0, commentCount: 0, repostCount: 1 }) >
        trendingScore({ likeCount: 1, commentCount: 0, repostCount: 0 }),
    );
  });
});

describe("rankTrending", () => {
  const p = (
    id: string,
    likeCount: number,
    commentCount: number,
    repostCount: number,
    createdAt: string | Date,
  ) => ({ id, likeCount, commentCount, repostCount, createdAt });

  test("orders by score desc, then newest first on ties", () => {
    // All three top candidates score 6 — the createdAt tie-break decides:
    // tie-new (11-03) > tie-old (11-02) > hot (10-01). low scores 2.
    const ranked = rankTrending(
      [
        p("low", 1, 0, 0, "2026-11-01T00:00:00Z"), // score 2
        p("hot", 0, 2, 0, "2026-10-01T00:00:00Z"), // score 6, oldest
        p("tie-new", 0, 1, 1, "2026-11-03T00:00:00Z"), // score 6, newest
        p("tie-old", 0, 1, 1, "2026-11-02T00:00:00Z"), // score 6, middle
      ],
      10,
    );
    assert.deepEqual(
      ranked.map((r) => r.id),
      ["tie-new", "tie-old", "hot", "low"],
    );
  });

  test("caps the result at `take`", () => {
    const candidates = Array.from({ length: 30 }, (_, i) =>
      p(`p${i}`, i, 0, 0, "2026-11-01T00:00:00Z"),
    );
    assert.equal(rankTrending(candidates, 20).length, 20);
  });

  test("does not mutate the input array", () => {
    const candidates = [p("b", 2, 0, 0, "2026-11-01T00:00:00Z"), p("a", 9, 0, 0, "2026-11-01T00:00:00Z")];
    const snapshot = [...candidates];
    rankTrending(candidates, 10);
    assert.deepEqual(candidates, snapshot);
  });

  test("Date objects and ISO strings both sort correctly", () => {
    const ranked = rankTrending(
      [
        p("older-date", 1, 0, 0, new Date("2026-11-01T00:00:00Z")),
        p("newer-string", 1, 0, 0, "2026-11-02T00:00:00Z"),
      ],
      10,
    );
    assert.equal(ranked[0].id, "newer-string");
  });
});

describe("nextCursorFrom", () => {
  test("returns the last row's ISO time only when more pages exist", () => {
    assert.equal(
      nextCursorFrom(new Date("2026-11-01T10:00:00Z"), true),
      "2026-11-01T10:00:00.000Z",
    );
    assert.equal(nextCursorFrom("2026-11-01T10:00:00Z", true), "2026-11-01T10:00:00.000Z");
  });

  test("returns null on the last page / empty page / bad input", () => {
    assert.equal(nextCursorFrom(new Date("2026-11-01T10:00:00Z"), false), null);
    assert.equal(nextCursorFrom(undefined, true), null);
    assert.equal(nextCursorFrom(null, true), null);
    assert.equal(nextCursorFrom("not-a-date", true), null);
  });
});
