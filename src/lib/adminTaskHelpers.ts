import type { AdminTask, TaskType } from "@/lib/adminApi";
import { normalizeAdminTaskUrlInput } from "@/lib/taskLinks";

export type TaskFormState = {
  name: string;
  description: string;
  reward_points: string;
  task_type: TaskType;
  required_seconds: string;
  target_url: string;
  video_url: string;
  is_active: boolean;
};

export const TASK_TYPE_OPTIONS: TaskType[] = ["custom", "task_completion", "referral", "staking", "login", "social"];

export const initialTaskForm: TaskFormState = {
  name: "",
  description: "",
  reward_points: "50",
  task_type: "custom",
  required_seconds: "30",
  target_url: "",
  video_url: "",
  is_active: true,
};

export function taskTypeRequiresLink(taskType: TaskType): boolean {
  return taskType === "social" || taskType === "task_completion";
}

export function buildTaskPayload(form: TaskFormState) {
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

export function taskToForm(task: AdminTask): TaskFormState {
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
