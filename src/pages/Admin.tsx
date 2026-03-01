import { AppLayout } from "@/components/AppLayout";
import { useAppData } from "@/context/AppDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminTask,
  createAdminActivity,
  createAdminTask,
  grantAdminRewards,
  type TaskType,
  updateAdminTask,
  updateAdminUser,
  updatePlatformSetting,
} from "@/lib/adminApi";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TaskFormState = {
  name: string;
  description: string;
  reward_points: string;
  task_type: TaskType;
  is_active: boolean;
};

const TASK_TYPE_OPTIONS: TaskType[] = ["custom", "task_completion", "referral", "staking", "login", "social"];

const initialTaskForm: TaskFormState = {
  name: "",
  description: "",
  reward_points: "50",
  task_type: "custom",
  is_active: true,
};

function buildTaskPayload(form: TaskFormState) {
  const name = form.name.trim();
  if (!name) throw new Error("Task name is required");
  const reward = Number(form.reward_points);
  if (!Number.isFinite(reward) || reward < 0) throw new Error("Reward points must be non-negative");
  return {
    name,
    description: form.description.trim() || null,
    reward_points: reward,
    task_type: form.task_type,
    is_active: form.is_active,
  };
}

function taskToForm(task: AdminTask): TaskFormState {
  return {
    name: task.name || "",
    description: task.description || "",
    reward_points: String(Number(task.reward_points || 0)),
    task_type: task.task_type || "custom",
    is_active: !!task.is_active,
  };
}

