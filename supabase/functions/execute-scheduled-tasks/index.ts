import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin: any = createClient(supabaseUrl, serviceKey);

    // Fetch pending tasks that are due
    const { data: pendingTasks, error: fetchErr } = await admin
      .from("scheduled_admin_tasks")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr.message);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending tasks", executed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let executed = 0;
    let failed = 0;

    for (const task of pendingTasks) {
      try {
        // Mark as executing
        await admin
          .from("scheduled_admin_tasks")
          .update({ status: "executing", updated_at: new Date().toISOString() })
          .eq("id", task.id);

        const result = await executeOperation(
          admin,
          task.created_by,
          task.operation_type,
          task.operation_payload,
        );

        await admin
          .from("scheduled_admin_tasks")
          .update({
            status: "completed",
            executed_at: new Date().toISOString(),
            result,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        // Audit log
        await admin.from("admin_audit_log").insert({
          admin_user_id: task.created_by,
          action: `scheduled_${task.operation_type}`,
          target_table: "scheduled_admin_tasks",
          target_id: task.id,
          new_data: { result, prompt: task.prompt_text },
        });

        executed++;
      } catch (err: any) {
        await admin
          .from("scheduled_admin_tasks")
          .update({
            status: "failed",
            error_message: err.message || "Unknown error",
            executed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        failed++;
        console.error(`Task ${task.id} failed:`, err.message);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${pendingTasks.length} tasks`,
        executed,
        failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Scheduler error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Scheduler error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

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
        action: "scheduled_create_task",
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
        p_reason: payload.reason || "Scheduled admin grant",
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
        reason: payload.reason || "Scheduled admin reward",
        description: payload.description || payload.reason || "Scheduled reward",
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
          description: payload.description || "Scheduled admin activity",
          metadata: { source: "scheduled_task" },
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
