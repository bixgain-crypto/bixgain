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
    const userId = parseUserId(body.user_id);
    const xpAmount = parsePositiveInteger(body.xp_amount);

    if (!userId) {
      return respond({ error: "user_id is required" }, 400);
    }

    if (xpAmount === null) {
      return respond({ error: "xp_amount must be a positive integer" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const tokenRole = getRoleFromToken(token);

    if (tokenRole !== "service_role") {
      const authHeader = req.headers.get("Authorization") || "";
      const callerId = await getAuthenticatedUserId(supabaseUrl, authHeader);
      if (!callerId) {
        return respond({ error: "Unauthorized" }, 401);
      }

      const isAdmin = await userIsAdmin(admin, callerId);
      if (!isAdmin) {
        return respond({ error: "Forbidden" }, 403);
      }
    }

    const { data, error } = await admin.rpc("progression_award_xp", {
      p_user_id: userId,
      p_xp_amount: xpAmount,
    });

    if (error) {
      return respond({ error: error.message }, dbErrorStatus(error));
    }

    return respond({ success: true, user: data });
  } catch (err) {
    console.error("Unexpected award_xp error:", (err as Error).message);
    return respond({ error: "An error occurred processing your request" }, 500);
  }
});