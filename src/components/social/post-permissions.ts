/**
 * Post ownership / permission logic — single source of truth (Phase 1 Fix 2).
 *
 * Bug this fixes: PostCard used to compute
 *   canEdit = state.repostedFrom === null && shown.author.id === state.author.id
 * which is a SELF-comparison: when the post is not a repost, `shown` IS
 * `state`, so the ids are always equal and canEdit/canDelete were TRUE for
 * EVERY viewer on every non-repost post. Edit/Delete controls therefore
 * appeared on other users' posts, while the Block button (rendered when
 * `!canEdit`) was hidden exactly where it should be available.
 *
 * The card never knew who the VIEWER was — it had no viewer identity to
 * compare against. The fix gives PostCard the viewer's own Prisma user id
 * (via useViewerId(), the same `/api/auth/me` identity CommentRow already
 * uses) and centralizes the visibility rules here as a pure function so
 * they can be unit-tested without React.
 *
 * SECURITY MODEL: these flags control MENU VISIBILITY only. The server
 * re-verifies every action server-side (PATCH/DELETE /api/social/posts/[id]
 * enforce author-or-group-manager; block/report are independent), so the UI
 * can never grant a permission the API does not enforce.
 *
 * Rules:
 *   isMine     — the viewer authored this post (the repost shell counts as
 *                the viewer's own post when they are the reposter).
 *   canEdit    — caption editing: only on your OWN original (non-repost)
 *                post. Matches the server PATCH (author-only) and the old
 *                intended behavior (repost shells have no editable caption
 *                of their own — the card shows the original).
 *   canDelete  — your own original post, OR any post you can moderate
 *                (group owner/admin/moderator — the server re-verifies the
 *                role on DELETE, this only controls the menu).
 *   canBlock   — anyone else's post (including reposts authored by someone
 *                else), when signed in and the author has a username (the
 *                block API works by username).
 */
export type PostLike = {
  author: { id: string; username?: string | null };
  /** Client Post shape carries the embedded original for reposts. */
  repostedFrom?: unknown | null;
};

export type PostPermissions = {
  isMine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canBlock: boolean;
};

export function computePostPermissions(
  post: PostLike,
  viewerId: string | null,
  canModerate = false,
): PostPermissions {
  const isMine = !!viewerId && post.author.id === viewerId;
  const isRepost = !!post.repostedFrom;

  const canEdit = isMine && !isRepost;
  const canDelete = canEdit || (canModerate && !!viewerId);
  const canBlock = !!viewerId && !isMine && !!post.author.username;

  return { isMine, canEdit, canDelete, canBlock };
}
