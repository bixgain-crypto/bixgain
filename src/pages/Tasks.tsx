import { AppLayout } from "@/components/AppLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeTaskOperation } from "@/lib/taskApi";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListTodo, Clock, Coins, CheckCircle2, ExternalLink, Upload,
  Eye, Play, Loader2, Camera, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState, useRef, useEffect, useCallback } from "react";

interface TaskAttemptState {
  taskId: string;
  attemptId: string;
  visitToken?: string;
  startedAt: number;
  phase: "started" | "visiting" | "uploading" | "watching" | "submitted";
}

export default function Tasks() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [activeAttempt, setActiveAttempt] = useState<TaskAttemptState | null>(null);
  const [proofText, setProofText] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const watchTimer = useRef<ReturnType<typeof setInterval>>();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_active", true)
        .order("reward_points", { ascending: false });
      return data || [];
    },
  });

  const { data: myAttempts } = useQuery({
    queryKey: ["my-attempts", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_attempts")
        .select("task_id, status")
        .eq("user_id", session!.user.id);
      return data || [];
    },
  });

  const getTaskStatus = (taskId: string) => {
    const attempts = myAttempts?.filter((a) => a.task_id === taskId) || [];
    if (attempts.some((a) => a.status === "approved")) return "approved";
    if (attempts.some((a) => a.status === "pending")) return "pending";
    if (attempts.some((a) => a.status === "started")) return "started";
    return null;
  };

  const getVerificationType = (task: any): string => {
    const rules = task.verification_rules;
    if (typeof rules === "object" && rules?.type) return rules.type;
    if (task.video_url) return "video_watch";
    if (task.target_url) return "link_visit";
    return "social_follow";
  };

  // Start a task attempt
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Open link for visit tracking
  const handleVisitLink = (task: any) => {
    if (!activeAttempt) return;
    window.open(task.target_url, "_blank");
    setActiveAttempt({ ...activeAttempt, phase: "visiting" });
  };

  // Verify link visit
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
        toast.success(`Earned ${result.reward} BIX!`);
        setActiveAttempt(null);
        queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Upload proof screenshot
  const handleUploadProof = async () => {
    if (!activeAttempt || !session?.user?.id) return;
    setUploading(true);
    try {
      let proof_url = "";
      if (proofFile) {
        const ext = proofFile.name.split(".").pop();
        const path = `${session.user.id}/${activeAttempt.attemptId}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("task-proofs")
          .upload(path, proofFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        // Use signed URL for private access
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from("task-proofs")
          .createSignedUrl(path, 60 * 60); // 1 hour expiry
        if (signedUrlErr) throw signedUrlErr;
        proof_url = signedUrlData.signedUrl;
      }

      await invokeTaskOperation("submit_proof", {
        attempt_id: activeAttempt.attemptId,
        proof_url,
        proof_text: proofText,
      });

      toast.success("Proof submitted! Awaiting admin review.");
      setActiveAttempt(null);
      setProofText("");
      setProofFile(null);
      queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploading(false);
  };

  // Video watch tracking
  const startWatching = useCallback((task: any) => {
    if (!activeAttempt) return;
    setActiveAttempt({ ...activeAttempt, phase: "watching" });
    setWatchSeconds(0);
    if (task.video_url) window.open(task.video_url, "_blank");
    watchTimer.current = setInterval(() => {
      setWatchSeconds((prev) => prev + 1);
    }, 1000);
  }, [activeAttempt]);

  const handleVerifyWatch = async (requiredSeconds: number) => {
    if (!activeAttempt) return;
    if (watchTimer.current) clearInterval(watchTimer.current);
    try {
      const result = await invokeTaskOperation("verify_video_watch", {
        attempt_id: activeAttempt.attemptId,
        watch_seconds: watchSeconds,
      });
      if (result.success) {
        toast.success(`Earned ${result.reward} BIX!`);
        setActiveAttempt(null);
        setWatchSeconds(0);
        queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
      } else {
        toast.error(`Watch for ${result.remaining} more seconds`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    return () => {
      if (watchTimer.current) clearInterval(watchTimer.current);
    };
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <ListTodo className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            Available Tasks
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">Complete tasks to earn BIX tokens</p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-lg p-6 animate-pulse h-48" />
            ))}
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task: any, i: number) => {
              const status = getTaskStatus(task.id);
              const vType = getVerificationType(task);
              const isActive = activeAttempt?.taskId === task.id;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass rounded-lg p-5 flex flex-col justify-between ${
                    status === "approved" ? "opacity-60" : "hover:glow-gold-sm"
                  } transition-all`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {vType.replace("_", " ")}
                      </span>
                      <div className="flex items-center gap-1 text-primary font-mono font-bold text-sm">
                        <Coins className="h-3.5 w-3.5" />
                        {Number(task.reward_points).toLocaleString()}
                      </div>
                    </div>
                    <h3 className="text-base font-semibold mb-1.5">{task.name}</h3>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    {task.end_date && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Ends {new Date(task.end_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {status === "approved" ? (
                      <div className="flex items-center gap-2 text-success text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Completed
                      </div>
                    ) : status === "pending" ? (
                      <div className="flex items-center gap-2 text-warning text-sm font-medium">
                        <Clock className="h-4 w-4" /> Pending Review
                      </div>
                    ) : !isActive ? (
                      <Button
                        onClick={() => handleStart(task.id)}
                        className="w-full bg-gradient-gold font-semibold"
                        size="sm"
                      >
                        {status === "started" ? "Continue" : "Start Task"}
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
                          {/* Link Visit Flow */}
                          {vType === "link_visit" && activeAttempt.phase === "started" && (
                            <Button onClick={() => handleVisitLink(task)} className="w-full" size="sm" variant="outline">
                              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Visit Link
                            </Button>
                          )}
                          {vType === "link_visit" && activeAttempt.phase === "visiting" && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Stay on the page for {task.required_seconds || 10}s, then verify.
                              </p>
                              <Button onClick={handleVerifyVisit} className="w-full bg-gradient-gold font-semibold" size="sm">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Verify Visit
                              </Button>
                            </div>
                          )}

                          {/* Social Follow Flow */}
                          {vType === "social_follow" && (
                            <div className="space-y-2">
                              {task.target_url && (
                                <a href={task.target_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> Open Profile
                                </a>
                              )}
                              <div className="space-y-1.5">
                                <Label className="text-xs">Username/Profile URL</Label>
                                <Input
                                  value={proofText}
                                  onChange={(e) => setProofText(e.target.value)}
                                  placeholder="Your username or profile link"
                                  className="bg-secondary border-border text-sm h-8"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Screenshot Proof</Label>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 text-xs bg-secondary rounded-md px-3 py-1.5 cursor-pointer hover:bg-secondary/80 transition-colors border border-border">
                                    <Camera className="h-3 w-3" />
                                    {proofFile ? proofFile.name.substring(0, 20) : "Upload"}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                                  </label>
                                </div>
                              </div>
                              <Button
                                onClick={handleUploadProof}
                                disabled={(!proofText && !proofFile) || uploading}
                                className="w-full bg-gradient-gold font-semibold"
                                size="sm"
                              >
                                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                Submit Proof
                              </Button>
                            </div>
                          )}

                          {/* Video Watch Flow */}
                          {vType === "video_watch" && activeAttempt.phase === "started" && (
                            <Button onClick={() => startWatching(task)} className="w-full" size="sm" variant="outline">
                              <Play className="h-3.5 w-3.5 mr-1.5" /> Start Watching
                            </Button>
                          )}
                          {vType === "video_watch" && activeAttempt.phase === "watching" && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Watching...</span>
                                <span className="font-mono text-primary">{watchSeconds}s / {task.required_seconds || 30}s</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (watchSeconds / (task.required_seconds || 30)) * 100)}%` }}
                                />
                              </div>
                              <Button
                                onClick={() => handleVerifyWatch(task.required_seconds || 30)}
                                disabled={watchSeconds < (task.required_seconds || 30)}
                                className="w-full bg-gradient-gold font-semibold"
                                size="sm"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Complete
                              </Button>
                            </div>
                          )}

                          {/* Referral type - just show info */}
                          {vType === "referral" && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              Refer friends from the Referrals page to complete this task.
                            </div>
                          )}

                          {/* Login type */}
                          {vType === "login" && (
                            <Button
                              onClick={async () => {
                                try {
                                  await invokeTaskOperation("verify_link_visit", {
                                    attempt_id: activeAttempt.attemptId,
                                    visit_token: activeAttempt.visitToken,
                                    elapsed_seconds: 999,
                                  });
                                  toast.success("Daily login bonus claimed!");
                                  setActiveAttempt(null);
                                  queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
                                  queryClient.invalidateQueries({ queryKey: ["wallet"] });
                                } catch (e: any) { toast.error(e.message); }
                              }}
                              className="w-full bg-gradient-gold font-semibold"
                              size="sm"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Claim Bonus
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setActiveAttempt(null); setProofText(""); setProofFile(null); }}
                            className="w-full text-xs"
                          >
                            Cancel
                          </Button>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-lg p-12 text-center">
            <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks available right now. Check back soon!</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
