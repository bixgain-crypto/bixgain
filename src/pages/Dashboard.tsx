import { AppLayout } from "@/components/AppLayout";
import { LevelBadge } from "@/components/LevelBadge";
import { XpProgressBar } from "@/components/XpProgressBar";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { formatXp, getLevelProgress } from "@/lib/progression";
import { motion } from "framer-motion";
import { Activity, Coins, Sparkles, Trophy } from "lucide-react";

type ActivityItem = Record<string, unknown> & {
  id?: string;
  activity_type?: string;
  description?: string | null;
  created_at?: string;
};

function getActivityAmount(activity: Record<string, unknown>): number {
  const raw = activity.xp_amount ?? activity.points_earned ?? activity.amount ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function getActivityUnit(activity: Record<string, unknown>): "xp" | "bix" {
  const metadata = activity.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const unit = (metadata as Record<string, unknown>).unit;
    if (typeof unit === "string" && unit.toLowerCase() === "bix") return "bix";
  }
  return "xp";
}

function activityTitle(activity: ActivityItem): string {
  if (activity.description && typeof activity.description === "string") return activity.description;
  if (activity.activity_type && typeof activity.activity_type === "string") {
    return activity.activity_type.replace(/_/g, " ");
  }
  return "Activity";
}

export default function Dashboard() {
  const { session, user } = useAuth();
  const { activities, leaderboards, loading } = useAppData();

  const visibleActivities = (activities ?? []).slice(0, 8) as ActivityItem[];
  const weeklyRank = leaderboards.weekly?.current_user?.rank || null;
  const seasonRank = leaderboards.season?.current_user?.rank || null;

  const totalXp = Number(user?.total_xp || 0);
  const bixBalance = Number(user?.bix_balance || 0);
  const levelNumber = Number(user?.current_level || 1);
  const levelName = String(user?.level_name || "Explorer");
  const progress = getLevelProgress(totalXp);

  if (!session?.user?.id) {
    return (
      <AppLayout>
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Sign in to view your dashboard.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_45%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{levelName}</h1>
                <p className="text-sm text-muted-foreground">{`Current Level: ${levelNumber}`}</p>
              </div>
              <LevelBadge totalXp={totalXp} />
            </div>

            <XpProgressBar value={progress.progressPercent} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total XP</p>
                <p className="mt-1 text-2xl font-bold text-gradient-gold">{formatXp(totalXp)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Bix Balance</p>
                <p className="mt-1 text-2xl font-bold">{bixBalance.toLocaleString()} Bix</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Season Rank</p>
                <p className="mt-1 text-2xl font-bold">{seasonRank ? `#${seasonRank}` : "-"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Weekly Rank</p>
                <p className="mt-1 text-2xl font-bold">{weeklyRank ? `#${weeklyRank}` : "-"}</p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activities
          </h2>
          <div className="mt-4 space-y-2">
            {loading.activities ? (
              <p className="text-sm text-muted-foreground">Loading activity feed...</p>
            ) : visibleActivities.length > 0 ? (
              visibleActivities.map((activity, index) => (
                <div key={String(activity.id || `activity-${index}`)} className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium capitalize">{activityTitle(activity)}</p>
                    <p className="text-sm font-mono text-primary">
                      {getActivityUnit(activity) === "bix"
                        ? `+${getActivityAmount(activity).toLocaleString()} BIX`
                        : `+${formatXp(getActivityAmount(activity))} XP`}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.created_at ? new Date(activity.created_at).toLocaleString() : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" />
              Bix Balance
            </p>
            <p className="mt-2 text-2xl font-bold">{bixBalance.toLocaleString()} Bix</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5" />
              Progress Status
            </p>
            <p className="mt-2 text-2xl font-bold">{`${levelName} · L${levelNumber}`}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              {formatXp(totalXp)} XP total
            </p>
          </div>
        </motion.section>
      </div>
    </AppLayout>
  );
}
