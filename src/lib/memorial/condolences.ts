import { Prisma } from "@prisma/client";

/**
 * Part 4 — condolence serialization helpers, shared by the condolence routes.
 * Kept out of route files: Next.js only allows HTTP handlers as route exports.
 */

export const condolenceSelect = Prisma.validator<Prisma.MemorialCondolenceSelect>()({
  id: true,
  memorialId: true,
  authorId: true,
  message: true,
  status: true,
  createdAt: true,
  author: { select: { id: true, name: true, username: true, image: true } },
});

export type CondolenceRow = Prisma.MemorialCondolenceGetPayload<{
  select: typeof condolenceSelect;
}>;

export type SerializedCondolence = {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  author: { id: string; name: string | null; username: string | null; image: string | null };
  isMine: boolean;
};

export function serializeCondolence(r: CondolenceRow, viewerId: string | null): SerializedCondolence {
  return {
    id: r.id,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    author: r.author,
    isMine: viewerId === r.authorId,
  };
}
