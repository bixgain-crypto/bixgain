import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  dbErrorStatus,
  getAuthenticatedUserId,
  parseRequestBody,
  respond,
  safeErrorMessage,
  userIsAdmin,
} from "../_shared/progression.ts";

type JsonRecord = Record<string, unknown>;

const TASK_TYPES = new Set([
  "task_completion",
  "referral",
  "staking",
  "login",
  "social",
  "custom",
]);

const ACTIVITY_TYPES = TASK_TYPES;

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

    const body = parseRequestBody(await req.text());
    const action = asString(body.action);
    if (!action) {
      return respond({ error: "action is required" }, 400);
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

    switch (action) {
      case "get_dashboard":
        return await getDashboard(admin);
      case "list_users":
        return await listUsers(admin, body);
      case "update_user":
        return await updateUser(admin, callerId, body);
      case "list_tasks":
        return await listTasks(admin, body);
      case "create_task":
        return await createTask(admin, callerId, body);
      case "update_task":
        return await updateTask(admin, callerId, body);
      case "grant_rewards":
        return await grantRewards(admin, callerId, body);
      case "list_activities":
        return await listActivities(admin, body);
      case "create_activity":
        return await createActivity(admin, callerId, body);
      case "list_settings":
        return await listSettings(admin);
      case "update_setting":
        return await updateSetting(admin, callerId, body);
      case "list_audit_logs":
        return await listAuditLogs(admin, body);
      default:
        return respond({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return respond({ error: safeErrorMessage(err) }, 500);
  }
});

function hasOwn(body: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asNonNegativeInteger(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

async function sumNumericColumn(
  admin: any,
  table: string,
  column: string,
  applyFilters?: (query: any) => any,
): Promise<number> {
  const pageSize = 1000;
  let from = 0;
  let total = 0;

  while (true) {
    let query = admin.from(table).select(column).range(from, from + pageSize - 1);
    if (applyFilters) {
      query = applyFilters(query);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data || []) as Array<Record<string, unknown>>;
    for (const row of rows) {
      total += Number(row[column] || 0);
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return total;
}

async function insertAudit(
  admin: any,
  adminUserId: string,
  action: string,
  targetTable: string | null,
  targetId: string | null,
  oldData: unknown = null,
  newData: unknown = null,
) {
  await admin.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    target_table: targetTable,
    target_id: targetId,
    old_data: oldData,
    new_data: newData,
  });
}

async function getDashboard(admin: any) {
  const [
    statsResult,
    totalTasksResult,
    activeTasksResult,
    pendingAttemptsResult,
    openFraudResult,
    activeStakesResult,
    totalBixInCirculation,
    totalTvlLocked,
    totalRewardsDistributed,
  ] = await Promise.all([
    admin.from("v_platform_stats").select("*").maybeSingle(),
    admin.from("tasks").select("*", { count: "exact", head: true }),
    admin.from("tasks").select("*", { count: "exact", head: true }).eq("is_active", true),
    admin.from("task_attempts").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("fraud_flags").select("*", { count: "exact", head: true }).eq("status", "open"),
    admin.from("stakes").select("*", { count: "exact", head: true }).eq("status", "active"),
    sumNumericColumn(admin, "users", "bix_balance"),
    sumNumericColumn(admin, "stakes", "amount", (query: any) => query.eq("status", "active")),
    sumNumericColumn(admin, "activities", "points_earned", (query: any) =>
      query.contains("metadata", { unit: "bix" }).gt("points_earned", 0)
    ),
  ]);

  if (statsResult.error) return respond({ error: statsResult.error.message }, dbErrorStatus(statsResult.error));
  if (totalTasksResult.error) return respond({ error: totalTasksResult.error.message }, dbErrorStatus(totalTasksResult.error));
  if (activeTasksResult.error) return respond({ error: activeTasksResult.error.message }, dbErrorStatus(activeTasksResult.error));
  if (pendingAttemptsResult.error) return respond({ error: pendingAttemptsResult.error.message }, dbErrorStatus(pendingAttemptsResult.error));
  if (openFraudResult.error) return respond({ error: openFraudResult.error.message }, dbErrorStatus(openFraudResult.error));
  if (activeStakesResult.error) return respond({ error: activeStakesResult.error.message }, dbErrorStatus(activeStakesResult.error));

  const { data: recentAudit, error: recentAuditError } = await admin
    .from("admin_audit_log")
    .select("id, admin_user_id, action, target_table, target_id, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (recentAuditError) return respond({ error: recentAuditError.message }, dbErrorStatus(recentAuditError));

  return respond({
    stats: {
      ...(statsResult.data || {}),
      total_bix_in_circulation: totalBixInCirculation,
      total_tvl_locked: totalTvlLocked,
      total_rewards_distributed: totalRewardsDistributed,
      active_stakes: activeStakesResult.count || 0,
      total_tasks: totalTasksResult.count || 0,
      active_tasks: activeTasksResult.count || 0,
      pending_attempts: pendingAttemptsResult.count || 0,
      open_fraud_flags: openFraudResult.count || 0,
    },
    recent_audit: recentAudit || [],
  });
}

async function listUsers(admin: any, body: JsonRecord) {
  const search = asString(body.search);
  const limit = clamp(asNonNegativeInteger(body.limit) ?? 120, 1, 500);

  let query = admin
    .from("users")
    .select("id, username, created_at, bix_balance, total_bix, total_xp, current_level, level_name, is_admin, admin_role")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.ilike("username", `%${search}%`);
  }

  const { data: users, error } = await query;
  if (error) return respond({ error: error.message }, dbErrorStatus(error));

  const userIds = (users || []).map((row: any) => row.id);
  let profilesByUserId = new Map<string, JsonRecord>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("user_id, display_name, is_active, is_frozen, referral_code")
      .in("user_id", userIds);

    if (profilesError) return respond({ error: profilesError.message }, dbErrorStatus(profilesError));

    profilesByUserId = new Map((profiles || []).map((profile: any) => [profile.user_id, profile as JsonRecord]));
  }

  const rows = (users || []).map((user: any) => {
    const profile = profilesByUserId.get(user.id);
    return {
      ...user,
      display_name: (profile?.display_name as string | null) ?? null,
      is_active: (profile?.is_active as boolean | null) ?? true,
      is_frozen: (profile?.is_frozen as boolean | null) ?? false,
      referral_code: (profile?.referral_code as string | null) ?? null,
    };
  });

  return respond({ users: rows });
}

async function updateUser(admin: any, adminUserId: string, body: JsonRecord) {
  const targetUserId = asString(body.target_user_id);
  if (!targetUserId) return respond({ error: "target_user_id is required" }, 400);

  const userPatch: JsonRecord = {};
  const profilePatch: JsonRecord = {};

  if (hasOwn(body, "username")) {
    const username = asString(body.username);
    if (!username) return respond({ error: "username cannot be empty" }, 400);
    userPatch.username = username;
  }

  if (hasOwn(body, "is_admin")) {
    const isAdminValue = asBoolean(body.is_admin);
    if (isAdminValue === null) return respond({ error: "is_admin must be boolean" }, 400);
    if (targetUserId === adminUserId && !isAdminValue) {
      return respond({ error: "You cannot remove your own admin access" }, 400);
    }
    userPatch.is_admin = isAdminValue;
    if (!isAdminValue && !hasOwn(body, "admin_role")) {
      userPatch.admin_role = "user";
    }
  }

  if (hasOwn(body, "admin_role")) {
    const adminRole = asString(body.admin_role);
    if (!adminRole) return respond({ error: "admin_role cannot be empty" }, 400);
    userPatch.admin_role = adminRole;
    if (adminRole === "user") {
      if (!hasOwn(body, "is_admin")) {
        userPatch.is_admin = false;
      }
    } else {
      userPatch.is_admin = true;
    }
  }

  if (hasOwn(body, "display_name")) {
    const displayName = asNullableString(body.display_name);
    profilePatch.display_name = displayName;
  }

  if (hasOwn(body, "is_active")) {
    const isActive = asBoolean(body.is_active);
    if (isActive === null) return respond({ error: "is_active must be boolean" }, 400);
    profilePatch.is_active = isActive;
  }

  if (hasOwn(body, "is_frozen")) {
    const isFrozen = asBoolean(body.is_frozen);
    if (isFrozen === null) return respond({ error: "is_frozen must be boolean" }, 400);
    profilePatch.is_frozen = isFrozen;
  }

  if (Object.keys(userPatch).length === 0 && Object.keys(profilePatch).length === 0) {
    return respond({ error: "No changes provided" }, 400);
  }

  if (Object.keys(userPatch).length > 0) {
    const { error: userError } = await admin.from("users").update(userPatch).eq("id", targetUserId);
    if (userError) return respond({ error: userError.message }, dbErrorStatus(userError));
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ user_id: targetUserId, ...profilePatch }, { onConflict: "user_id" });
    if (profileError) return respond({ error: profileError.message }, dbErrorStatus(profileError));
  }

  const { data: user, error: userReadError } = await admin
    .from("users")
    .select("id, username, created_at, bix_balance, total_bix, total_xp, current_level, level_name, is_admin, admin_role")
    .eq("id", targetUserId)
    .maybeSingle();
  if (userReadError) return respond({ error: userReadError.message }, dbErrorStatus(userReadError));

  const { data: profile, error: profileReadError } = await admin
    .from("profiles")
    .select("user_id, display_name, is_active, is_frozen, referral_code")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (profileReadError) return respond({ error: profileReadError.message }, dbErrorStatus(profileReadError));

  await insertAudit(admin, adminUserId, "update_user", "users", targetUserId, null, {
    user_patch: userPatch,
    profile_patch: profilePatch,
  });

  return respond({
    user: {
      ...(user || {}),
      display_name: profile?.display_name || null,
      is_active: profile?.is_active ?? true,
      is_frozen: profile?.is_frozen ?? false,
      referral_code: profile?.referral_code || null,
    },
  });
}

