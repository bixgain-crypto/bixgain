import { AppLayout } from "@/components/AppLayout";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { awardXp } from "@/lib/progressionApi";
import { formatXp } from "@/lib/progression";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type MissionCategory = "daily" | "weekly" | "referral" | "challenges" | "season";

type MissionItem = {
  id: string;
  category: MissionCategory;
  name: string;
  xpReward: number;
  difficulty: "Easy" | "Medium" | "Hard";
  levelRequired: number;
  cooldown: string;
  target: number;
};

const MISSIONS: MissionItem[] = [
  { id: "daily-boost-wheel", category: "daily", name: "Daily Boost Wheel", xpReward: 50, difficulty: "Easy", levelRequired: 1, cooldown: "24h", target: 1 },
  { id: "daily-activity-log", category: "daily", name: "Log 1 Activity", xpReward: 40, difficulty: "Easy", levelRequired: 1, cooldown: "24h", target: 1 },
  { id: "weekly-completions", category: "weekly", name: "Complete 5 Missions", xpReward: 150, difficulty: "Medium", levelRequired: 2, cooldown: "7d", target: 5 },
  { id: "weekly-streak", category: "weekly", name: "Maintain 3-Day Streak", xpReward: 120, difficulty: "Medium", levelRequired: 2, cooldown: "7d", target: 3 },
  { id: "referral-3", category: "referral", name: "Invite 3 Friends", xpReward: 200, difficulty: "Hard", levelRequired: 2, cooldown: "24h", target: 3 },
  { id: "referral-5", category: "referral", name: "Invite 5 Friends", xpReward: 320, difficulty: "Hard", levelRequired: 3, cooldown: "24h", target: 5 },
  { id: "challenge-elite", category: "challenges", name: "Elite Challenge Run", xpReward: 250, difficulty: "Hard", levelRequired: 3, cooldown: "48h", target: 1 },
  { id: "challenge-xp", category: "challenges", name: "Earn 500 XP This Week", xpReward: 260, difficulty: "Hard", levelRequired: 3, cooldown: "7d", target: 1 },
  { id: "season-qualifier", category: "season", name: "Season Qualifier", xpReward: 300, difficulty: "Hard", levelRequired: 4, cooldown: "Season", target: 1 },
  { id: "season-event", category: "season", name: "Season Event Completion", xpReward: 400, difficulty: "Hard", levelRequired: 4, cooldown: "Season", target: 1 },
];

type ActivityRow = Record<string, unknown> & {
  description?: string | null;
  created_at?: string;
};

function difficultyClass(level: MissionItem["difficulty"]): string {
  if (level === "Hard") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (level === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
}

async function insertActivityWithFallback(userId: string, mission: MissionItem): Promise<void> {
  const payloads: Record<string, unknown>[] = [
    {
      user_id: userId,
      activity_type: "mission",
      description: mission.name,
      xp_amount: mission.xpReward,
      metadata: { mission_id: mission.id, source: "missions" },
    },
    {
      user_id: userId,
      activity_type: "mission",
      description: mission.name,
      points_earned: mission.xpReward,
      metadata: { mission_id: mission.id, source: "missions" },
    },
    {
      user_id: userId,
      description: mission.name,
      xp_amount: mission.xpReward,
    },
    {
      user_id: userId,
      description: mission.name,
      points_earned: mission.xpReward,
    },
  ];

  let lastError: Error | null = null;

  for (const payload of payloads) {
    const { error } = await supabase.from("activities").insert(payload as never);
    if (!error) return;
    lastError = new Error(error.message);
  }

  throw lastError || new Error("Unable to insert activity");
}

export default function Tasks() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<MissionCategory>("daily");
  const [pendingMission, setPendingMission] = useState<string | null>(null);

  const { data: activities } = useQuery({
    queryKey: ["mission-activities", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const visibleMissions = useMemo(
    () => MISSIONS.filter((mission) => mission.category === category),
    [category],
  );

  const getProgress = (mission: MissionItem) => {
    const current = (activities ?? []).filter((row) => {
      const text = typeof row.description === "string" ? row.description.toLowerCase() : "";
      return text.includes(mission.name.toLowerCase());
    }).length;
    const progress = Math.min(current, mission.target);
    return {
      current: progress,
      percent: Math.max(0, Math.min(100, (progress / mission.target) * 100)),
      completed: progress >= mission.target,
    };
  };

  const handleCompleteMission = async (mission: MissionItem) => {
    if (!session?.user?.id) return;
    if (Number(user?.current_level || 1) < mission.levelRequired) {
      toast.error(`Level ${mission.levelRequired} required`);
      return;
    }

    setPendingMission(mission.id);
    try {
      await awardXp(mission.xpReward, session.user.id);
      await insertActivityWithFallback(session.user.id, mission);
      toast.success(`Mission completed: +${formatXp(mission.xpReward)} XP`);
      queryClient.invalidateQueries({ queryKey: ["mission-activities"] });
      queryClient.invalidateQueries({ queryKey: ["user-core"] });
      queryClient.invalidateQueries({ queryKey: ["progression-summary"] });
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
          <p className="text-sm text-muted-foreground mt-1">Complete missions to earn XP and grow your level.</p>
        </motion.div>

        <Tabs value={category} onValueChange={(value) => setCategory(value as MissionCategory)} className="w-full">
          <TabsList className="w-full grid grid-cols-2 gap-2 md:grid-cols-5 bg-transparent p-0">
            <TabsTrigger value="daily" className="glass rounded-xl py-2">Daily Missions</TabsTrigger>
            <TabsTrigger value="weekly" className="glass rounded-xl py-2">Weekly Missions</TabsTrigger>
            <TabsTrigger value="referral" className="glass rounded-xl py-2">Referral Missions</TabsTrigger>
            <TabsTrigger value="challenges" className="glass rounded-xl py-2">Challenges</TabsTrigger>
            <TabsTrigger value="season" className="glass rounded-xl py-2">Season Events</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleMissions.map((mission) => {
            const progress = getProgress(mission);
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

                {progress.completed ? (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Mission completed
                  </div>
                ) : (
                  <Button
                    onClick={() => handleCompleteMission(mission)}
                    disabled={pendingMission === mission.id}
                    className="w-full bg-gradient-gold text-primary-foreground font-semibold"
                  >
                    {pendingMission === mission.id ? (
                      <>
                        <Clock className="h-4 w-4 mr-1.5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Complete Mission"
                    )}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
