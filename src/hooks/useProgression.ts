import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchLeaderboard } from "@/lib/leaderboardApi";
import { getLevelProgress, getSeasonLabel, getSeasonStart, getWeekStart } from "@/lib/progression";

type ActivityRow = {
  points_earned: number;
  created_at: string;
};

type SpinRow = {
  reward_amount: number;
  spun_at: string;
};

async function fetchActivityRows(userId: string): Promise<ActivityRow[]> {
  const pageSize = 1000;
  const rows: ActivityRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("activities")
      .select("points_earned, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const chunk = (data ?? []) as ActivityRow[];
    rows.push(...chunk);

    if (chunk.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function fetchSpinRows(userId: string): Promise<SpinRow[]> {
  const pageSize = 1000;
  const rows: SpinRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("spin_records")
      .select("reward_amount, spun_at")
      .eq("user_id", userId)
      .order("spun_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const chunk = (data ?? []) as SpinRow[];
    rows.push(...chunk);

    if (chunk.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

export function useProgression(userId?: string) {
  const progressionQuery = useQuery({
    queryKey: ["progression-summary", userId],
    enabled: !!userId,
    queryFn: async () => {
      const weekStart = getWeekStart();
      const seasonStart = getSeasonStart();

      const [activities, spins] = await Promise.all([
        fetchActivityRows(userId!),
        fetchSpinRows(userId!),
      ]);

      let totalXp = 0;
      let weeklyXp = 0;
      let seasonXp = 0;

      for (const activity of activities) {
        const amount = Number(activity.points_earned || 0);
        const createdAt = new Date(activity.created_at);
        totalXp += amount;
        if (createdAt >= weekStart) weeklyXp += amount;
        if (createdAt >= seasonStart) seasonXp += amount;
      }

      for (const spin of spins) {
        const amount = Number(spin.reward_amount || 0);
        const spunAt = new Date(spin.spun_at);
        totalXp += amount;
        if (spunAt >= weekStart) weeklyXp += amount;
        if (spunAt >= seasonStart) seasonXp += amount;
      }

      return {
        totalXp,
        weeklyXp,
        seasonXp,
        levelProgress: getLevelProgress(totalXp),
        seasonLabel: getSeasonLabel(),
      };
    },
  });

  const weeklyRankQuery = useQuery({
    queryKey: ["leaderboard", "weekly", userId],
    enabled: !!userId,
    queryFn: () => fetchLeaderboard("weekly", 5),
  });

  const seasonRankQuery = useQuery({
    queryKey: ["leaderboard", "season", userId],
    enabled: !!userId,
    queryFn: () => fetchLeaderboard("season", 5),
  });

  return {
    progressionQuery,
    weeklyRankQuery,
    seasonRankQuery,
  };
}
