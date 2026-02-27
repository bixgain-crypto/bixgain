import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("VITE_PUBLIC_URL") || Deno.env.get("PUBLIC_URL") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Credentials": "true",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin: any = createClient(supabaseUrl, serviceKey);

    // Get user from auth header
    // Read request body early so we can support unauthenticated referral linking
    const body = await req.json();
    const { action } = body;

    const authHeader = req.headers.get("Authorization");

    // Resolve acting user from auth token when present. For the signup
    // referral flow we may not have a session yet, so allow an
    // unauthenticated call that passes `new_user_id` for `link_referral`.
    let user: any = null;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
      const supabaseUser: any = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user: tokenUser },
        error: authError,
      } = await supabaseUser.auth.getUser();
      if (!authError && tokenUser) {
        user = tokenUser;
      }
    }

    // Support unauthenticated linking immediately after signup when the
    // client provides the newly created user's id.
    if (!user && action === "link_referral" && body.new_user_id) {
      user = { id: body.new_user_id };
    }

    if (!user) {
      return respond({ error: "Unauthorized" }, 401);
    }

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
      case "link_referral":
        return await linkReferral(supabaseAdmin, user.id, body, ip);
      default:
        return respond({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return respond({ error: (err as Error).message }, 500);
  }
});

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============ Link referral (called after signup) ============
async function linkReferral(
  admin: any,
  userId: string,
  body: { referral_code: string; device_id?: string },
  ip: string
) {
  const { referral_code, device_id } = body;
  const normalizedCode = String(referral_code || "").trim().toUpperCase();
  if (!normalizedCode) return respond({ error: "referral_code required" }, 400);

  // Look up referrer by referral_code
  const { data: referrer } = await admin
    .from("profiles")
    .select("id, user_id")
    .ilike("referral_code", normalizedCode)
    .maybeSingle();

  if (!referrer) return respond({ error: "Invalid referral code" }, 404);

  // Block self-referrals
  if (referrer.user_id === userId) {
    return respond({ error: "Cannot use your own referral code" }, 400);
  }

  // Check if referral already exists
  const { data: existingRef } = await admin
    .from("referrals")
    .select("id")
    .eq("referrer_id", referrer.user_id)
    .eq("referred_id", userId)
    .maybeSingle();

  if (existingRef) {
    return respond({ success: true, message: "Referral already linked" });
  }

  // Check daily referral limit
  const { data: limitSetting } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "referral_daily_limit")
    .maybeSingle();

  const dailyLimit = limitSetting ? parseInt(limitSetting.value, 10) : 10;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: todayCount } = await admin
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", referrer.user_id)
    .gte("created_at", oneDayAgo);

  if (todayCount !== null && todayCount >= dailyLimit) {
    await admin.from("fraud_flags").insert({
      user_id: referrer.user_id,
      flag_type: "referral_daily_limit",
      reason: `Referrer exceeded daily limit of ${dailyLimit} referrals`,
      severity: "medium",
      related_table: "referrals",
    });
    return respond({ error: "Referral limit exceeded" }, 429);
  }

  // Check same-IP fraud: get referrer's IP from their most recent referral
  const { data: recentRef } = await admin
    .from("referrals")
    .select("referred_ip")
    .eq("referrer_id", referrer.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Also get referrer's own IP from their profile creation (use their own referral record if they were referred)
  if (ip !== "unknown") {
    // Check if referred user's IP matches referrer's known IPs
    const { data: sameIpRefs } = await admin
      .from("referrals")
      .select("id")
      .eq("referrer_id", referrer.user_id)
      .eq("referred_ip", ip)
      .limit(1);

    if (sameIpRefs && sameIpRefs.length > 0) {
      await admin.from("fraud_flags").insert({
        user_id: referrer.user_id,
        flag_type: "referral_same_ip",
        reason: `Same IP ${ip} used for multiple referrals`,
        severity: "high",
        related_table: "referrals",
      });
      return respond({ error: "Referral blocked: suspicious activity" }, 403);
    }
  }

  // Check same device_id fraud
  if (device_id) {
    const { data: sameDeviceRefs } = await admin
      .from("referrals")
      .select("id")
      .eq("referrer_id", referrer.user_id)
      .eq("referred_device_id", device_id)
      .limit(1);

    if (sameDeviceRefs && sameDeviceRefs.length > 0) {
      await admin.from("fraud_flags").insert({
        user_id: referrer.user_id,
        flag_type: "referral_same_device",
        reason: `Same device_id ${device_id} used for multiple referrals`,
        severity: "high",
        related_table: "referrals",
      });
      return respond({ error: "Referral blocked: suspicious activity" }, 403);
    }
  }

  // Get referrer's IP from their own profile or most recent activity
  const referrerIp = recentRef?.referred_ip || null;

  // Create referral record -- no reward yet
  const { error: insertErr } = await admin.from("referrals").insert({
    referrer_id: referrer.user_id,
    referred_id: userId,
    qualified: false,
    reward_granted: false,
    referrer_ip: referrerIp,
    referred_ip: ip !== "unknown" ? ip : null,
    referred_device_id: device_id || null,
  });

  if (insertErr) {
    // Unique constraint violation means already linked
    if (insertErr.code === "23505") {
      return respond({ success: true, message: "Referral already linked" });
    }
    return respond({ error: insertErr.message }, 500);
  }

  // Update profile referred_by
  await admin
    .from("profiles")
    .update({ referred_by: referrer.id })
    .eq("user_id", userId);

  return respond({ success: true, message: "Referral linked successfully" });
}

