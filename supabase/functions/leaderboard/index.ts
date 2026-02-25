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
  current_level: number | null;
  level_name: string | null;
};

type ActivityRow = Record<string, unknown> & {
  user_id?: string;
  created_at?: string;
};

type RankedRow = {
  user_id: string;
  username: string;
  xp: number;
  level: number;
  level_name: string;
};

const SEASON_NAMES = ["Winter", "Spring", "Summer", "Autumn"] as const;

function getWeekStartISO(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString();
}

function getSeasonStartISO(now = new Date()): string {
  const quarter = Math.floor(now.getUTCMonth() / 3);
  return new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1, 0, 0, 0, 0)).toISOString();
}

function getSeasonLabel(now = new Date()): string {
  const quarter = Math.floor(now.getUTCMonth() / 3);
  return `${SEASON_NAMES[quarter]} ${now.getUTCFullYear()}`;
}

function extractActivityXp(row: Record<string, unknown>): number {
  const raw = row.xp_amount ?? row.points_earned ?? row.amount ?? 0;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function safeUsername(userId: string, username: string | null | undefined): string {
  if (username && username.trim().length > 0) return username.trim();
  return `User-${userId.slice(0, 6)}`;
}

async function fetchPagedActivities(admin: ReturnType<typeof createClient>, sinceIso: string): Promise<ActivityRow[]> {
  const pageSize = 1000;
  const rows: ActivityRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("activities")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const chunk = (data ?? []) as ActivityRow[];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
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

    const admin = createClient(supabaseUrl, serviceKey);
    const userMap = new Map<string, UserRow>();
    let ranked: RankedRow[] = [];

    if (period === "all_time") {
      const { data: users, error } = await admin
        .from("users")
        .select("id, username, total_xp, current_level, level_name");

      if (error) {
        return respond({ error: error.message }, 500);
      }

      const rows = (users ?? []) as UserRow[];
      ranked = sortRank(
        rows.map((row) => ({
          user_id: row.id,
          username: safeUsername(row.id, row.username),
          xp: Number(row.total_xp || 0),
          level: Number(row.current_level || 1),
          level_name: String(row.level_name || "Explorer"),
        })),
      );
    } else {
      const sinceIso = period === "weekly" ? getWeekStartISO() : getSeasonStartISO();
      const activities = await fetchPagedActivities(admin, sinceIso);
      const xpByUser = new Map<string, number>();

      for (const row of activities) {
        const userId = row.user_id;
        if (!userId) continue;
        const xp = extractActivityXp(row);
        if (xp <= 0) continue;
        xpByUser.set(userId, (xpByUser.get(userId) || 0) + xp);
      }

      if (!xpByUser.has(currentUserId)) {
        xpByUser.set(currentUserId, 0);
      }

      const userIds = Array.from(xpByUser.keys());
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await admin
          .from("users")
          .select("id, username, total_xp, current_level, level_name")
          .in("id", userIds);

        if (usersError) {
          return respond({ error: usersError.message }, 500);
        }

        for (const row of (users ?? []) as UserRow[]) {
          userMap.set(row.id, row);
        }
      }

      ranked = sortRank(
        userIds.map((id) => {
          const row = userMap.get(id);
          return {
            user_id: id,
            username: safeUsername(id, row?.username),
            xp: Number(xpByUser.get(id) || 0),
            level: Number(row?.current_level || 1),
            level_name: String(row?.level_name || "Explorer"),
          };
        }),
      );
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
      period,
      generated_at: new Date().toISOString(),
      season_label: getSeasonLabel(),
      total_players: ranked.length,
      top,
      current_user,
    });
  } catch (err) {
    return respond({ error: (err as Error).message }, 500);
  }
});
