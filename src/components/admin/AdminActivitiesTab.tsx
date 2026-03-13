import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminFormSection } from "./AdminFormSection";
import type { AdminActivity, AdminUser, TaskType } from "@/lib/adminApi";
import { TASK_TYPE_OPTIONS } from "@/lib/adminTaskHelpers";
import type { UseMutationResult } from "@tanstack/react-query";

type Props = {
  users: AdminUser[];
  adminActivities: AdminActivity[];
  activityUserId: string;
  setActivityUserId: (v: string) => void;
  activityType: TaskType;
  setActivityType: (v: TaskType) => void;
  activityPoints: string;
  setActivityPoints: (v: string) => void;
  activityDescription: string;
  setActivityDescription: (v: string) => void;
  handleCreateActivity: () => Promise<void>;
  createActivityMutation: UseMutationResult<any, unknown, any, unknown>;
};

export function AdminActivitiesTab({
  users, adminActivities, activityUserId, setActivityUserId, activityType, setActivityType,
  activityPoints, setActivityPoints, activityDescription, setActivityDescription,
  handleCreateActivity, createActivityMutation,
}: Props) {
  return (
    <div className="space-y-3">
      <AdminFormSection title="Create Activity">
        <Select value={activityUserId} onValueChange={setActivityUserId}>
          <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
          <SelectContent>{users.map((item) => <SelectItem key={item.id} value={item.id}>{item.username || item.id}</SelectItem>)}</SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={activityType} onValueChange={(v) => setActivityType(v as TaskType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" min="0" value={activityPoints} onChange={(e) => setActivityPoints(e.target.value)} placeholder="Points" />
        </div>
        <Textarea value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} placeholder="Description" />
        <Button onClick={handleCreateActivity} disabled={createActivityMutation.isPending}>{createActivityMutation.isPending ? "Creating..." : "Create Activity"}</Button>
      </AdminFormSection>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {adminActivities.map((item) => (
          <div key={item.id} className="glass rounded-lg p-3">
            <p className="font-semibold text-sm">{item.username || item.user_id} <span className="text-muted-foreground">{item.activity_type}</span></p>
            <p className="text-xs text-muted-foreground">{item.description || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
