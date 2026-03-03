import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type RewardNotification = {
  id: string;
  user_id: string;
  xp_amount: number;
  bix_amount: number;
  reason: string | null;
  description: string | null;
  status: "pending" | "claimed" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  metadata: Json | null;
};

export type RewardNotificationClaimResult = {
  success: boolean;
  notification_id: string;
  xp_amount: number;
  bix_amount: number;
  claimed_at: string | null;
};

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listPendingRewardNotifications(): Promise<RewardNotification[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_reward_notifications" as never)
    .select("id, user_id, xp_amount, bix_amount, reason, description, status, created_at, expires_at, claimed_at, metadata")
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id || ""),
    user_id: String(row.user_id || ""),
    xp_amount: Math.max(0, Math.floor(asNumber(row.xp_amount))),
    bix_amount: Math.max(0, asNumber(row.bix_amount)),
    reason: typeof row.reason === "string" ? row.reason : null,
    description: typeof row.description === "string" ? row.description : null,
    status: (typeof row.status === "string" ? row.status : "pending") as RewardNotification["status"],
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    expires_at: typeof row.expires_at === "string" ? row.expires_at : new Date().toISOString(),
    claimed_at: typeof row.claimed_at === "string" ? row.claimed_at : null,
    metadata: (row.metadata as Json | null) ?? null,
  }));
}

export async function claimRewardNotification(
  notificationId: string,
): Promise<RewardNotificationClaimResult> {
  const id = notificationId.trim();
  if (!id) {
    throw new Error("notification_id is required");
  }

  const { data, error } = await supabase.rpc("claim_reward_notification" as never, {
    p_notification_id: id,
  } as never);

  if (error) {
    throw new Error(error.message);
  }

  const payload = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  return {
    success: true,
    notification_id: String(payload.notification_id || id),
    xp_amount: Math.max(0, Math.floor(asNumber(payload.xp_amount))),
    bix_amount: Math.max(0, asNumber(payload.bix_amount)),
    claimed_at: typeof payload.claimed_at === "string" ? payload.claimed_at : null,
  };
}

