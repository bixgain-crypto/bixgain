import { AppLayout } from "@/components/AppLayout";
import { LevelBadge } from "@/components/LevelBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardResponse,
} from "@/lib/leaderboardApi";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { Crown, Medal, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function buildRows(data: LeaderboardResponse | undefined): LeaderboardEntry[] {
  if (!data) return [];
  return data.current_user && !data.top.some((row) => row.user_id === data.current_user!.user_id)
    ? [...data.top, data.current_user]
    : data.top;
}

function getCurrentUser(
  data: LeaderboardResponse | undefined,
  rows: LeaderboardEntry[],
): LeaderboardEntry | null {
  if (data?.current_user) return data.current_user;
  return rows.find((row) => row.is_current_user) || null;
}

function formatGeneratedAt(value: string | undefined): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function rankClass(rank: number): string {
  if (rank === 1) return "bg-warning/15 text-warning border-warning/30";
  if (rank === 2) return "bg-secondary text-foreground border-border";
  if (rank === 3) return "bg-accent/20 text-accent border-accent/30";
  return "bg-secondary/35 text-muted-foreground border-border/70";
}

export default function Leaderboard() {
  const { session } = useAuth();
  const { leaderboards, refreshLeaderboard, loading } = useAppData();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");

  useEffect(() => {
    if (!session?.user?.id) return;
    void refreshLeaderboard(period);
  }, [period, refreshLeaderboard, session?.user?.id]);

  const activeData = leaderboards[period];
  const rows = useMemo(() => buildRows(activeData), [activeData]);
  const currentUser = useMemo(() => getCurrentUser(activeData, rows), [activeData, rows]);
  const generatedAt = useMemo(() => formatGeneratedAt(activeData?.generated_at), [activeData?.generated_at]);
  const totalPlayers = Number(activeData?.total_players ?? rows.length);

  if (!session?.user?.id) {
    return (
      <AppLayout>
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Sign in to access leaderboard rankings.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold flex items-center gap-2 sm:gap-3">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rank by XP across Weekly, Season, and All Time competition.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="glass rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Players</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{totalPlayers.toLocaleString()}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Your Rank</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold">
              {currentUser ? `#${currentUser.rank.toLocaleString()}` : "--"}
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Your XP</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-gradient-gold">
              {currentUser ? formatXp(currentUser.xp) : "--"}
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Updated</p>
            <p className="mt-1 text-sm sm:text-base font-medium break-words">{generatedAt}</p>
          </div>
        </div>

        <Tabs value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}>
          <TabsList className="w-full max-w-xl bg-transparent p-0 grid grid-cols-3 gap-2">
            <TabsTrigger value="weekly" className="glass rounded-xl px-3 sm:px-6 py-2 text-xs sm:text-sm">Weekly</TabsTrigger>
            <TabsTrigger value="season" className="glass rounded-xl px-3 sm:px-6 py-2 text-xs sm:text-sm">Season</TabsTrigger>
            <TabsTrigger value="all_time" className="glass rounded-xl px-3 sm:px-6 py-2 text-xs sm:text-sm">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="glass rounded-2xl overflow-hidden">
          {loading.leaderboard && !activeData ? (
            <div className="p-6 text-sm text-muted-foreground">Loading leaderboard...</div>
          ) : rows.length > 0 ? (
            <>
              <div className="md:hidden divide-y divide-border/50">
                {rows.map((row) => (
                  <div
                    key={row.user_id}
                    className={`p-3 ${
                      row.is_current_user ? "bg-primary/10 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono ${rankClass(row.rank)}`}>
                            #{row.rank}
                          </span>
                          {row.rank === 1 ? <Crown className="h-3.5 w-3.5 text-warning" /> : null}
                          {row.rank === 2 || row.rank === 3 ? <Medal className="h-3.5 w-3.5 text-primary" /> : null}
                        </div>
                        <p className="mt-1 truncate font-semibold text-sm">{row.username}</p>
                        {row.is_current_user ? <p className="text-[10px] text-primary">You</p> : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm text-primary">{formatXp(row.xp)}</p>
                        <LevelBadge totalXp={row.xp} compact className="mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <div className="grid grid-cols-[88px_minmax(0,1fr)_170px_190px] gap-3 px-5 py-3 border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <span>Rank</span>
                  <span>User</span>
                  <span>XP</span>
                  <span>Level</span>
                </div>
                <div className="divide-y divide-border/50">
                  {rows.map((row) => (
                    <div
                      key={row.user_id}
                      className={`grid grid-cols-[88px_minmax(0,1fr)_170px_190px] gap-3 items-center px-5 py-3 ${
                        row.is_current_user ? "bg-primary/10 border-l-2 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono ${rankClass(row.rank)}`}>
                          #{row.rank}
                        </span>
                        {row.rank === 1 ? <Crown className="h-4 w-4 text-warning" /> : null}
                        {row.rank === 2 || row.rank === 3 ? <Medal className="h-4 w-4 text-primary" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.username}</p>
                        {row.is_current_user ? <p className="text-xs text-primary">You</p> : null}
                      </div>
                      <p className="font-mono text-primary">{formatXp(row.xp)}</p>
                      <div className="flex items-center">
                        <LevelBadge totalXp={row.xp} compact className="lg:hidden" />
                        <LevelBadge totalXp={row.xp} className="hidden lg:inline-flex" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No leaderboard data yet.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
