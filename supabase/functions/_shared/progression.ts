import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("VITE_PUBLIC_URL") || Deno.env.get("PUBLIC_URL") || "";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Credentials": "true",
};

export function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function parseRequestBody(bodyText: string): Record<string, unknown> {
  if (!bodyText) return {};
  try {
    const parsed = JSON.parse(bodyText);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") || "";
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

  try {
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  return typeof role === "string" ? role : null;
}

export function parsePositiveInteger(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isInteger(input) || input <= 0) {
    return null;
  }
  return input;
}

export function parseUserId(input: unknown): string | null {
  if (typeof input !== "string" || input.trim().length === 0) {
    return null;
  }
  return input;
}

export async function getAuthenticatedUserId(supabaseUrl: string, authHeader: string): Promise<string | null> {
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!anonKey) return null;

  const supabaseUser: any = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await supabaseUser.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

export async function userIsAdmin(adminClient: any, userId: string): Promise<boolean> {
  const { data, error } = await adminClient.rpc("is_admin", { _user_id: userId });
  if (error) return false;
  return !!data;
}

export function dbErrorStatus(error: any): number {
  const code = String(error?.code || "");

  if (code === "P0001" || code.startsWith("22") || code === "23514") {
    return 400;
  }

  if (code === "23505") {
    return 409;
  }

  return 500;
}

/** Known safe error substrings that can be shown to the user. */
const SAFE_ERROR_PATTERNS = [
  "Insufficient",
  "Unauthorized",
  "Forbidden",
  "Not authenticated",
  "Invalid amount",
  "Invalid wallet",
  "Account flagged",
  "already claimed",
  "already linked",
  "not found",
  "not active",
  "Minimum stake",
  "Maximum stake",
  "plan_id and positive",
  "whole-number BIX",
  "No claimable",
  "Unknown action",
  "action is required",
  "user_id is required",
  "required",
  "must be",
  "too short",
  "too long",
  "not allowed",
  "already taken",
  "cannot be empty",
  "No changes",
  "Maximum attempts",
  "Referral",
  "Cannot use your own",
  "limit exceeded",
  "blocked",
  "Staking",
  "balance",
];

/**
 * Sanitize an error for client response.
 * Returns the original message only if it matches a known safe pattern;
 * otherwise returns a generic message and logs the real error server-side.
 */
export function safeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  for (const pattern of SAFE_ERROR_PATTERNS) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return message;
    }
  }

  // Log the real error server-side only
  console.error("Unexpected error:", message);
  return "An error occurred processing your request";
}