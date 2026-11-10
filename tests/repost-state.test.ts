/**
 * Koino Social — repost state & attribution tests.
 *
 * THE BUGS (pre-Part 2 PostCard):
 *   1. toggleRepost never tracked `viewer.reposted`, so a viewer who had
 *      reposted a post saw no active state and could not reliably undo —
 *      the button always optimistically bumped the count UP, even when the
 *      server was about to REMOVE the repost.
 *   2. The "↻ Reposted from @…" line rendered the WRAPPER author's handle
 *      (`state.author.username`) — for the viewer's own repost it read the
 *      nonsensical "Reposted from @me" instead of the ORIGINAL author.
 *
 * THE FIX: the pure helpers in src/lib/social/feed-utils.ts —
 *   optimisticRepostCount()  ±1 in the correct direction before the request
 *   applyRepostToViewer()    fold the server response (count + flag); the
 *                            server count always wins
 *   repostAttributionHandle() the ORIGINAL author's handle
 *
 * The server route stays the same toggle transaction (marker post +
 * repostCount inside $transaction) — Part 2 reuses it, no new endpoint.
 *
 * Pure functions — no database, no network, no mocks needed.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  repostAttributionHandle,
  applyRepostToViewer,
  optimisticRepostCount,
  type RepostablePost,
} from "../src/lib/social/feed-utils";

function post(overrides: Partial<RepostablePost> = {}): RepostablePost {
  return {
    id: "p1",
    repostCount: 4,
    author: { id: "u-prakash", username: "prakash", name: "Prakash Kumar" },
    repostedFrom: null,
    viewer: { liked: false, bookmarked: false, following: true, reposted: false },
    ...overrides,
  };
}

describe("repostAttributionHandle", () => {
  test("a repost wrapper attributes the ORIGINAL author, not the reposter", () => {
    const wrapper = post({
      author: { id: "u-me", username: "asher", name: "Asher Varghese" },
      repostedFrom: { author: { id: "u-prakash", username: "prakash", name: "Prakash Kumar" } },
    });
    assert.equal(repostAttributionHandle(wrapper), "prakash");
  });

  test("a normal post has no attribution", () => {
    assert.equal(repostAttributionHandle(post()), null);
  });

  test("original author without a username falls back to null (UI shows 'member')", () => {
    const wrapper = post({
      repostedFrom: { author: { id: "u-x", username: null, name: "No Handle" } },
    });
    assert.equal(repostAttributionHandle(wrapper), null);
  });
});

describe("optimisticRepostCount", () => {
  test("counts UP when starting a repost", () => {
    assert.equal(optimisticRepostCount(post()), 5);
  });

  test("counts DOWN when starting an undo (the old bug bumped up)", () => {
    assert.equal(optimisticRepostCount(post({ viewer: { liked: false, bookmarked: false, following: false, reposted: true } })), 3);
  });

  test("never goes below zero", () => {
    assert.equal(optimisticRepostCount(post({ repostCount: 0, viewer: { liked: false, bookmarked: false, following: false, reposted: true } })), 0);
  });
});

describe("applyRepostToViewer", () => {
  test("repost success: flag set, server count wins", () => {
    const result = applyRepostToViewer(post(), { reposted: true, repostCount: 5 });
    assert.deepEqual(result, { repostCount: 5, viewer: { liked: false, bookmarked: false, following: true, reposted: true } });
  });

  test("undo success: flag cleared, server count wins", () => {
    const state = post({ viewer: { liked: false, bookmarked: false, following: true, reposted: true } });
    const result = applyRepostToViewer(state, { reposted: false, repostCount: 4 });
    assert.equal(result.viewer.reposted, false);
    assert.equal(result.repostCount, 4);
  });

  test("a stale optimistic bump can never stick (server count is authoritative)", () => {
    // Client guessed 6, server says 5 — the response must overwrite it.
    const result = applyRepostToViewer(post({ repostCount: 6 }), { reposted: true, repostCount: 5 });
    assert.equal(result.repostCount, 5);
  });

  test("negative server counts are floored at zero", () => {
    const result = applyRepostToViewer(post(), { reposted: false, repostCount: -2 });
    assert.equal(result.repostCount, 0);
  });

  test("other viewer flags survive the fold untouched", () => {
    const state = post({ viewer: { liked: true, bookmarked: true, following: false, reposted: false } });
    const result = applyRepostToViewer(state, { reposted: true, repostCount: 9 });
    assert.deepEqual(result.viewer, { liked: true, bookmarked: true, following: false, reposted: true });
  });
});
