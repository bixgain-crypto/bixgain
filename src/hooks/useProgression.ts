import { fetchLeaderboard } from "@/lib/leaderboardApi";
import { getLevelProgress, getSeasonLabel, getSeasonStart, getWeekStart } from "@/lib/progression";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type CoreUserRow = {
  id: string;
  total_xp: number;
  current_level: number;
  level_name: string;
};

type ActivityRow = Record<string, unknown> & {
  created_at?: string;
};

function extractXpValue(row: Record<string, unknown>): number {
  const raw = row.xp_amount ?? row.points_earned ?? row.amount ?? 0;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function fetchActivityRows(userId: string): Promise<ActivityRow[]> {
  const pageSize = 1000;
  const rows: ActivityRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
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

export function useProgression(userId?: string) {
  const progressionQuery = useQuery({
    queryKey: ["progression-summary", userId],
    enabled: !!userId,
    queryFn: async () => {
      const weekStart = getWeekStart();
      const seasonStart = getSeasonStart();

      const [{ data: user }, activities] = await Promise.all([
        supabase
          .from("users" as never)
          .select("id, total_xp, current_level, level_name")
          .eq("id", userId!)
          .maybeSingle(),
        fetchActivityRows(userId!),
      ]);

      const coreUser = (user ?? null) as CoreUserRow | null;
      const totalXp = Number(coreUser?.total_xp || 0);
      let weeklyXp = 0;
      let seasonXp = 0;

      for (const activity of activities) {
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
        currentLevel: Number(coreUser?.current_level || 1),
        levelName: String(coreUser?.level_name || "Explorer"),
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