// ============ Start a task attempt ============
async function startAttempt(
  admin: any,
  userId: string,
  body: { task_id: string; device_id?: string },
  ip: string
) {
  const { task_id, device_id } = body;

  const { data: task } = await admin
    .from("tasks")
    .select("*")
    .eq("id", task_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!task) return respond({ error: "Task not found or inactive" }, 404);

  // Check for existing "started" attempt FIRST so "Continue" always works
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

  // Only check max_attempts when creating a NEW attempt
  const { count } = await admin
    .from("task_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("task_id", task_id);

  if (count !== null && task.max_attempts && count >= task.max_attempts) {
    return respond({ error: "Maximum attempts reached" }, 429);
  }

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
  admin: any,
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
  admin: any,
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

  const requiredSeconds = attempt.tasks?.required_seconds || 10;

  if (elapsed_seconds < requiredSeconds) {
    return respond({
      error: `Must visit for at least ${requiredSeconds} seconds`,
      remaining: requiredSeconds - elapsed_seconds,
    }, 400);
  }

  const { error } = await admin
    .from("task_attempts")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", attempt_id);

  if (error) return respond({ error: error.message }, 500);

  const reward = attempt.tasks?.reward_points || 0;
  await awardReward(admin, userId, reward, "task_completion", attempt_id);

  // Check referral qualification after first approved task
  await checkReferralQualification(admin, userId);

  return respond({ success: true, status: "approved", reward });
}

// ============ Verify video watch ============
async function verifyVideoWatch(
  admin: any,
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

  await admin
    .from("task_attempts")
    .update({ watch_seconds })
    .eq("id", attempt_id);

  const requiredSeconds = attempt.tasks?.required_seconds || 30;

  if (watch_seconds < requiredSeconds) {
    return respond({
      success: false,
      remaining: requiredSeconds - watch_seconds,
    });
  }

  await admin
    .from("task_attempts")
    .update({ status: "approved", watch_seconds, reviewed_at: new Date().toISOString() })
    .eq("id", attempt_id);

  const reward = attempt.tasks?.reward_points || 0;
  await awardReward(admin, userId, reward, "task_completion", attempt_id);

  // Check referral qualification after first approved task
  await checkReferralQualification(admin, userId);

  return respond({ success: true, status: "approved", reward });
}

// ============ Admin: Approve attempt ============
async function approveAttempt(
  admin: any,
  adminUserId: string,
  body: { attempt_id: string; notes?: string }
) {
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

  const reward = attempt.tasks?.reward_points || 0;
  await awardReward(admin, attempt.user_id, reward, "task_completion", body.attempt_id);

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
  admin: any,
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

// ============ Admin: Qualify referral manually ============
async function qualifyReferral(
  admin: any,
  userId: string,
  body: { referral_id?: string }
) {
  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
  if (!isAdmin) return respond({ error: "Not authorized" }, 403);

  if (!body.referral_id) return respond({ error: "referral_id required" }, 400);

  const { data: ref } = await admin
    .from("referrals")
    .select("*")
    .eq("id", body.referral_id)
    .eq("qualified", false)
    .maybeSingle();

  if (!ref) return respond({ error: "Referral not found or already qualified" }, 404);

  if (ref.reward_granted) {
    return respond({ error: "Reward already granted" }, 400);
  }

  await admin
    .from("referrals")
    .update({ qualified: true, qualified_at: new Date().toISOString(), reward_granted: true })
    .eq("id", body.referral_id);

  await awardReward(admin, ref.referrer_id, 100, "referral", body.referral_id);

  return respond({ success: true });
}

// ============ Check referral qualification (auto) ============
async function checkReferralQualification(
  admin: any,
  userId: string
) {
  // Check if this user was referred and referral not yet qualified/rewarded
  const { data: referral } = await admin
    .from("referrals")
    .select("*")
    .eq("referred_id", userId)
    .eq("qualified", false)
    .eq("reward_granted", false)
    .maybeSingle();

  if (!referral) return;

  // Check if user has at least one approved attempt
  const { count } = await admin
    .from("task_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "approved");

  if (!count || count < 1) return;

  // IP fraud check
  if (referral.referrer_ip && referral.referred_ip && referral.referrer_ip === referral.referred_ip) {
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

  // Device fraud check
  if (referral.referred_device_id) {
    const { data: deviceMatch } = await admin
      .from("referrals")
      .select("id")
      .eq("referrer_id", referral.referrer_id)
      .eq("referred_device_id", referral.referred_device_id)
      .neq("id", referral.id)
      .limit(1);

    if (deviceMatch && deviceMatch.length > 0) {
      await admin.from("fraud_flags").insert({
        user_id: referral.referrer_id,
        flag_type: "referral_device_match",
        reason: `Same device used for multiple referrals: ${referral.referred_device_id}`,
        severity: "high",
        related_id: referral.id,
        related_table: "referrals",
      });
      return;
    }
  }

  // Check for open fraud flags on either user
  const { count: fraudCount } = await admin
    .from("fraud_flags")
    .select("*", { count: "exact", head: true })
    .eq("user_id", referral.referrer_id)
    .eq("status", "open");

  if (fraudCount && fraudCount > 0) return;

  // All checks passed - qualify and reward
  await admin
    .from("referrals")
    .update({
      qualified: true,
      qualified_at: new Date().toISOString(),
      reward_granted: true,
    })
    .eq("id", referral.id);

  await awardReward(admin, referral.referrer_id, 100, "referral", referral.id);
}

// ============ Credit BIX on users table (source of truth) ============
async function creditUserBix(
  admin: any,
  userId: string,
  amount: number,
) {
  if (amount <= 0) return;

  const { data: userRow, error: readError } = await admin
    .from("users")
    .select("id, bix_balance, total_bix")
    .eq("id", userId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  if (!userRow) {
    const { error: insertError } = await admin.from("users").insert({ id: userId });
    if (insertError && insertError.code !== "23505") {
      throw new Error(insertError.message);
    }
  }

  const nextBalance = Number(userRow?.bix_balance || 0) + amount;
  const nextTotalBix = Number(userRow?.total_bix || 0) + amount;

  const { error: updateError } = await admin
    .from("users")
    .update({
      bix_balance: nextBalance,
      total_bix: nextTotalBix,
    })
    .eq("id", userId);

  if (updateError) throw new Error(updateError.message);
}

// ============ Award reward into ledger + users ============
async function awardReward(
  admin: any,
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
    reference_type: reason === "referral" ? "referral" : "task_attempt",
  });

  // Canonical balance ledger is users.bix_balance. 
  await creditUserBix(admin, userId, amount);

  // Insert activity for history/reporting.
  await admin.from("activities").insert({
    user_id: userId,
    activity_type: reason === "referral" ? "referral" : "task_completion",
    points_earned: amount,
    description: `Earned ${amount} BIX from ${reason}`,
    metadata: {
      unit: "bix",
      source: "task-operations",
      reason,
      reference_id: referenceId,
    },
  });
}
