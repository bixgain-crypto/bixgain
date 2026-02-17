import { AppLayout } from "@/components/AppLayout";
import { useAdmin } from "@/hooks/useAdmin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeTaskOperation } from "@/lib/taskApi";
import { motion } from "framer-motion";
import {
  Shield, Users, FileText, AlertTriangle, Settings, ListTodo,
  CheckCircle2, XCircle, Clock, Eye, Coins, Plus, BarChart3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function Admin() {
  const { session } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();

  // ---- Platform stats ----
  const { data: stats } = useQuery({
    queryKey: ["admin-platform-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("v_platform_stats").select("*").maybeSingle();
      return data;
    },
  });

  // ---- Pending attempts ----
  const { data: pendingAttempts } = useQuery({
    queryKey: ["admin-pending-attempts"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_attempts")
        .select("*, tasks(name, reward_points, task_type)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // ---- All tasks ----
  const { data: allTasks } = useQuery({
    queryKey: ["admin-all-tasks"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ---- Users ----
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("v_admin_user_summary")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // ---- Fraud flags ----
  const { data: fraudFlags } = useQuery({
    queryKey: ["admin-fraud-flags"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("fraud_flags")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ---- Reward ledger ----
  const { data: ledger } = useQuery({
    queryKey: ["admin-reward-ledger"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("reward_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // ---- Audit log ----
  const { data: auditLogs } = useQuery({
    queryKey: ["admin-audit-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  // ---- Actions ----
  const handleApprove = async (attemptId: string) => {
    try {
      await invokeTaskOperation("approve_attempt", { attempt_id: attemptId });
      toast.success("Attempt approved & reward granted!");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reward-ledger"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReject = async (attemptId: string) => {
    try {
      await invokeTaskOperation("reject_attempt", { attempt_id: attemptId, reason: "Rejected by admin" });
      toast.success("Attempt rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-attempts"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ---- Task creation state ----
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "", description: "", task_type: "social" as string,
    reward_points: 10, target_url: "", video_url: "",
    required_seconds: 10, max_attempts: 1, is_active: true,
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("tasks").insert({
      name: newTask.name,
      description: newTask.description,
      task_type: newTask.task_type as any,
      reward_points: newTask.reward_points,
      target_url: newTask.target_url || null,
      video_url: newTask.video_url || null,
      required_seconds: newTask.required_seconds,
      max_attempts: newTask.max_attempts,
      is_active: newTask.is_active,
      verification_rules: JSON.stringify({
        type: newTask.task_type === "social" ? "social_follow" : newTask.task_type,
      }),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Task created!");
    setShowCreateTask(false);
    setNewTask({ name: "", description: "", task_type: "social", reward_points: 10, target_url: "", video_url: "", required_seconds: 10, max_attempts: 1, is_active: true });
    queryClient.invalidateQueries({ queryKey: ["admin-all-tasks"] });
  };

  const toggleTaskActive = async (taskId: string, isActive: boolean) => {
    await supabase.from("tasks").update({ is_active: !isActive }).eq("id", taskId);
    queryClient.invalidateQueries({ queryKey: ["admin-all-tasks"] });
    toast.success(isActive ? "Task disabled" : "Task enabled");
  };

  if (adminLoading) {
    return <AppLayout><div className="flex items-center justify-center h-[60vh]"><div className="glass rounded-lg p-12 animate-pulse">Loading...</div></div></AppLayout>;
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="glass rounded-lg p-12 text-center">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
            <p className="text-muted-foreground">You don't have admin privileges.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">Platform management & oversight</p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: "Total Users", value: stats?.total_users || 0, icon: Users },
            { label: "Active Users", value: stats?.active_users || 0, icon: BarChart3 },
            { label: "BIX Circulating", value: Number(stats?.total_bix_in_circulation || 0).toLocaleString(), icon: Coins },
            { label: "Pending Verifications", value: pendingAttempts?.length || 0, icon: Clock },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="h-4 w-4 text-primary" />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold font-mono">{s.value}</p>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="queue" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Queue ({pendingAttempts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <ListTodo className="h-3.5 w-3.5 mr-1.5" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Users
            </TabsTrigger>
            <TabsTrigger value="rewards" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Coins className="h-3.5 w-3.5 mr-1.5" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="fraud" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Fraud ({fraudFlags?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Audit
            </TabsTrigger>
          </TabsList>

          {/* ===== Verification Queue ===== */}
          <TabsContent value="queue">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Pending Verifications</h2>
              {pendingAttempts && pendingAttempts.length > 0 ? (
                <div className="space-y-3">
                  {pendingAttempts.map((a: any) => (
                    <div key={a.id} className="rounded-lg bg-secondary/50 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{a.tasks?.name || "Unknown Task"}</p>
                          <p className="text-xs text-muted-foreground">
                            Type: {a.tasks?.task_type} · {new Date(a.created_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            IP: {a.ip_address || "N/A"} · Device: {a.device_id || "N/A"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-mono text-sm font-bold">
                          <Coins className="h-3.5 w-3.5" />
                          {Number(a.tasks?.reward_points || 0).toLocaleString()} BIX
                        </div>
                      </div>
                      {a.proof_text && (
                        <p className="text-xs bg-muted/50 rounded p-2">
                          <span className="text-muted-foreground">Proof: </span>{a.proof_text}
                        </p>
                      )}
                      {a.proof_url && (
                        <a href={a.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          View Screenshot →
                        </a>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApprove(a.id)} className="bg-success hover:bg-success/90 text-success-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(a.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No pending verifications.</p>
              )}
            </motion.div>
          </TabsContent>

          {/* ===== Task Manager ===== */}
          <TabsContent value="tasks">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Task Manager</h2>
                <Button size="sm" onClick={() => setShowCreateTask(!showCreateTask)} className="bg-gradient-gold font-semibold">
                  <Plus className="h-4 w-4 mr-1" /> New Task
                </Button>
              </div>

              {showCreateTask && (
                <form onSubmit={handleCreateTask} className="space-y-4 bg-secondary/50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Task Name</Label>
                      <Input value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} required className="bg-background border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <select value={newTask.task_type} onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="social">Social Follow</option>
                        <option value="custom">Link Visit</option>
                        <option value="task_completion">Video Watch</option>
                        <option value="referral">Referral</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reward (BIX)</Label>
                      <Input type="number" value={newTask.reward_points} onChange={(e) => setNewTask({ ...newTask, reward_points: Number(e.target.value) })} className="bg-background border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Attempts</Label>
                      <Input type="number" value={newTask.max_attempts} onChange={(e) => setNewTask({ ...newTask, max_attempts: Number(e.target.value) })} className="bg-background border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Target URL</Label>
                      <Input value={newTask.target_url} onChange={(e) => setNewTask({ ...newTask, target_url: e.target.value })} placeholder="https://..." className="bg-background border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Required Seconds</Label>
                      <Input type="number" value={newTask.required_seconds} onChange={(e) => setNewTask({ ...newTask, required_seconds: Number(e.target.value) })} className="bg-background border-border" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="bg-background border-border" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="bg-gradient-gold font-semibold">Create Task</Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreateTask(false)}>Cancel</Button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {allTasks?.map((task: any) => (
                  <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md bg-secondary/50 px-4 py-3 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${task.is_active ? "bg-success" : "bg-muted-foreground"}`} />
                        <p className="text-sm font-medium truncate">{task.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.task_type} · {Number(task.reward_points)} BIX · Max: {task.max_attempts || "∞"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => toggleTaskActive(task.id, task.is_active)} className="shrink-0">
                      {task.is_active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* ===== User Manager ===== */}
          <TabsContent value="users">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">User Manager</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4 hidden sm:table-cell">Balance</th>
                      <th className="pb-2 pr-4 hidden sm:table-cell">Activities</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((u: any) => (
                      <tr key={u.id} className="border-b border-border/30">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-sm">{u.display_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-sm hidden sm:table-cell">{Number(u.bix_balance || 0).toLocaleString()}</td>
                        <td className="py-2.5 pr-4 hidden sm:table-cell">{u.total_activities || 0}</td>
                        <td className="py-2.5 pr-4">
                          {u.is_frozen ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive">Frozen</span>
                          ) : u.is_active ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success">Active</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {Number(u.open_fraud_flags) > 0 ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive">{u.open_fraud_flags}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </TabsContent>

          {/* ===== Rewards Ledger ===== */}
          <TabsContent value="rewards">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Reward Ledger</h2>
              {ledger && ledger.length > 0 ? (
                <div className="space-y-2">
                  {ledger.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium capitalize">{entry.reason.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold text-success">+{Number(entry.amount).toLocaleString()} BIX</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No ledger entries yet.</p>
              )}
            </motion.div>
          </TabsContent>

          {/* ===== Fraud Monitor ===== */}
          <TabsContent value="fraud">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Open Fraud Flags</h2>
              {fraudFlags && fraudFlags.length > 0 ? (
                <div className="space-y-3">
                  {fraudFlags.map((flag: any) => (
                    <div key={flag.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 gap-2">
                      <div>
                        <p className="text-sm font-medium">{flag.flag_type}</p>
                        <p className="text-xs text-muted-foreground">{flag.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(flag.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded self-start ${
                        flag.severity === "high" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                      }`}>
                        {flag.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No open fraud flags.</p>
              )}
            </motion.div>
          </TabsContent>

          {/* ===== Audit Log ===== */}
          <TabsContent value="audit">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Audit Log</h2>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.target_table} · {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No audit logs yet.</p>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
