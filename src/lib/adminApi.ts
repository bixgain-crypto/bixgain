import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type AdminActionResponse = {
  error?: string;
  message?: string;
};

export type TaskType = Database["public"]["Enums"]["activity_type"];

export type AdminDashboardStats = {
  total_users: number | null;
  active_users: number | null;
  total_bix_in_circulation: number | null;
  pending_claims: number | null;
  total_approved_claims: number | null;
  total_revenue: number | null;
  total_tasks: number;
  active_tasks: number;
  pending_attempts: number;
  open_fraud_flags: number;
};

export type AdminAuditItem = {
  id: string;
  admin_user_id: string;
  admin_username?: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  old_data?: Json | null;
  new_data?: Json | null;
  ip_address?: string | null;
  created_at: string;
};

export type AdminUser = {
  id: string;
  username: string | null;
  created_at: string;
  bix_balance: number;
  total_bix: number;
  total_xp: number;
  current_level: number;
  level_name: string;
  is_admin: boolean;
  admin_role: string | null;
  display_name: string | null;
  is_active: boolean;
  is_frozen: boolean;
  referral_code: string | null;
};

export type AdminTask = {
  id: string;
  name: string;
  description: string | null;
  reward_points: number;
  task_type: TaskType;
  is_active: boolean;
  required_seconds: number | null;
  max_attempts: number | null;
  max_completions_per_user: number | null;
  total_budget: number | null;
  total_claimed: number;
  target_url: string | null;
  video_url: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminActivity = {
  id: string;
  user_id: string;
  username?: string | null;
  task_id: string | null;
  activity_type: TaskType;
  points_earned: number;
  description: string | null;
  metadata: Json | null;
  created_at: string;
};

export type PlatformSetting = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
};

type UpdateAdminUserPayload = {
  target_user_id: string;
  username?: string;
  admin_role?: string;
  is_admin?: boolean;
  display_name?: string | null;
  is_active?: boolean;
  is_frozen?: boolean;
};

type UpsertTaskPayload = {
  task_id?: string;
  name?: string;
  description?: string | null;
  reward_points?: number;
  task_type?: TaskType;
  is_active?: boolean;
  required_seconds?: number | null;
  max_attempts?: number | null;
  max_completions_per_user?: number | null;
  total_budget?: number | null;
  target_url?: string | null;
  video_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  requirements?: Json | null;
  verification_rules?: Json | null;
};

type GrantRewardsPayload = {
  target_user_id: string;
  xp_amount?: number;
  bix_amount?: number;
  reason?: string;
  description?: string;
};

type CreateActivityPayload = {
  target_user_id: string;
  activity_type: TaskType;
  points_earned?: number;
  description?: string;
  metadata?: Json;
  grant_xp?: boolean;
};

function extractEdgeError(error: unknown): string {
  const fallback = "Edge Function request failed";
  if (!(error instanceof Error)) return fallback;

  const details = (error as Error & { details?: string }).details;
  if (details && typeof details === "string") {
    try {
      const parsed = JSON.parse(details) as { error?: string; message?: string };
      if (parsed.error) return parsed.error;
      if (parsed.message) return parsed.message;
    } catch {
      // Ignore JSON parse failure and fall back to default message.
    }
  }

  return error.message || fallback;
}

async function callAdminOperation<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-operations", {
    body: { action, ...payload },
  });

  if (error) {
    throw new Error(extractEdgeError(error));
  }

  const base = (data || {}) as AdminActionResponse;
  if (base.error) {
    throw new Error(base.error);
  }

  return data as T;
}

export async function getAdminDashboard(): Promise<{ stats: AdminDashboardStats; recent_audit: AdminAuditItem[] }> {
  return callAdminOperation("get_dashboard");
}

export async function listAdminUsers(search = ""): Promise<AdminUser[]> {
  const response = await callAdminOperation<{ users: AdminUser[] }>("list_users", {
    search,
    limit: 200,
  });
  return response.users || [];
}

export async function updateAdminUser(payload: UpdateAdminUserPayload): Promise<AdminUser> {
  const response = await callAdminOperation<{ user: AdminUser }>("update_user", payload);
  return response.user;
}

export async function listAdminTasks(search = ""): Promise<AdminTask[]> {
  const response = await callAdminOperation<{ tasks: AdminTask[] }>("list_tasks", {
    search,
    limit: 300,
  });
  return response.tasks || [];
}

export async function createAdminTask(payload: UpsertTaskPayload): Promise<AdminTask> {
  const response = await callAdminOperation<{ task: AdminTask }>("create_task", payload);
  return response.task;
}

export async function updateAdminTask(payload: UpsertTaskPayload): Promise<AdminTask> {
  const response = await callAdminOperation<{ task: AdminTask }>("update_task", payload);
  return response.task;
}

export async function grantAdminRewards(payload: GrantRewardsPayload): Promise<AdminUser | null> {
  const response = await callAdminOperation<{ success: boolean; user: AdminUser | null }>("grant_rewards", payload);
  return response.user || null;
}

export async function listAdminActivities(userId?: string): Promise<AdminActivity[]> {
  const response = await callAdminOperation<{ activities: AdminActivity[] }>("list_activities", {
    user_id: userId || null,
    limit: 200,
  });
  return response.activities || [];
}

export async function createAdminActivity(payload: CreateActivityPayload): Promise<AdminActivity> {
  const response = await callAdminOperation<{ activity: AdminActivity }>("create_activity", payload);
  return response.activity;
}

export async function listPlatformSettings(): Promise<PlatformSetting[]> {
  const response = await callAdminOperation<{ settings: PlatformSetting[] }>("list_settings");
  return response.settings || [];
}

export async function updatePlatformSetting(key: string, value: string, description?: string | null): Promise<PlatformSetting> {
  const response = await callAdminOperation<{ setting: PlatformSetting }>("update_setting", {
    key,
    value,
    description,
  });
  return response.setting;
}

export async function listAdminAuditLogs(limit = 200): Promise<AdminAuditItem[]> {
  const response = await callAdminOperation<{ logs: AdminAuditItem[] }>("list_audit_logs", { limit });
  return response.logs || [];
}

