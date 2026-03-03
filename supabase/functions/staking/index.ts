import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    const authHeader = req.headers.get("Authorization");
    let user: any = null;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: tokenUser } } = await supabaseUser.auth.getUser();
      if (tokenUser) user = tokenUser;
    }

    if (!user) return respond({ error: "Unauthorized" }, 401);

    const accountGuard = await ensureActiveAccount(admin, user.id);
    if (accountGuard) return accountGuard;

    switch (action) {
      case "get_plans":
        return await getPlans(admin);
      case "get_my_stakes":
        return await getMyStakes(admin, user.id);
      case "create_stake":
        return await createStake(admin, user.id, body);
      case "unstake":
        return await unstake(admin, user.id, body);
      case "claim_rewards":
        return await claimRewards(admin, user.id, body);
      case "process_accruals":
        return await processAccruals(admin, body);
      default:
        return respond({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Only expose known safe messages
    const safePatterns = ["Insufficient", "Unauthorized", "not found", "not active", "Minimum", "Maximum", "whole-number", "plan_id", "No claimable", "Unknown action", "balance"];
    const isSafe = safePatterns.some(p => message.toLowerCase().includes(p.toLowerCase()));
    if (!isSafe) console.error("Unexpected staking error:", message);
    return respond({ error: isSafe ? message : "An error occurred processing your request" }, 500);
  }
});

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureActiveAccount(admin: any, userId: string): Promise<Response | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("is_active, is_frozen")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return respond({ error: error.message }, 500);
  if (data?.is_active === false) return respond({ error: "Account not active" }, 403);
  if (data?.is_frozen === true) return respond({ error: "Account flagged" }, 403);

  return null;
}

async function readUserBix(admin: any, userId: string) {
  const { data, error } = await admin
    .from("users")
    .select("id, bix_balance, total_bix")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) {
    return {
      balance: Number(data.bix_balance || 0),
      totalBix: Number(data.total_bix || 0),
    };
  }

  const { error: insertError } = await admin.from("users").insert({ id: userId });
  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }

  return { balance: 0, totalBix: 0 };
}