export default function Admin() {
  const {
    isAdmin,
    adminStats,
    adminUsers,
    adminTasks,
    adminActivities,
    adminSettings,
    adminAuditLogs,
    loading,
    refreshAdminStats,
    refreshAdminUsers,
    refreshAdminTasks,
    refreshAdminActivities,
    refreshAdminSettings,
    refreshAdminAuditLogs,
    refreshTasks,
    refreshUserProfile,
    refreshWallet,
  } = useAppData();

  const [activeTab, setActiveTab] = useState("users");
  const [userSearch, setUserSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [createForm, setCreateForm] = useState<TaskFormState>(initialTaskForm);
  const [editTaskId, setEditTaskId] = useState("");
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

  const users = useMemo(() => adminUsers ?? [], [adminUsers]);
  const tasks = useMemo(() => adminTasks ?? [], [adminTasks]);

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
    if (!adminSettings?.length) return;
    setSettingDrafts((current) => {
      const next = { ...current };
      for (const setting of adminSettings) {
        if (!(setting.key in next)) next[setting.key] = setting.value;
      }
      return next;
    });
  }, [adminSettings]);

  const refreshAdminViews = async () => {
    await Promise.all([
      refreshAdminStats(),
      refreshAdminUsers(),
      refreshAdminTasks(),
      refreshAdminActivities(),
      refreshAdminSettings(),
      refreshAdminAuditLogs(),
    ]);
  };

  const updateUserMutation = useMutation({
    mutationFn: updateAdminUser,
    onSuccess: async () => {
      await Promise.all([refreshAdminUsers(), refreshAdminStats(), refreshAdminAuditLogs(), refreshUserProfile(), refreshWallet()]);
      toast.success("User updated");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to update user"),
  });

  const createTaskMutation = useMutation({
    mutationFn: createAdminTask,
    onSuccess: async () => {
      setCreateForm(initialTaskForm);
      await Promise.all([refreshAdminTasks(), refreshTasks(), refreshAdminStats(), refreshAdminAuditLogs()]);
      toast.success("Mission created");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to create mission"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: updateAdminTask,
    onSuccess: async () => {
      await Promise.all([refreshAdminTasks(), refreshTasks(), refreshAdminStats(), refreshAdminAuditLogs()]);
      toast.success("Mission updated");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to update mission"),
  });

  const grantRewardsMutation = useMutation({
    mutationFn: grantAdminRewards,
    onSuccess: async () => {
      setRewardXp("");
      setRewardBix("");
      setRewardReason("");
      await Promise.all([
        refreshAdminStats(),
        refreshAdminUsers(),
        refreshAdminActivities(),
        refreshAdminAuditLogs(),
        refreshUserProfile(),
        refreshWallet(),
      ]);
      toast.success("Rewards granted");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to grant rewards"),
  });

  const createActivityMutation = useMutation({
    mutationFn: createAdminActivity,
    onSuccess: async () => {
      setActivityPoints("0");
      setActivityDescription("");
      await Promise.all([refreshAdminActivities(), refreshAdminStats(), refreshAdminAuditLogs(), refreshUserProfile()]);
      toast.success("Activity created");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to create activity"),
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value, description }: { key: string; value: string; description?: string | null }) => updatePlatformSetting(key, value, description),
    onSuccess: async () => {
      await Promise.all([refreshAdminSettings(), refreshAdminAuditLogs()]);
      toast.success("Setting saved");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to save setting"),
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
        <div className="glass rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div><p className="text-muted-foreground">Total Users</p><p className="font-semibold">{Number(adminStats?.total_users || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">TVL Locked</p><p className="font-semibold">{Number(adminStats?.total_tvl_locked || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Rewards Distributed</p><p className="font-semibold">{Number(adminStats?.total_rewards_distributed || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Active Stakes</p><p className="font-semibold">{Number(adminStats?.active_stakes || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Pending Claims</p><p className="font-semibold">{Number(adminStats?.pending_claims || 0).toLocaleString()}</p></div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-full grid grid-cols-6 sm:grid-cols-6">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="missions">Missions</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="data">Settings</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="users" className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Search users" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
              <Button variant="outline" onClick={() => void refreshAdminViews()} disabled={loading.adminUsers}>Refresh</Button>
            </div>
            {loading.adminUsers ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
            <div className="space-y-2">
              {filteredUsers.map((item) => (
                <div key={item.id} className="glass rounded-lg p-3 space-y-2">
                  <div className="flex justify-between gap-2 items-center">
                    <div>
                      <p className="font-semibold">{item.username || "Unnamed user"}</p>
                      <p className="text-xs text-muted-foreground">{item.id}</p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant={item.is_admin ? "default" : "secondary"}>{item.is_admin ? "Admin" : "User"}</Badge>
                      <Badge variant={item.is_active ? "default" : "destructive"}>{item.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">XP {Number(item.total_xp || 0).toLocaleString()} | BIX {Number(item.bix_balance || 0).toLocaleString()}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_active: !item.is_active })}>{item.is_active ? "Deactivate" : "Activate"}</Button>
                    <Button size="sm" variant="outline" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_frozen: !item.is_frozen })}>{item.is_frozen ? "Unfreeze" : "Freeze"}</Button>
                    <Button size="sm" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_admin: !item.is_admin, admin_role: !item.is_admin ? "admin" : "user" })}>{item.is_admin ? "Revoke Admin" : "Make Admin"}</Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="missions" className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="glass rounded-lg p-3 space-y-2">
                <h2 className="font-semibold">Create Mission</h2>
                <Input value={createForm.name} placeholder="Name" onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} />
                <Textarea value={createForm.description} placeholder="Description" onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={createForm.reward_points} onChange={(event) => setCreateForm((prev) => ({ ...prev, reward_points: event.target.value }))} />
                  <Select value={createForm.task_type} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, task_type: value as TaskType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-active">Active</Label>
                  <Switch id="create-active" checked={createForm.is_active} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, is_active: checked }))} />
                </div>
                <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? "Creating..." : "Create Mission"}</Button>
              </div>

              <div className="glass rounded-lg p-3 space-y-2">
                <h2 className="font-semibold">Edit Mission</h2>
                <Select value={editTaskId} onValueChange={(value) => { setEditTaskId(value); const task = tasks.find((item) => item.id === value); setEditForm(task ? taskToForm(task) : null); }}>
                  <SelectTrigger><SelectValue placeholder="Select mission" /></SelectTrigger>
                  <SelectContent>{tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>)}</SelectContent>
                </Select>
                {editForm ? (
                  <>
                    <Input value={editForm.name} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
                    <Input type="number" value={editForm.reward_points} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, reward_points: event.target.value } : prev))} />
                    <div className="flex items-center justify-between">
                      <Label htmlFor="edit-active">Active</Label>
                      <Switch id="edit-active" checked={editForm.is_active} onCheckedChange={(checked) => setEditForm((prev) => (prev ? { ...prev, is_active: checked } : prev))} />
                    </div>
                    <Button onClick={handleSaveTaskEdit} disabled={updateTaskMutation.isPending}>{updateTaskMutation.isPending ? "Saving..." : "Save Mission"}</Button>
                  </>
                ) : <p className="text-sm text-muted-foreground">Select a mission to edit.</p>}
              </div>
            </div>

            <Input placeholder="Search missions" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} />
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <div key={task.id} className="glass rounded-lg p-3 flex justify-between items-center gap-2">
                  <div>
                    <p className="font-semibold">{task.name}</p>
                    <p className="text-xs text-muted-foreground">{task.task_type} | Reward {Number(task.reward_points || 0).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={updateTaskMutation.isPending} onClick={() => updateTaskMutation.mutate({ task_id: task.id, is_active: !task.is_active })}>{task.is_active ? "Disable" : "Enable"}</Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-3">
            <div className="glass rounded-lg p-3 space-y-2 max-w-xl">
              <h2 className="font-semibold">Grant Rewards</h2>
              <Select value={rewardUserId} onValueChange={setRewardUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>{users.map((item) => <SelectItem key={item.id} value={item.id}>{item.username || item.id}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min="0" value={rewardXp} onChange={(event) => setRewardXp(event.target.value)} placeholder="XP" />
                <Input type="number" min="0" value={rewardBix} onChange={(event) => setRewardBix(event.target.value)} placeholder="BIX" />
              </div>
              <Textarea value={rewardReason} onChange={(event) => setRewardReason(event.target.value)} placeholder="Reason" />
              <Button onClick={handleGrantRewards} disabled={grantRewardsMutation.isPending}>{grantRewardsMutation.isPending ? "Granting..." : "Grant Reward"}</Button>
            </div>
          </TabsContent>

          <TabsContent value="activities" className="space-y-3">
            <div className="glass rounded-lg p-3 space-y-2 max-w-xl">
              <h2 className="font-semibold">Create Activity</h2>
              <Select value={activityUserId} onValueChange={setActivityUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>{users.map((item) => <SelectItem key={item.id} value={item.id}>{item.username || item.id}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Select value={activityType} onValueChange={(value) => setActivityType(value as TaskType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min="0" value={activityPoints} onChange={(event) => setActivityPoints(event.target.value)} placeholder="Points" />
              </div>
              <Textarea value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} placeholder="Description" />
              <Button onClick={handleCreateActivity} disabled={createActivityMutation.isPending}>{createActivityMutation.isPending ? "Creating..." : "Create Activity"}</Button>
            </div>
            <div className="space-y-2">
              {adminActivities.map((item) => (
                <div key={item.id} className="glass rounded-lg p-3">
                  <p className="font-semibold text-sm">{item.username || item.user_id} <span className="text-muted-foreground">{item.activity_type}</span></p>
                  <p className="text-xs text-muted-foreground">{item.description || "-"}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-2">
            {adminSettings.map((setting) => (
              <div key={setting.id} className="glass rounded-lg p-3 space-y-2">
                <p className="font-medium">{setting.key}</p>
                <Input value={settingDrafts[setting.key] ?? setting.value} onChange={(event) => setSettingDrafts((prev) => ({ ...prev, [setting.key]: event.target.value }))} />
                <Button size="sm" onClick={() => updateSettingMutation.mutate({ key: setting.key, value: settingDrafts[setting.key] ?? setting.value, description: setting.description })} disabled={updateSettingMutation.isPending}>Save</Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="audit" className="space-y-2">
            {adminAuditLogs.map((row) => (
              <div key={row.id} className="glass rounded-lg p-3">
                <p className="font-semibold text-sm">{row.action}</p>
                <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Admin: {row.admin_username || row.admin_user_id}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

