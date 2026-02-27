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
import { Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function buildRows(data: LeaderboardResponse | undefined): LeaderboardEntry[] {
  if (!data) return [];
  return data.current_user && !data.top.some((row) => row.user_id === data.current_user!.user_id)
    ? [...data.top, data.current_user]
    : data.top;
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
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rank by XP across Weekly, Season, and All Time competition.
          </p>
        </motion.div>

        <Tabs value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}>
          <TabsList className="w-full sm:w-auto bg-transparent p-0 grid grid-cols-3 gap-2">
            <TabsTrigger value="weekly" className="glass rounded-xl px-6 py-2">Weekly</TabsTrigger>
            <TabsTrigger value="season" className="glass rounded-xl px-6 py-2">Season</TabsTrigger>
            <TabsTrigger value="all_time" className="glass rounded-xl px-6 py-2">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_120px_120px] gap-3 px-4 py-3 border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
            <span>Rank</span>
            <span>User</span>
            <span>XP</span>
            <span>Level</span>
          </div>

          {loading.leaderboard && !activeData ? (
            <div className="p-6 text-sm text-muted-foreground">Loading leaderboard...</div>
          ) : rows.length > 0 ? (
            <div className="divide-y divide-border/50">
              {rows.map((row) => (
                <div
                  key={row.user_id}
                  className={`grid grid-cols-[80px_1fr_120px_120px] gap-3 px-4 py-3 items-center ${
                    row.is_current_user ? "bg-primary/10 border-l-2 border-primary" : "bg-transparent"
                  }`}
                >
                  <span className="font-mono text-sm">{`#${row.rank}`}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.username}</p>
                    {row.is_current_user && <p className="text-xs text-primary">You</p>}
                  </div>
                  <span className="font-mono text-sm text-primary">{formatXp(row.xp)}</span>
                  <div className="flex items-center gap-2">
                    <LevelBadge totalXp={row.xp} compact />
                    <span className="text-xs text-muted-foreground hidden sm:inline">{row.level_name}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No leaderboard data yet.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
