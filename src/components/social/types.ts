"use client";

/** Shared client types for the social UI (mirrors API payloads). */

export type SocialUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  verified?: boolean;
};

export type Post = {
  id: string;
  content: string | null;
  mediaType: "text" | "image" | "video" | string;
  mediaUrls: string[];
  thumbnailUrl: string | null;
  aspectRatio: string | null;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount: number;
  isReel: boolean;
  editedAt: string | null;
  createdAt: string;
  author: SocialUser;
  repostedFrom: {
    id: string;
    content: string | null;
    mediaType: string;
    mediaUrls: string[];
    thumbnailUrl: string | null;
    aspectRatio: string | null;
    author: SocialUser;
  } | null;
  viewer: { liked: boolean; bookmarked: boolean; following: boolean };
};

export type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: SocialUser;
  replyCount?: number;
  recentReplies?: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: SocialUser;
  }>;
};

export type NotificationItem = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  postId?: string | null;
  commentId?: string | null;
  storyId?: string | null;
  actor: SocialUser | null;
  post: {
    id: string;
    content: string | null;
    mediaType: string;
    mediaUrls: string[];
    thumbnailUrl: string | null;
  } | null;
};

export type StoryGroup = {
  user: SocialUser;
  isMine: boolean;
  allSeen: boolean;
  items: Array<{
    id: string;
    mediaUrl: string;
    mediaType: string;
    thumbnailUrl: string | null;
    aspectRatio: string | null;
    caption: string | null;
    backgroundColor: string | null;
    createdAt: string;
    expiresAt: string;
    seen: boolean;
    isMine: boolean;
  }>;
};

export async function api<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}
