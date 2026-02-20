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
    return respond({ error: (err as Error).message }, 500);
  }
});

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  if (!plan_id || !amount || amount <= 0) {
    return respond({ error: "plan_id and positive amount required" }, 400);
  }

  // Get plan
  const { data: plan } = await admin
    .from("staking_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) return respond({ error: "Staking plan not found" }, 404);

  if (amount < Number(plan.min_amount)) {
    return respond({ error: `Minimum stake is ${plan.min_amount} BIX` }, 400);
  }
  if (plan.max_amount && amount > Number(plan.max_amount)) {
    return respond({ error: `Maximum stake is ${plan.max_amount} BIX` }, 400);
  }

  // Check wallet balance
  const { data: wallet } = await admin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", userId)
    .eq("wallet_type", "bix")
    .eq("is_primary", true)
    .maybeSingle();

  if (!wallet || Number(wallet.balance) < amount) {
    return respond({ error: "Insufficient BIX balance" }, 400);
  }

  // Deduct from wallet
  await admin
    .from("wallets")
    .update({ balance: Number(wallet.balance) - amount, updated_at: new Date().toISOString() })
    .eq("id", wallet.id);

  // Calculate maturity date
  const maturesAt = new Date();
  maturesAt.setDate(maturesAt.getDate() + plan.duration_days);

  // Create stake
  const { data: stake, error } = await admin
    .from("stakes")
    .insert({
      user_id: userId,
      plan_id,
      amount,
      matures_at: maturesAt.toISOString(),
      status: "active",
    })
    .select()
    .single();

  if (error) return respond({ error: error.message }, 500);

  // Log activity
  await admin.from("activities").insert({
    user_id: userId,
    activity_type: "staking",
    points_earned: 0,
    description: `Staked ${amount} BIX in ${plan.name} plan`,
    metadata: { stake_id: stake.id, plan_name: plan.name },
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
  const penaltyAmount = Math.floor(Number(stake.amount) * penalty);
  const returnAmount = Number(stake.amount) - penaltyAmount + Number(stake.accrued_reward);

  // Update stake status
  await admin
    .from("stakes")
    .update({
      status: isEarly ? "unstaked" : "completed",
      completed_at: now.toISOString(),
    })
    .eq("id", stake_id);

  // Credit wallet: principal (minus penalty) + accrued rewards
  const { data: wallet } = await admin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", userId)
    .eq("wallet_type", "bix")
    .eq("is_primary", true)
    .maybeSingle();

  if (wallet) {
    await admin
      .from("wallets")
      .update({ balance: Number(wallet.balance) + returnAmount, updated_at: now.toISOString() })
      .eq("id", wallet.id);
  }

  // Log activity for staking rewards earned (if any)
  if (Number(stake.accrued_reward) > 0) {
    await admin.from("activities").insert({
      user_id: userId,
      activity_type: "staking",
      points_earned: Number(stake.accrued_reward),
      description: `Staking reward: ${Number(stake.accrued_reward).toFixed(2)} BIX from ${stake.staking_plans.name}`,
    });
  }

  return respond({
    success: true,
    returned: returnAmount,
    penalty: penaltyAmount,
    reward: Number(stake.accrued_reward),
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
  if (reward <= 0) return respond({ error: "No rewards to claim" }, 400);

  // Reset accrued reward
  await admin
    .from("stakes")
    .update({ accrued_reward: 0 })
    .eq("id", stake_id);

  // Credit wallet
  const { data: wallet } = await admin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", userId)
    .eq("wallet_type", "bix")
    .eq("is_primary", true)
    .maybeSingle();

  if (wallet) {
    await admin
      .from("wallets")
      .update({ balance: Number(wallet.balance) + reward, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);
  }

  // Log activity
  await admin.from("activities").insert({
    user_id: userId,
    activity_type: "staking",
    points_earned: reward,
    description: `Claimed ${reward.toFixed(2)} BIX staking reward`,
  });

  return respond({ success: true, claimed: reward });
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

      await admin
        .from("stakes")
        .update({
          status: "completed",
          completed_at: now.toISOString(),
          accrued_reward: totalReward,
          last_accrual_at: now.toISOString(),
        })
        .eq("id", stake.id);

      // Credit wallet
      const returnAmount = Number(stake.amount) + totalReward;
      const { data: wallet } = await admin
        .from("wallets")
        .select("id, balance")
        .eq("user_id", stake.user_id)
        .eq("wallet_type", "bix")
        .eq("is_primary", true)
        .maybeSingle();

      if (wallet) {
        await admin
          .from("wallets")
          .update({ balance: Number(wallet.balance) + returnAmount, updated_at: now.toISOString() })
          .eq("id", wallet.id);
      }

      if (totalReward > 0) {
        await admin.from("activities").insert({
          user_id: stake.user_id,
          activity_type: "staking",
          points_earned: totalReward,
          description: `Staking completed: earned ${totalReward.toFixed(2)} BIX from ${stake.staking_plans.name}`,
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
