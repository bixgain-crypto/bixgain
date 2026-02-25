import { AppLayout } from "@/components/AppLayout";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invokeTaskOperation } from "@/lib/taskApi";
import { formatXp } from "@/lib/progression";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Play,
  Send,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type MissionCategory = "daily" | "weekly" | "referral" | "challenges" | "season";

interface MissionTask {
  id: string;
  name: string;
  description: string | null;
  reward_points: number;
  required_seconds: number | null;
  end_date: string | null;
  max_attempts: number | null;
  max_completions_per_user: number | null;
  verification_rules: unknown;
  task_type: string;
  target_url: string | null;
  video_url: string | null;
}

interface TaskAttemptRow {
  task_id: string;
  status: string;
  created_at: string;
}

interface TaskAttemptState {
  taskId: string;
  attemptId: string;
  visitToken?: string;
  startedAt: number;
  phase: "started" | "visiting" | "watching";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Mission request failed";
}

function getVerificationType(task: MissionTask): string {
  const rules = task.verification_rules;
  if (typeof rules === "object" && rules?.type) return rules.type;
  if (task.video_url) return "video_watch";
  if (task.target_url) return "link_visit";
  return task.task_type === "referral" ? "referral" : "social_follow";
}

function getCategory(task: MissionTask): MissionCategory {
  const name = task.name.toLowerCase();
  if (task.task_type === "referral" || name.includes("referral") || name.includes("invite")) return "referral";
  if (name.includes("season")) return "season";
  if (name.includes("week")) return "weekly";
  if (task.reward_points >= 200 || (task.required_seconds ?? 0) >= 60) return "challenges";
  return "daily";
}

function getLevelRequirement(task: MissionTask): number {
  if (task.reward_points >= 250) return 4;
  if (task.reward_points >= 150) return 3;
  if (task.reward_points >= 80) return 2;
  return 1;
}

function getDifficulty(task: MissionTask): "Easy" | "Medium" | "Hard" {
  if (task.reward_points >= 200) return "Hard";
  if (task.reward_points >= 90) return "Medium";
  return "Easy";
}

