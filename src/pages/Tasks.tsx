import { AppLayout } from "@/components/AppLayout";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { awardXp } from "@/lib/progressionApi";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type MissionCategory = "daily" | "weekly" | "referral" | "challenges" | "season";
type MissionDifficulty = "Easy" | "Medium" | "Hard";
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

type ReferralRow = {
  id: string;
  qualified: boolean;
};

type MissionTask = {
  id: string;
  name: string;
  description: string | null;
  category: MissionCategory;
  taskType: TaskRow["task_type"];
  xpReward: number;
  difficulty: MissionDifficulty;
  levelRequired: number;
  cooldown: string;
  target: number;
};

type JsonRecord = Record<string, unknown>;

const CATEGORY_ORDER: MissionCategory[] = ["daily", "weekly", "referral", "challenges", "season"];

const CATEGORY_LABELS: Record<MissionCategory, string> = {
  daily: "Daily Missions",
  weekly: "Weekly Missions",
  referral: "Referral Missions",
  challenges: "Challenges",
  season: "Season Events",
};

const TASK_TYPE_CATEGORY_MAP: Record<TaskRow["task_type"], MissionCategory> = {
  login: "daily",
  task_completion: "weekly",
  referral: "referral",
  social: "challenges",
  staking: "season",
  custom: "daily",
};

function difficultyClass(level: MissionDifficulty): string {
  if (level === "Hard") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (level === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
}

function asRecord(value: Json | null | undefined): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asCategory(value: unknown): MissionCategory | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CATEGORY_ORDER.find((item) => item === normalized) || null;
}

function asDifficulty(value: unknown): MissionDifficulty | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
}

