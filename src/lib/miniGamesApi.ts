import { supabase } from "@/integrations/supabase/client";

type JsonRecord = Record<string, unknown>;

export type MiniGameStatus = "active" | "beta" | "coming_soon";

export type MiniGameCatalogItem = {
  slug: string;
  name: string;
  description: string;
  reward_rate: string;
  status: MiniGameStatus;
  xp_per_unit: number;
  max_score: number;
  max_xp: number;
  playable: boolean;
};

export type MiniGameOverview = {
  conversion_rate: string;
  energy: number;
  max_energy: number;
  last_refill: string | null;
  streak_count: number;
  streak_last_date: string | null;
  today_games_played: number;
  stats: {
    total_games_played: number;
    total_xp_from_games: number;
    total_bix_earned_from_games: number;
    best_score_per_game: Record<string, number>;
    pending_lucky_bix: number;
  };
  games: MiniGameCatalogItem[];
};

export type MiniGameDailyBonusResult = {
  already_claimed: boolean;
  bonus_xp: number;
  streak_count: number;
};

export type MiniGameSessionStartResult = {
  session_id: string;
  game_slug: string;
  game_name: string;
  status: MiniGameStatus;
  energy_remaining: number;
  plays_today: number;
  max_plays_per_day: number;
  xp_per_unit: number;
  max_score: number;
  max_xp: number;
  conversion_rate: string;
};

export type MiniGameSubmitResult = {
  session_id: string;
  score_id: string;
  game_slug: string;
  game_name: string;
  raw_score: number;
  xp_earned: number;
  bix_earned: number;
  bix_from_xp: number;
  energy_remaining: number;
  games_played_today: number;
  bonuses: {
    first_game_bonus_xp: number;
    combo_bonus_xp: number;
    lucky_bonus_xp: number;
    lucky_bonus_bix: number;
  };
  lucky_drop: {
    roll: number;
    xp: number;
    bix: number;
  };
  pending_bix: number;
};

export type MiniGameProfileStats = {
  user_id: string;
  total_games_played: number;
  total_xp_from_games: number;
  total_bix_earned_from_games: number;
  best_score_per_game: Record<string, number>;
};

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

async function invokeMiniGameRpc(functionName: string, payload: JsonRecord = {}): Promise<JsonRecord> {
  const { data, error } = await supabase.rpc(functionName as never, payload as never);
  if (error) throw new Error(error.message);

  const normalized = asObject(data);
  if (normalized.success === false && typeof normalized.error === "string") {
    throw new Error(normalized.error);
  }
  return normalized;
}

function parseBestScores(value: unknown): Record<string, number> {
  const source = asObject(value);
  return Object.entries(source).reduce<Record<string, number>>((acc, [key, raw]) => {
    acc[key] = Math.max(0, Math.floor(asNumber(raw)));
    return acc;
  }, {});
}

export async function getMiniGamesOverview(): Promise<MiniGameOverview> {
  const payload = await invokeMiniGameRpc("mini_game_get_overview");
  const stats = asObject(payload.stats);
  const games = Array.isArray(payload.games) ? payload.games : [];

  return {
    conversion_rate: asString(payload.conversion_rate) || "10000 XP = 1 BIX",
    energy: Math.max(0, Math.floor(asNumber(payload.energy))),
    max_energy: Math.max(1, Math.floor(asNumber(payload.max_energy || 5))),
    last_refill: typeof payload.last_refill === "string" ? payload.last_refill : null,
    streak_count: Math.max(0, Math.floor(asNumber(payload.streak_count))),
    streak_last_date: typeof payload.streak_last_date === "string" ? payload.streak_last_date : null,
    today_games_played: Math.max(0, Math.floor(asNumber(payload.today_games_played))),
    stats: {
      total_games_played: Math.max(0, Math.floor(asNumber(stats.total_games_played))),
      total_xp_from_games: Math.max(0, Math.floor(asNumber(stats.total_xp_from_games))),
      total_bix_earned_from_games: Math.max(0, asNumber(stats.total_bix_earned_from_games)),
      best_score_per_game: parseBestScores(stats.best_score_per_game),
      pending_lucky_bix: Math.max(0, asNumber(stats.pending_lucky_bix)),
    },
    games: games.map((row) => {
      const item = asObject(row);
      const statusRaw = asString(item.status).toLowerCase();
      const status: MiniGameStatus =
        statusRaw === "active" || statusRaw === "beta" ? (statusRaw as MiniGameStatus) : "coming_soon";
      return {
        slug: asString(item.slug),
        name: asString(item.name),
        description: asString(item.description),
        reward_rate: asString(item.reward_rate),
        status,
        xp_per_unit: Math.max(0, Math.floor(asNumber(item.xp_per_unit))),
        max_score: Math.max(0, Math.floor(asNumber(item.max_score))),
        max_xp: Math.max(0, Math.floor(asNumber(item.max_xp))),
        playable: item.playable === true,
      };
    }),
  };
}

