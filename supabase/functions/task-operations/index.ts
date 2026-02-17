import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    switch (action) {
      case "start_attempt":
        return await startAttempt(supabaseAdmin, user.id, body, ip);
      case "submit_proof":
        return await submitProof(supabaseAdmin, user.id, body);
      case "verify_link_visit":
        return await verifyLinkVisit(supabaseAdmin, user.id, body);
      case "verify_video_watch":
        return await verifyVideoWatch(supabaseAdmin, user.id, body);
      case "approve_attempt":
        return await approveAttempt(supabaseAdmin, user.id, body);
      case "reject_attempt":
        return await rejectAttempt(supabaseAdmin, user.id, body);
      case "qualify_referral":
        return await qualifyReferral(supabaseAdmin, user.id, body);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============ Start a task attempt ============
async function startAttempt(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: { task_id: string; device_id?: string },
  ip: string
) {
  const { task_id, device_id } = body;

  // Check task exists and is active
  const { data: task } = await admin
    .from("tasks")
    .select("*")
    .eq("id", task_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!task) return respond({ error: "Task not found or inactive" }, 404);

  // Check max attempts
  const { count } = await admin
    .from("task_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("task_id", task_id);

  if (count !== null && task.max_attempts && count >= task.max_attempts) {
    return respond({ error: "Maximum attempts reached" }, 429);
  }

  // Check for existing started attempt
  const { data: existing } = await admin
    .from("task_attempts")
    .select("id, visit_token")
    .eq("user_id", userId)
    .eq("task_id", task_id)
    .eq("status", "started")
    .maybeSingle();

  if (existing) {
    return respond({ attempt_id: existing.id, visit_token: existing.visit_token });
  }

  // Generate visit token for link tasks
  const visit_token = crypto.randomUUID();

  const { data: attempt, error } = await admin
    .from("task_attempts")
    .insert({
      user_id: userId,
      task_id,
      status: "started",
      visit_token,
      ip_address: ip,
      device_id: device_id || null,
    })
    .select()
    .single();

  if (error) return respond({ error: error.message }, 500);

  return respond({
    attempt_id: attempt.id,
    visit_token: attempt.visit_token,
    target_url: task.target_url,
    video_url: task.video_url,
    required_seconds: task.required_seconds,
    task_type: task.task_type,
    verification_rules: task.verification_rules,
  });
}

// ============ Submit proof (screenshot/text) ============
async function submitProof(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: { attempt_id: string; proof_url?: string; proof_text?: string }
) {
  const { attempt_id, proof_url, proof_text } = body;

  const { data: attempt } = await admin
    .from("task_attempts")
    .select("*")
    .eq("id", attempt_id)
    .eq("user_id", userId)
    .eq("status", "started")
    .maybeSingle();

  if (!attempt) return respond({ error: "Attempt not found or not in started state" }, 404);

  const { error } = await admin
    .from("task_attempts")
    .update({
      status: "pending",
      proof_url: proof_url || null,
      proof_text: proof_text || null,
    })
    .eq("id", attempt_id);

  if (error) return respond({ error: error.message }, 500);

  return respond({ success: true, status: "pending" });
}

// ============ Verify link visit ============
async function verifyLinkVisit(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: { attempt_id: string; visit_token: string; elapsed_seconds: number }
) {
  const { attempt_id, visit_token, elapsed_seconds } = body;

  const { data: attempt } = await admin
    .from("task_attempts")
    .select("*, tasks(*)")
    .eq("id", attempt_id)
    .eq("user_id", userId)
    .eq("visit_token", visit_token)
    .maybeSingle();

  if (!attempt) return respond({ error: "Invalid attempt or token" }, 404);

  const requiredSeconds = (attempt as any).tasks?.required_seconds || 10;

  if (elapsed_seconds < requiredSeconds) {
    return respond({
      error: `Must visit for at least ${requiredSeconds} seconds`,
      remaining: requiredSeconds - elapsed_seconds,
    }, 400);
  }

  // Auto-approve link visits that meet the time requirement
  const { error } = await admin
    .from("task_attempts")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", attempt_id);

  if (error) return respond({ error: error.message }, 500);

  // Award reward
  const reward = (attempt as any).tasks?.reward_points || 0;
  await awardReward(admin, userId, reward, "task_completion", attempt_id);

  return respond({ success: true, status: "approved", reward });
}

// ============ Verify video watch ============
async function verifyVideoWatch(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: { attempt_id: string; watch_seconds: number }
) {
  const { attempt_id, watch_seconds } = body;

  const { data: attempt } = await admin
    .from("task_attempts")
    .select("*, tasks(*)")
    .eq("id", attempt_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!attempt) return respond({ error: "Attempt not found" }, 404);

  // Update watch progress
  await admin
    .from("task_attempts")
    .update({ watch_seconds })
    .eq("id", attempt_id);

  const requiredSeconds = (attempt as any).tasks?.required_seconds || 30;

  if (watch_seconds < requiredSeconds) {
    return respond({
      success: false,
      remaining: requiredSeconds - watch_seconds,
    });
  }

  // Auto-approve
  await admin
    .from("task_attempts")
    .update({ status: "approved", watch_seconds, reviewed_at: new Date().toISOString() })
    .eq("id", attempt_id);

  const reward = (attempt as any).tasks?.reward_points || 0;
  await awardReward(admin, userId, reward, "task_completion", attempt_id);

  return respond({ success: true, status: "approved", reward });
}

// ============ Admin: Approve attempt ============
async function approveAttempt(
  admin: ReturnType<typeof createClient>,
  adminUserId: string,
  body: { attempt_id: string; notes?: string }
) {
  // Verify admin
  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: adminUserId });
  if (!isAdmin) return respond({ error: "Not authorized" }, 403);

  const { data: attempt } = await admin
    .from("task_attempts")
    .select("*, tasks(*)")
    .eq("id", body.attempt_id)
    .eq("status", "pending")
    .maybeSingle();

  if (!attempt) return respond({ error: "Attempt not found or not pending" }, 404);

  await admin
    .from("task_attempts")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq("id", body.attempt_id);

  const reward = (attempt as any).tasks?.reward_points || 0;
  await awardReward(admin, attempt.user_id, reward, "task_completion", body.attempt_id);

  // Log audit
  await admin.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action: "approve_attempt",
    target_table: "task_attempts",
    target_id: body.attempt_id,
    new_data: { notes: body.notes },
  });

  // Check if this qualifies any referral
  await checkReferralQualification(admin, attempt.user_id);

  return respond({ success: true, reward });
}

