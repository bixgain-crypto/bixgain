import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppDataContext";
import type { LeaderboardPeriod } from "@/lib/leaderboardApi";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { Crown, Medal, Sparkles, Timer, Trophy, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string; icon: typeof Trophy }[] = [
  { value: "weekly", label: "Weekly", icon: Timer },
  { value: "season", label: "Season", icon: Crown },
  { value: "all_time", label: "All Time", icon: Medal },
];

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-300",
  2: "text-slate-300",
  3: "text-amber-600",
};

const RANK_BG: Record<number, string> = {
  1: "bg-amber-500/10 border-amber-500/30",
  2: "bg-slate-400/10 border-slate-400/30",
  3: "bg-amber-700/10 border-amber-600/30",
};

export default function Leaderboard() {
  const { leaderboards, loading, refreshLeaderboard, session } = useAppData();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");

  const data = leaderboards[period];
  const isLoading = loading.leaderboard;

  const switchPeriod = useCallback(
    (next: LeaderboardPeriod) => {
      setPeriod(next);
      if (!leaderboards[next]) {
        void refreshLeaderboard(next);
      }
    },
    [leaderboards, refreshLeaderboard],
  );

  useEffect(() => {
    if (session && !leaderboards[period]) {
      void refreshLeaderboard(period);
    }
  }, [session, period, leaderboards, refreshLeaderboard]);

  const topEntries = data?.top ?? [];
  const currentUser = data?.current_user;
  const currentUserInTop = topEntries.some((e) => e.is_current_user);

  return (
    <AppLayout>
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_45%)]" />

          <div className="relative space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-primary" />
                  Leaderboard
                </h1>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
                  {data?.season_label
                    ? `${data.season_label} — ${data.total_players} players ranked`
                    : "Top performers ranked by XP"}
                </p>
              </div>

              {currentUser && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center min-w-[100px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Your Rank</p>
                  <p className="mt-1 text-2xl font-bold text-primary">#{currentUser.rank}</p>
                </div>
              )}
            </div>

            {/* Period tabs */}
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = period === opt.value;
                return (
                  <Button
                    key={opt.value}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => switchPeriod(opt.value)}
                    className={active ? "bg-gradient-gold text-primary-foreground font-semibold" : ""}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    {opt.label}
                  </Button>
                );
              })}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Players</p>
                <p className="mt-1 text-2xl font-bold">{data?.total_players ?? "--"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Your XP</p>
                <p className="mt-1 text-2xl font-bold text-gradient-gold">
                  {currentUser ? formatXp(currentUser.xp) : "--"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Your Level</p>
                <p className="mt-1 text-2xl font-bold">{currentUser?.level_name ?? "--"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Period</p>
                <p className="mt-1 text-2xl font-bold capitalize">{period.replace("_", " ")}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Rankings list */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl overflow-hidden"
        >
          {isLoading && !data ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : topEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Users className="h-10 w-10" />
              <p className="text-sm">No ranking data yet for this period.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {/* Header row */}
              <div className="grid grid-cols-[3rem_1fr_auto_auto] sm:grid-cols-[4rem_1fr_8rem_6rem] items-center gap-2 px-4 sm:px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground bg-secondary/20">
                <span>Rank</span>
                <span>Player</span>
                <span className="text-right">XP</span>
                <span className="text-right hidden sm:block">Level</span>
              </div>

              {topEntries.map((entry, index) => {
                const isMe = entry.is_current_user;
                const rankStyle = RANK_STYLES[entry.rank] || "";
                const rowBg = isMe
                  ? "bg-primary/5 border-l-2 border-l-primary"
                  : RANK_BG[entry.rank]
                    ? `${RANK_BG[entry.rank]}`
                    : "";

                return (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.02 * Math.min(index, 20) }}
                    className={`grid grid-cols-[3rem_1fr_auto_auto] sm:grid-cols-[4rem_1fr_8rem_6rem] items-center gap-2 px-4 sm:px-6 py-3 hover:bg-secondary/20 transition-colors ${rowBg}`}
                  >
                    {/* Rank */}
                    <span className={`text-lg font-bold ${rankStyle}`}>
                      {entry.rank <= 3 ? (
                        <span className="flex items-center gap-1">
                          {entry.rank === 1 && <Crown className="h-5 w-5 text-amber-300" />}
                          {entry.rank === 2 && <Medal className="h-5 w-5 text-slate-300" />}
                          {entry.rank === 3 && <Medal className="h-5 w-5 text-amber-600" />}
                        </span>
                      ) : (
                        `#${entry.rank}`
                      )}
                    </span>

                    {/* Player info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-secondary/60 border border-border/50 flex items-center justify-center text-xs font-bold uppercase shrink-0">
                        {entry.username?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isMe ? "text-primary" : ""}`}>
                          {entry.username}
                          {isMe && (
                            <Badge variant="secondary" className="ml-2 text-[10px] py-0 px-1.5">
                              You
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* XP */}
                    <p className="text-sm font-semibold text-right text-gradient-gold">
                      {formatXp(entry.xp)}
                    </p>

                    {/* Level */}
                    <p className="text-xs text-muted-foreground text-right hidden sm:block">
                      {entry.level_name}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Current user outside top — show their position */}
        {currentUser && !currentUserInTop && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-4 border border-primary/20"
          >
            <div className="grid grid-cols-[3rem_1fr_auto_auto] sm:grid-cols-[4rem_1fr_8rem_6rem] items-center gap-2">
              <span className="text-lg font-bold text-primary">#{currentUser.rank}</span>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold uppercase shrink-0">
                  {currentUser.username?.charAt(0) || "?"}
                </div>
                <p className="text-sm font-semibold text-primary truncate">
                  {currentUser.username}
                  <Badge variant="secondary" className="ml-2 text-[10px] py-0 px-1.5">You</Badge>
                </p>
              </div>
              <p className="text-sm font-semibold text-right text-gradient-gold">
                {formatXp(currentUser.xp)}
              </p>
              <p className="text-xs text-muted-foreground text-right hidden sm:block">
                {currentUser.level_name}
              </p>
            </div>
          </motion.section>
        )}

        {/* Refresh button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="flex justify-center"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshLeaderboard(period)}
            disabled={isLoading}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {isLoading ? "Refreshing…" : "Refresh Rankings"}
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
