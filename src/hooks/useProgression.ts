import { useMemo } from "react";
import { useAppData } from "@/context/AppDataContext";
import { getLevelProgress, getSeasonLabel, getSeasonStart, getWeekStart } from "@/lib/progression";

type ActivityRow = Record<string, unknown> & {
  created_at?: string;
  activity_type?: string;
  metadata?: Record<string, unknown> | null;
};

function getActivityUnit(row: Record<string, unknown>): string | null {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;

  const unit = (metadata as Record<string, unknown>).unit;
  if (typeof unit !== "string") return null;
  const normalized = unit.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function isXpActivity(row: Record<string, unknown>): boolean {
  const unit = getActivityUnit(row);
  if (unit === "xp") return true;
  if (unit === "bix") return false;

  const activityType = typeof row.activity_type === "string" ? row.activity_type : "";
  if (activityType === "staking" || activityType === "referral" || activityType === "task_completion") {
    return false;
  }

  return true;
}

function extractXpValue(row: Record<string, unknown>): number {
  if (!isXpActivity(row)) return 0;

  const raw = row.xp_amount ?? row.points_earned ?? row.amount ?? 0;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function useProgression(userId?: string) {
  const { user, activities, leaderboards, loading } = useAppData();

  const progression = useMemo(() => {
    const weekStart = getWeekStart();
    const seasonStart = getSeasonStart();
    const activityRows = (activities ?? []) as ActivityRow[];

    const totalXp = Number(user?.total_xp || 0);
    let weeklyXp = 0;
    let seasonXp = 0;

    for (const activity of activityRows) {
      const createdAtRaw = activity.created_at;
      if (!createdAtRaw || typeof createdAtRaw !== "string") continue;
      const createdAt = new Date(createdAtRaw);
      const amount = extractXpValue(activity);
      if (createdAt >= weekStart) weeklyXp += amount;
      if (createdAt >= seasonStart) seasonXp += amount;
    }

    return {
      totalXp,
      weeklyXp,
      seasonXp,
      currentLevel: Number(user?.current_level || 1),
      levelName: String(user?.level_name || "Explorer"),
      levelProgress: getLevelProgress(totalXp),
      seasonLabel: getSeasonLabel(),
    };
  }, [activities, user?.current_level, user?.level_name, user?.total_xp]);

  const disabled = !userId || userId !== user?.id;
  const queryLike = { data: disabled ? undefined : progression, isLoading: loading.user || loading.activities, isError: false };

  return {
    progressionQuery: queryLike,
    weeklyRankQuery: { data: disabled ? undefined : leaderboards.weekly, isLoading: loading.leaderboard, isError: false },
    seasonRankQuery: { data: disabled ? undefined : leaderboards.season, isLoading: loading.leaderboard, isError: false },
  };
}
