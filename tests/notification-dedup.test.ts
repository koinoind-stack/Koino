/**
 * Lordsbook Part 2 — notification de-duplication tests.
 *
 * THE PROBLEM: like and repost are toggles. Before Part 2, every `notify()`
 * call inserted a fresh Notification row, so a viewer who liked → unliked →
 * liked again left the author with TWO "liked your post" rows for the same
 * post. The Part 2 spec requires notification integration with the EXISTING
 * system and duplicate prevention.
 *
 * THE FIX: notify() looks up existing rows for (userId, actorId, type) and
 * lets the pure `isDuplicateNotification()` decide — comparing the full
 * identity tuple including the optional postId / commentId / storyId
 * targets. These tests pin that decision table:
 *
 *   Section A — like toggle (same post: duplicate; different post: not)
 *   Section B — comments vs replies (commentId distinguishes events)
 *   Section C — mentions and story replies (storyId / null targets)
 *   Section D — null/undefined normalization (DB nulls vs omitted fields)
 *
 * Pure functions — no database, no network, no mocks needed.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isDuplicateNotification } from "../src/lib/social/feed-utils";

const base = {
  userId: "author-1",
  actorId: "fan-2",
  type: "like",
  postId: "post-A",
  commentId: null,
  storyId: null,
};

describe("isDuplicateNotification — like/unlike/like toggle (Section A)", () => {
  test("re-liking the same post is a duplicate", () => {
    assert.equal(isDuplicateNotification(base, { ...base }), true);
  });

  test("liking a different post by the same author is NOT a duplicate", () => {
    assert.equal(isDuplicateNotification(base, { ...base, postId: "post-B" }), false);
  });

  test("a different actor liking the same post is NOT a duplicate", () => {
    assert.equal(isDuplicateNotification(base, { ...base, actorId: "fan-3" }), false);
  });

  test("a different type on the same post is NOT a duplicate", () => {
    assert.equal(isDuplicateNotification(base, { ...base, type: "repost" }), false);
  });

  test("no existing row means never a duplicate", () => {
    assert.equal(isDuplicateNotification(null, { ...base }), false);
    assert.equal(isDuplicateNotification(undefined, { ...base }), false);
  });
});

describe("comments vs replies (Section B)", () => {
  test("reply on the same comment duplicates (recipient already notified)", () => {
    const existing = { ...base, type: "reply", commentId: "c-1" };
    assert.equal(isDuplicateNotification(existing, { ...existing }), true);
  });

  test("reply on a different comment is a new event", () => {
    const existing = { ...base, type: "reply", commentId: "c-1" };
    assert.equal(isDuplicateNotification(existing, { ...existing, commentId: "c-2" }), false);
  });

  test("comment notifications with different commentIds never collapse", () => {
    const existing = { ...base, type: "comment", commentId: "c-1" };
    const incoming = { ...base, type: "comment", commentId: "c-2" };
    assert.equal(isDuplicateNotification(existing, incoming), false);
  });
});

describe("mentions and story replies (Section C)", () => {
  test("story reply dedupes per story", () => {
    const existing = { ...base, type: "story_reply", postId: null, storyId: "s-1" };
    assert.equal(isDuplicateNotification(existing, { ...existing }), true);
    assert.equal(isDuplicateNotification(existing, { ...existing, storyId: "s-2" }), false);
  });

  test("mention dedupes per (post, comment) pair", () => {
    const existing = { ...base, type: "mention", commentId: null };
    assert.equal(isDuplicateNotification(existing, { ...existing }), true);
    assert.equal(
      isDuplicateNotification(existing, { ...existing, commentId: "c-9" }),
      false,
    );
  });
});

describe("null/undefined normalization (Section D)", () => {
  test("DB null and omitted undefined targets are the same identity", () => {
    const fromDb = { userId: "u", actorId: "a", type: "like", postId: "p", commentId: null, storyId: null };
    const incoming = { userId: "u", actorId: "a", type: "like", postId: "p" };
    assert.equal(isDuplicateNotification(fromDb, incoming), true);
  });

  test("null actor never matches a real actor (system rows are unique)", () => {
    const fromDb = { userId: "u", actorId: null, type: "system", postId: null, commentId: null, storyId: null };
    assert.equal(
      isDuplicateNotification(fromDb, { userId: "u", actorId: "a", type: "system" }),
      false,
    );
  });
});
