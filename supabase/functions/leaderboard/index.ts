import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAuthenticatedUserId,
  getBearerToken,
  parseRequestBody,
  respond,
} from "../_shared/progression.ts";

type LeaderboardPeriod = "weekly" | "season" | "all_time";

type LevelMeta = {
  level: number;
  levelName: string;
};

type AggregatedRow = {
  user_id: string;
  xp: number;
};

const LEVEL_THRESHOLDS: Array<{ level: number; levelName: string; minXp: number }> = [
  { level: 1, levelName: "Explorer", minXp: 0 },
  { level: 2, levelName: "Builder", minXp: 5000 },
  { level: 3, levelName: "Pro", minXp: 15000 },
  { level: 4, levelName: "Elite", minXp: 35000 },
  { level: 5, levelName: "Legend", minXp: 70000 },
];

const SEASON_NAMES = ["Winter", "Spring", "Summer", "Autumn"];

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

function getLevelFromXp(xp: number): LevelMeta {
  let current = LEVEL_THRESHOLDS[0];
  for (const tier of LEVEL_THRESHOLDS) {
    if (xp >= tier.minXp) current = tier;
    else break;
  }

  return {
    level: current.level,
    levelName: current.levelName,
  };
}

function safeUsername(userId: string, displayName: string | null | undefined): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }
  return `User-${userId.slice(0, 6)}`;
}

async function fetchPagedRows(
  admin: any,
  table: "activities" | "spin_records",
  fields: string,
  dateColumn: string,
  sinceIso: string | null,
) {
  const pageSize = 1000;
  const rows: any[] = [];
  let from = 0;

  while (true) {
    let query = admin
      .from(table)
      .select(fields)
      .order(dateColumn, { ascending: false })
      .range(from, from + pageSize - 1);

    if (sinceIso) {
      query = query.gte(dateColumn, sinceIso);
    }

    const { data, error } = await query;
    if (error) throw error;

    const chunk = data ?? [];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
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

    const authHeader = req.headers.get("Authorization") || "";
    const currentUserId = await getAuthenticatedUserId(supabaseUrl, authHeader);
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

    let sinceIso: string | null = null;
    if (period === "weekly") sinceIso = getWeekStartISO();
    if (period === "season") sinceIso = getSeasonStartISO();

    const admin = createClient(supabaseUrl, serviceKey);
    const [activities, spins] = await Promise.all([
      fetchPagedRows(admin, "activities", "user_id, points_earned, created_at", "created_at", sinceIso),
      fetchPagedRows(admin, "spin_records", "user_id, reward_amount, spun_at", "spun_at", sinceIso),
    ]);

    const xpByUser = new Map<string, number>();

    for (const row of activities) {
      const xp = Number(row.points_earned || 0);
      if (!row.user_id || xp <= 0) continue;
      xpByUser.set(row.user_id, (xpByUser.get(row.user_id) || 0) + xp);
    }

    for (const row of spins) {
      const xp = Number(row.reward_amount || 0);
      if (!row.user_id || xp <= 0) continue;
      xpByUser.set(row.user_id, (xpByUser.get(row.user_id) || 0) + xp);
    }

    if (!xpByUser.has(currentUserId)) {
      xpByUser.set(currentUserId, 0);
    }

    const ranked: AggregatedRow[] = Array.from(xpByUser.entries())
      .map(([user_id, xp]) => ({ user_id, xp }))
      .sort((a, b) => {
        if (b.xp !== a.xp) return b.xp - a.xp;
        return a.user_id.localeCompare(b.user_id);
      });

    const rankByUser = new Map<string, number>();
    ranked.forEach((row, index) => rankByUser.set(row.user_id, index + 1));

    const topRows = ranked.slice(0, limit);
    const currentUserRow = ranked.find((row) => row.user_id === currentUserId) || null;

    const profileIds = Array.from(new Set([
      ...topRows.map((row) => row.user_id),
      ...(currentUserRow ? [currentUserRow.user_id] : []),
    ]));

    let profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    if (profileIds.length > 0) {
      const { data: profiles, error: profileError } = await admin
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", profileIds);

      if (profileError) {
        return respond({ error: profileError.message }, 500);
      }

      profileMap = new Map(
        (profiles || []).map((row: any) => [
          row.user_id,
          { display_name: row.display_name, avatar_url: row.avatar_url },
        ]),
      );
    }

    const toEntry = (row: AggregatedRow) => {
      const profile = profileMap.get(row.user_id);
      const level = getLevelFromXp(row.xp);
      return {
        user_id: row.user_id,
        username: safeUsername(row.user_id, profile?.display_name),
        avatar_url: profile?.avatar_url ?? null,
        xp: row.xp,
        level: level.level,
        level_name: level.levelName,
        rank: rankByUser.get(row.user_id) || 0,
        is_current_user: row.user_id === currentUserId,
      };
    };

    return respond({
      period,
      generated_at: new Date().toISOString(),
      season_label: getSeasonLabel(),
      total_players: ranked.length,
      top: topRows.map(toEntry),
      current_user: currentUserRow ? toEntry(currentUserRow) : null,
    });
  } catch (err) {
    return respond({ error: (err as Error).message }, 500);
  }
});
