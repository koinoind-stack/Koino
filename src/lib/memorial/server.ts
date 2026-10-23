import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import {
  type MemorialAuthShape,
  type Viewer,
  canViewMemorial,
  isManagerOf,
} from "@/lib/memorial/shared";

/**
 * Server-only helpers for /api/memorials/* routes (Part 4).
 * Thin wrappers around the pure authorization rules in shared.ts.
 */

/** Prisma select for a memorial row + the fields needed for auth decisions. */
export const memorialSelect = {
  id: true,
  creatorId: true,
  fullName: true,
  birthYear: true,
  birthMonth: true,
  birthDay: true,
  deathYear: true,
  deathMonth: true,
  deathDay: true,
  epitaph: true,
  biography: true,
  serviceInfo: true,
  photoUrl: true,
  visibility: true,
  condolencePolicy: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  creator: {
    select: { id: true, name: true, username: true, image: true },
  },
  managers: {
    select: {
      userId: true,
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  },
} as const;

export type MemorialRow = {
  id: string;
  creatorId: string;
  fullName: string;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  epitaph: string | null;
  biography: string | null;
  serviceInfo: string | null;
  photoUrl: string | null;
  visibility: string;
  condolencePolicy: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  creator: { id: string; name: string | null; username: string | null; image: string | null };
  managers: Array<{
    userId: string;
    user: { id: string; name: string | null; username: string | null; image: string | null };
  }>;
  condolenceCount?: number;
  pendingCount?: number;
};

/** Fetch one memorial with managers, or null. */
export async function findMemorial(id: string): Promise<MemorialRow | null> {
  return db.memorial.findUnique({
    where: { id },
    select: memorialSelect,
  }) as Promise<MemorialRow | null>;
}

/** The auth shape consumed by the pure rules in shared.ts. */
export function authShape(m: MemorialRow): MemorialAuthShape {
  return {
    creatorId: m.creatorId,
    visibility: m.visibility,
    archived: m.archived,
    managerIds: m.managers.map((mm) => mm.userId),
  };
}

export function viewerFrom(sessionUser: { id: string; role: string } | null): Viewer {
  return sessionUser ? { id: sessionUser.id, role: sessionUser.role } : null;
}

/**
 * Standard access guard for detail/edit routes.
 * Returns { memorial, viewer } or a ready-made error Response.
 */
export async function requireMemorialAccess(
  id: string,
  sessionUser: { id: string; role: string } | null,
): Promise<
  { ok: true; memorial: MemorialRow; viewer: Viewer }
  | { ok: false; response: Response }
> {
  const memorial = await findMemorial(id);
  if (!memorial) return { ok: false, response: jsonError("Memorial not found", 404) };
  const viewer = viewerFrom(sessionUser);
  if (!canViewMemorial(authShape(memorial), viewer)) {
    return { ok: false, response: jsonError("You don't have access to this memorial", 403) };
  }
  return { ok: true, memorial, viewer };
}

export { canViewMemorial, isManagerOf };

// ─── Serialization ──────────────────────────────────────────────────────────

/** Client payload for list cards (no biography — detail route adds it). */
export function serializeMemorialSummary(m: Record<string, unknown>, viewerId: string | null) {
  const managers = (m.managers as Array<{ userId: string; user: Record<string, unknown> }>) || [];
  return {
    id: m.id as string,
    fullName: m.fullName as string,
    birthYear: m.birthYear as number | null,
    birthMonth: m.birthMonth as number | null,
    birthDay: m.birthDay as number | null,
    deathYear: m.deathYear as number | null,
    deathMonth: m.deathMonth as number | null,
    deathDay: m.deathDay as number | null,
    epitaph: m.epitaph as string | null,
    photoUrl: m.photoUrl as string | null,
    visibility: m.visibility as string,
    condolencePolicy: m.condolencePolicy as string,
    createdAt: (m.createdAt as Date).toISOString(),
    creator: m.creator as { id: string; name: string | null; username: string | null; image: string | null },
    managerUsers: managers.map((mm) => ({
      id: mm.user.id, name: mm.user.name, username: mm.user.username, image: mm.user.image,
    })),
    isManager:
      !!viewerId &&
      ((m.creatorId as string) === viewerId ||
        managers.some((mm) => mm.userId === viewerId)),
    isOwner: viewerId === m.creatorId,
  };
}

/** Full client payload (detail view — includes biography + service info). */
export function serializeMemorialFull(m: Record<string, unknown>, viewerId: string | null) {
  return {
    ...serializeMemorialSummary(m, viewerId),
    biography: m.biography as string | null,
    serviceInfo: m.serviceInfo as string | null,
    archived: m.archived as boolean,
    updatedAt: (m.updatedAt as Date).toISOString(),
  };
}
