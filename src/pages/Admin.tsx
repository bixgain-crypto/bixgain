import { AppLayout } from "@/components/AppLayout";
import { useAppData } from "@/context/AppDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminTask,
  createClaimableRewardNotifications,
  createAdminActivity,
  createAdminTask,
  grantAdminRewards,
  type TaskType,
  updateAdminTask,
  updateAdminUser,
  updatePlatformSetting,
} from "@/lib/adminApi";
import { normalizeAdminTaskUrlInput } from "@/lib/taskLinks";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminAiPrompt } from "@/components/AdminAiPrompt";

type TaskFormState = {
  name: string;
  description: string;
  reward_points: string;
  task_type: TaskType;
  required_seconds: string;
  target_url: string;
  video_url: string;
  is_active: boolean;
};

const TASK_TYPE_OPTIONS: TaskType[] = ["custom", "task_completion", "referral", "staking", "login", "social"];

const initialTaskForm: TaskFormState = {
  name: "",
  description: "",
  reward_points: "50",
  task_type: "custom",
  required_seconds: "30",
  target_url: "",
  video_url: "",
  is_active: true,
};

function taskTypeRequiresLink(taskType: TaskType): boolean {
  return taskType === "social" || taskType === "task_completion";
}

function buildTaskPayload(form: TaskFormState) {
  const name = form.name.trim();
  if (!name) throw new Error("Task name is required");
  const reward = Number(form.reward_points);
  if (!Number.isFinite(reward) || reward < 0) throw new Error("Reward points must be non-negative");
  const targetCheck = normalizeAdminTaskUrlInput(form.target_url);
  if (targetCheck.error) throw new Error(`Target URL: ${targetCheck.error}`);
  const videoCheck = normalizeAdminTaskUrlInput(form.video_url);
  if (videoCheck.error) throw new Error(`Video URL: ${videoCheck.error}`);
  if (form.is_active && taskTypeRequiresLink(form.task_type) && !targetCheck.url && !videoCheck.url) {
    throw new Error("Active social/task missions require at least one valid https:// link");
  }
  const claimDelaySeconds = Number.parseInt(form.required_seconds || "30", 10);
  if (!Number.isInteger(claimDelaySeconds) || claimDelaySeconds < 30 || claimDelaySeconds > 3600) {
    throw new Error("Claim delay must be between 30 and 3600 seconds");
  }

  return {
    name,
    description: form.description.trim() || null,
    reward_points: reward,
    task_type: form.task_type,
    required_seconds: claimDelaySeconds,
    target_url: targetCheck.url,
    video_url: videoCheck.url,
    is_active: form.is_active,
  };
}

