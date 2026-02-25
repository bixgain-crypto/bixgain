import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  dbErrorStatus,
  getAuthenticatedUserId,
  getBearerToken,
  getRoleFromToken,
  parsePositiveInteger,
  parseRequestBody,
  parseUserId,
  respond,
  userIsAdmin,
} from "../_shared/progression.ts";

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
    const amount = parsePositiveInteger(body.amount);

    if (amount === null) {
      return respond({ error: "amount must be a positive integer" }, 400);
    }

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

    const { data, error } = await admin.rpc("progression_spend_bix", {
      p_user_id: targetUserId,
      p_amount: amount,
    });

    if (error) {
      return respond({ error: error.message }, dbErrorStatus(error));
    }

    return respond({ success: true, user: data });
  } catch (err) {
    return respond({ error: (err as Error).message }, 500);
  }
});