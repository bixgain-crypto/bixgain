import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminFormSection } from "./AdminFormSection";
import type { AdminTask, TaskType } from "@/lib/adminApi";
import { type TaskFormState, TASK_TYPE_OPTIONS, taskToForm } from "@/lib/adminTaskHelpers";
import type { UseMutationResult } from "@tanstack/react-query";

type Props = {
  createForm: TaskFormState;
  setCreateForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  editTaskId: string;
  setEditTaskId: (id: string) => void;
  editForm: TaskFormState | null;
  setEditForm: React.Dispatch<React.SetStateAction<TaskFormState | null>>;
  tasks: AdminTask[];
  filteredTasks: AdminTask[];
  taskSearch: string;
  setTaskSearch: (v: string) => void;
  handleCreateTask: () => Promise<void>;
  handleSaveTaskEdit: () => Promise<void>;
  createTaskMutation: UseMutationResult<any, unknown, any, unknown>;
  updateTaskMutation: UseMutationResult<any, unknown, any, unknown>;
};

export function AdminMissionsTab({
  createForm, setCreateForm, editTaskId, setEditTaskId, editForm, setEditForm,
  tasks, filteredTasks, taskSearch, setTaskSearch,
  handleCreateTask, handleSaveTaskEdit, createTaskMutation, updateTaskMutation,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <AdminFormSection title="Create Mission">
          <Input value={createForm.name} placeholder="Name" onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} />
          <Textarea value={createForm.description} placeholder="Description" onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} />
          <Input value={createForm.target_url} placeholder="Target URL (https://...)" onChange={(e) => setCreateForm((prev) => ({ ...prev, target_url: e.target.value }))} />
          <Input value={createForm.video_url} placeholder="Video URL (optional, https://...)" onChange={(e) => setCreateForm((prev) => ({ ...prev, video_url: e.target.value }))} />
          <Input type="number" min="30" max="3600" value={createForm.required_seconds} placeholder="Claim Delay Seconds (30 - 3600)" onChange={(e) => setCreateForm((prev) => ({ ...prev, required_seconds: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" value={createForm.reward_points} onChange={(e) => setCreateForm((prev) => ({ ...prev, reward_points: e.target.value }))} />
            <Select value={createForm.task_type} onValueChange={(v) => setCreateForm((prev) => ({ ...prev, task_type: v as TaskType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TASK_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="create-active">Active</Label>
            <Switch id="create-active" checked={createForm.is_active} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, is_active: checked }))} />
          </div>
          <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? "Creating..." : "Create Mission"}</Button>
        </AdminFormSection>

        <AdminFormSection title="Edit Mission">
          <Select value={editTaskId} onValueChange={(v) => { setEditTaskId(v); const task = tasks.find((i) => i.id === v); setEditForm(task ? taskToForm(task) : null); }}>
            <SelectTrigger><SelectValue placeholder="Select mission" /></SelectTrigger>
            <SelectContent>{tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>)}</SelectContent>
          </Select>
          {editForm ? (
            <>
              <Input value={editForm.name} placeholder="Name" onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))} />
              <Textarea value={editForm.description} placeholder="Description" onChange={(e) => setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))} />
              <Input value={editForm.target_url} placeholder="Target URL (https://...)" onChange={(e) => setEditForm((prev) => (prev ? { ...prev, target_url: e.target.value } : prev))} />
              <Input value={editForm.video_url} placeholder="Video URL (optional, https://...)" onChange={(e) => setEditForm((prev) => (prev ? { ...prev, video_url: e.target.value } : prev))} />
              <Input type="number" min="30" max="3600" value={editForm.required_seconds} placeholder="Claim Delay Seconds (30 - 3600)" onChange={(e) => setEditForm((prev) => (prev ? { ...prev, required_seconds: e.target.value } : prev))} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={editForm.reward_points} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, reward_points: e.target.value } : prev))} />
                <Select value={editForm.task_type} onValueChange={(v) => setEditForm((prev) => (prev ? { ...prev, task_type: v as TaskType } : prev))}>
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
        </AdminFormSection>
      </div>

      <Input placeholder="Search missions" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
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
    </div>
  );
}
