"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Client-side hooks for the trivia API.
 * All scoring is server-side — the client just sends answers and
 * receives verified results.
 *
 * The user's selected language is auto-included in the startQuiz call
 * so the API returns translated questions if available.
 */
export function useTriviaApi() {
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();

  const startQuiz = useCallback(async (params: {
    difficulty: string;
    category: string;
    count: number;
    mode: "EARN_POINTS" | "PRACTICE";
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/trivia/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } finally {
      setLoading(false);
    }
  }, [lang]);

  const submitQuiz = useCallback(async (params: {
    difficulty: string;
    category: string;
    mode: "EARN_POINTS" | "PRACTICE";
    answers: { questionId: string; selectedAnswer: number }[];
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/trivia/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStats = useCallback(async () => {
    try {
      const res = await fetch("/api/trivia/stats");
      if (res.status === 401) return null;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch {
      return null;
    }
  }, []);

  const getLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/trivia/leaderboard");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.leaderboard || [];
    } catch {
      return [];
    }
  }, []);

  const getGifts = useCallback(async () => {
    try {
      const res = await fetch("/api/trivia/gifts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch {
      return { gifts: [], userPoints: 0, isAuthenticated: false };
    }
  }, []);

  const claimGift = useCallback(async (giftId: string) => {
    const res = await fetch("/api/trivia/claim-gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giftId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }, []);

  const getHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/trivia/history");
      if (res.status === 401) return [];
      const data = await res.json();
      return data.transactions || [];
    } catch {
      return [];
    }
  }, []);

  return {
    loading,
    startQuiz,
    submitQuiz,
    getStats,
    getLeaderboard,
    getGifts,
    claimGift,
    getHistory,
  };
}