export async function claimMiniGamesDailyLoginBonus(): Promise<MiniGameDailyBonusResult> {
  const payload = await invokeMiniGameRpc("mini_game_claim_daily_login_bonus");
  return {
    already_claimed: payload.already_claimed === true,
    bonus_xp: Math.max(0, Math.floor(asNumber(payload.bonus_xp))),
    streak_count: Math.max(0, Math.floor(asNumber(payload.streak_count))),
  };
}

export async function startMiniGameSession(
  gameSlug: string,
  clientMeta?: JsonRecord,
): Promise<MiniGameSessionStartResult> {
  const payload = await invokeMiniGameRpc("mini_game_start_session", {
    p_game_slug: gameSlug,
    p_client_meta: clientMeta || {},
  });

  const statusRaw = asString(payload.status).toLowerCase();
  const status: MiniGameStatus =
    statusRaw === "active" || statusRaw === "beta" ? (statusRaw as MiniGameStatus) : "coming_soon";

  return {
    session_id: asString(payload.session_id),
    game_slug: asString(payload.game_slug),
    game_name: asString(payload.game_name),
    status,
    energy_remaining: Math.max(0, Math.floor(asNumber(payload.energy_remaining))),
    plays_today: Math.max(0, Math.floor(asNumber(payload.plays_today))),
    max_plays_per_day: Math.max(1, Math.floor(asNumber(payload.max_plays_per_day))),
    xp_per_unit: Math.max(0, Math.floor(asNumber(payload.xp_per_unit))),
    max_score: Math.max(0, Math.floor(asNumber(payload.max_score))),
    max_xp: Math.max(0, Math.floor(asNumber(payload.max_xp))),
    conversion_rate: asString(payload.conversion_rate) || "10000 XP = 1 BIX",
  };
}

export async function submitMiniGameScore(
  sessionId: string,
  score: number,
  clientMeta?: JsonRecord,
): Promise<MiniGameSubmitResult> {
  const payload = await invokeMiniGameRpc("mini_game_submit_score", {
    p_session_id: sessionId,
    p_score: Math.max(0, Math.floor(score)),
    p_client_meta: clientMeta || {},
  });

  const bonuses = asObject(payload.bonuses);
  const lucky = asObject(payload.lucky_drop);

  return {
    session_id: asString(payload.session_id),
    score_id: asString(payload.score_id),
    game_slug: asString(payload.game_slug),
    game_name: asString(payload.game_name),
    raw_score: Math.max(0, Math.floor(asNumber(payload.raw_score))),
    xp_earned: Math.max(0, Math.floor(asNumber(payload.xp_earned))),
    bix_earned: Math.max(0, asNumber(payload.bix_earned)),
    bix_from_xp: Math.max(0, asNumber(payload.bix_from_xp)),
    energy_remaining: Math.max(0, Math.floor(asNumber(payload.energy_remaining))),
    games_played_today: Math.max(0, Math.floor(asNumber(payload.games_played_today))),
    bonuses: {
      first_game_bonus_xp: Math.max(0, Math.floor(asNumber(bonuses.first_game_bonus_xp))),
      combo_bonus_xp: Math.max(0, Math.floor(asNumber(bonuses.combo_bonus_xp))),
      lucky_bonus_xp: Math.max(0, Math.floor(asNumber(bonuses.lucky_bonus_xp))),
      lucky_bonus_bix: Math.max(0, asNumber(bonuses.lucky_bonus_bix)),
    },
    lucky_drop: {
      roll: asNumber(lucky.roll),
      xp: Math.max(0, Math.floor(asNumber(lucky.xp))),
      bix: Math.max(0, asNumber(lucky.bix)),
    },
    pending_bix: Math.max(0, asNumber(payload.pending_bix)),
  };
}

export async function getMiniGameProfileStats(userId?: string): Promise<MiniGameProfileStats> {
  const payload = await invokeMiniGameRpc("mini_game_get_profile_stats", {
    p_user_id: userId || null,
  });

  return {
    user_id: asString(payload.user_id),
    total_games_played: Math.max(0, Math.floor(asNumber(payload.total_games_played))),
    total_xp_from_games: Math.max(0, Math.floor(asNumber(payload.total_xp_from_games))),
    total_bix_earned_from_games: Math.max(0, asNumber(payload.total_bix_earned_from_games)),
    best_score_per_game: parseBestScores(payload.best_score_per_game),
  };
}
