import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminActivities,
  listAdminAuditLogs,
  listAdminTasks,
  listAdminUsers,
  listPlatformSettings,
} from "@/lib/adminApi";
import { fetchLeaderboard, type LeaderboardPeriod, type LeaderboardResponse } from "@/lib/leaderboardApi";
import { listPendingRewardNotifications, type RewardNotification } from "@/lib/rewardNotificationApi";
import { invokeStaking } from "@/lib/stakingApi";

import type {
  ActivityRow,
  AdminStatsRpcRow,
  AppDataContextValue,
  ClaimRow,
  CoreUser,
  LoadingState,
  NormalizedWallet,
  ReferralRow,
  RewardTransactionRow,
  StakeRow,
  StakingPlanRow,
  TaskRow,
  UserRow,
  WalletRow,
} from "./appDataTypes";
import { DEFAULT_LOADING } from "./appDataTypes";
import type { AdminDashboardStats, AdminUser, AdminTask, AdminActivity, PlatformSetting, AdminAuditItem } from "@/lib/adminApi";
import { normalizeUser, ensureReferralCode, sameSession } from "./appDataHelpers";
import { useRealtimeSubscriptions } from "./useRealtimeSubscriptions";

export type { CoreUser } from "./appDataTypes";

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);
const REFRESH_ALL_THROTTLE_MS = 5000;

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<CoreUser | null>(null);
  const [profile, setProfile] = useState<{ user_id: string; display_name: string; created_at: string } | null>(null);
  const [wallet, setWallet] = useState<NormalizedWallet | null>(null);
  const [stakes, setStakes] = useState<StakeRow[]>([]);
  const [stakingPlans, setStakingPlans] = useState<StakingPlanRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [rewardTransactions, setRewardTransactions] = useState<RewardTransactionRow[]>([]);
  const [rewardNotifications, setRewardNotifications] = useState<RewardNotification[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminTasks, setAdminTasks] = useState<AdminTask[]>([]);
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>([]);
  const [adminSettings, setAdminSettings] = useState<PlatformSetting[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditItem[]>([]);
  const [leaderboards, setLeaderboards] = useState<Partial<Record<LeaderboardPeriod, LeaderboardResponse>>>({});
  const [loading, setLoading] = useState<LoadingState>(DEFAULT_LOADING);

  const inFlightRef = useRef<Record<string, Promise<unknown>>>({});
  const lastRefreshAllRef = useRef(0);
  const sessionUserId = session?.user?.id || null;
  const isAdmin = !!user?.is_admin;

  const setLoadingFlag = useCallback((key: keyof LoadingState, value: boolean) => {
    setLoading((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const clearUserData = useCallback(() => {
    setUser(null);
    setProfile(null);
    setWallet(null);
    setStakes([]);
    setStakingPlans([]);
    setActivities([]);
    setReferrals([]);
    setTasks([]);
    setClaims([]);
    setRewardTransactions([]);
    setRewardNotifications([]);
    setReferralCode("");
    setLeaderboards({});
  }, []);

  const clearAdminData = useCallback(() => {
    setAdminStats(null);
    setAdminUsers([]);
    setAdminTasks([]);
    setAdminActivities([]);
    setAdminSettings([]);
    setAdminAuditLogs([]);
  }, []);

  const runExclusive = useCallback(<T,>(key: string, runner: () => Promise<T>): Promise<T> => {
    const current = inFlightRef.current[key] as Promise<T> | undefined;
    if (current) return current;

    const next = runner().finally(() => {
      delete inFlightRef.current[key];
    }) as Promise<T>;

    inFlightRef.current[key] = next as Promise<unknown>;
    return next;
  }, []);

  // ── User & Profile ──────────────────────────────────────────────
  const refreshUserProfile = useCallback(async (): Promise<CoreUser | null> => {
    if (!sessionUserId) {
      setUser(null);
      setProfile(null);
      return null;
    }

    return runExclusive("refresh-user", async () => {
      setLoadingFlag("user", true);
      try {
        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("id, username, created_at, bix_balance, total_bix, total_xp, converted_xp, current_level, level_name, is_admin, admin_role, is_active, is_frozen")
          .eq("id", sessionUserId)
          .maybeSingle();

        if (userError) throw userError;

        const normalized = normalizeUser((userRow ?? null) as UserRow | null, session);
        setUser(normalized);
        setProfile(
          normalized
            ? {
                user_id: normalized.id,
                display_name: normalized.username || `user-${normalized.id.slice(0, 6)}`,
                created_at: normalized.created_at,
              }
            : null,
        );
        return normalized;
      } finally {
        setLoadingFlag("user", false);
      }
    });
  }, [runExclusive, session, sessionUserId, setLoadingFlag]);

  // ── Wallet ──────────────────────────────────────────────────────
  const refreshWallet = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setWallet(null); return; }
    await runExclusive("refresh-wallet", async () => {
      setLoadingFlag("wallet", true);
      try {
        const [{ data: walletRow, error: walletError }, { data: userRow, error: userError }] = await Promise.all([
          supabase.from("wallets").select("*").eq("user_id", sessionUserId).eq("wallet_type", "bix").maybeSingle(),
          supabase.from("users").select("bix_balance").eq("id", sessionUserId).maybeSingle(),
        ]);
        if (walletError) throw walletError;
        if (userError) throw userError;
        if (!walletRow) { setWallet(null); return; }
        setWallet({ ...(walletRow as WalletRow), balance: Number(userRow?.bix_balance ?? walletRow.balance ?? 0) });
      } finally { setLoadingFlag("wallet", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  // ── Staking ─────────────────────────────────────────────────────
  const refreshStakingPlans = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setStakingPlans([]); return; }
    await runExclusive("refresh-staking-plans", async () => {
      setLoadingFlag("stakingPlans", true);
      try {
        const response = await invokeStaking("get_plans");
        setStakingPlans(((response?.plans ?? []) as StakingPlanRow[]).filter(Boolean));
      } finally { setLoadingFlag("stakingPlans", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshStakes = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setStakes([]); return; }
    await runExclusive("refresh-stakes", async () => {
      setLoadingFlag("stakes", true);
      try {
        const response = await invokeStaking("get_my_stakes");
        setStakes((response?.stakes ?? []) as StakeRow[]);
      } finally { setLoadingFlag("stakes", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  // ── User Data ───────────────────────────────────────────────────
  const refreshActivities = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setActivities([]); return; }
    await runExclusive("refresh-activities", async () => {
      setLoadingFlag("activities", true);
      try {
        const { data, error } = await supabase.from("activities").select("*").eq("user_id", sessionUserId).order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        setActivities((data ?? []) as ActivityRow[]);
      } finally { setLoadingFlag("activities", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshReferrals = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setReferrals([]); return; }
    await runExclusive("refresh-referrals", async () => {
      setLoadingFlag("referrals", true);
      try {
        const { data, error } = await supabase.from("referrals").select("*").eq("referrer_id", sessionUserId).order("created_at", { ascending: false });
        if (error) throw error;
        setReferrals((data ?? []) as ReferralRow[]);
      } finally { setLoadingFlag("referrals", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshTasks = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setTasks([]); return; }
    await runExclusive("refresh-tasks", async () => {
      setLoadingFlag("tasks", true);
      try {
        const { data, error } = await supabase.from("tasks").select("*").eq("is_active", true).order("created_at", { ascending: false });
        if (error) throw error;
        setTasks((data ?? []) as TaskRow[]);
      } finally { setLoadingFlag("tasks", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshClaims = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setClaims([]); return; }
    await runExclusive("refresh-claims", async () => {
      setLoadingFlag("claims", true);
      try {
        const { data, error } = await supabase.from("claims").select("*").eq("user_id", sessionUserId).order("created_at", { ascending: false });
        if (error) throw error;
        setClaims((data ?? []) as ClaimRow[]);
      } finally { setLoadingFlag("claims", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshRewardTransactions = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setRewardTransactions([]); return; }
    await runExclusive("refresh-reward-transactions", async () => {
      setLoadingFlag("rewardTransactions", true);
      try {
        const { data, error } = await supabase.from("reward_transactions").select("*").eq("user_id", sessionUserId).order("created_at", { ascending: false }).limit(50);
        if (error) throw error;
        setRewardTransactions((data ?? []) as RewardTransactionRow[]);
      } finally { setLoadingFlag("rewardTransactions", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshRewardNotifications = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setRewardNotifications([]); return; }
    await runExclusive("refresh-reward-notifications", async () => {
      setLoadingFlag("rewardNotifications", true);
      try { setRewardNotifications(await listPendingRewardNotifications()); }
      finally { setLoadingFlag("rewardNotifications", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshReferralCode = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { setReferralCode(""); return; }
    await runExclusive("refresh-referral-code", async () => {
      setLoadingFlag("referralCode", true);
      try {
        const code = await ensureReferralCode(sessionUserId, user?.username || session?.user?.email?.split("@")[0] || null);
        setReferralCode(code);
      } finally { setLoadingFlag("referralCode", false); }
    });
  }, [runExclusive, session, sessionUserId, setLoadingFlag, user?.username]);

  // ── Admin Data ──────────────────────────────────────────────────
  const refreshAdminStats = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) { setAdminStats(null); return; }
    await runExclusive("refresh-admin-stats", async () => {
      setLoadingFlag("adminStats", true);
      try {
        const { data, error } = await supabase.rpc("get_admin_stats" as never);
        if (error) throw error;
        const row = (Array.isArray(data) ? (data as any[])[0] : data) as AdminStatsRpcRow | null | undefined;
        setAdminStats((prev) => ({
          total_users: Number(row?.total_users ?? 0),
          active_users: prev?.active_users ?? null,
          total_bix_in_circulation: prev?.total_bix_in_circulation ?? null,
          total_tvl_locked: Number(row?.tvl_locked ?? 0),
          total_rewards_distributed: Number(row?.rewards_distributed ?? 0),
          active_stakes: Number(row?.active_stakes ?? 0),
          pending_claims: Number(row?.pending_claims ?? 0),
          total_approved_claims: prev?.total_approved_claims ?? null,
          total_revenue: prev?.total_revenue ?? null,
          total_tasks: prev?.total_tasks ?? 0,
          active_tasks: prev?.active_tasks ?? 0,
          pending_attempts: prev?.pending_attempts ?? 0,
          open_fraud_flags: prev?.open_fraud_flags ?? 0,
        }));
      } finally { setLoadingFlag("adminStats", false); }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminUsers = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) { setAdminUsers([]); return; }
    await runExclusive("refresh-admin-users", async () => {
      setLoadingFlag("adminUsers", true);
      try { setAdminUsers(await listAdminUsers("")); }
      finally { setLoadingFlag("adminUsers", false); }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminTasks = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) { setAdminTasks([]); return; }
    await runExclusive("refresh-admin-tasks", async () => {
      setLoadingFlag("adminTasks", true);
      try { setAdminTasks(await listAdminTasks("")); }
      finally { setLoadingFlag("adminTasks", false); }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminActivities = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) { setAdminActivities([]); return; }
    await runExclusive("refresh-admin-activities", async () => {
      setLoadingFlag("adminActivities", true);
      try { setAdminActivities(await listAdminActivities()); }
      finally { setLoadingFlag("adminActivities", false); }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminSettings = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) { setAdminSettings([]); return; }
    await runExclusive("refresh-admin-settings", async () => {
      setLoadingFlag("adminSettings", true);
      try { setAdminSettings(await listPlatformSettings()); }
      finally { setLoadingFlag("adminSettings", false); }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminAuditLogs = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) { setAdminAuditLogs([]); return; }
    await runExclusive("refresh-admin-audit", async () => {
      setLoadingFlag("adminAuditLogs", true);
      try { setAdminAuditLogs(await listAdminAuditLogs(200)); }
      finally { setLoadingFlag("adminAuditLogs", false); }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  // ── Leaderboard ─────────────────────────────────────────────────
  const refreshLeaderboard = useCallback(async (period: LeaderboardPeriod): Promise<void> => {
    if (!sessionUserId) { setLeaderboards({}); return; }
    await runExclusive(`refresh-leaderboard-${period}`, async () => {
      setLoadingFlag("leaderboard", true);
      try {
        const response = await fetchLeaderboard(period, 100);
        const top = (response.top ?? []).map((entry, index) => {
          const userId = String(entry.user_id || "");
          const xp = Number(entry.xp ?? 0);
          const level = Number(entry.level ?? 1);
          return {
            ...entry,
            user_id: userId,
            username: entry.username?.trim() || `User-${userId.slice(0, 6)}`,
            avatar_url: entry.avatar_url ?? null,
            xp, level,
            level_name: entry.level_name?.trim() || `Level ${level}`,
            rank: Number(entry.rank ?? index + 1),
            is_current_user: entry.is_current_user || userId === sessionUserId,
          };
        });
        const responseCurrent = response.current_user;
        const currentUser = responseCurrent
          ? {
              ...responseCurrent,
              user_id: String(responseCurrent.user_id || ""),
              username: responseCurrent.username?.trim() || `User-${String(responseCurrent.user_id || "").slice(0, 6)}`,
              avatar_url: responseCurrent.avatar_url ?? null,
              xp: Number(responseCurrent.xp ?? 0),
              level: Number(responseCurrent.level ?? 1),
              level_name: responseCurrent.level_name?.trim() || `Level ${Number(responseCurrent.level ?? 1)}`,
              rank: Number(responseCurrent.rank ?? 0),
              is_current_user: true,
            }
          : top.find((entry) => entry.user_id === sessionUserId) || null;
        const payload: LeaderboardResponse = {
          ...response, period, top,
          total_players: Number(response.total_players ?? top.length),
          current_user: currentUser,
        };
        setLeaderboards((prev) => ({ ...prev, [period]: payload }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Leaderboard unavailable";
        const authFailure = message.toLowerCase().includes("invalid jwt") || message.toLowerCase().includes("unauthorized");
        if (authFailure) {
          setLeaderboards((prev) => ({ ...prev, [period]: { period, generated_at: new Date().toISOString(), season_label: "", total_players: 0, top: [], current_user: null } }));
          return;
        }
        console.error(`[leaderboard:${period}] ${message}`);
      } finally { setLoadingFlag("leaderboard", false); }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  // ── Refresh All ─────────────────────────────────────────────────
  const refreshAll = useCallback(async (): Promise<void> => {
    if (!sessionUserId) { clearUserData(); clearAdminData(); return; }
    await runExclusive("refresh-all", async () => {
      const now = Date.now();
      if (now - lastRefreshAllRef.current >= 0 && now - lastRefreshAllRef.current < REFRESH_ALL_THROTTLE_MS) return;
      lastRefreshAllRef.current = now;
      const latestUser = await refreshUserProfile();
      await Promise.all([
        refreshWallet(), refreshStakingPlans(), refreshStakes(),
        refreshActivities(), refreshReferrals(), refreshReferralCode(),
        refreshTasks(), refreshClaims(), refreshRewardTransactions(),
        refreshRewardNotifications(), refreshLeaderboard("weekly"), refreshLeaderboard("season"),
      ]);
      if (latestUser?.is_admin) {
        await Promise.all([
          refreshAdminStats(), refreshAdminUsers(), refreshAdminTasks(),
          refreshAdminActivities(), refreshAdminSettings(), refreshAdminAuditLogs(),
        ]);
      } else { clearAdminData(); }
    });
  }, [clearAdminData, clearUserData, refreshActivities, refreshAdminActivities, refreshAdminAuditLogs, refreshAdminSettings, refreshAdminStats, refreshAdminTasks, refreshAdminUsers, refreshClaims, refreshLeaderboard, refreshReferralCode, refreshReferrals, refreshRewardNotifications, refreshRewardTransactions, refreshStakes, refreshStakingPlans, refreshTasks, refreshUserProfile, refreshWallet, runExclusive, sessionUserId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearUserData();
    clearAdminData();
    window.location.href = "/";
  }, [clearAdminData, clearUserData]);

  // ── Auth listener ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoadingFlag("session", true);
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession((prev) => (sameSession(prev, data.session) ? prev : data.session));
      setLoadingFlag("session", false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession((prev) => (sameSession(prev, nextSession) ? prev : nextSession));
      setLoadingFlag("session", false);
    });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, [setLoadingFlag]);

  // ── Initial + periodic refresh ──────────────────────────────────
  useEffect(() => {
    if (!sessionUserId) { clearUserData(); clearAdminData(); return; }
    void refreshAll().catch((e: unknown) => console.error(e instanceof Error ? e.message : "Failed to refresh"));
  }, [clearAdminData, clearUserData, refreshAll, sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;
    const interval = window.setInterval(() => { void refreshAll().catch((e: unknown) => console.error(e instanceof Error ? e.message : "Failed to refresh")); }, 60_000);
    return () => { window.clearInterval(interval); };
  }, [refreshAll, sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;
    if (!isAdmin) { clearAdminData(); return; }
    void Promise.all([refreshAdminStats(), refreshAdminUsers(), refreshAdminTasks(), refreshAdminActivities(), refreshAdminSettings(), refreshAdminAuditLogs()]).catch((e: unknown) => console.error(e instanceof Error ? e.message : "Failed to refresh admin data"));
  }, [clearAdminData, isAdmin, refreshAdminActivities, refreshAdminAuditLogs, refreshAdminSettings, refreshAdminStats, refreshAdminTasks, refreshAdminUsers, sessionUserId]);

  // ── Realtime ────────────────────────────────────────────────────
  useRealtimeSubscriptions(sessionUserId, isAdmin, {
    refreshUserProfile, refreshWallet, refreshStakes, refreshActivities,
    refreshReferrals, refreshClaims, refreshRewardTransactions, refreshRewardNotifications,
    refreshTasks, refreshLeaderboard, refreshAdminUsers, refreshAdminStats,
    refreshAdminActivities, refreshAdminTasks, refreshAdminSettings, refreshAdminAuditLogs,
  });

  const value = useMemo<AppDataContextValue>(() => ({
    session, user, profile, wallet, stakes, stakingPlans, activities, referrals, tasks, claims,
    rewardTransactions, rewardNotifications, referralCode, adminStats, adminUsers, adminTasks,
    adminActivities, adminSettings, adminAuditLogs, leaderboards, loading, isAdmin,
    initialized: !loading.session,
    refreshUserProfile, refreshWallet, refreshStakes, refreshStakingPlans, refreshActivities,
    refreshReferrals, refreshTasks, refreshClaims, refreshRewardTransactions, refreshRewardNotifications,
    refreshReferralCode, refreshAdminStats, refreshAdminUsers, refreshAdminTasks, refreshAdminActivities,
    refreshAdminSettings, refreshAdminAuditLogs, refreshLeaderboard, refreshAll, signOut,
  }), [activities, adminActivities, adminAuditLogs, adminSettings, adminStats, adminTasks, adminUsers, claims, isAdmin, leaderboards, loading, profile, referralCode, referrals, refreshActivities, refreshAdminActivities, refreshAdminAuditLogs, refreshAdminSettings, refreshAdminStats, refreshAdminTasks, refreshAdminUsers, refreshAll, refreshClaims, refreshRewardNotifications, refreshLeaderboard, refreshReferralCode, refreshReferrals, refreshRewardTransactions, refreshStakes, refreshStakingPlans, refreshTasks, refreshUserProfile, refreshWallet, rewardTransactions, rewardNotifications, session, signOut, stakes, stakingPlans, tasks, user, wallet]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error("useAppData must be used within AppDataProvider");
  return context;
}