async function applyUserBixDelta(
  admin: any,
  userId: string,
  balanceDelta: number,
  totalBixDelta = 0,
) {
  const snapshot = await readUserBix(admin, userId);
  const nextBalance = snapshot.balance + balanceDelta;
  const nextTotalBix = snapshot.totalBix + totalBixDelta;

  if (nextBalance < 0) {
    throw new Error("Insufficient BIX balance");
  }

  const { error } = await admin
    .from("users")
    .update({
      bix_balance: nextBalance,
      total_bix: nextTotalBix,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  return {
    balance: nextBalance,
    totalBix: nextTotalBix,
  };
}

// ============ Get staking plans ============
async function getPlans(admin: any) {
  const { data, error } = await admin
    .from("staking_plans")
    .select("*")
    .eq("is_active", true)
    .order("duration_days", { ascending: true });

  if (error) return respond({ error: error.message }, 500);
  return respond({ plans: data });
}

// ============ Get user's stakes ============ 
async function getMyStakes(admin: any, userId: string) {
  const { data, error } = await admin
    .from("stakes")
    .select("*, staking_plans(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return respond({ error: error.message }, 500);
  return respond({ stakes: data });
}

// ============ Create a new stake ============
async function createStake(
  admin: any,
  userId: string,
  body: { plan_id: string; amount: number }
) {
  const { plan_id, amount } = body;
  const normalizedAmount = Number(amount);
  if (!plan_id || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return respond({ error: "plan_id and positive amount required" }, 400);
  }

  if (!Number.isInteger(normalizedAmount)) {
    return respond({ error: "Stake amount must be a whole-number BIX value" }, 400);
  }

  // Get plan
  const { data: plan } = await admin
    .from("staking_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) return respond({ error: "Staking plan not found" }, 404);

  if (normalizedAmount < Number(plan.min_amount)) {
    return respond({ error: `Minimum stake is ${plan.min_amount} BIX` }, 400);
  }
  if (plan.max_amount && normalizedAmount > Number(plan.max_amount)) {
    return respond({ error: `Maximum stake is ${plan.max_amount} BIX` }, 400);
  }

  const userSnapshot = await readUserBix(admin, userId);
  if (userSnapshot.balance < normalizedAmount) {
    return respond({ error: "Insufficient BIX balance" }, 400);
  }

  // Lock the stake amount from spendable balance.
  await applyUserBixDelta(admin, userId, -normalizedAmount, 0);

  // Calculate maturity date
  const maturesAt = new Date();
  maturesAt.setDate(maturesAt.getDate() + plan.duration_days);

  // Create stake
  const { data: stake, error } = await admin
    .from("stakes")
    .insert({
      user_id: userId,
      plan_id,
      amount: normalizedAmount,
      matures_at: maturesAt.toISOString(),
      status: "active",
    })
    .select()
    .single();

  if (error) {
    // Best-effort rollback so the user does not lose balance on stake insert failure.
    try {
      await applyUserBixDelta(admin, userId, normalizedAmount, 0);
    } catch {
      // Ignore rollback failure; original error is still surfaced.
    }
    return respond({ error: error.message }, 500);
  }

  // Log activity
  await admin.from("activities").insert({
    user_id: userId,
    activity_type: "staking",
    points_earned: 0,
    description: `Staked ${normalizedAmount} BIX in ${plan.name} plan`,
    metadata: {
      unit: "bix",
      source: "staking",
      action: "stake_created",
      stake_id: stake.id,
      plan_name: plan.name,
    },
  });

  return respond({ success: true, stake });
}

// ============ Unstake (early or after maturity) ============
async function unstake(
  admin: any,
  userId: string,
  body: { stake_id: string }
) {
  const { stake_id } = body;

  const { data: stake } = await admin
    .from("stakes")
    .select("*, staking_plans(*)")
    .eq("id", stake_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!stake) return respond({ error: "Active stake not found" }, 404);

  const now = new Date();
  const maturesAt = new Date(stake.matures_at);
  const isEarly = now < maturesAt;
  const penalty = isEarly ? Number(stake.staking_plans.early_unstake_penalty) : 0;
  const stakedAmount = Number(stake.amount);
  const accruedReward = Number(stake.accrued_reward);
  const payableReward = Math.floor(Math.max(0, accruedReward));
  const penaltyAmount = Math.floor(stakedAmount * penalty);
  const returnAmount = stakedAmount - penaltyAmount + payableReward;

  // Update stake status
  const { error: updateStakeError } = await admin
    .from("stakes")
    .update({
      status: isEarly ? "unstaked" : "completed",
      completed_at: now.toISOString(),
      accrued_reward: payableReward,
    })
    .eq("id", stake_id);

  if (updateStakeError) {
    return respond({ error: updateStakeError.message }, 500);
  }

  // Return principal (minus penalty) + whole-number rewards to spendable balance.
  await applyUserBixDelta(admin, userId, returnAmount, payableReward);

  // Log activity for staking rewards earned (if any)
  if (payableReward > 0) {
    await admin.from("activities").insert({
      user_id: userId,
      activity_type: "staking",
      points_earned: payableReward,
      description: `Staking reward: ${payableReward.toFixed(2)} BIX from ${stake.staking_plans.name}`,
      metadata: {
        unit: "bix",
        source: "staking",
        action: "unstake_reward",
        stake_id,
        plan_name: stake.staking_plans.name,
        early_unstake: isEarly,
      },
    });
  }

  return respond({
    success: true,
    returned: returnAmount,
    penalty: penaltyAmount,
    reward: payableReward,
    early: isEarly,
  });
}

// ============ Claim accrued rewards without unstaking ============
async function claimRewards(
  admin: any,
  userId: string,
  body: { stake_id: string }
) {
  const { stake_id } = body;

  const { data: stake } = await admin
    .from("stakes")
    .select("*, staking_plans(*)")
    .eq("id", stake_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!stake) return respond({ error: "Active stake not found" }, 404);

  const reward = Number(stake.accrued_reward);
  const claimableReward = Math.floor(Math.max(0, reward));
  if (claimableReward <= 0) return respond({ error: "No claimable whole-number rewards yet" }, 400);

  // Keep fractional remainder (if any) for the next claim.
  const remainingReward = reward - claimableReward;
  const { error: resetError } = await admin
    .from("stakes")
    .update({ accrued_reward: remainingReward })
    .eq("id", stake_id);

  if (resetError) {
    return respond({ error: resetError.message }, 500);
  }

  // Rewards are newly minted BIX.
  await applyUserBixDelta(admin, userId, claimableReward, claimableReward);

  // Log activity
  await admin.from("activities").insert({
    user_id: userId,
    activity_type: "staking",
    points_earned: claimableReward,
    description: `Claimed ${claimableReward.toFixed(2)} BIX staking reward`,
    metadata: {
      unit: "bix",
      source: "staking",
      action: "claim_rewards",
      stake_id,
    },
  });

  return respond({ success: true, claimed: claimableReward, remaining_reward: remainingReward });
}

// ============ Process daily accruals (called by cron) ============
async function processAccruals(admin: any, body: any) {
  // Fetch all active stakes
  const { data: activeStakes, error } = await admin
    .from("stakes")
    .select("*, staking_plans(*)")
    .eq("status", "active");

  if (error) return respond({ error: error.message }, 500);
  if (!activeStakes || activeStakes.length === 0) {
    return respond({ processed: 0 });
  }

  let processed = 0;
  let autoCompleted = 0;
  const now = new Date();

  for (const stake of activeStakes) {
    const lastAccrual = new Date(stake.last_accrual_at);
    const hoursSince = (now.getTime() - lastAccrual.getTime()) / (1000 * 60 * 60);
    
    // Only accrue if at least 23 hours since last accrual (daily)
    if (hoursSince < 23) continue;

    const apyRate = Number(stake.staking_plans.apy_rate) / 100;
    const dailyRate = apyRate / 365;
    const dailyReward = Number(stake.amount) * dailyRate;

    // Check if stake has matured
    const maturesAt = new Date(stake.matures_at);
    if (now >= maturesAt) {
      // Auto-complete matured stakes: credit principal + all rewards
      const totalReward = Number(stake.accrued_reward) + dailyReward;
      const payableReward = Math.floor(Math.max(0, totalReward));

      const { error: completeError } = await admin
        .from("stakes")
        .update({
          status: "completed",
          completed_at: now.toISOString(),
          accrued_reward: payableReward,
          last_accrual_at: now.toISOString(),
        })
        .eq("id", stake.id);

      if (completeError) {
        return respond({ error: completeError.message }, 500);
      }

      const returnAmount = Number(stake.amount) + payableReward;
      await applyUserBixDelta(admin, stake.user_id, returnAmount, payableReward);

      if (payableReward > 0) {
        await admin.from("activities").insert({
          user_id: stake.user_id,
          activity_type: "staking",
          points_earned: payableReward,
          description: `Staking completed: earned ${payableReward.toFixed(2)} BIX from ${stake.staking_plans.name}`,
          metadata: {
            unit: "bix",
            source: "staking",
            action: "auto_complete",
            stake_id: stake.id,
            plan_name: stake.staking_plans.name,
          },
        });
      }

      autoCompleted++;
    } else {
      // Accrue daily reward
      await admin
        .from("stakes")
        .update({
          accrued_reward: Number(stake.accrued_reward) + dailyReward,
          last_accrual_at: now.toISOString(),
        })
        .eq("id", stake.id);
    }

    processed++;
  }

  return respond({ processed, autoCompleted });
}