function difficultyClass(level: "Easy" | "Medium" | "Hard"): string {
  if (level === "Hard") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (level === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
}

function getCooldownLabel(task: MissionTask): string {
  if (!task.end_date) return "24h";
  const diff = new Date(task.end_date).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export default function Tasks() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<MissionCategory>("daily");
  const [activeAttempt, setActiveAttempt] = useState<TaskAttemptState | null>(null);
  const [proofText, setProofText] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const watchTimer = useRef<ReturnType<typeof setInterval>>();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["missions"],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_active", true)
        .order("reward_points", { ascending: false });

      return (data ?? []) as MissionTask[];
    },
  });

  const { data: attempts } = useQuery({
    queryKey: ["mission-attempts", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_attempts")
        .select("task_id, status, created_at")
        .eq("user_id", session!.user.id);
      return (data ?? []) as TaskAttemptRow[];
    },
  });

  const missionGroups = useMemo(() => {
    const grouped: Record<MissionCategory, MissionTask[]> = {
      daily: [],
      weekly: [],
      referral: [],
      challenges: [],
      season: [],
    };

    for (const task of tasks ?? []) {
      grouped[getCategory(task)].push(task);
    }

    return grouped;
  }, [tasks]);

  const visibleMissions = missionGroups[category];

  const getTaskAttempts = (taskId: string) => (attempts ?? []).filter((item) => item.task_id === taskId);

  const getTaskStatus = (taskId: string) => {
    const rows = getTaskAttempts(taskId);
    if (rows.some((row) => row.status === "approved")) return "approved";
    if (rows.some((row) => row.status === "pending")) return "pending";
    if (rows.some((row) => row.status === "started")) return "started";
    return "new";
  };

  const getTaskProgress = (task: MissionTask) => {
    const rows = getTaskAttempts(task.id);
    const approved = rows.filter((row) => row.status === "approved").length;
    const totalNeeded = task.max_completions_per_user || task.max_attempts || 1;
    const current = Math.min(approved, totalNeeded);
    const percent = Math.max(0, Math.min(100, (current / totalNeeded) * 100));
    return { current, totalNeeded, percent };
  };

  const handleStart = async (taskId: string) => {
    if (!session?.user?.id) return;
    try {
      const result = await invokeTaskOperation("start_attempt", {
        task_id: taskId,
        device_id: navigator.userAgent.substring(0, 50),
      });

      setActiveAttempt({
        taskId,
        attemptId: result.attempt_id,
        visitToken: result.visit_token,
        startedAt: Date.now(),
        phase: "started",
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleVisitLink = (task: MissionTask) => {
    if (!activeAttempt || !task.target_url) return;
    window.open(task.target_url, "_blank");
    setActiveAttempt({ ...activeAttempt, phase: "visiting" });
  };

  const handleVerifyVisit = async () => {
    if (!activeAttempt) return;
    const elapsed = Math.floor((Date.now() - activeAttempt.startedAt) / 1000);

    try {
      const result = await invokeTaskOperation("verify_link_visit", {
        attempt_id: activeAttempt.attemptId,
        visit_token: activeAttempt.visitToken,
        elapsed_seconds: elapsed,
      });

      if (result.success) {
        toast.success(`+${result.reward} XP credited`);
        setActiveAttempt(null);
        queryClient.invalidateQueries({ queryKey: ["mission-attempts"] });
        queryClient.invalidateQueries({ queryKey: ["progression-summary"] });
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUploadProof = async () => {
    if (!activeAttempt || !session?.user?.id) return;
    setUploading(true);

    try {
      let proofUrl = "";
      if (proofFile) {
        const ext = proofFile.name.split(".").pop();
        const path = `${session.user.id}/${activeAttempt.attemptId}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("task-proofs")
          .upload(path, proofFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("task-proofs").getPublicUrl(path);
        proofUrl = urlData.publicUrl;
      }

      await invokeTaskOperation("submit_proof", {
        attempt_id: activeAttempt.attemptId,
        proof_url: proofUrl,
        proof_text: proofText,
      });

      toast.success("Mission proof submitted");
      setActiveAttempt(null);
      setProofText("");
      setProofFile(null);
      queryClient.invalidateQueries({ queryKey: ["mission-attempts"] });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const startWatching = useCallback((task: MissionTask) => {
    if (!activeAttempt) return;
    setActiveAttempt({ ...activeAttempt, phase: "watching" });
    setWatchSeconds(0);
    if (task.video_url) window.open(task.video_url, "_blank");

    watchTimer.current = setInterval(() => {
      setWatchSeconds((prev) => prev + 1);
    }, 1000);
  }, [activeAttempt]);

  const handleVerifyWatch = async () => {
    if (!activeAttempt) return;
    if (watchTimer.current) clearInterval(watchTimer.current);

    try {
      const result = await invokeTaskOperation("verify_video_watch", {
        attempt_id: activeAttempt.attemptId,
        watch_seconds: watchSeconds,
      });

      if (result.success) {
        toast.success(`+${result.reward} XP credited`);
        setActiveAttempt(null);
        setWatchSeconds(0);
        queryClient.invalidateQueries({ queryKey: ["mission-attempts"] });
        queryClient.invalidateQueries({ queryKey: ["progression-summary"] });
      } else {
        toast.error(`Watch ${result.remaining} more seconds`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  useEffect(() => {
    return () => {
      if (watchTimer.current) clearInterval(watchTimer.current);
    };
  }, []);

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
          <p className="text-sm text-muted-foreground mt-1">Complete missions to climb levels and increase your XP.</p>
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

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass rounded-2xl p-6 h-52 animate-pulse" />
            ))}
          </div>
        ) : visibleMissions?.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleMissions.map((task) => {
              const status = getTaskStatus(task.id);
              const progress = getTaskProgress(task);
              const verificationType = getVerificationType(task);
              const isActive = activeAttempt?.taskId === task.id;
              const levelRequired = getLevelRequirement(task);
              const difficulty = getDifficulty(task);
              const cooldown = getCooldownLabel(task);
              const requiredSeconds = task.required_seconds || 30;
              const watchProgress = Math.max(0, Math.min(100, (watchSeconds / requiredSeconds) * 100));

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{task.name}</p>
                      <p className="text-sm text-muted-foreground">{task.description || "Mission objective available after start."}</p>
                    </div>
                    <span className={`text-[11px] rounded-full border px-2 py-0.5 ${difficultyClass(difficulty)}`}>
                      {difficulty}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                      <p className="text-xs text-muted-foreground">XP Reward</p>
                      <p className="font-mono text-primary text-base">+{formatXp(task.reward_points)} XP</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Level Required</p>
                      <p className="font-semibold text-base">{`Level ${levelRequired}`}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Progress</p>
                      <p className="font-semibold">{`${progress.current} / ${progress.totalNeeded}`}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Cooldown</p>
                      <p className="font-semibold">{cooldown}</p>
                    </div>
                  </div>

                  <XpProgressBar value={progress.percent} className="py-1" />

                  {status === "approved" ? (
                    <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Mission completed
                    </div>
                  ) : status === "pending" ? (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Pending review
                    </div>
                  ) : !isActive ? (
                    <Button onClick={() => handleStart(task.id)} className="w-full bg-gradient-gold text-primary-foreground font-semibold">
                      {status === "started" ? "Continue Mission" : "Start Mission"}
                    </Button>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeAttempt.phase}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3"
                      >
                        {verificationType === "link_visit" && activeAttempt.phase === "started" && (
                          <Button onClick={() => handleVisitLink(task)} variant="outline" className="w-full">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Visit Mission Link
                          </Button>
                        )}

                        {verificationType === "link_visit" && activeAttempt.phase === "visiting" && (
                          <Button onClick={handleVerifyVisit} className="w-full bg-gradient-gold text-primary-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Verify Progress
                          </Button>
                        )}

                        {verificationType === "social_follow" && (
                          <div className="space-y-2">
                            {task.target_url && (
                              <a
                                href={task.target_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Open destination
                              </a>
                            )}
                            <div className="space-y-1">
                              <Label className="text-xs">Proof text</Label>
                              <Input
                                value={proofText}
                                onChange={(event) => setProofText(event.target.value)}
                                placeholder="Username or profile URL"
                                className="h-8 bg-secondary/60"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Proof screenshot</Label>
                              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer rounded-md border border-border px-3 py-1.5 bg-secondary/60">
                                <Camera className="h-3 w-3" />
                                {proofFile ? proofFile.name.slice(0, 20) : "Upload image"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                                />
                              </label>
                            </div>
                            <Button
                              onClick={handleUploadProof}
                              disabled={(!proofText && !proofFile) || uploading}
                              className="w-full bg-gradient-gold text-primary-foreground"
                            >
                              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                              Submit Proof
                            </Button>
                          </div>
                        )}

                        {verificationType === "video_watch" && activeAttempt.phase === "started" && (
                          <Button onClick={() => startWatching(task)} variant="outline" className="w-full">
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            Start Watching
                          </Button>
                        )}

                        {verificationType === "video_watch" && activeAttempt.phase === "watching" && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {watchSeconds}s / {requiredSeconds}s
                            </p>
                            <XpProgressBar value={watchProgress} />
                            <Button
                              onClick={handleVerifyWatch}
                              disabled={watchSeconds < requiredSeconds}
                              className="w-full bg-gradient-gold text-primary-foreground"
                            >
                              Complete Mission
                            </Button>
                          </div>
                        )}

                        {verificationType === "referral" && (
                          <p className="text-xs text-muted-foreground text-center">
                            Referral progress updates when invited players complete qualifying missions.
                          </p>
                        )}

                        <Button
                          variant="ghost"
                          className="w-full text-xs"
                          onClick={() => {
                            setActiveAttempt(null);
                            setProofText("");
                            setProofFile(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="text-muted-foreground">No missions in this category yet.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