function buildTaskPatch(body: JsonRecord, mode: "create" | "update"): { patch?: JsonRecord; error?: string } {
  const patch: JsonRecord = {};

  if (mode === "create" || hasOwn(body, "name")) {
    const name = asString(body.name);
    if (!name) return { error: "name is required" };
    patch.name = name;
  }

  if (hasOwn(body, "description")) {
    patch.description = asNullableString(body.description);
  }

  if (mode === "create" || hasOwn(body, "reward_points")) {
    const rewardPoints = asNumber(body.reward_points);
    if (rewardPoints === null || rewardPoints < 0) {
      return { error: "reward_points must be a non-negative number" };
    }
    patch.reward_points = rewardPoints;
  }

  if (mode === "create" || hasOwn(body, "task_type")) {
    const taskType = asString(body.task_type) || "custom";
    if (!TASK_TYPES.has(taskType)) {
      return { error: "Invalid task_type" };
    }
    patch.task_type = taskType;
  }

  if (hasOwn(body, "is_active")) {
    const isActive = asBoolean(body.is_active);
    if (isActive === null) return { error: "is_active must be boolean" };
    patch.is_active = isActive;
  } else if (mode === "create") {
    patch.is_active = true;
  }

  if (hasOwn(body, "required_seconds")) {
    const requiredSeconds = body.required_seconds === null ? null : asNonNegativeInteger(body.required_seconds);
    if (requiredSeconds === null && body.required_seconds !== null) {
      return { error: "required_seconds must be a non-negative integer or null" };
    }
    patch.required_seconds = requiredSeconds;
  }

  if (hasOwn(body, "max_attempts")) {
    const maxAttempts = body.max_attempts === null ? null : asNonNegativeInteger(body.max_attempts);
    if (maxAttempts === null && body.max_attempts !== null) {
      return { error: "max_attempts must be a non-negative integer or null" };
    }
    patch.max_attempts = maxAttempts;
  }

  if (hasOwn(body, "max_completions_per_user")) {
    const maxCompletions = body.max_completions_per_user === null ? null : asNonNegativeInteger(body.max_completions_per_user);
    if (maxCompletions === null && body.max_completions_per_user !== null) {
      return { error: "max_completions_per_user must be a non-negative integer or null" };
    }
    patch.max_completions_per_user = maxCompletions;
  }

  if (hasOwn(body, "total_budget")) {
    const totalBudget = body.total_budget === null ? null : asNumber(body.total_budget);
    if (totalBudget === null && body.total_budget !== null) {
      return { error: "total_budget must be a number or null" };
    }
    patch.total_budget = totalBudget;
  }

  if (hasOwn(body, "target_url")) {
    patch.target_url = asNullableString(body.target_url);
  }

  if (hasOwn(body, "video_url")) {
    patch.video_url = asNullableString(body.video_url);
  }

  if (hasOwn(body, "start_date")) {
    patch.start_date = asNullableString(body.start_date);
  }

  if (hasOwn(body, "end_date")) {
    patch.end_date = asNullableString(body.end_date);
  }

  if (hasOwn(body, "requirements")) {
    patch.requirements = (body.requirements as JsonRecord | null) ?? null;
  }

  if (hasOwn(body, "verification_rules")) {
    patch.verification_rules = (body.verification_rules as JsonRecord | null) ?? null;
  }

  if (mode === "update" && Object.keys(patch).length === 0) {
    return { error: "No task changes provided" };
  }

  return { patch };
}

