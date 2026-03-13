import type { Database, Json } from "@/integrations/supabase/types";
import { resolveTaskLinkFromFields } from "@/lib/taskLinks";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export type MissionCategory = "daily" | "weekly" | "referral" | "challenges" | "season";
export type MissionDifficulty = "Easy" | "Medium" | "Hard";

export type MissionTask = {
  id: string;
  name: string;
  description: string | null;
  category: MissionCategory;
  taskType: TaskRow["task_type"];
  xpReward: number;
  difficulty: MissionDifficulty;
  levelRequired: number;
  cooldown: string;
  target: number;
  requiredSeconds: number;
  linkUrl: string | null;
  linkInternal: boolean;
  linkState: "valid" | "missing" | "invalid";
};

type JsonRecord = Record<string, unknown>;

export const CATEGORY_ORDER: MissionCategory[] = ["daily", "weekly", "referral", "challenges", "season"];

export const CATEGORY_LABELS: Record<MissionCategory, string> = {
  daily: "Daily Missions",
  weekly: "Weekly Missions",
  referral: "Referral Missions",
  challenges: "Challenges",
  season: "Season Events",
};

const TASK_TYPE_CATEGORY_MAP: Record<TaskRow["task_type"], MissionCategory> = {
  login: "daily",
  task_completion: "weekly",
  referral: "referral",
  social: "challenges",
  staking: "season",
  custom: "daily",
};

export function difficultyClass(level: MissionDifficulty): string {
  if (level === "Hard") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (level === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
}

function asRecord(value: Json | null | undefined): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asCategory(value: unknown): MissionCategory | null {
  if (typeof value !== "string") return null;
  return CATEGORY_ORDER.find((item) => item === value.trim().toLowerCase()) || null;
}

function asDifficulty(value: unknown): MissionDifficulty | null {
  if (typeof value !== "string") return null;
  const n = value.trim().toLowerCase();
  if (n === "easy") return "Easy";
  if (n === "medium") return "Medium";
  if (n === "hard") return "Hard";
  return null;
}

function asPositiveInt(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function inferDifficulty(xpReward: number): MissionDifficulty {
  if (xpReward >= 250) return "Hard";
  if (xpReward >= 120) return "Medium";
  return "Easy";
}

function defaultCooldown(category: MissionCategory): string {
  if (category === "daily") return "24h";
  if (category === "weekly") return "7d";
  if (category === "challenges") return "48h";
  if (category === "season") return "Season";
  return "24h";
}

export function clampClaimDelaySeconds(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(30, Math.min(3600, Math.floor(parsed)));
}

export function formatDelay(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${remainder}s`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

export function toMissionTask(task: TaskRow): MissionTask {
  const requirements = asRecord(task.requirements);
  const resolvedLink = resolveTaskLinkFromFields({
    target_url: task.target_url,
    video_url: task.video_url,
    requirements: task.requirements,
  });
  const xpReward = Math.max(0, Math.floor(Number(task.reward_points || 0)));
  const category = asCategory(requirements?.category) || TASK_TYPE_CATEGORY_MAP[task.task_type] || "daily";
  const difficulty = asDifficulty(requirements?.difficulty) || inferDifficulty(xpReward);
  const levelRequired = asPositiveInt(requirements?.level_required) || 1;
  const target =
    asPositiveInt(requirements?.target) ||
    (task.max_completions_per_user && task.max_completions_per_user > 0 ? task.max_completions_per_user : 1);
  const rawCooldown = requirements?.cooldown;
  const cooldown = typeof rawCooldown === "string" && rawCooldown.trim().length > 0
    ? rawCooldown.trim()
    : defaultCooldown(category);
  const requiredSeconds = resolvedLink.url
    ? clampClaimDelaySeconds(task.required_seconds ?? requirements?.required_seconds)
    : 0;

  return {
    id: task.id,
    name: task.name,
    description: task.description,
    category,
    taskType: task.task_type,
    xpReward,
    difficulty,
    levelRequired,
    cooldown,
    target,
    requiredSeconds,
    linkUrl: resolvedLink.url,
    linkInternal: resolvedLink.isInternal,
    linkState: resolvedLink.url ? "valid" : (resolvedLink.reason === "invalid" ? "invalid" : "missing"),
  };
}
