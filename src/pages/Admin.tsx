
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  type AdminTask,
  createAdminActivity,
  createAdminTask,
  getAdminDashboard,
  grantAdminRewards,
  listAdminActivities,
  listAdminAuditLogs,
  listAdminTasks,
  listAdminUsers,
  listPlatformSettings,
  type TaskType,
  updateAdminTask,
  updateAdminUser,
  updatePlatformSetting,
} from "@/lib/adminApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  Coins,
  Database,
  Gift,
  ListChecks,
  Loader2,
  Settings2,
  Shield,
  ShieldAlert,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TaskFormState = {
  name: string;
  description: string;
  reward_points: string;
  task_type: TaskType;
  is_active: boolean;
  required_seconds: string;
  max_attempts: string;
};

const TASK_TYPE_OPTIONS: TaskType[] = [
  "custom",
  "task_completion",
  "referral",
  "staking",
  "login",
  "social",
];

const initialTaskForm: TaskFormState = {
  name: "",
  description: "",
  reward_points: "50",
  task_type: "custom",
  is_active: true,
  required_seconds: "",
  max_attempts: "",
};

function parseRequiredNumber(label: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
}

function parseOptionalInteger(label: string, value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function buildTaskPayload(form: TaskFormState) {
  const name = form.name.trim();
  if (!name) throw new Error("Task name is required");

  return {
    name,
    description: form.description.trim() || null,
    reward_points: parseRequiredNumber("Reward points", form.reward_points),
    task_type: form.task_type,
    is_active: form.is_active,
    required_seconds: parseOptionalInteger("Required seconds", form.required_seconds),
    max_attempts: parseOptionalInteger("Max attempts", form.max_attempts),
  };
}

function taskToForm(task: AdminTask): TaskFormState {
  return {
    name: task.name || "",
    description: task.description || "",
    reward_points: String(Number(task.reward_points || 0)),
    task_type: task.task_type || "custom",
    is_active: !!task.is_active,
    required_seconds: task.required_seconds == null ? "" : String(task.required_seconds),
    max_attempts: task.max_attempts == null ? "" : String(task.max_attempts),
  };
}

export default function Admin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = !!user?.is_admin;

  const [activeTab, setActiveTab] = useState("users");
  const [userSearch, setUserSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");

  const [createForm, setCreateForm] = useState<TaskFormState>(initialTaskForm);
  const [editTaskId, setEditTaskId] = useState<string>("");
  const [editForm, setEditForm] = useState<TaskFormState | null>(null);

  const [rewardUserId, setRewardUserId] = useState("");
  const [rewardXp, setRewardXp] = useState("");
  const [rewardBix, setRewardBix] = useState("");
  const [rewardReason, setRewardReason] = useState("");

  const [activityUserId, setActivityUserId] = useState("");
  const [activityType, setActivityType] = useState<TaskType>("custom");
  const [activityPoints, setActivityPoints] = useState("0");
  const [activityDescription, setActivityDescription] = useState("");

  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});

  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard"],
    enabled: isAdmin,
    queryFn: getAdminDashboard,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: () => listAdminUsers(""),
  });

  const tasksQuery = useQuery({
    queryKey: ["admin-tasks"],
    enabled: isAdmin,
    queryFn: () => listAdminTasks(""),
  });

  const activitiesQuery = useQuery({
    queryKey: ["admin-activities"],
    enabled: isAdmin,
    queryFn: () => listAdminActivities(),
  });

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    enabled: isAdmin,
    queryFn: listPlatformSettings,
  });

  const auditQuery = useQuery({
    queryKey: ["admin-audit-logs"],
    enabled: isAdmin,
    queryFn: () => listAdminAuditLogs(200),
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((item) => {
      const username = String(item.username || "").toLowerCase();
      const displayName = String(item.display_name || "").toLowerCase();
      return username.includes(q) || displayName.includes(q) || item.id.toLowerCase().includes(q);
    });
  }, [users, userSearch]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        String(item.description || "").toLowerCase().includes(q) ||
        item.task_type.toLowerCase().includes(q)
      );
    });
  }, [tasks, taskSearch]);

  useEffect(() => {
    if (!rewardUserId && users.length > 0) setRewardUserId(users[0].id);
    if (!activityUserId && users.length > 0) setActivityUserId(users[0].id);
  }, [users, rewardUserId, activityUserId]);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettingDrafts((current) => {
      const next = { ...current };
      for (const setting of settingsQuery.data) {
        if (!(setting.key in next)) {
          next[setting.key] = setting.value;
        }
      }
      return next;
    });
  }, [settingsQuery.data]);

  const refreshAdminViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-activities"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
      queryClient.invalidateQueries({ queryKey: ["user-core"] }),
    ]);
  };

  const updateUserMutation = useMutation({
    mutationFn: updateAdminUser,
    onSuccess: async () => {
      await refreshAdminViews();
      toast.success("User updated");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: createAdminTask,
    onSuccess: async () => {
      setCreateForm(initialTaskForm);
      await refreshAdminViews();
      toast.success("Mission created");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to create mission");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: updateAdminTask,
    onSuccess: async () => {
      await refreshAdminViews();
      toast.success("Mission updated");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to update mission");
    },
  });

  const grantRewardsMutation = useMutation({
    mutationFn: grantAdminRewards,
    onSuccess: async () => {
      setRewardXp("");
      setRewardBix("");
      setRewardReason("");
      await refreshAdminViews();
      toast.success("Rewards granted");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to grant rewards");
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: createAdminActivity,
    onSuccess: async () => {
      setActivityPoints("0");
      setActivityDescription("");
      await refreshAdminViews();
      toast.success("Activity created");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to create activity");
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value, description }: { key: string; value: string; description?: string | null }) =>
      updatePlatformSetting(key, value, description),
    onSuccess: async () => {
      await refreshAdminViews();
      toast.success("Setting saved");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to save setting");
    },
  });

  const handleCreateTask = async () => {
    try {
      await createTaskMutation.mutateAsync(buildTaskPayload(createForm));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Invalid task payload");
    }
  };

  const handleSaveTaskEdit = async () => {
    if (!editTaskId || !editForm) return;
    try {
      await updateTaskMutation.mutateAsync({ task_id: editTaskId, ...buildTaskPayload(editForm) });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Invalid task payload");
    }
  };

  const handleGrantRewards = async () => {
    const xpAmount = rewardXp.trim() ? Number.parseInt(rewardXp, 10) : 0;
    const bixAmount = rewardBix.trim() ? Number.parseInt(rewardBix, 10) : 0;

    if (!rewardUserId) return toast.error("Select a user");
    if (!Number.isInteger(xpAmount) || xpAmount < 0 || !Number.isInteger(bixAmount) || bixAmount < 0) {
      return toast.error("Reward values must be non-negative integers");
    }
    if (xpAmount === 0 && bixAmount === 0) return toast.error("Provide XP and/or BIX amount");

    await grantRewardsMutation.mutateAsync({
      target_user_id: rewardUserId,
      xp_amount: xpAmount,
      bix_amount: bixAmount,
      reason: rewardReason.trim() || "Manual admin grant",
      description: rewardReason.trim() || "Manual admin grant",
    });
  };

  const handleCreateActivity = async () => {
    const points = Number(activityPoints);
    if (!activityUserId) return toast.error("Select a user");
    if (!Number.isFinite(points) || points < 0) return toast.error("Points must be a non-negative number");

    await createActivityMutation.mutateAsync({
      target_user_id: activityUserId,
      activity_type: activityType,
      points_earned: points,
      description: activityDescription.trim() || "Admin activity",
      metadata: { source: "admin-console-ui" },
      grant_xp: false,
    });
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="glass rounded-2xl p-8 text-center">
          <ShieldAlert className="h-8 w-8 text-warning mx-auto mb-3" />
          <p className="font-semibold">Admin access required</p>
          <p className="text-sm text-muted-foreground mt-1">This page is visible only when `is_admin = true`.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Admin Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Role: {user?.admin_role || "admin"}</p>
        </motion.div>

        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="glass rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Users</p><p className="mt-1 text-2xl font-bold">{Number(dashboardQuery.data?.stats.total_users || 0).toLocaleString()}</p></div>
          <div className="glass rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Active Tasks</p><p className="mt-1 text-2xl font-bold">{Number(dashboardQuery.data?.stats.active_tasks || 0).toLocaleString()}</p></div>
          <div className="glass rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Claims</p><p className="mt-1 text-2xl font-bold">{Number(dashboardQuery.data?.stats.pending_claims || 0).toLocaleString()}</p></div>
          <div className="glass rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Attempts</p><p className="mt-1 text-2xl font-bold">{Number(dashboardQuery.data?.stats.pending_attempts || 0).toLocaleString()}</p></div>
          <div className="glass rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Fraud Flags</p><p className="mt-1 text-2xl font-bold">{Number(dashboardQuery.data?.stats.open_fraud_flags || 0).toLocaleString()}</p></div>
        </motion.section>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-6 gap-2 bg-transparent p-0 h-auto">
            <TabsTrigger value="users" className="glass rounded-xl py-2"><Users className="h-4 w-4 mr-1.5" />Users</TabsTrigger>
            <TabsTrigger value="missions" className="glass rounded-xl py-2"><Target className="h-4 w-4 mr-1.5" />Missions</TabsTrigger>
            <TabsTrigger value="rewards" className="glass rounded-xl py-2"><Gift className="h-4 w-4 mr-1.5" />Rewards</TabsTrigger>
            <TabsTrigger value="activities" className="glass rounded-xl py-2"><Activity className="h-4 w-4 mr-1.5" />Activities</TabsTrigger>
            <TabsTrigger value="data" className="glass rounded-xl py-2"><Database className="h-4 w-4 mr-1.5" />Data</TabsTrigger>
            <TabsTrigger value="audit" className="glass rounded-xl py-2"><ListChecks className="h-4 w-4 mr-1.5" />Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" />User Management</h2>
                <Button variant="outline" onClick={() => refreshAdminViews()}>Refresh</Button>
              </div>
              <Input placeholder="Search users" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} className="bg-secondary/60" />
              <div className="space-y-2">
                {usersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-secondary/35 p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.username || "Unnamed user"}</p>
                          <p className="text-xs text-muted-foreground">{item.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={item.is_admin ? "default" : "secondary"}>{item.is_admin ? "Admin" : "User"}</Badge>
                          <Badge variant={item.is_active ? "default" : "destructive"}>{item.is_active ? "Active" : "Inactive"}</Badge>
                          <Badge variant={item.is_frozen ? "destructive" : "secondary"}>{item.is_frozen ? "Frozen" : "Unfrozen"}</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"><p className="text-xs text-muted-foreground">Level</p><p className="font-semibold">{item.current_level}</p></div>
                        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"><p className="text-xs text-muted-foreground">XP</p><p className="font-semibold">{Number(item.total_xp || 0).toLocaleString()}</p></div>
                        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"><p className="text-xs text-muted-foreground">BIX</p><p className="font-semibold">{Number(item.bix_balance || 0).toLocaleString()}</p></div>
                        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"><p className="text-xs text-muted-foreground">Total BIX</p><p className="font-semibold">{Number(item.total_bix || 0).toLocaleString()}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_active: !item.is_active })}>{item.is_active ? "Deactivate" : "Activate"}</Button>
                        <Button size="sm" variant="outline" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_frozen: !item.is_frozen })}>{item.is_frozen ? "Unfreeze" : "Freeze"}</Button>
                        <Button size="sm" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_admin: !item.is_admin, admin_role: !item.is_admin ? "admin" : "user" })} className={item.is_admin ? "" : "bg-gradient-gold text-primary-foreground"}>{item.is_admin ? "Revoke Admin" : "Make Admin"}</Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No users found.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="missions" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="glass rounded-2xl p-5 space-y-4">
                <h2 className="text-lg font-semibold">Create Mission</h2>
                <div className="space-y-2"><Label>Name</Label><Input value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Reward Points</Label><Input type="number" value={createForm.reward_points} onChange={(event) => setCreateForm((prev) => ({ ...prev, reward_points: event.target.value }))} /></div>
                  <div className="space-y-2">
                    <Label>Task Type</Label>
                    <Select value={createForm.task_type} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, task_type: value as TaskType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TASK_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Required Seconds</Label><Input type="number" value={createForm.required_seconds} onChange={(event) => setCreateForm((prev) => ({ ...prev, required_seconds: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Max Attempts</Label><Input type="number" value={createForm.max_attempts} onChange={(event) => setCreateForm((prev) => ({ ...prev, max_attempts: event.target.value }))} /></div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 px-3 py-2"><Label htmlFor="create-is-active">Active</Label><Switch id="create-is-active" checked={createForm.is_active} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, is_active: checked }))} /></div>
                <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending} className="w-full bg-gradient-gold text-primary-foreground">{createTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create Mission</Button>
              </div>

              <div className="glass rounded-2xl p-5 space-y-4">
                <h2 className="text-lg font-semibold">Edit Mission</h2>
                <Select value={editTaskId} onValueChange={(value) => { setEditTaskId(value); const task = tasks.find((item) => item.id === value); setEditForm(task ? taskToForm(task) : null); }}>
                  <SelectTrigger><SelectValue placeholder="Select mission" /></SelectTrigger>
                  <SelectContent>{tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>)}</SelectContent>
                </Select>
                {editForm ? (
                  <div className="space-y-3">
                    <div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))} /></div>
                    <div className="space-y-2"><Label>Reward Points</Label><Input type="number" value={editForm.reward_points} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, reward_points: event.target.value } : prev))} /></div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 px-3 py-2"><Label htmlFor="edit-is-active">Active</Label><Switch id="edit-is-active" checked={editForm.is_active} onCheckedChange={(checked) => setEditForm((prev) => (prev ? { ...prev, is_active: checked } : prev))} /></div>
                    <Button onClick={handleSaveTaskEdit} disabled={updateTaskMutation.isPending} className="w-full">{updateTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Mission</Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a mission to edit.</p>
                )}
              </div>
            </div>
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Missions List</h2>
                <Input placeholder="Search missions" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} className="max-w-sm bg-secondary/60" />
              </div>
              <div className="space-y-2">
                {tasksQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading missions...</p>
                ) : filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-border/60 bg-secondary/35 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{task.task_type} | Reward {Number(task.reward_points || 0).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={task.is_active ? "default" : "secondary"}>{task.is_active ? "Active" : "Inactive"}</Badge>
                        <Button size="sm" variant="outline" disabled={updateTaskMutation.isPending} onClick={() => updateTaskMutation.mutate({ task_id: task.id, is_active: !task.is_active })}>{task.is_active ? "Disable" : "Enable"}</Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No missions found.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Gift className="h-5 w-5 text-primary" />Grant Rewards</h2>
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={rewardUserId} onValueChange={setRewardUserId}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>{users.map((item) => <SelectItem key={item.id} value={item.id}>{item.username || item.id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>XP Amount</Label><Input type="number" min="0" value={rewardXp} onChange={(event) => setRewardXp(event.target.value)} /></div>
                <div className="space-y-2"><Label>BIX Amount</Label><Input type="number" min="0" value={rewardBix} onChange={(event) => setRewardBix(event.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Reason</Label><Textarea value={rewardReason} onChange={(event) => setRewardReason(event.target.value)} /></div>
              <Button onClick={handleGrantRewards} disabled={grantRewardsMutation.isPending} className="bg-gradient-gold text-primary-foreground">{grantRewardsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Coins className="h-4 w-4 mr-2" />}Grant Reward</Button>
            </div>
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="glass rounded-2xl p-5 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Create Activity</h2>
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={activityUserId} onValueChange={setActivityUserId}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>{users.map((item) => <SelectItem key={item.id} value={item.id}>{item.username || item.id}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Activity Type</Label>
                    <Select value={activityType} onValueChange={(value) => setActivityType(value as TaskType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TASK_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Points</Label><Input type="number" min="0" value={activityPoints} onChange={(event) => setActivityPoints(event.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} /></div>
                <Button onClick={handleCreateActivity} disabled={createActivityMutation.isPending}>{createActivityMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create Activity</Button>
              </div>

              <div className="glass rounded-2xl p-5 space-y-3">
                <h2 className="text-lg font-semibold">Recent Activities</h2>
                <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                  {activitiesQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading activities...</p>
                  ) : (activitiesQuery.data || []).length > 0 ? (
                    (activitiesQuery.data || []).map((item) => (
                      <div key={item.id} className="rounded-xl border border-border/60 bg-secondary/35 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{item.username || item.user_id}</p>
                          <Badge variant="secondary">{item.activity_type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.description || "-"}</p>
                        <p className="text-xs mt-1">Points: {Number(item.points_earned || 0).toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No activities yet.</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Platform Settings</h2>
              <div className="space-y-3">
                {settingsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading settings...</p>
                ) : (settingsQuery.data || []).length > 0 ? (
                  (settingsQuery.data || []).map((setting) => (
                    <div key={setting.id} className="rounded-xl border border-border/60 bg-secondary/35 p-3 space-y-2">
                      <div>
                        <p className="font-medium">{setting.key}</p>
                        <p className="text-xs text-muted-foreground">{setting.description || "No description"}</p>
                      </div>
                      <Input value={settingDrafts[setting.key] ?? setting.value} onChange={(event) => setSettingDrafts((prev) => ({ ...prev, [setting.key]: event.target.value }))} className="bg-secondary/60" />
                      <Button size="sm" onClick={() => updateSettingMutation.mutate({ key: setting.key, value: settingDrafts[setting.key] ?? setting.value, description: setting.description })} disabled={updateSettingMutation.isPending}>Save</Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No settings found.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" />Admin Audit Log</h2>
              <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
                {auditQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading audit log...</p>
                ) : (auditQuery.data || []).length > 0 ? (
                  (auditQuery.data || []).map((row) => (
                    <div key={row.id} className="rounded-xl border border-border/60 bg-secondary/35 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{row.action}</p>
                        <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Admin: {row.admin_username || row.admin_user_id}</p>
                      <p className="text-xs text-muted-foreground">Target: {row.target_table || "-"} {row.target_id ? `(${row.target_id})` : ""}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No audit logs found.</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
