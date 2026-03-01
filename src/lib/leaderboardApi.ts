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

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors.
  }
  return null;
}

async function extractInvokeMessage(error: unknown): Promise<string> {
  const candidate = (error ?? {}) as { message?: unknown; details?: unknown; context?: unknown };

  if (typeof candidate.details === "string" && candidate.details.trim().length > 0) {
    const json = parseJsonObject(candidate.details);
    if (json?.error && typeof json.error === "string") return json.error;
    if (json?.message && typeof json.message === "string") return json.message;
    return candidate.details;
  }

  const context = candidate.context;
  if (context && typeof context === "object" && "text" in context) {
    try {
      const responseLike = context as Response;
      const text = await responseLike.clone().text();
      if (text.trim().length > 0) {
        const json = parseJsonObject(text);
        if (json?.error && typeof json.error === "string") return json.error;
        if (json?.message && typeof json.message === "string") return json.message;
        return text;
      }
    } catch {
      // Ignore response parsing errors.
    }
  }

  if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
    return candidate.message;
  }

  return "Leaderboard unavailable";
}

function isJwtError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid jwt") || normalized.includes("jwt") || normalized.includes("unauthorized");
}

async function invokeLeaderboard(period: LeaderboardPeriod, limit: number, accessToken?: string) {
  return supabase.functions.invoke("leaderboard", {
    body: { period, limit },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export async function fetchLeaderboard(period: LeaderboardPeriod, limit = 25): Promise<LeaderboardResponse> {
  const { data, error } = await invokeLeaderboard(period, limit);

  if (!error) {
    if (data?.error) {
      throw new Error(String(data.error));
    }
    return data as LeaderboardResponse;
  }

  const firstMessage = await extractInvokeMessage(error);
  if (!isJwtError(firstMessage)) {
    throw new Error(firstMessage);
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshData.session?.access_token) {
    throw new Error(firstMessage);
  }

  const retry = await invokeLeaderboard(period, limit, refreshData.session.access_token);
  if (retry.error) {
    throw new Error(await extractInvokeMessage(retry.error));
  }

  if (retry.data?.error) {
    throw new Error(String(retry.data.error));
  }

  return retry.data as LeaderboardResponse;
}
