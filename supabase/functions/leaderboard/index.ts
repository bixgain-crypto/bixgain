import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAuthenticatedUserId,
  getBearerToken,
  parseRequestBody,
  respond,
} from "../_shared/progression.ts";

type LeaderboardPeriod = "weekly" | "season" | "all_time";

type UserRow = {
  id: string;
  username: string | null;
  total_xp: number | null;
  weekly_xp: number | null;
  season_xp: number | null;
  current_level: number | null;
  level_name: string | null;
};

type RankedRow = {
  user_id: string;
  username: string;
  xp: number;
  level: number;
  level_name: string;
};

const FUNCTION_VERSION = "leaderboard-users-xp-2026-03-09";

const SEASON_NAMES = ["Winter", "Spring", "Summer", "Autumn"] as const;

function getSeasonLabel(now = new Date()): string {
  const quarter = Math.floor(now.getUTCMonth() / 3);
  return `${SEASON_NAMES[quarter]} ${now.getUTCFullYear()}`;
}

function safeUsername(userId: string, username: string | null | undefined): string {
  if (username && username.trim().length > 0) return username.trim();
  return `User-${userId.slice(0, 6)}`;
}

function extractPeriodXp(period: LeaderboardPeriod, row: UserRow): number {
  const raw =
    period === "weekly"
      ? row.weekly_xp
      : period === "season"
        ? row.season_xp
        : row.total_xp;
  const numeric = Number(raw ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function sortRank(rows: RankedRow[]): RankedRow[] {
  return rows.sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    return a.user_id.localeCompare(b.user_id);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Missing Supabase environment configuration" }, 500);
    }

    const token = getBearerToken(req);
    if (!token) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const currentUserId = await getAuthenticatedUserId(
      supabaseUrl,
      req.headers.get("Authorization") || "",
    );
    if (!currentUserId) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const body = parseRequestBody(await req.text());
    const periodCandidate = body.period;
    const period: LeaderboardPeriod =
      periodCandidate === "weekly" || periodCandidate === "season" || periodCandidate === "all_time"
        ? periodCandidate
        : "weekly";

    const limitCandidate = Number(body.limit ?? 25);
    const limit = Number.isFinite(limitCandidate)
      ? Math.max(1, Math.min(100, Math.floor(limitCandidate)))
      : 25;

    const admin: any = createClient(supabaseUrl, serviceKey);

    // IMPORTANT: We rank using the denormalized counters stored on users
    // (weekly_xp/season_xp/total_xp). This ensures players still appear even
    // if their activities table does not include recent rows for the period.
    const { data: users, error } = await admin
      .from("users")
      .select("id, username, total_xp, weekly_xp, season_xp, current_level, level_name");

    if (error) {
      return respond({ error: error.message }, 500);
    }

    const rows = (users ?? []) as UserRow[];

    let ranked = sortRank(
      rows.map((row) => ({
        user_id: row.id,
        username: safeUsername(row.id, row.username),
        xp: extractPeriodXp(period, row),
        level: Number(row.current_level || 1),
        level_name: String(row.level_name || "Explorer"),
      })),
    );

    // Ensure current user is always represented even if their user row is missing.
    if (!ranked.some((row) => row.user_id === currentUserId)) {
      ranked = sortRank([
        ...ranked,
        {
          user_id: currentUserId,
          username: safeUsername(currentUserId, null),
          xp: 0,
          level: 1,
          level_name: "Explorer",
        },
      ]);
    }

    const rankByUser = new Map<string, number>();
    ranked.forEach((row, index) => rankByUser.set(row.user_id, index + 1));

    const top = ranked.slice(0, limit).map((row) => ({
      ...row,
      rank: rankByUser.get(row.user_id) || 0,
      is_current_user: row.user_id === currentUserId,
    }));

    const current = ranked.find((row) => row.user_id === currentUserId);
    const current_user = current
      ? {
          ...current,
          rank: rankByUser.get(current.user_id) || 0,
          is_current_user: true,
        }
      : null;

    return respond({
      version: FUNCTION_VERSION,
      period,
      generated_at: new Date().toISOString(),
      season_label: getSeasonLabel(),
      total_players: ranked.length,
      top,
      current_user,
    });
  } catch (err) {
    console.error("Leaderboard error:", (err as Error).message);
    return respond({ error: "An error occurred processing your request" }, 500);
  }
});