// ============ Admin: Reject attempt ============
async function rejectAttempt(
  admin: ReturnType<typeof createClient>,
  adminUserId: string,
  body: { attempt_id: string; reason?: string }
) {
  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: adminUserId });
  if (!isAdmin) return respond({ error: "Not authorized" }, 403);

  const { error } = await admin
    .from("task_attempts")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq("id", body.attempt_id)
    .eq("status", "pending");

  if (error) return respond({ error: error.message }, 500);

  await admin.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action: "reject_attempt",
    target_table: "task_attempts",
    target_id: body.attempt_id,
    new_data: { reason: body.reason },
  });

  return respond({ success: true });
}

// ============ Qualify referral ============
async function qualifyReferral(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: { referral_id?: string }
) {
  // This is called internally or by admin
  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
  if (!isAdmin) return respond({ error: "Not authorized" }, 403);

  if (body.referral_id) {
    const { data: ref } = await admin
      .from("referrals")
      .select("*")
      .eq("id", body.referral_id)
      .eq("qualified", false)
      .maybeSingle();

    if (!ref) return respond({ error: "Referral not found or already qualified" }, 404);

    await admin
      .from("referrals")
      .update({ qualified: true, qualified_at: new Date().toISOString() })
      .eq("id", body.referral_id);

    await awardReward(admin, ref.referrer_id, 50, "referral", body.referral_id);

    return respond({ success: true });
  }

  return respond({ error: "referral_id required" }, 400);
}

// ============ Check referral qualification ============
async function checkReferralQualification(
  admin: ReturnType<typeof createClient>,
  userId: string
) {
  // Check if this user was referred and has completed their first task
  const { data: referral } = await admin
    .from("referrals")
    .select("*")
    .eq("referred_id", userId)
    .eq("qualified", false)
    .maybeSingle();

  if (!referral) return;

  // Check if user has at least one approved attempt
  const { count } = await admin
    .from("task_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "approved");

  if (count && count >= 1) {
    // Check IP fraud
    if (referral.referrer_ip && referral.referred_ip && referral.referrer_ip === referral.referred_ip) {
      // Flag as suspicious
      await admin.from("fraud_flags").insert({
        user_id: referral.referrer_id,
        flag_type: "referral_ip_match",
        reason: `Referrer and referred user share IP: ${referral.referrer_ip}`,
        severity: "high",
        related_id: referral.id,
        related_table: "referrals",
      });
      return;
    }

    await admin
      .from("referrals")
      .update({ qualified: true, qualified_at: new Date().toISOString() })
      .eq("id", referral.id);

    await awardReward(admin, referral.referrer_id, 50, "referral", referral.id);
  }
}

// ============ Award reward into ledger + wallet ============
async function awardReward(
  admin: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  reason: string,
  referenceId: string
) {
  if (amount <= 0) return;

  // Insert into reward_ledger
  await admin.from("reward_ledger").insert({
    user_id: userId,
    amount,
    reason,
    reference_id: referenceId,
    reference_type: "task_attempt",
  });

  // Also update wallet balance for quick reads
  await admin
    .from("wallets")
    .update({ balance: admin.rpc ? undefined : undefined })
    .eq("user_id", userId)
    .eq("wallet_type", "bix");

  // Direct SQL-like update via RPC isn't available, use raw increment
  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .eq("wallet_type", "bix")
    .eq("is_primary", true)
    .maybeSingle();

  if (wallet) {
    await admin
      .from("wallets")
      .update({ balance: Number(wallet.balance) + amount, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("wallet_type", "bix")
      .eq("is_primary", true);
  }

  // Also insert activity for dashboard tracking
  await admin.from("activities").insert({
    user_id: userId,
    activity_type: reason === "referral" ? "referral" : "task_completion",
    points_earned: amount,
    description: `Earned ${amount} BIX from ${reason}`,
  });
}