function asPositiveInt(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function inferDifficulty(xpReward: number): MissionDifficulty {
  if (xpReward >= 250) return "Hard";
  if (xpReward >= 120) return "Medium";
  return "Easy";
}

function defaultCooldown(category: MissionCategory): string {
  if (category === "daily") return "24h";
  if (category === "weekly") return "7d";
  if (category === "challenges") return "48h";
  if (category === "season") return "Season";
  return "24h";
}

function toMissionTask(task: TaskRow): MissionTask {
  const requirements = asRecord(task.requirements);
  const xpReward = Math.max(0, Math.floor(Number(task.reward_points || 0)));
  const category = asCategory(requirements?.category) || TASK_TYPE_CATEGORY_MAP[task.task_type] || "daily";
  const difficulty = asDifficulty(requirements?.difficulty) || inferDifficulty(xpReward);
  const levelRequired = asPositiveInt(requirements?.level_required) || 1;
  const target =
    asPositiveInt(requirements?.target) ||
    (task.max_completions_per_user && task.max_completions_per_user > 0 ? task.max_completions_per_user : 1);
  const rawCooldown = requirements?.cooldown;
  const cooldown = typeof rawCooldown === "string" && rawCooldown.trim().length > 0
    ? rawCooldown.trim()
    : defaultCooldown(category);

  return {
    id: task.id,
    name: task.name,
    description: task.description,
    category,
    taskType: task.task_type,
    xpReward,
    difficulty,
    levelRequired,
    cooldown,
    target,
  };
}

export default function Tasks() {
  const { session, user } = useAuth();
  const {
    tasks,
    activities,
    referrals: referralRows,
    loading,
    refreshActivities,
    refreshReferrals,
    refreshUserProfile,
    refreshLeaderboard,
  } = useAppData();
  const [category, setCategory] = useState<MissionCategory>("daily");
  const [pendingMission, setPendingMission] = useState<string | null>(null);

  const tasksLoading = loading.tasks;

  const qualifiedReferrals = useMemo(
    () => (referralRows ?? []).filter((row) => row.qualified).length,
    [referralRows],
  );

  const missionTasks = useMemo(() => {
    const now = Date.now();
    return (tasks ?? [])
      .filter((task) => {
        if (!task.start_date && !task.end_date) return true;
        const startsOk = !task.start_date || new Date(task.start_date).getTime() <= now;
        const endsOk = !task.end_date || new Date(task.end_date).getTime() >= now;
        return startsOk && endsOk;
      })
      .map(toMissionTask);
  }, [tasks]);

  const availableCategories = useMemo(() => {
    const seen = new Set(missionTasks.map((task) => task.category));
    return CATEGORY_ORDER.filter((value) => seen.has(value));
  }, [missionTasks]);

  useEffect(() => {
    if (availableCategories.length === 0) return;
    if (!availableCategories.includes(category)) {
      setCategory(availableCategories[0]);
    }
  }, [availableCategories, category]);

  const visibleMissions = useMemo(() => missionTasks.filter((mission) => mission.category === category), [category, missionTasks]);

  const completedByTaskId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of activities ?? []) {
      if (!row.task_id) continue;
      map.set(row.task_id, (map.get(row.task_id) || 0) + 1);
    }
    return map;
  }, [activities]);

  const getProgress = (mission: MissionTask) => {
    if (mission.category === "referral") {
      const progress = Math.min(qualifiedReferrals, mission.target);
      return {
        current: progress,
        percent: Math.max(0, Math.min(100, (progress / mission.target) * 100)),
        completed: progress >= mission.target,
      };
    }

    const completedCount = completedByTaskId.get(mission.id) || 0;
    const completed = completedCount > 0;
    const progress = completed ? mission.target : 0;
    return {
      current: progress,
      percent: Math.max(0, Math.min(100, (progress / mission.target) * 100)),
      completed,
    };
  };

  const isMissionClaimed = (mission: MissionTask) => {
    return (completedByTaskId.get(mission.id) || 0) > 0;
  };

  const handleCompleteMission = async (mission: MissionTask) => {
    if (!session?.user?.id) return;

    if (Number(user?.current_level || 1) < mission.levelRequired) {
      toast.error(`Level ${mission.levelRequired} required`);
      return;
    }

    if (mission.category === "referral") {
      const progress = getProgress(mission);
      if (!progress.completed) {
        toast.error(`Referral target not reached (${progress.current}/${mission.target})`);
        return;
      }

      if (isMissionClaimed(mission)) {
        toast.error("Referral mission already claimed");
        return;
      }
    }

    if (isMissionClaimed(mission)) {
      toast.error("Mission already completed");
      return;
    }

    setPendingMission(mission.id);
    try {
      const { data: insertedActivity, error: activityError } = await supabase
        .from("activities")
        .insert({
          user_id: session.user.id,
          task_id: mission.id,
          activity_type: "custom",
          points_earned: mission.xpReward,
          description: mission.name,
          metadata: {
            unit: "xp",
            source: "missions-ui",
            mission_id: mission.id,
            task_type: mission.taskType,
            category: mission.category,
            reward_xp: mission.xpReward,
          },
        } as never)
        .select("id")
        .single();

      if (activityError) {
        if (activityError.code === "23505") {
          throw new Error("Mission already completed");
        }
        throw new Error(activityError.message);
      }

      if (mission.xpReward > 0) {
        try {
          await awardXp(mission.xpReward, session.user.id);
        } catch (error: unknown) {
          if (insertedActivity?.id) {
            await supabase.from("activities").delete().eq("id", insertedActivity.id);
          }
          throw error;
        }
      }

      toast.success(`Mission completed: +${formatXp(mission.xpReward)} XP`);
      await Promise.all([
        refreshActivities(),
        refreshReferrals(),
        refreshUserProfile(),
        refreshLeaderboard("weekly"),
        refreshLeaderboard("season"),
        refreshLeaderboard("all_time"),
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Mission failed";
      toast.error(message);
    } finally {
      setPendingMission(null);
    }
  };

  if (!session?.user?.id) {
    return (
      <AppLayout>
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Sign in to access missions.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Target className="h-7 w-7 text-primary" />
            Missions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Live missions are loaded from your admin-managed tasks table.</p>
        </motion.div>

        <Tabs value={category} onValueChange={(value) => setCategory(value as MissionCategory)} className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-full grid grid-cols-5 gap-2 bg-transparent p-0">
            {CATEGORY_ORDER.map((value) => (
              <TabsTrigger key={value} value={value} className="glass rounded-xl py-2">
                {CATEGORY_LABELS[value]}
              </TabsTrigger>
            ))}
          </TabsList>
          </div>
        </Tabs>

        {tasksLoading ? (
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">Loading missions...</div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleMissions.map((mission) => {
            const progress = getProgress(mission);
            const claimed = isMissionClaimed(mission);
            const referralNeedsProgress = mission.category === "referral" && !progress.completed;
            return (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{mission.name}</p>
                    {mission.description ? <p className="text-sm text-muted-foreground mt-1">{mission.description}</p> : null}
                    <p className="text-sm text-muted-foreground">{`Reward: +${formatXp(mission.xpReward)} XP`}</p>
                  </div>
                  <span className={`text-[11px] rounded-full border px-2 py-0.5 ${difficultyClass(mission.difficulty)}`}>
                    {mission.difficulty}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Progress</p>
                    <p className="font-semibold">{`${progress.current} / ${mission.target}`}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Level Required</p>
                    <p className="font-semibold">{`Level ${mission.levelRequired}`}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Cooldown</p>
                    <p className="font-semibold">{mission.cooldown}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-semibold">{progress.completed ? "Completed" : "Active"}</p>
                  </div>
                </div>

                <XpProgressBar value={progress.percent} />

                {claimed ? (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Mission completed
                  </div>
                ) : (
                  <Button
                    onClick={() => handleCompleteMission(mission)}
                    disabled={pendingMission === mission.id || referralNeedsProgress}
                    className="w-full bg-gradient-gold text-primary-foreground font-semibold"
                  >
                    {pendingMission === mission.id ? (
                      <>
                      <Clock className="h-4 w-4 mr-1.5 animate-spin" />
                      Submitting...
                    </>
                    ) : Number(user?.current_level || 1) < mission.levelRequired ? (
                      `Reach Level ${mission.levelRequired}`
                    ) : referralNeedsProgress ? (
                      `Invite ${mission.target - progress.current} more`
                    ) : (
                      "Complete Mission"
                    )}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        {!tasksLoading && visibleMissions.length === 0 ? (
          <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
            No active missions in this category yet.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
