import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  dbErrorStatus,
  getAuthenticatedUserId,
  getBearerToken,
  getRoleFromToken,
  parseRequestBody,
  parseUserId,
  respond,
  userIsAdmin,
} from "../_shared/progression.ts";

function isCooldownError(message: string): boolean {
  return message.toLowerCase().includes("daily reward already claimed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Missing Supabase environment configuration" }, 500);
    }

    const token = getBearerToken(req);
    if (!token) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const body = parseRequestBody(await req.text());
    const admin = createClient(supabaseUrl, serviceKey);
    const tokenRole = getRoleFromToken(token);
    let targetUserId = parseUserId(body.user_id);

    if (tokenRole === "service_role") {
      if (!targetUserId) {
        return respond({ error: "user_id is required for service role calls" }, 400);
      }
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      const callerId = await getAuthenticatedUserId(supabaseUrl, authHeader);
      if (!callerId) {
        return respond({ error: "Unauthorized" }, 401);
      }

      if (!targetUserId) {
        targetUserId = callerId;
      } else if (targetUserId !== callerId) {
        const isAdmin = await userIsAdmin(admin, callerId);
        if (!isAdmin) {
          return respond({ error: "Forbidden" }, 403);
        }
      }
    }

    const { data, error } = await admin.rpc("claim_daily_reward", {
      p_user_id: targetUserId,
    });

    if (error) {
      if (isCooldownError(error.message)) {
        return respond(
          {
            error: error.message,
            next_claim_at: typeof error.details === "string" ? error.details : null,
          },
          409,
        );
      }

      return respond({ error: error.message }, dbErrorStatus(error));
    }

    if (typeof data === "object" && data !== null) {
      return respond(data, 200);
    }

    return respond({ success: true, value: data }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isSafe = message.toLowerCase().includes("already claimed") || message.toLowerCase().includes("unauthorized");
    if (!isSafe) console.error("Unexpected claim_daily_reward error:", message);
    return respond({ error: isSafe ? message : "An error occurred processing your request" }, 500);
  }
});
