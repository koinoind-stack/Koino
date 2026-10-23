"use client";

/** Shared client types for the In Loving Memory UI (mirrors API payloads). */

export type MemorialUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

export type MemorialSummary = {
  id: string;
  fullName: string;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  epitaph: string | null;
  photoUrl: string | null;
  visibility: string;
  condolencePolicy: string;
  createdAt: string;
  creator: MemorialUser;
  managerUsers: MemorialUser[];
  isManager: boolean;
  isOwner: boolean;
};

export type MemorialDetail = MemorialSummary & {
  biography: string | null;
  serviceInfo: string | null;
  archived: boolean;
  updatedAt: string;
};

export type Condolence = {
  id: string;
  message: string;
  status: string; // pending | approved | rejected
  createdAt: string;
  author: MemorialUser;
  isMine: boolean;
};

export type MemorialInputPayload = {
  fullName: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  deathYear: string;
  deathMonth: string;
  deathDay: string;
  epitaph: string;
  biography: string;
  serviceInfo: string;
  photoUrl: string;
  visibility: string;
  condolencePolicy: string;
};
