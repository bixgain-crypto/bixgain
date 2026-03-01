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

let refreshSessionInFlight: Promise<string | null> | null = null;

function normalizeRpcResult(data: unknown): RpcResult {
  if (typeof data === "object" && data !== null) {
    return data as RpcResult;
  }
  return { success: true, value: data } as RpcResult;
}

function parseJsonString(value: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
  } catch {
    // Fall through and return null.
  }
  return null;
}

async function extractInvokeErrorMessage(functionName: string, error: unknown): Promise<string> {
  const candidate = (error ?? {}) as {
    message?: unknown;
    details?: unknown;
    context?: unknown;
  };

  if (typeof candidate.details === "string" && candidate.details.trim().length > 0) {
    const detailsJson = parseJsonString(candidate.details);
    if (detailsJson?.error && typeof detailsJson.error === "string") {
      return `${functionName}: ${detailsJson.error}`;
    }
    if (detailsJson?.message && typeof detailsJson.message === "string") {
      return `${functionName}: ${detailsJson.message}`;
    }
    return `${functionName}: ${candidate.details}`;
  }

  const response = candidate.context;
  if (response && typeof response === "object" && "text" in response) {
    const responseLike = response as Response;
    try {
      const bodyText = await responseLike.clone().text();
      const bodyJson = parseJsonString(bodyText);
      if (bodyJson?.error && typeof bodyJson.error === "string") {
        return `${functionName}: ${bodyJson.error}`;
      }
      if (bodyJson?.message && typeof bodyJson.message === "string") {
        return `${functionName}: ${bodyJson.message}`;
      }
      if (bodyText.trim().length > 0) {
        return `${functionName}: ${bodyText}`;
      }
    } catch {
      // Fall through to generic message.
    }
  }

  if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
    return `${functionName}: ${candidate.message}`;
  }

  return `${functionName}: request failed`;
}

function extractRpcErrorMessage(error: unknown): string {
  const candidate = (error ?? {}) as { message?: unknown; details?: unknown; hint?: unknown };
  const parts = [candidate.message, candidate.details, candidate.hint]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => String(part));

  if (parts.length > 0) return parts.join(" ");
  return "request failed";
}

function isAuthError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid jwt") ||
    normalized.includes("jwt expired") ||
    normalized.includes("unauthorized") ||
    normalized.includes("401") ||
    normalized.includes("session expired")
  );
}

async function refreshAccessTokenOnce(): Promise<string | null> {
  if (!refreshSessionInFlight) {
    refreshSessionInFlight = (async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) return null;
      return data.session.access_token;
    })().finally(() => {
      refreshSessionInFlight = null;
    });
  }

  return refreshSessionInFlight;
}

async function ensureAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) return session.access_token;
  return refreshAccessTokenOnce();
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
      return normalizeRpcResult(data);
    }

    const rpcMessage = extractRpcErrorMessage(error);

    if (!isMissingRpcError(error)) {
      if (isAuthError(rpcMessage)) {
        const refreshedToken = await refreshAccessTokenOnce();
        if (!refreshedToken) {
          throw new Error("Authentication session expired. Please sign in again.");
        }

        const retry = await supabase.rpc(functionName as never, payload as never);
        if (!retry.error) {
          return normalizeRpcResult(retry.data);
        }

        const retryMessage = extractRpcErrorMessage(retry.error);
        if (isAuthError(retryMessage)) {
          throw new Error("Authentication session expired. Please sign in again.");
        }

        if (!isMissingRpcError(retry.error)) {
          throw new Error(retryMessage);
        }

        lastError = new Error(retryMessage);
        continue;
      }

      throw new Error(rpcMessage);
    }

    lastError = new Error(rpcMessage);
  }

  //  Fallback to Edge Function by the same name when RPC is not exposed directly.
  const invokePayload = payloads[0] || {};
  const accessToken = await ensureAccessToken();
  const invoke = await supabase.functions.invoke(functionName, {
    body: invokePayload,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (!invoke.error) {
    if (invoke.data?.error) {
      throw new Error(`${functionName}: ${String(invoke.data.error)}`);
    }
    return normalizeRpcResult(invoke.data);
  }

  const firstInvokeMessage = await extractInvokeErrorMessage(functionName, invoke.error);
  if (!isAuthError(firstInvokeMessage)) {
    throw new Error(firstInvokeMessage);
  }

  const refreshedToken = await refreshAccessTokenOnce();
  if (!refreshedToken) {
    throw new Error("Authentication session expired. Please sign in again.");
  }

  const retry = await supabase.functions.invoke(functionName, {
    body: invokePayload,
    headers: { Authorization: `Bearer ${refreshedToken}` },
  });

  if (retry.error) {
    const retryMessage = await extractInvokeErrorMessage(functionName, retry.error);
    if (isAuthError(retryMessage)) {
      throw new Error("Authentication session expired. Please sign in again.");
    }
    throw new Error(retryMessage);
  }

  if (retry.data?.error) {
    throw new Error(`${functionName}: ${String(retry.data.error)}`);
  }

  return normalizeRpcResult(retry.data);
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