async function listTasks(admin: any, body: JsonRecord) {
  const search = asString(body.search);
  const limit = clamp(asNonNegativeInteger(body.limit) ?? 200, 1, 500);

  let query = admin
    .from("tasks")
    .select("id, name, description, reward_points, task_type, is_active, required_seconds, max_attempts, max_completions_per_user, total_budget, total_claimed, target_url, video_url, start_date, end_date, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) return respond({ error: error.message }, dbErrorStatus(error));
  return respond({ tasks: data || [] });
}

async function createTask(admin: any, adminUserId: string, body: JsonRecord) {
  const { patch, error: patchError } = buildTaskPatch(body, "create");
  if (patchError || !patch) return respond({ error: patchError || "Invalid task payload" }, 400);

  const { data, error } = await admin.from("tasks").insert(patch).select("*").single();
  if (error) return respond({ error: error.message }, dbErrorStatus(error));

  await insertAudit(admin, adminUserId, "create_task", "tasks", data.id, null, patch);
  return respond({ task: data });
}

async function updateTask(admin: any, adminUserId: string, body: JsonRecord) {
  const taskId = asString(body.task_id);
  if (!taskId) return respond({ error: "task_id is required" }, 400);

  const { patch, error: patchError } = buildTaskPatch(body, "update");
  if (patchError || !patch) return respond({ error: patchError || "Invalid task payload" }, 400);

  const { data, error } = await admin
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .select("*")
    .maybeSingle();

  if (error) return respond({ error: error.message }, dbErrorStatus(error));
  if (!data) return respond({ error: "Task not found" }, 404);

  await insertAudit(admin, adminUserId, "update_task", "tasks", taskId, null, patch);
  return respond({ task: data });
}

async function grantRewards(admin: any, adminUserId: string, body: JsonRecord) {
  const targetUserId = asString(body.target_user_id);
  if (!targetUserId) return respond({ error: "target_user_id is required" }, 400);

  const xpAmount = asNonNegativeInteger(body.xp_amount) ?? 0;
  const bixAmount = asNonNegativeInteger(body.bix_amount) ?? 0;
  const reason = asNullableString(body.reason);
  const description = asNullableString(body.description);

  if (xpAmount <= 0 && bixAmount <= 0) {
    return respond({ error: "Provide xp_amount and/or bix_amount greater than zero" }, 400);
  }

  if (xpAmount > 0) {
    const { error } = await admin.rpc("progression_award_xp", {
      p_user_id: targetUserId,
      p_xp_amount: xpAmount,
    });
    if (error) {
      // Fallback to award_xp if progression_award_xp doesn't exist
      const { error: fallbackError } = await admin.rpc("award_xp", {
        user_id: targetUserId,
        xp_amount: xpAmount,
      });
      if (fallbackError) return respond({ error: fallbackError.message }, dbErrorStatus(fallbackError));
    }
  }

  let nextBixBalance: number | null = null;

  if (bixAmount > 0) {
    const { data: existingUser, error: readError } = await admin
      .from("users")
      .select("id, bix_balance, total_bix")
      .eq("id", targetUserId)
      .maybeSingle();

    if (readError) return respond({ error: readError.message }, dbErrorStatus(readError));
    if (!existingUser) return respond({ error: "Target user not found" }, 404);

    nextBixBalance = Number(existingUser.bix_balance || 0) + bixAmount;
    const nextTotalBix = Number(existingUser.total_bix || 0) + bixAmount;

    const { error: updateError } = await admin
      .from("users")
      .update({
        bix_balance: nextBixBalance,
        total_bix: nextTotalBix,
      })
      .eq("id", targetUserId);

    if (updateError) return respond({ error: updateError.message }, dbErrorStatus(updateError));

    const { error: rewardTxError } = await admin
      .from("reward_transactions")
      .insert({
        user_id: targetUserId,
        transaction_type: "bonus",
        gross_amount: bixAmount,
        tax_amount: 0,
        net_amount: bixAmount,
        running_balance: nextBixBalance,
        description: description || reason || "Admin bonus grant",
        metadata: {
          source: "admin_console",
          admin_user_id: adminUserId,
          xp_amount: xpAmount,
          bix_amount: bixAmount,
        },
      });

    if (rewardTxError) return respond({ error: rewardTxError.message }, dbErrorStatus(rewardTxError));
  }

  const activityDescription =
    description ||
    `Admin grant${xpAmount > 0 ? ` +${xpAmount} XP` : ""}${bixAmount > 0 ? ` +${bixAmount} BIX` : ""}`;

  const { error: activityError } = await admin.from("activities").insert({
    user_id: targetUserId,
    activity_type: "custom",
    points_earned: xpAmount,
    description: activityDescription,
    metadata: {
      unit: xpAmount > 0 ? "xp" : "bix",
      source: "admin_console",
      reason,
      awarded_xp: xpAmount,
      awarded_bix: bixAmount,
      admin_user_id: adminUserId,
    },
  });

  if (activityError) return respond({ error: activityError.message }, dbErrorStatus(activityError));

  const { data: user, error: userReadError } = await admin
    .from("users")
    .select("id, username, created_at, bix_balance, total_bix, total_xp, current_level, level_name, is_admin, admin_role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (userReadError) return respond({ error: userReadError.message }, dbErrorStatus(userReadError));

  await insertAudit(admin, adminUserId, "grant_rewards", "users", targetUserId, null, {
    xp_amount: xpAmount,
    bix_amount: bixAmount,
    reason,
  });

  return respond({ success: true, user });
}

async function listActivities(admin: any, body: JsonRecord) {
  const userId = asString(body.user_id);
  const limit = clamp(asNonNegativeInteger(body.limit) ?? 120, 1, 500);

  let query = admin
    .from("activities")
    .select("id, user_id, task_id, activity_type, points_earned, description, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: activities, error } = await query;
  if (error) return respond({ error: error.message }, dbErrorStatus(error));

  const userIds = [...new Set((activities || []).map((row: any) => row.user_id))];
  let usernameById = new Map<string, string | null>();

  if (userIds.length > 0) {
    const { data: users, error: userError } = await admin
      .from("users")
      .select("id, username")
      .in("id", userIds);
    if (userError) return respond({ error: userError.message }, dbErrorStatus(userError));
    usernameById = new Map((users || []).map((row: any) => [row.id, row.username]));
  }

  return respond({
    activities: (activities || []).map((row: any) => ({
      ...row,
      username: usernameById.get(row.user_id) || null,
    })),
  });
}

function parseMetadata(value: unknown): JsonRecord | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JsonRecord;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function createActivity(admin: any, adminUserId: string, body: JsonRecord) {
  const targetUserId = asString(body.target_user_id);
  if (!targetUserId) return respond({ error: "target_user_id is required" }, 400);

  const activityType = asString(body.activity_type) || "custom";
  if (!ACTIVITY_TYPES.has(activityType)) {
    return respond({ error: "Invalid activity_type" }, 400);
  }

  const pointsEarned = asNumber(body.points_earned) ?? 0;
  if (pointsEarned < 0) {
    return respond({ error: "points_earned must be >= 0" }, 400);
  }

  const grantXp = asBoolean(body.grant_xp) ?? false;
  if (grantXp) {
    if (!Number.isInteger(pointsEarned) || pointsEarned <= 0) {
      return respond({ error: "grant_xp requires points_earned to be a positive integer" }, 400);
    }
    const { error: xpError } = await admin.rpc("progression_award_xp", {
      p_user_id: targetUserId,
      p_xp_amount: pointsEarned,
    });
    if (xpError) {
      // Fallback to award_xp
      const { error: fallbackError } = await admin.rpc("award_xp", {
        user_id: targetUserId,
        xp_amount: pointsEarned,
      });
      if (fallbackError) return respond({ error: fallbackError.message }, dbErrorStatus(fallbackError));
    }
  }

  const metadata = parseMetadata(body.metadata) || {};
  const requestedUnit = typeof metadata.unit === "string" ? metadata.unit.trim().toLowerCase() : "";
  const resolvedUnit = requestedUnit === "xp" || requestedUnit === "bix"
    ? requestedUnit
    : (grantXp ? "xp" : "bix");
  const { data: activity, error } = await admin
    .from("activities")
    .insert({
      user_id: targetUserId,
      activity_type: activityType,
      points_earned: pointsEarned,
      description: asNullableString(body.description),
      metadata: {
        ...metadata,
        unit: resolvedUnit,
        source: "admin_console",
        admin_user_id: adminUserId,
        grant_xp: grantXp,
      },
    })
    .select("id, user_id, task_id, activity_type, points_earned, description, metadata, created_at")
    .single();

  if (error) return respond({ error: error.message }, dbErrorStatus(error));

  await insertAudit(admin, adminUserId, "create_activity", "activities", activity.id, null, {
    user_id: targetUserId,
    activity_type: activityType,
    points_earned: pointsEarned,
    grant_xp: grantXp,
  });

  return respond({ activity });
}

async function listSettings(admin: any) {
  const { data, error } = await admin
    .from("platform_settings")
    .select("id, key, value, description, updated_at, updated_by")
    .order("key", { ascending: true });

  if (error) return respond({ error: error.message }, dbErrorStatus(error));
  return respond({ settings: data || [] });
}

async function updateSetting(admin: any, adminUserId: string, body: JsonRecord) {
  const key = asString(body.key);
  if (!key) return respond({ error: "key is required" }, 400);

  if (!hasOwn(body, "value")) return respond({ error: "value is required" }, 400);
  const rawValue = body.value;
  const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);

  const patch: JsonRecord = {
    key,
    value,
    updated_by: adminUserId,
  };

  if (hasOwn(body, "description")) {
    patch.description = asNullableString(body.description);
  }

  const { data, error } = await admin
    .from("platform_settings")
    .upsert(patch, { onConflict: "key" })
    .select("id, key, value, description, updated_at, updated_by")
    .single();

  if (error) return respond({ error: error.message }, dbErrorStatus(error));

  await insertAudit(admin, adminUserId, "update_setting", "platform_settings", data.id, null, {
    key,
    value,
  });

  return respond({ setting: data });
}

async function listAuditLogs(admin: any, body: JsonRecord) {
  const limit = clamp(asNonNegativeInteger(body.limit) ?? 180, 1, 500);

  const { data: logs, error } = await admin
    .from("admin_audit_log")
    .select("id, admin_user_id, action, target_table, target_id, old_data, new_data, ip_address, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return respond({ error: error.message }, dbErrorStatus(error));

  const adminUserIds = [...new Set((logs || []).map((row: any) => row.admin_user_id))];
  let usernameById = new Map<string, string | null>();

  if (adminUserIds.length > 0) {
    const { data: users, error: usersError } = await admin
      .from("users")
      .select("id, username")
      .in("id", adminUserIds);

    if (usersError) return respond({ error: usersError.message }, dbErrorStatus(usersError));
    usernameById = new Map((users || []).map((row: any) => [row.id, row.username]));
  }

  return respond({
    logs: (logs || []).map((row: any) => ({
      ...row,
      admin_username: usernameById.get(row.admin_user_id) || null,
    })),
  });
}