function taskToForm(task: AdminTask): TaskFormState {
  return {
    name: task.name || "",
    description: task.description || "",
    reward_points: String(Number(task.reward_points || 0)),
    task_type: task.task_type || "custom",
    required_seconds: String(Number(task.required_seconds || 30)),
    target_url: task.target_url || "",
    video_url: task.video_url || "",
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

  const [activeTab, setActiveTab] = useState("ai");
  const [userSearch, setUserSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [createForm, setCreateForm] = useState<TaskFormState>(initialTaskForm);
  const [editTaskId, setEditTaskId] = useState("");
  const [editForm, setEditForm] = useState<TaskFormState | null>(null);
  const [rewardUserId, setRewardUserId] = useState("");
  const [rewardXp, setRewardXp] = useState("");
  const [rewardBix, setRewardBix] = useState("");
  const [rewardReason, setRewardReason] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [claimAudience, setClaimAudience] = useState<"selected" | "all">("selected");
  const [claimRewardXp, setClaimRewardXp] = useState("");
  const [claimRewardBix, setClaimRewardBix] = useState("");
  const [claimReason, setClaimReason] = useState("");
  const [claimTimeoutMinutes, setClaimTimeoutMinutes] = useState("60");
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

  const allFilteredSelected = useMemo(() => {
    if (filteredUsers.length === 0) return false;
    const selected = new Set(selectedUserIds);
    return filteredUsers.every((item) => selected.has(item.id));
  }, [filteredUsers, selectedUserIds]);

  const allUsersSelected = useMemo(() => {
    if (users.length === 0) return false;
    const selected = new Set(selectedUserIds);
    return users.every((item) => selected.has(item.id));
  }, [selectedUserIds, users]);

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
    const allowedIds = new Set(users.map((item) => item.id));
    setSelectedUserIds((current) => current.filter((id) => allowedIds.has(id)));
  }, [users]);

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

  const toggleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) {
        if (current.includes(userId)) return current;
        return [...current, userId];
      }
      return current.filter((id) => id !== userId);
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (!checked) {
      const filteredIdSet = new Set(filteredUsers.map((item) => item.id));
      setSelectedUserIds((current) => current.filter((id) => !filteredIdSet.has(id)));
      return;
    }

    setSelectedUserIds((current) => {
      const next = new Set(current);
      for (const item of filteredUsers) {
        next.add(item.id);
      }
      return Array.from(next);
    });
  };

  const toggleSelectAllUsers = (checked: boolean) => {
    if (!checked) {
      setSelectedUserIds([]);
      return;
    }

    setSelectedUserIds(users.map((item) => item.id));
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

  const createClaimableRewardsMutation = useMutation({
    mutationFn: createClaimableRewardNotifications,
    onSuccess: async (result) => {
      await Promise.all([refreshAdminStats(), refreshAdminUsers(), refreshAdminAuditLogs()]);
      toast.success(
        `Claim notification sent to ${Number(result.created_count || 0).toLocaleString()} user(s)`,
      );
      setClaimRewardXp("");
      setClaimRewardBix("");
      setClaimReason("");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Failed to create claim notifications"),
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

  const handleCreateClaimableRewards = async () => {
    const xpAmount = claimRewardXp.trim() ? Number.parseInt(claimRewardXp, 10) : 0;
    const bixAmount = claimRewardBix.trim() ? Number.parseInt(claimRewardBix, 10) : 0;
    const timeoutMinutes = Number.parseInt(claimTimeoutMinutes, 10);

    if (!Number.isInteger(xpAmount) || xpAmount < 0 || !Number.isInteger(bixAmount) || bixAmount < 0) {
      return toast.error("Reward values must be non-negative integers");
    }
    if (xpAmount === 0 && bixAmount === 0) return toast.error("Provide XP and/or BIX amount");
    if (!Number.isInteger(timeoutMinutes) || timeoutMinutes <= 0) {
      return toast.error("Timeout must be a positive integer (minutes)");
    }

    if (claimAudience === "selected" && selectedUserIds.length === 0) {
      return toast.error("Select at least one user from Users tab or switch to All Users");
    }

    await createClaimableRewardsMutation.mutateAsync({
      all_users: claimAudience === "all",
      user_ids: claimAudience === "selected" ? selectedUserIds : [],
      xp_amount: xpAmount,
      bix_amount: bixAmount,
      reason: claimReason.trim() || "Admin timed claim reward",
      description: claimReason.trim() || "Admin timed claim reward",
      expires_in_seconds: timeoutMinutes * 60,
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
        <div className="glass rounded-xl p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
          <div><p className="text-muted-foreground">Total Users</p><p className="font-semibold">{Number(adminStats?.total_users || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">TVL Locked</p><p className="font-semibold">{Number(adminStats?.total_tvl_locked || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Rewards Distributed</p><p className="font-semibold">{Number(adminStats?.total_rewards_distributed || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Active Stakes</p><p className="font-semibold">{Number(adminStats?.active_stakes || 0).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Pending Claims</p><p className="font-semibold">{Number(adminStats?.pending_claims || 0).toLocaleString()}</p></div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-full grid grid-cols-7 sm:grid-cols-7">
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="missions">Missions</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="data">Settings</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="ai">
            <AdminAiPrompt />
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search users" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
              <Button variant="outline" onClick={() => void refreshAdminViews()} disabled={loading.adminUsers}>Refresh</Button>
              <Button
                variant="outline"
                onClick={() => toggleSelectAllFiltered(!allFilteredSelected)}
                disabled={filteredUsers.length === 0}
              >
                {allFilteredSelected ? "Unselect Filtered" : "Select Filtered"}
              </Button>
              <Button
                variant="outline"
                onClick={() => toggleSelectAllUsers(!allUsersSelected)}
                disabled={users.length === 0}
              >
                {allUsersSelected ? "Unselect All Users" : "Select All Users"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedUserIds([])}
                disabled={selectedUserIds.length === 0}
              >
                Clear Selection ({selectedUserIds.length})
              </Button>
            </div>
            {loading.adminUsers ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {filteredUsers.map((item) => (
                <div key={item.id} className="glass rounded-lg p-3 space-y-2">
                  <div className="flex justify-between gap-2 items-center">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedUserIds.includes(item.id)}
                        onCheckedChange={(checked) => toggleUserSelection(item.id, checked === true)}
                        aria-label={`Select ${item.username || item.id}`}
                      />
                      <div>
                      <p className="font-semibold">{item.username || "Unnamed user"}</p>
                      <p className="text-xs text-muted-foreground">{item.id}</p>
                      </div>
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
                <Input
                  value={createForm.target_url}
                  placeholder="Target URL (https://...)"
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, target_url: event.target.value }))}
                />
                <Input
                  value={createForm.video_url}
                  placeholder="Video URL (optional, https://...)"
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, video_url: event.target.value }))}
                />
                <Input
                  type="number"
                  min="30"
                  max="3600"
                  value={createForm.required_seconds}
                  placeholder="Claim Delay Seconds (30 - 3600)"
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, required_seconds: event.target.value }))}
                />
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
                    <Input value={editForm.name} placeholder="Name" onChange={(event) => setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
                    <Textarea value={editForm.description} placeholder="Description" onChange={(event) => setEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))} />
                    <Input
                      value={editForm.target_url}
                      placeholder="Target URL (https://...)"
                      onChange={(event) => setEditForm((prev) => (prev ? { ...prev, target_url: event.target.value } : prev))}
                    />
                    <Input
                      value={editForm.video_url}
                      placeholder="Video URL (optional, https://...)"
                      onChange={(event) => setEditForm((prev) => (prev ? { ...prev, video_url: event.target.value } : prev))}
                    />
                    <Input
                      type="number"
                      min="30"
                      max="3600"
                      value={editForm.required_seconds}
                      placeholder="Claim Delay Seconds (30 - 3600)"
                      onChange={(event) => setEditForm((prev) => (prev ? { ...prev, required_seconds: event.target.value } : prev))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" value={editForm.reward_points} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, reward_points: event.target.value } : prev))} />
                      <Select value={editForm.task_type} onValueChange={(value) => setEditForm((prev) => (prev ? { ...prev, task_type: value as TaskType } : prev))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TASK_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2">
              {filteredTasks.map((task) => (
                <div key={task.id} className="glass rounded-lg p-3 flex justify-between items-center gap-2">
                  <div>
                    <p className="font-semibold">{task.name}</p>
                    <p className="text-xs text-muted-foreground">{task.task_type} | Reward {Number(task.reward_points || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.target_url || task.video_url || "No link configured"}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={updateTaskMutation.isPending} onClick={() => updateTaskMutation.mutate({ task_id: task.id, is_active: !task.is_active })}>{task.is_active ? "Disable" : "Enable"}</Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="glass rounded-lg p-3 space-y-2">
                <h2 className="font-semibold">Instant Grant</h2>
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

              <div className="glass rounded-lg p-3 space-y-2">
                <h2 className="font-semibold">Timed Claim Notification</h2>
                <Select value={claimAudience} onValueChange={(value) => setClaimAudience(value as "selected" | "all")}>
                  <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selected">Selected Users</SelectItem>
                    <SelectItem value="all">All Users</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selected users: {selectedUserIds.length.toLocaleString()} | Timeout is required before reward expires.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" min="0" value={claimRewardXp} onChange={(event) => setClaimRewardXp(event.target.value)} placeholder="XP" />
                  <Input type="number" min="0" value={claimRewardBix} onChange={(event) => setClaimRewardBix(event.target.value)} placeholder="BIX" />
                  <Input type="number" min="1" value={claimTimeoutMinutes} onChange={(event) => setClaimTimeoutMinutes(event.target.value)} placeholder="Timeout (min)" />
                </div>
                <Textarea value={claimReason} onChange={(event) => setClaimReason(event.target.value)} placeholder="Notification reason" />
                <Button onClick={handleCreateClaimableRewards} disabled={createClaimableRewardsMutation.isPending}>
                  {createClaimableRewardsMutation.isPending ? "Sending..." : "Send Claim Notification"}
                </Button>
              </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {adminActivities.map((item) => (
                <div key={item.id} className="glass rounded-lg p-3">
                  <p className="font-semibold text-sm">{item.username || item.user_id} <span className="text-muted-foreground">{item.activity_type}</span></p>
                  <p className="text-xs text-muted-foreground">{item.description || "-"}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="data" className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {adminSettings.map((setting) => (
              <div key={setting.id} className="glass rounded-lg p-3 space-y-2">
                <p className="font-medium">{setting.key}</p>
                <Input value={settingDrafts[setting.key] ?? setting.value} onChange={(event) => setSettingDrafts((prev) => ({ ...prev, [setting.key]: event.target.value }))} />
                <Button size="sm" onClick={() => updateSettingMutation.mutate({ key: setting.key, value: settingDrafts[setting.key] ?? setting.value, description: setting.description })} disabled={updateSettingMutation.isPending}>Save</Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="audit" className="grid grid-cols-1 xl:grid-cols-2 gap-2">
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

          <TabsContent value="ai">
            <AdminAiPrompt />
          </TabsContent>

