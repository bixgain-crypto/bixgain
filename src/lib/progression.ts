export type LevelTier = {
  level: number;
  name: string;
  minXp: number;
  badgeClass: string;
  ringClass: string;
  unlocks: string[];
};

export const LEVEL_TIERS: LevelTier[] = [
  {
    level: 1,
    name: "Explorer",
    minXp: 0,
    badgeClass: "bg-slate-500/20 text-slate-300 border-slate-400/30",
    ringClass: "ring-slate-400/40",
    unlocks: ["Starter Missions", "Base XP Rewards"],
  },
  {
    level: 2,
    name: "Builder",
    minXp: 5000,
    badgeClass: "bg-sky-500/20 text-sky-300 border-sky-400/30",
    ringClass: "ring-sky-400/40",
    unlocks: ["1.1x XP Multiplier", "Referral Missions"],
  },
  {
    level: 3,
    name: "Pro",
    minXp: 15000,
    badgeClass: "bg-violet-500/20 text-violet-300 border-violet-400/30",
    ringClass: "ring-violet-400/40",
    unlocks: ["Advanced Missions", "Weekly Challenge Queue"],
  },
  {
    level: 4,
    name: "Elite",
    minXp: 35000,
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    ringClass: "ring-amber-400/40",
    unlocks: ["1.2x XP Multiplier", "Elite Missions Access"],
  },
  {
    level: 5,
    name: "Legend",
    minXp: 70000,
    badgeClass: "bg-cyan-300/20 text-cyan-200 border-cyan-200/40",
    ringClass: "ring-cyan-200/50",
    unlocks: ["Diamond Identity Badge", "Season Power Bonus"],
  },
  {
    level: 6,
    name: "Master",
    minXp: 120000,
    badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
    ringClass: "ring-indigo-400/40",
    unlocks: ["Master Mission Track", "1.25x XP Multiplier"],
  },
  {
    level: 7,
    name: "Grandmaster",
    minXp: 185000,
    badgeClass: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30",
    ringClass: "ring-fuchsia-400/40",
    unlocks: ["Priority Event Queue", "Exclusive Seasonal Quests"],
  },
  {
    level: 8,
    name: "Mythic",
    minXp: 265000,
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-400/30",
    ringClass: "ring-rose-400/40",
    unlocks: ["1.35x XP Multiplier", "Mythic Rank Cosmetics"],
  },
  {
    level: 9,
    name: "Immortal",
    minXp: 360000,
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    ringClass: "ring-emerald-400/40",
    unlocks: ["Immortal League Access", "Endgame Mission Boosts"],
  },
  {
    level: 10,
    name: "Apex",
    minXp: 500000,
    badgeClass: "bg-yellow-300/20 text-yellow-200 border-yellow-200/40",
    ringClass: "ring-yellow-200/50",
    unlocks: ["Apex Identity Aura", "Top-Tier Reward Multipliers"],
  },
];

export const SEASON_NAMES = ["Winter", "Spring", "Summer", "Autumn"] as const;

export function getSeasonStart(input: Date = new Date()): Date {
  const year = input.getUTCFullYear();
  const month = input.getUTCMonth();
  const quarter = Math.floor(month / 3);
  return new Date(Date.UTC(year, quarter * 3, 1, 0, 0, 0, 0));
}

export function getSeasonLabel(input: Date = new Date()): string {
  const month = input.getUTCMonth();
  const quarter = Math.floor(month / 3);
  return `${SEASON_NAMES[quarter]} ${input.getUTCFullYear()}`;
}

export function getWeekStart(input: Date = new Date()): Date {
  const date = new Date(Date.UTC(
    input.getUTCFullYear(),
    input.getUTCMonth(),
    input.getUTCDate(),
    0,
    0,
    0,
    0,
  ));

  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

export function getLevelTier(totalXp: number): LevelTier {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  let current = LEVEL_TIERS[0];

  for (const tier of LEVEL_TIERS) {
    if (xp >= tier.minXp) {
      current = tier;
    } else {
      break;
    }
  }

  return current;
}

export function getNextLevelTier(totalXp: number): LevelTier | null {
  const current = getLevelTier(totalXp);
  return LEVEL_TIERS.find((tier) => tier.level === current.level + 1) ?? null;
}

export function getLevelProgress(totalXp: number): {
  current: LevelTier;
  next: LevelTier | null;
  xpIntoLevel: number;
  xpSpan: number;
  xpToNextLevel: number;
  progressPercent: number;
} {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  const current = getLevelTier(xp);
  const next = getNextLevelTier(xp);

  if (!next) {
    return {
      current,
      next: null,
      xpIntoLevel: 0,
      xpSpan: 1,
      xpToNextLevel: 0,
      progressPercent: 100,
    };
  }

  const xpIntoLevel = Math.max(0, xp - current.minXp);
  const xpSpan = Math.max(1, next.minXp - current.minXp);
  const xpToNextLevel = Math.max(0, next.minXp - xp);
  const progressPercent = Math.max(0, Math.min(100, (xpIntoLevel / xpSpan) * 100));

  return {
    current,
    next,
    xpIntoLevel,
    xpSpan,
    xpToNextLevel,
    progressPercent,
  };
}

export function formatXp(value: number): string {
  return Math.max(0, Math.floor(value || 0)).toLocaleString();
}

export function shortAddressLikeLabel(value: string): string {
  if (!value) return "User";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
