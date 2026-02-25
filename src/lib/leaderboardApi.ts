import { supabase } from "@/integrations/supabase/client";

export type LeaderboardPeriod = "weekly" | "season" | "all_time";

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  level_name: string;
  rank: number;
  is_current_user: boolean;
};

export type LeaderboardResponse = {
  period: LeaderboardPeriod;
  generated_at: string;
  season_label: string;
  total_players: number;
  top: LeaderboardEntry[];
  current_user: LeaderboardEntry | null;
};

export async function fetchLeaderboard(period: LeaderboardPeriod, limit = 25): Promise<LeaderboardResponse> {
  const { data, error } = await supabase.functions.invoke("leaderboard", {
    body: { period, limit },
  });

  if (error) {
    const fallbackMessage = (error as { message?: string }).message || "Leaderboard unavailable";
    throw new Error(fallbackMessage);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as LeaderboardResponse;
}
