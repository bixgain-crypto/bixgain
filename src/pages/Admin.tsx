import { AppLayout } from "@/components/AppLayout";
import { useAppData } from "@/context/AppDataContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { type TaskFormState, initialTaskForm, buildTaskPayload } from "@/lib/adminTaskHelpers";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminAiPrompt } from "@/components/AdminAiPrompt";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminMissionsTab } from "@/components/admin/AdminMissionsTab";
import { AdminRewardsTab } from "@/components/admin/AdminRewardsTab";
import { AdminActivitiesTab } from "@/components/admin/AdminActivitiesTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";
import { AdminAuditTab } from "@/components/admin/AdminAuditTab";

export default function Admin() {
  const {
    isAdmin, adminStats, adminUsers, adminTasks, adminActivities, adminSettings, adminAuditLogs, loading,
    refreshAdminStats, refreshAdminUsers, refreshAdminTasks, refreshAdminActivities, refreshAdminSettings,
    refreshAdminAuditLogs, refreshTasks, refreshUserProfile, refreshWallet,
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
    return users.filter((i) => String(i.username || "").toLowerCase().includes(q) || String(i.display_name || "").toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
  }, [users, userSearch]);

  const allFilteredSelected = useMemo(() => filteredUsers.length > 0 && filteredUsers.every((i) => selectedUserIds.includes(i.id)), [filteredUsers, selectedUserIds]);
  const allUsersSelected = useMemo(() => users.length > 0 && users.every((i) => selectedUserIds.includes(i.id)), [selectedUserIds, users]);
  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((i) => i.name.toLowerCase().includes(q) || String(i.description || "").toLowerCase().includes(q) || i.task_type.toLowerCase().includes(q));
  }, [tasks, taskSearch]);

  useEffect(() => { if (!rewardUserId && users.length > 0) setRewardUserId(users[0].id); if (!activityUserId && users.length > 0) setActivityUserId(users[0].id); }, [users, rewardUserId, activityUserId]);
  useEffect(() => { const ids = new Set(users.map((i) => i.id)); setSelectedUserIds((c) => c.filter((id) => ids.has(id))); }, [users]);
  useEffect(() => { if (!adminSettings?.length) return; setSettingDrafts((c) => { const n = { ...c }; for (const s of adminSettings) { if (!(s.key in n)) n[s.key] = s.value; } return n; }); }, [adminSettings]);

  const refreshAdminViews = async () => { await Promise.all([refreshAdminStats(), refreshAdminUsers(), refreshAdminTasks(), refreshAdminActivities(), refreshAdminSettings(), refreshAdminAuditLogs()]); };

  const toggleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUserIds((c) => checked ? (c.includes(userId) ? c : [...c, userId]) : c.filter((id) => id !== userId));
  };
  const toggleSelectAllFiltered = (checked: boolean) => {
    if (!checked) { const s = new Set(filteredUsers.map((i) => i.id)); setSelectedUserIds((c) => c.filter((id) => !s.has(id))); return; }
    setSelectedUserIds((c) => { const n = new Set(c); for (const i of filteredUsers) n.add(i.id); return Array.from(n); });
  };
  const toggleSelectAllUsers = (checked: boolean) => { checked ? setSelectedUserIds(users.map((i) => i.id)) : setSelectedUserIds([]); };

  const updateUserMutation = useMutation({ mutationFn: updateAdminUser, onSuccess: async () => { await Promise.all([refreshAdminUsers(), refreshAdminStats(), refreshAdminAuditLogs(), refreshUserProfile(), refreshWallet()]); toast.success("User updated"); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update user") });
  const createTaskMutation = useMutation({ mutationFn: createAdminTask, onSuccess: async () => { setCreateForm(initialTaskForm); await Promise.all([refreshAdminTasks(), refreshTasks(), refreshAdminStats(), refreshAdminAuditLogs()]); toast.success("Mission created"); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to create mission") });
  const updateTaskMutation = useMutation({ mutationFn: updateAdminTask, onSuccess: async () => { await Promise.all([refreshAdminTasks(), refreshTasks(), refreshAdminStats(), refreshAdminAuditLogs()]); toast.success("Mission updated"); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update mission") });
  const grantRewardsMutation = useMutation({ mutationFn: grantAdminRewards, onSuccess: async () => { setRewardXp(""); setRewardBix(""); setRewardReason(""); await Promise.all([refreshAdminStats(), refreshAdminUsers(), refreshAdminActivities(), refreshAdminAuditLogs(), refreshUserProfile(), refreshWallet()]); toast.success("Rewards granted"); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to grant rewards") });
  const createClaimableRewardsMutation = useMutation({ mutationFn: createClaimableRewardNotifications, onSuccess: async (result) => { await Promise.all([refreshAdminStats(), refreshAdminUsers(), refreshAdminAuditLogs()]); toast.success(`Claim notification sent to ${Number(result.created_count || 0).toLocaleString()} user(s)`); setClaimRewardXp(""); setClaimRewardBix(""); setClaimReason(""); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to create claim notifications") });
  const createActivityMutation = useMutation({ mutationFn: createAdminActivity, onSuccess: async () => { setActivityPoints("0"); setActivityDescription(""); await Promise.all([refreshAdminActivities(), refreshAdminStats(), refreshAdminAuditLogs(), refreshUserProfile()]); toast.success("Activity created"); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to create activity") });
  const updateSettingMutation = useMutation({ mutationFn: ({ key, value, description }: { key: string; value: string; description?: string | null }) => updatePlatformSetting(key, value, description), onSuccess: async () => { await Promise.all([refreshAdminSettings(), refreshAdminAuditLogs()]); toast.success("Setting saved"); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save setting") });

  const handleCreateTask = async () => { try { await createTaskMutation.mutateAsync(buildTaskPayload(createForm)); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Invalid task payload"); } };
  const handleSaveTaskEdit = async () => { if (!editTaskId || !editForm) return; try { await updateTaskMutation.mutateAsync({ task_id: editTaskId, ...buildTaskPayload(editForm) }); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Invalid task payload"); } };
  const handleGrantRewards = async () => {
    const xp = rewardXp.trim() ? Number.parseInt(rewardXp, 10) : 0;
    const bix = rewardBix.trim() ? Number.parseInt(rewardBix, 10) : 0;
    if (!rewardUserId) return toast.error("Select a user");
    if (!Number.isInteger(xp) || xp < 0 || !Number.isInteger(bix) || bix < 0) return toast.error("Reward values must be non-negative integers");
    if (xp === 0 && bix === 0) return toast.error("Provide XP and/or BIX amount");
    await grantRewardsMutation.mutateAsync({ target_user_id: rewardUserId, xp_amount: xp, bix_amount: bix, reason: rewardReason.trim() || "Manual admin grant", description: rewardReason.trim() || "Manual admin grant" });
  };
  const handleCreateClaimableRewards = async () => {
    const xp = claimRewardXp.trim() ? Number.parseInt(claimRewardXp, 10) : 0;
    const bix = claimRewardBix.trim() ? Number.parseInt(claimRewardBix, 10) : 0;
    const timeout = Number.parseInt(claimTimeoutMinutes, 10);
    if (!Number.isInteger(xp) || xp < 0 || !Number.isInteger(bix) || bix < 0) return toast.error("Reward values must be non-negative integers");
    if (xp === 0 && bix === 0) return toast.error("Provide XP and/or BIX amount");
    if (!Number.isInteger(timeout) || timeout <= 0) return toast.error("Timeout must be positive (minutes)");
    if (claimAudience === "selected" && selectedUserIds.length === 0) return toast.error("Select at least one user or switch to All Users");
    await createClaimableRewardsMutation.mutateAsync({ all_users: claimAudience === "all", user_ids: claimAudience === "selected" ? selectedUserIds : [], xp_amount: xp, bix_amount: bix, reason: claimReason.trim() || "Admin timed claim reward", description: claimReason.trim() || "Admin timed claim reward", expires_in_seconds: timeout * 60 });
  };
  const handleCreateActivity = async () => {
    const points = Number(activityPoints);
    if (!activityUserId) return toast.error("Select a user");
    if (!Number.isFinite(points) || points < 0) return toast.error("Points must be non-negative");
    await createActivityMutation.mutateAsync({ target_user_id: activityUserId, activity_type: activityType, points_earned: points, description: activityDescription.trim() || "Admin activity", metadata: { source: "admin-console-ui" }, grant_xp: false });
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

          <TabsContent value="ai"><AdminAiPrompt /></TabsContent>
          <TabsContent value="users">
            <AdminUsersTab users={users} filteredUsers={filteredUsers} userSearch={userSearch} setUserSearch={setUserSearch} selectedUserIds={selectedUserIds} toggleUserSelection={toggleUserSelection} toggleSelectAllFiltered={toggleSelectAllFiltered} toggleSelectAllUsers={toggleSelectAllUsers} setSelectedUserIds={setSelectedUserIds} allFilteredSelected={allFilteredSelected} allUsersSelected={allUsersSelected} loading={loading.adminUsers} refreshAdminViews={refreshAdminViews} updateUserMutation={updateUserMutation} />
          </TabsContent>
          <TabsContent value="missions">
            <AdminMissionsTab createForm={createForm} setCreateForm={setCreateForm} editTaskId={editTaskId} setEditTaskId={setEditTaskId} editForm={editForm} setEditForm={setEditForm} tasks={tasks} filteredTasks={filteredTasks} taskSearch={taskSearch} setTaskSearch={setTaskSearch} handleCreateTask={handleCreateTask} handleSaveTaskEdit={handleSaveTaskEdit} createTaskMutation={createTaskMutation} updateTaskMutation={updateTaskMutation} />
          </TabsContent>
          <TabsContent value="rewards">
            <AdminRewardsTab users={users} rewardUserId={rewardUserId} setRewardUserId={setRewardUserId} rewardXp={rewardXp} setRewardXp={setRewardXp} rewardBix={rewardBix} setRewardBix={setRewardBix} rewardReason={rewardReason} setRewardReason={setRewardReason} handleGrantRewards={handleGrantRewards} grantRewardsMutation={grantRewardsMutation} selectedUserIds={selectedUserIds} claimAudience={claimAudience} setClaimAudience={setClaimAudience} claimRewardXp={claimRewardXp} setClaimRewardXp={setClaimRewardXp} claimRewardBix={claimRewardBix} setClaimRewardBix={setClaimRewardBix} claimReason={claimReason} setClaimReason={setClaimReason} claimTimeoutMinutes={claimTimeoutMinutes} setClaimTimeoutMinutes={setClaimTimeoutMinutes} handleCreateClaimableRewards={handleCreateClaimableRewards} createClaimableRewardsMutation={createClaimableRewardsMutation} />
          </TabsContent>
          <TabsContent value="activities">
            <AdminActivitiesTab users={users} adminActivities={adminActivities} activityUserId={activityUserId} setActivityUserId={setActivityUserId} activityType={activityType} setActivityType={setActivityType} activityPoints={activityPoints} setActivityPoints={setActivityPoints} activityDescription={activityDescription} setActivityDescription={setActivityDescription} handleCreateActivity={handleCreateActivity} createActivityMutation={createActivityMutation} />
          </TabsContent>
          <TabsContent value="data">
            <AdminSettingsTab adminSettings={adminSettings} settingDrafts={settingDrafts} setSettingDrafts={setSettingDrafts} updateSettingMutation={updateSettingMutation} />
          </TabsContent>
          <TabsContent value="audit">
            <AdminAuditTab adminAuditLogs={adminAuditLogs} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
