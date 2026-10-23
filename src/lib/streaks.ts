// Streak tracking utility — shared across all Koino activities.
// Tracks consecutive-day streaks for daily habits (Bible reading, trivia, prayer).
// All data persisted in localStorage.

export type StreakActivity = "bible_reading" | "trivia_play" | "prayer_share";

type StreakData = {
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalDays: number; // total active days ever
  history: string[]; // list of YYYY-MM-DD dates (last 60 kept)
  freezesAvailable: number; // streak freezes available
  freezesUsed: number; // total freezes ever used
};

const STORAGE_KEY = "crosscrafted_streaks";

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const yesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function getAllStreaks(): Record<StreakActivity, StreakData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStreaks();
    const parsed = JSON.parse(raw);
    // Ensure all activities exist
    const defaults = defaultStreaks();
    return {
      bible_reading: parsed.bible_reading || defaults.bible_reading,
      trivia_play: parsed.trivia_play || defaults.trivia_play,
      prayer_share: parsed.prayer_share || defaults.prayer_share,
    };
  } catch {
    return defaultStreaks();
  }
}

function defaultStreaks(): Record<StreakActivity, StreakData> {
  return {
    bible_reading: { currentStreak: 0, bestStreak: 0, lastActiveDate: "", totalDays: 0, history: [], freezesAvailable: 1, freezesUsed: 0 },
    trivia_play: { currentStreak: 0, bestStreak: 0, lastActiveDate: "", totalDays: 0, history: [], freezesAvailable: 1, freezesUsed: 0 },
    prayer_share: { currentStreak: 0, bestStreak: 0, lastActiveDate: "", totalDays: 0, history: [], freezesAvailable: 1, freezesUsed: 0 },
  };
}

function saveStreaks(data: Record<StreakActivity, StreakData>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full — ignore
  }
}

export type StreakInfo = {
  currentStreak: number;
  bestStreak: number;
  totalDays: number;
  lastActiveDate: string;
  isActiveToday: boolean;
  nextMilestone: number;
  milestoneProgress: number; // 0-100
};

/**
 * Record activity for today. If user already active today, this is a no-op
 * (streak doesn't increase, but we don't reset either). Returns updated info.
 */
export function recordStreak(activity: StreakActivity): StreakInfo {
  const all = getAllStreaks();
  const data = all[activity];
  const today = todayStr();
  const yesterday = yesterdayStr();

  if (data.lastActiveDate === today) {
    // Already active today — return current info
    return getStreakInfo(activity);
  }

  if (data.lastActiveDate === yesterday) {
    // Continued streak!
    data.currentStreak += 1;
  } else if (data.lastActiveDate === "") {
    // First ever activity
    data.currentStreak = 1;
  } else {
    // Streak might be broken — check for freeze
    if (data.freezesAvailable > 0) {
      // Use a freeze — streak continues!
      data.freezesAvailable -= 1;
      data.freezesUsed += 1;
      data.currentStreak += 1;
      // Note: freeze is used silently; the user sees their streak continue
    } else {
      // No freeze — streak broken, restart at 1
      data.currentStreak = 1;
    }
  }

  data.bestStreak = Math.max(data.bestStreak, data.currentStreak);
  data.lastActiveDate = today;
  data.totalDays += 1;
  data.history = [...data.history, today].slice(-60); // keep last 60 days

  all[activity] = data;
  saveStreaks(all);

  return getStreakInfo(activity);
}

/**
 * Get current streak info without modifying it.
 */
export function getStreakInfo(activity: StreakActivity): StreakInfo {
  const all = getAllStreaks();
  const data = all[activity];
  const today = todayStr();

  // Check if streak is still alive (last active was today or yesterday)
  const yesterday = yesterdayStr();
  if (data.lastActiveDate !== today && data.lastActiveDate !== yesterday) {
    // Streak is broken — currentStreak should be 0 for display
    return {
      currentStreak: 0,
      bestStreak: data.bestStreak,
      totalDays: data.totalDays,
      lastActiveDate: data.lastActiveDate,
      isActiveToday: false,
      nextMilestone: getNextMilestone(0),
      milestoneProgress: 0,
    };
  }

  const current = data.lastActiveDate === today ? data.currentStreak : 0;
  // If last active was yesterday, currentStreak is still "alive" but not yet incremented today
  // We show the streak number but it's "at risk" if not done today
  const displayStreak = data.lastActiveDate === yesterday ? data.currentStreak : current;
  const nextMilestone = getNextMilestone(displayStreak);
  const prevMilestone = getPrevMilestone(displayStreak);
  const milestoneProgress =
    nextMilestone === prevMilestone
      ? 100
      : Math.round(((displayStreak - prevMilestone) / (nextMilestone - prevMilestone)) * 100);

  return {
    currentStreak: displayStreak,
    bestStreak: data.bestStreak,
    totalDays: data.totalDays,
    lastActiveDate: data.lastActiveDate,
    isActiveToday: data.lastActiveDate === today,
    nextMilestone,
    milestoneProgress,
  };
}

// Milestones: 3, 7, 14, 30, 60, 90, 180, 365 days
const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

function getNextMilestone(current: number): number {
  for (const m of MILESTONES) {
    if (current < m) return m;
  }
  return current + 365; // past 365, next is +1 year
}

function getPrevMilestone(current: number): number {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (current >= MILESTONES[i]) return MILESTONES[i];
  }
  return 0;
}

export const STREAK_MILESTONES = MILESTONES;

export const STREAK_LABELS: Record<StreakActivity, { singular: string; plural: string; verb: string }> = {
  bible_reading: { singular: "day", plural: "days", verb: "reading the Bible" },
  trivia_play: { singular: "day", plural: "days", verb: "playing trivia" },
  prayer_share: { singular: "day", plural: "days", verb: "sharing prayers" },
};

/**
 * Add a streak freeze to a specific activity (e.g., from daily spin reward).
 */
export function addStreakFreeze(activity: StreakActivity): void {
  const all = getAllStreaks();
  all[activity].freezesAvailable += 1;
  saveStreaks(all);
}

/**
 * Get the number of available freezes for all activities.
 */
export function getTotalFreezes(): number {
  const all = getAllStreaks();
  return Object.values(all).reduce((sum, d) => sum + d.freezesAvailable, 0);
}
