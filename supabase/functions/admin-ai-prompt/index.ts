import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAuthenticatedUserId,
  respond,
  safeErrorMessage,
  userIsAdmin,
} from "../_shared/progression.ts";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are an admin automation assistant for the BixGain platform.
You parse natural language admin commands into structured JSON operations.

Available operations:
1. "create_task" - Create a new task/mission for users
   Fields: name (string, required), description (string), reward_points (number, default 50), task_type (one of: task_completion, referral, staking, login, social, custom), required_seconds (number, default 30), target_url (string), video_url (string), is_active (boolean, default true), start_date (ISO string), end_date (ISO string)

2. "grant_rewards" - Grant XP/BIX to a specific user
   Fields: target_user_id (uuid, required), xp_amount (number), bix_amount (number), reason (string)

3. "create_claimable_reward_notifications" - Send claimable rewards to all or selected users
   Fields: all_users (boolean), user_ids (string[]), xp_amount (number), bix_amount (number), reason (string), expires_in_seconds (number)

4. "update_setting" - Update a platform setting
   Fields: key (string), value (string)

5. "create_activity" - Log an activity for a user
   Fields: target_user_id (uuid), activity_type (string), points_earned (number), description (string)

When the user mentions a specific date/time for scheduling, include "scheduled_at" (ISO 8601 string) in the response.
If no date/time is mentioned, omit "scheduled_at" (execute immediately).

