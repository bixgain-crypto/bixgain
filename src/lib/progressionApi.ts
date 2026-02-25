import { supabase } from "@/integrations/supabase/client";

type JsonRecord = Record<string, unknown>;

type UserSnapshot = {
  id?: string;
  username?: string | null;
  bix_balance?: number;
  total_bix?: number;
  total_xp?: number;
  current_level?: number;
  level_name?: string;
};

type RpcResult = {
  success?: boolean;
  message?: string;
  user?: UserSnapshot;
  reward_xp?: number;
  awarded_xp?: number;
  claimed_xp?: number;
  next_claim_at?: string;
  error?: string;
} & JsonRecord;

function normalizeError(prefix: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${prefix}: ${message}`);
}

function isMissingRpcError(error: unknown): boolean {
  const candidate = (error ?? {}) as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = String(candidate.code ?? "");
  const message = [candidate.message, candidate.details, candidate.hint]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();

  if (code === "PGRST202" || code === "42883") {
    return true;
  }

  return (
    message.includes("could not find the function") ||
    message.includes("function") && message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

async function callRpcWithFallback(functionName: string, payloads: JsonRecord[]): Promise<RpcResult> {
  let lastError: Error | null = null;

  for (const payload of payloads) {
    const { data, error } = await supabase.rpc(functionName as never, payload as never);
    if (!error) {
      if (typeof data === "object" && data !== null) {
        return data as RpcResult;
      }
      return { success: true, value: data };
    }

    if (!isMissingRpcError(error)) {
      throw new Error(error.message);
    }

    lastError = new Error(error.message);
  }

  // Fallback to Edge Function by the same name when RPC is not exposed directly.
  const invokePayload = payloads[0] || {};
  const { data, error } = await supabase.functions.invoke(functionName, { body: invokePayload });
  if (error) {
    throw normalizeError(functionName, error);
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return (typeof data === "object" && data !== null ? data : { success: true, value: data }) as RpcResult;
}

export async function spendBix(amount: number): Promise<RpcResult> {
  return callRpcWithFallback("spend_bix", [
    { amount },
    { p_amount: amount },
  ]);
}

export async function spendXp(amount: number): Promise<RpcResult> {
  return callRpcWithFallback("spend_xp", [
    { amount },
    { p_amount: amount },
  ]);
}

export async function awardXp(xpAmount: number, userId?: string): Promise<RpcResult> {
  const payloads: JsonRecord[] = [
    userId ? { user_id: userId, xp_amount: xpAmount } : { xp_amount: xpAmount },
    userId ? { p_user_id: userId, p_xp_amount: xpAmount } : { p_xp_amount: xpAmount },
    userId ? { user_id: userId, amount: xpAmount } : { amount: xpAmount },
  ];
  return callRpcWithFallback("award_xp", payloads);
}

export async function claimDailyReward(): Promise<RpcResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payloads: JsonRecord[] = [{}];
  if (user?.id) {
    payloads.push({ p_user_id: user.id });
    payloads.push({ user_id: user.id });
  }

  return callRpcWithFallback("claim_daily_reward", [
    ...payloads,
  ]);
}

export async function changeUsername(username: string): Promise<RpcResult> {
  return callRpcWithFallback("change_username", [
    { username },
    { new_username: username },
    { p_username: username },
  ]);
}
