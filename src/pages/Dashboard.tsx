import { AppLayout } from "@/components/AppLayout";
import { LevelBadge } from "@/components/LevelBadge";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/hooks/useProgression";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatXp, getLevelProgress } from "@/lib/progression";
import { motion } from "framer-motion";
import { ArrowRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

type MissionPreview = {
  id: string;
  name: string;
  reward_points: number;
};

function getDifficultyTag(rewardXp: number): "Easy" | "Medium" | "Hard" {
  if (rewardXp >= 180) return "Hard";
  if (rewardXp >= 80) return "Medium";
  return "Easy";
}

function difficultyClass(difficulty: "Easy" | "Medium" | "Hard") {
  if (difficulty === "Hard") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (difficulty === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
}

const FALLBACK_LEADERBOARD = [
  { rank: 1, username: "Alex", xp: 2450 },
  { rank: 2, username: "Musa", xp: 2100 },
  { rank: 3, username: "Jay", xp: 1800 },
  { rank: 4, username: "Nina", xp: 1640 },
  { rank: 5, username: "Ravi", xp: 1510 },
];

export default function Dashboard() {
  const { profile, session } = useAuth();
  const { progressionQuery, weeklyRankQuery, seasonRankQuery } = useProgression(session?.user?.id);

  const { data: missionPreview } = useQuery({
    queryKey: ["dashboard-active-missions"],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, name, reward_points")
        .eq("is_active", true)
        .order("reward_points", { ascending: false })
        .limit(3);

      return (data ?? []) as MissionPreview[];
    },
  });

  const progression = progressionQuery.data;
  const fallbackProgress = getLevelProgress(0);
  const levelProgress = progression?.levelProgress ?? fallbackProgress;
  const totalXp = progression?.totalXp ?? 0;
  const seasonXp = progression?.seasonXp ?? 0;
  const weeklyXp = progression?.weeklyXp ?? 0;

  const seasonRank = seasonRankQuery.data?.current_user?.rank;
  const weeklyRank = weeklyRankQuery.data?.current_user?.rank;
  const leaderboardRows = weeklyRankQuery.data?.top?.length
    ? weeklyRankQuery.data.top
    : FALLBACK_LEADERBOARD.map((entry) => ({
        user_id: String(entry.rank),
        username: entry.username,
        avatar_url: null,
        xp: entry.xp,
        level: 1,
        level_name: "Explorer",
        rank: entry.rank,
        is_current_user: false,
      }));

  const nextUnlocks = levelProgress.next?.unlocks ?? ["Season Champion identity frame", "Competitive boost slots"];

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_45%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {`Level ${levelProgress.current.level} - ${levelProgress.current.name}`}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {profile?.display_name || "Operator"}
                </p>
              </div>
              <LevelBadge totalXp={totalXp} />
            </div>

            <div className="grid gap-2 text-sm sm:text-base">
              <p>
                Total XP: <span className="font-mono text-xl sm:text-2xl text-foreground">{formatXp(totalXp)} XP</span>
              </p>
              <p className="text-muted-foreground">
                XP to Next Level: <span className="text-foreground font-semibold">{formatXp(levelProgress.xpToNextLevel)} XP</span>
              </p>
            </div>

            <XpProgressBar value={levelProgress.progressPercent} />

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="rounded-full bg-secondary px-3 py-1">
                Season Rank: {seasonRank ? `#${seasonRank}` : "-"}
              </span>
              <span className="rounded-full bg-secondary px-3 py-1">
                Weekly Rank: {weeklyRank ? `#${weeklyRank}` : "-"}
              </span>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total XP</p>
            <p className="mt-2 text-3xl font-bold text-gradient-gold">{formatXp(totalXp)}</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Season XP</p>
            <p className="mt-2 text-2xl font-bold">{formatXp(seasonXp)}</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Weekly XP</p>
            <p className="mt-2 text-2xl font-bold">{formatXp(weeklyXp)}</p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h2 className="text-xl font-semibold">Active Missions</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(missionPreview?.length ? missionPreview : [
              { id: "fallback-1", name: "Daily Boost Wheel", reward_points: 50 },
              { id: "fallback-2", name: "Invite 3 Friends", reward_points: 200 },
              { id: "fallback-3", name: "Complete 5 Missions", reward_points: 150 },
            ]).map((mission) => {
              const difficulty = getDifficultyTag(mission.reward_points);
              return (
                <div key={mission.id} className="glass rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{mission.name}</p>
                    <span className={`border rounded-full px-2 py-0.5 text-[11px] ${difficultyClass(difficulty)}`}>
                      {difficulty}
                    </span>
                  </div>
                  <p className="font-mono text-lg text-primary">+{formatXp(mission.reward_points)} XP</p>
                  <Link to="/missions" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Open Mission
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-semibold">Next Level Unlock</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {levelProgress.next
              ? `${levelProgress.next.level} - ${levelProgress.next.name}`
              : "Max level reached"}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {nextUnlocks.map((unlock) => (
              <li key={unlock} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{unlock}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Leaderboard Preview
            </h2>
            <Link to="/leaderboard">
              <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
                View Full Leaderboard
              </Button>
            </Link>
          </div>

          <div className="space-y-2">
            {leaderboardRows.slice(0, 5).map((entry) => (
              <div
                key={`${entry.rank}-${entry.user_id}`}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                  entry.is_current_user ? "border-primary/60 bg-primary/10" : "border-border/60 bg-secondary/40"
                }`}
              >
                <p className="font-medium">{`#${entry.rank} ${entry.username}`}</p>
                <p className="font-mono text-sm text-primary">{formatXp(entry.xp)} XP</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </AppLayout>
  );
}