IMPORTANT: Always respond with ONLY valid JSON. Use the tool calling format provided.
If the prompt is unclear, return an operation with type "clarification_needed" and a "message" field explaining what you need.
For multiple operations from one prompt, return them as an array.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Missing Supabase environment configuration" }, 500);
    }
    if (!lovableApiKey) {
      return respond({ error: "AI service not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const callerId = await getAuthenticatedUserId(supabaseUrl, authHeader);
    if (!callerId) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const admin: any = createClient(supabaseUrl, serviceKey);
    const callerIsAdmin = await userIsAdmin(admin, callerId);
    if (!callerIsAdmin) {
      return respond({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const { prompt, context } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return respond({ error: "prompt is required" }, 400);
    }

    if (prompt.length > 2000) {
      return respond({ error: "Prompt too long (max 2000 characters)" }, 400);
    }

    // Fetch user list for context (so AI can reference users)
    const { data: usersList } = await admin
      .from("users")
      .select("id, username, bix_balance, total_xp, current_level")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: existingTasks } = await admin
      .from("tasks")
      .select("id, name, task_type, is_active, reward_points")
      .order("created_at", { ascending: false })
      .limit(30);

    const contextMessage = `Current platform context:
- Users (top 50): ${JSON.stringify((usersList || []).map((u: any) => ({ id: u.id, username: u.username, bix: u.bix_balance, xp: u.total_xp, level: u.current_level })))}
- Existing tasks (recent 30): ${JSON.stringify((existingTasks || []).map((t: any) => ({ id: t.id, name: t.name, type: t.task_type, active: t.is_active, reward: t.reward_points })))}
- Current date/time: ${new Date().toISOString()}
${context ? `- Additional context: ${context}` : ""}

Admin prompt: "${prompt.trim()}"`;

    // Call AI gateway with tool calling for structured output
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "execute_admin_operations",
              description: "Execute one or more admin operations based on the parsed prompt",
              parameters: {
                type: "object",
                properties: {
                  operations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: [
                            "create_task",
                            "grant_rewards",
                            "create_claimable_reward_notifications",
                            "update_setting",
                            "create_activity",
                            "clarification_needed",
                          ],
                        },
                        payload: {
                          type: "object",
                          description: "Operation data. For create_task: {name, description, reward_points, task_type, required_seconds, target_url, video_url, is_active, start_date, end_date}. For grant_rewards: {target_user_id, xp_amount, bix_amount, reason}. For create_claimable_reward_notifications: {all_users, user_ids, xp_amount, bix_amount, reason, expires_in_seconds}. For update_setting: {key, value}. For create_activity: {target_user_id, activity_type, points_earned, description}. For clarification_needed: {message}.",
                          properties: {
                            name: { type: "string" },
                            description: { type: "string" },
                            reward_points: { type: "number" },
                            task_type: { type: "string" },
                            required_seconds: { type: "number" },
                            target_url: { type: "string" },
                            video_url: { type: "string" },
                            is_active: { type: "boolean" },
                            start_date: { type: "string" },
                            end_date: { type: "string" },
                            target_user_id: { type: "string" },
                            xp_amount: { type: "number" },
                            bix_amount: { type: "number" },
                            reason: { type: "string" },
                            all_users: { type: "boolean" },
                            user_ids: { type: "array", items: { type: "string" } },
                            expires_in_seconds: { type: "number" },
                            key: { type: "string" },
                            value: { type: "string" },
                            activity_type: { type: "string" },
                            points_earned: { type: "number" },
                            message: { type: "string" },
                          },
                        },
                        scheduled_at: {
                          type: "string",
                          description: "ISO 8601 datetime for FUTURE scheduled execution ONLY. Do NOT set this for immediate operations. Only include if the user explicitly mentions a future date/time.",
                        },
                        summary: {
                          type: "string",
                          description: "Human-readable summary of this operation",
                        },
                      },
                      required: ["type", "payload", "summary"],
                    },
                  },
                  overall_summary: {
                    type: "string",
                    description: "Brief overall summary of all operations",
                  },
                },
                required: ["operations", "overall_summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "execute_admin_operations" },
        },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return respond({ error: "AI rate limit exceeded, please try again later." }, 429);
      }
      if (aiResponse.status === 402) {
        return respond({ error: "AI credits exhausted. Please add funds." }, 402);
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return respond({ error: "AI service temporarily unavailable" }, 502);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return respond({ error: "AI could not parse the command. Please rephrase." }, 422);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return respond({ error: "AI returned invalid response. Please try again." }, 422);
    }

    console.log("AI parsed response:", JSON.stringify(parsed, null, 2));

    const operations = parsed.operations || [];
    const overallSummary = parsed.overall_summary || "Parsed admin operations";

    // Check for clarification needed
    const clarification = operations.find((op: any) => op.type === "clarification_needed");
    if (clarification) {
      return respond({
        status: "clarification_needed",
        message: clarification.payload?.message || clarification.summary,
        operations: [],
      });
    }

    // Process operations: immediate vs scheduled
    const results: any[] = [];
    const now = Date.now();

    for (const op of operations) {
      // Fallback: if payload is empty but fields exist at top level, extract them
      if (!op.payload || Object.keys(op.payload).length === 0) {
        const { type: _t, payload: _p, scheduled_at: _s, summary: _sum, ...rest } = op;
        if (Object.keys(rest).length > 0) {
          op.payload = rest;
          console.log("Extracted payload from flat operation:", JSON.stringify(op.payload));
        }
      }

      // Treat scheduled_at within 60s of now as immediate
      const isScheduled = op.scheduled_at && (new Date(op.scheduled_at).getTime() - now > 60_000);

      if (isScheduled) {
        // Schedule for later
        const { error: schedErr } = await admin
          .from("scheduled_admin_tasks")
          .insert({
            created_by: callerId,
            operation_type: op.type,
            operation_payload: op.payload,
            scheduled_at: op.scheduled_at,
            prompt_text: prompt.trim(),
            status: "pending",
          });

        if (schedErr) {
          results.push({
            type: op.type,
            summary: op.summary,
            status: "schedule_failed",
            error: schedErr.message,
          });
        } else {
          results.push({
            type: op.type,
            summary: op.summary,
            status: "scheduled",
            scheduled_at: op.scheduled_at,
          });
        }
      } else {
        // Execute immediately via admin-operations
        try {
          const execResult = await executeOperation(admin, callerId, op.type, op.payload);
          results.push({
            type: op.type,
            summary: op.summary,
            status: "executed",
            result: execResult,
          });
        } catch (err: any) {
          results.push({
            type: op.type,
            summary: op.summary,
            status: "failed",
            error: err.message || "Execution failed",
          });
        }
      }
    }

    // Audit log
    await admin.from("admin_audit_log").insert({
      admin_user_id: callerId,
      action: "ai_prompt_execution",
      target_table: "scheduled_admin_tasks",
      new_data: {
        prompt: prompt.trim(),
        operations_count: operations.length,
        results_summary: results.map((r: any) => ({
          type: r.type,
          status: r.status,
        })),
      },
    });

    return respond({
      status: "success",
      overall_summary: overallSummary,
      operations: results,
    });
  } catch (err) {
    return respond({ error: safeErrorMessage(err) }, 500);
  }
});

// Execute an operation directly using the admin Supabase client
async function executeOperation(
  admin: any,
  adminUserId: string,
  operationType: string,
  payload: any,
): Promise<any> {
  switch (operationType) {
    case "create_task": {
      const taskData: any = {
        name: payload.name,
        description: payload.description || null,
        reward_points: payload.reward_points ?? 50,
        task_type: payload.task_type || "custom",
        required_seconds: payload.required_seconds ?? 30,
        target_url: payload.target_url || null,
        video_url: payload.video_url || null,
        is_active: payload.is_active !== false,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      };

      const { data, error } = await admin
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await admin.from("admin_audit_log").insert({
        admin_user_id: adminUserId,
        action: "create_task",
        target_table: "tasks",
        target_id: data.id,
        new_data: taskData,
      });

      return { task_id: data.id, name: data.name };
    }

    case "grant_rewards": {
      const { data, error } = await admin.rpc("admin_grant_reward_single", {
        p_target_user_id: payload.target_user_id,
        p_xp: payload.xp_amount || 0,
        p_bix: payload.bix_amount || 0,
        p_reason: payload.reason || "AI admin grant",
      });

      if (error) throw new Error(error.message);
      return data;
    }

    case "create_claimable_reward_notifications": {
      let targetUserIds: string[] = [];

      if (payload.all_users) {
        const { data: allUsers } = await admin
          .from("users")
          .select("id")
          .eq("is_active", true);
        targetUserIds = (allUsers || []).map((u: any) => u.id);
      } else if (payload.user_ids?.length > 0) {
        targetUserIds = payload.user_ids;
      }

      if (targetUserIds.length === 0) {
        throw new Error("No target users specified");
      }

      const expiresAt = new Date(
        Date.now() + (payload.expires_in_seconds || 3600) * 1000,
      ).toISOString();

      const notifications = targetUserIds.map((uid: string) => ({
        user_id: uid,
        xp_amount: payload.xp_amount || 0,
        bix_amount: payload.bix_amount || 0,
        reason: payload.reason || "AI admin reward",
        description: payload.description || payload.reason || "AI admin reward",
        expires_at: expiresAt,
        created_by: adminUserId,
        status: "pending",
      }));

      const { error } = await admin
        .from("user_reward_notifications")
        .insert(notifications);

      if (error) throw new Error(error.message);
      return { created_count: notifications.length, expires_at: expiresAt };
    }

    case "update_setting": {
      const { data, error } = await admin
        .from("platform_settings")
        .upsert(
          {
            key: payload.key,
            value: String(payload.value),
            updated_by: adminUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { key: data.key, value: data.value };
    }

    case "create_activity": {
      const { data, error } = await admin
        .from("activities")
        .insert({
          user_id: payload.target_user_id,
          activity_type: payload.activity_type || "custom",
          points_earned: payload.points_earned || 0,
          description: payload.description || "AI admin activity",
          metadata: { source: "ai_admin_prompt" },
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { activity_id: data.id };
    }

    default:
      throw new Error(`Unknown operation type: ${operationType}`);
  }
}
