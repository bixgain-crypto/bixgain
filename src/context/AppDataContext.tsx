import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  type AdminActivity,
  type AdminAuditItem,
  type AdminDashboardStats,
  type AdminTask,
  type AdminUser,
  type PlatformSetting,
  getAdminDashboard,
  listAdminActivities,
  listAdminAuditLogs,
  listAdminTasks,
  listAdminUsers,
  listPlatformSettings,
} from "@/lib/adminApi";
import { type LeaderboardPeriod, type LeaderboardResponse, fetchLeaderboard } from "@/lib/leaderboardApi";
import { generateReferralCode } from "@/lib/referrals";
import { invokeStaking } from "@/lib/stakingApi";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type WalletRow = Database["public"]["Tables"]["wallets"]["Row"];
type StakeRow = Database["public"]["Tables"]["stakes"]["Row"] & {
  staking_plans?: Database["public"]["Tables"]["staking_plans"]["Row"] | null;
};
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type RewardTransactionRow = Database["public"]["Tables"]["reward_transactions"]["Row"];
type ClaimRow = Database["public"]["Tables"]["claims"]["Row"];
type StakingPlanRow = Database["public"]["Tables"]["staking_plans"]["Row"];

export type CoreUser = {
  id: string;
  username: string | null;
  created_at: string;
  bix_balance: number;
  total_bix: number;
  total_xp: number;
  converted_xp: number;
  current_level: number;
  level_name: string;
  is_admin: boolean;
  admin_role: string | null;
};

type NormalizedWallet = WalletRow & {
  balance: number;
};

type LoadingState = {
  session: boolean;
  user: boolean;
  wallet: boolean;
  stakes: boolean;
  stakingPlans: boolean;
  activities: boolean;
  referrals: boolean;
  tasks: boolean;
  claims: boolean;
  rewardTransactions: boolean;
  referralCode: boolean;
  adminStats: boolean;
  adminUsers: boolean;
  adminTasks: boolean;
  adminActivities: boolean;
  adminSettings: boolean;
  adminAuditLogs: boolean;
  leaderboard: boolean;
};

type AppDataContextValue = {
  session: Session | null;
  user: CoreUser | null;
  profile: { user_id: string; display_name: string; created_at: string } | null;
  wallet: NormalizedWallet | null;
  stakes: StakeRow[];
  stakingPlans: StakingPlanRow[];
  activities: ActivityRow[];
  referrals: ReferralRow[];
  tasks: TaskRow[];
  claims: ClaimRow[];
  rewardTransactions: RewardTransactionRow[];
  referralCode: string;
  adminStats: AdminDashboardStats | null;
  adminUsers: AdminUser[];
  adminTasks: AdminTask[];
  adminActivities: AdminActivity[];
  adminSettings: PlatformSetting[];
  adminAuditLogs: AdminAuditItem[];
  leaderboards: Partial<Record<LeaderboardPeriod, LeaderboardResponse>>;
  loading: LoadingState;
  isAdmin: boolean;
  initialized: boolean;
  refreshUserProfile: () => Promise<CoreUser | null>;
  refreshWallet: () => Promise<void>;
  refreshStakes: () => Promise<void>;
  refreshStakingPlans: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  refreshReferrals: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshClaims: () => Promise<void>;
  refreshRewardTransactions: () => Promise<void>;
  refreshReferralCode: () => Promise<void>;
  refreshAdminStats: () => Promise<void>;
  refreshAdminUsers: () => Promise<void>;
  refreshAdminTasks: () => Promise<void>;
  refreshAdminActivities: () => Promise<void>;
  refreshAdminSettings: () => Promise<void>;
  refreshAdminAuditLogs: () => Promise<void>;
  refreshLeaderboard: (period: LeaderboardPeriod) => Promise<void>;
  refreshAll: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

const DEFAULT_LOADING: LoadingState = {
  session: true,
  user: false,
  wallet: false,
  stakes: false,
  stakingPlans: false,
  activities: false,
  referrals: false,
  tasks: false,
  claims: false,
  rewardTransactions: false,
  referralCode: false,
  adminStats: false,
  adminUsers: false,
  adminTasks: false,
  adminActivities: false,
  adminSettings: false,
  adminAuditLogs: false,
  leaderboard: false,
};

function normalizeUser(raw: UserRow | null, session: Session | null): CoreUser | null {
  if (!raw) return null;
  const username =
    raw.username && raw.username.trim().length > 0
      ? raw.username.trim()
      : session?.user?.email?.split("@")[0] || `user-${raw.id.slice(0, 6)}`;

  return {
    ...raw,
    username,
    admin_role: raw.admin_role || "user",
  };
}

async function ensureReferralCode(userId: string, username: string | null | undefined): Promise<string> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  const existing = profile?.referral_code?.trim();
  if (existing) return existing.toUpperCase();

  const baseCode = generateReferralCode(userId, username);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate =
      attempt === 0
        ? baseCode
        : `${baseCode.slice(0, 8)}${Math.floor(1000 + Math.random() * 9000)}`;

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, referral_code: candidate }, { onConflict: "user_id" });

    if (!error) return candidate;
    if (error.code !== "23505") throw error;
  }

  throw new Error("Unable to generate unique referral code");
}

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

  const refreshUserProfile = useCallback(async (): Promise<CoreUser | null> => {
    if (!sessionUserId) {
      setUser(null);
      setProfile(null);
      return null;
    }

    return runExclusive("refresh-user", async () => {
      setLoadingFlag("user", true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, created_at, bix_balance, total_bix, total_xp, converted_xp, current_level, level_name, is_admin, admin_role")
          .eq("id", sessionUserId)
          .maybeSingle();

        if (error) throw error;
        const normalized = normalizeUser((data ?? null) as UserRow | null, session);
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

  const refreshWallet = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setWallet(null);
      return;
    }

    await runExclusive("refresh-wallet", async () => {
      setLoadingFlag("wallet", true);
      try {
        const [{ data: walletRow, error: walletError }, { data: userRow, error: userError }] = await Promise.all([
          supabase
            .from("wallets")
            .select("*")
            .eq("user_id", sessionUserId)
            .eq("wallet_type", "bix")
            .maybeSingle(),
          supabase
            .from("users")
            .select("bix_balance")
            .eq("id", sessionUserId)
            .maybeSingle(),
        ]);

        if (walletError) throw walletError;
        if (userError) throw userError;

        if (!walletRow) {
          setWallet(null);
          return;
        }

        const normalized: NormalizedWallet = {
          ...(walletRow as WalletRow),
          balance: Number(userRow?.bix_balance ?? walletRow.balance ?? 0),
        };
        setWallet(normalized);
      } finally {
        setLoadingFlag("wallet", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshStakingPlans = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setStakingPlans([]);
      return;
    }

    await runExclusive("refresh-staking-plans", async () => {
      setLoadingFlag("stakingPlans", true);
      try {
        const response = await invokeStaking("get_plans");
        setStakingPlans(((response?.plans ?? []) as StakingPlanRow[]).filter(Boolean));
      } finally {
        setLoadingFlag("stakingPlans", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshStakes = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setStakes([]);
      return;
    }

    await runExclusive("refresh-stakes", async () => {
      setLoadingFlag("stakes", true);
      try {
        const response = await invokeStaking("get_my_stakes");
        setStakes((response?.stakes ?? []) as StakeRow[]);
      } finally {
        setLoadingFlag("stakes", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshActivities = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setActivities([]);
      return;
    }

    await runExclusive("refresh-activities", async () => {
      setLoadingFlag("activities", true);
      try {
        const { data, error } = await supabase
          .from("activities")
          .select("*")
          .eq("user_id", sessionUserId)
          .order("created_at", { ascending: false })
          .limit(500);

        if (error) throw error;
        setActivities((data ?? []) as ActivityRow[]);
      } finally {
        setLoadingFlag("activities", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshReferrals = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setReferrals([]);
      return;
    }

    await runExclusive("refresh-referrals", async () => {
      setLoadingFlag("referrals", true);
      try {
        const { data, error } = await supabase
          .from("referrals")
          .select("*")
          .eq("referrer_id", sessionUserId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setReferrals((data ?? []) as ReferralRow[]);
      } finally {
        setLoadingFlag("referrals", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshTasks = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setTasks([]);
      return;
    }

    await runExclusive("refresh-tasks", async () => {
      setLoadingFlag("tasks", true);
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTasks((data ?? []) as TaskRow[]);
      } finally {
        setLoadingFlag("tasks", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshClaims = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setClaims([]);
      return;
    }

    await runExclusive("refresh-claims", async () => {
      setLoadingFlag("claims", true);
      try {
        const { data, error } = await supabase
          .from("claims")
          .select("*")
          .eq("user_id", sessionUserId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setClaims((data ?? []) as ClaimRow[]);
      } finally {
        setLoadingFlag("claims", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshRewardTransactions = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setRewardTransactions([]);
      return;
    }

    await runExclusive("refresh-reward-transactions", async () => {
      setLoadingFlag("rewardTransactions", true);
      try {
        const { data, error } = await supabase
          .from("reward_transactions")
          .select("*")
          .eq("user_id", sessionUserId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setRewardTransactions((data ?? []) as RewardTransactionRow[]);
      } finally {
        setLoadingFlag("rewardTransactions", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshReferralCode = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      setReferralCode("");
      return;
    }

    await runExclusive("refresh-referral-code", async () => {
      setLoadingFlag("referralCode", true);
      try {
        const code = await ensureReferralCode(
          sessionUserId,
          user?.username || session?.user?.email?.split("@")[0] || null,
        );
        setReferralCode(code);
      } finally {
        setLoadingFlag("referralCode", false);
      }
    });
  }, [runExclusive, session, sessionUserId, setLoadingFlag, user?.username]);

  const refreshAdminStats = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) {
      setAdminStats(null);
      return;
    }

    await runExclusive("refresh-admin-stats", async () => {
      setLoadingFlag("adminStats", true);
      try {
        const data = await getAdminDashboard();
        setAdminStats(data.stats);
      } finally {
        setLoadingFlag("adminStats", false);
      }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminUsers = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) {
      setAdminUsers([]);
      return;
    }

    await runExclusive("refresh-admin-users", async () => {
      setLoadingFlag("adminUsers", true);
      try {
        setAdminUsers(await listAdminUsers(""));
      } finally {
        setLoadingFlag("adminUsers", false);
      }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminTasks = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) {
      setAdminTasks([]);
      return;
    }

    await runExclusive("refresh-admin-tasks", async () => {
      setLoadingFlag("adminTasks", true);
      try {
        setAdminTasks(await listAdminTasks(""));
      } finally {
        setLoadingFlag("adminTasks", false);
      }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminActivities = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) {
      setAdminActivities([]);
      return;
    }

    await runExclusive("refresh-admin-activities", async () => {
      setLoadingFlag("adminActivities", true);
      try {
        setAdminActivities(await listAdminActivities());
      } finally {
        setLoadingFlag("adminActivities", false);
      }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminSettings = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) {
      setAdminSettings([]);
      return;
    }

    await runExclusive("refresh-admin-settings", async () => {
      setLoadingFlag("adminSettings", true);
      try {
        setAdminSettings(await listPlatformSettings());
      } finally {
        setLoadingFlag("adminSettings", false);
      }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAdminAuditLogs = useCallback(async (): Promise<void> => {
    if (!sessionUserId || !isAdmin) {
      setAdminAuditLogs([]);
      return;
    }

    await runExclusive("refresh-admin-audit", async () => {
      setLoadingFlag("adminAuditLogs", true);
      try {
        setAdminAuditLogs(await listAdminAuditLogs(200));
      } finally {
        setLoadingFlag("adminAuditLogs", false);
      }
    });
  }, [isAdmin, runExclusive, sessionUserId, setLoadingFlag]);

  const refreshLeaderboard = useCallback(async (period: LeaderboardPeriod): Promise<void> => {
    if (!sessionUserId) {
      setLeaderboards({});
      return;
    }

    await runExclusive(`refresh-leaderboard-${period}`, async () => {
      setLoadingFlag("leaderboard", true);
      try {
        const data = await fetchLeaderboard(period, 100);
        setLeaderboards((prev) => ({ ...prev, [period]: data }));
      } finally {
        setLoadingFlag("leaderboard", false);
      }
    });
  }, [runExclusive, sessionUserId, setLoadingFlag]);

  const refreshAll = useCallback(async (): Promise<void> => {
    if (!sessionUserId) {
      clearUserData();
      clearAdminData();
      return;
    }

    const latestUser = await refreshUserProfile();

    await Promise.all([
      refreshWallet(),
      refreshStakingPlans(),
      refreshStakes(),
      refreshActivities(),
      refreshReferrals(),
      refreshReferralCode(),
      refreshTasks(),
      refreshClaims(),
      refreshRewardTransactions(),
      refreshLeaderboard("weekly"),
      refreshLeaderboard("season"),
      refreshLeaderboard("all_time"),
    ]);

    if (latestUser?.is_admin) {
      await Promise.all([
        refreshAdminStats(),
        refreshAdminUsers(),
        refreshAdminTasks(),
        refreshAdminActivities(),
        refreshAdminSettings(),
        refreshAdminAuditLogs(),
      ]);
    } else {
      clearAdminData();
    }
  }, [
    clearAdminData,
    clearUserData,
    refreshActivities,
    refreshAdminActivities,
    refreshAdminAuditLogs,
    refreshAdminSettings,
    refreshAdminStats,
    refreshAdminTasks,
    refreshAdminUsers,
    refreshClaims,
    refreshLeaderboard,
    refreshReferralCode,
    refreshReferrals,
    refreshRewardTransactions,
    refreshStakes,
    refreshStakingPlans,
    refreshTasks,
    refreshUserProfile,
    refreshWallet,
    sessionUserId,
  ]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearUserData();
    clearAdminData();
    window.location.href = "/";
  }, [clearAdminData, clearUserData]);

  useEffect(() => {
    let mounted = true;
    setLoadingFlag("session", true);

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoadingFlag("session", false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingFlag("session", false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [setLoadingFlag]);

  useEffect(() => {
    if (!sessionUserId) {
      clearUserData();
      clearAdminData();
      return;
    }

    void refreshAll();
  }, [clearAdminData, clearUserData, refreshAll, sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;

    const interval = window.setInterval(() => {
      void refreshAll();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshAll, sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;

    const channelName = `app-data-${sessionUserId}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    const onUsers = () => {
      void refreshUserProfile();
      void refreshWallet();
      if (isAdmin) {
        void refreshAdminUsers();
        void refreshAdminStats();
      }
    };

    const onWallets = () => {
      void refreshWallet();
      if (isAdmin) {
        void refreshAdminStats();
      }
    };

    const onStakes = () => {
      void refreshStakes();
      if (isAdmin) {
        void refreshAdminStats();
      }
    };

    const onActivities = () => {
      void refreshActivities();
      void refreshLeaderboard("weekly");
      void refreshLeaderboard("season");
      void refreshLeaderboard("all_time");
      if (isAdmin) {
        void refreshAdminActivities();
        void refreshAdminStats();
      }
    };

    const onReferrals = () => {
      void refreshReferrals();
      if (isAdmin) {
        void refreshAdminStats();
      }
    };

    if (isAdmin) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "users" }, onUsers)
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, onWallets)
        .on("postgres_changes", { event: "*", schema: "public", table: "stakes" }, onStakes)
        .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, onActivities)
        .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, onReferrals)
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
          void refreshTasks();
          void refreshAdminTasks();
          void refreshAdminStats();
        });
    } else {
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "users", filter: `id=eq.${sessionUserId}` },
          onUsers,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${sessionUserId}` },
          onWallets,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "stakes", filter: `user_id=eq.${sessionUserId}` },
          onStakes,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activities", filter: `user_id=eq.${sessionUserId}` },
          onActivities,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "referrals", filter: `referrer_id=eq.${sessionUserId}` },
          onReferrals,
        );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    isAdmin,
    refreshActivities,
    refreshAdminActivities,
    refreshAdminStats,
    refreshAdminTasks,
    refreshAdminUsers,
    refreshLeaderboard,
    refreshReferrals,
    refreshStakes,
    refreshTasks,
    refreshUserProfile,
    refreshWallet,
    sessionUserId,
  ]);

  const value = useMemo<AppDataContextValue>(() => ({
    session,
    user,
    profile,
    wallet,
    stakes,
    stakingPlans,
    activities,
    referrals,
    tasks,
    claims,
    rewardTransactions,
    referralCode,
    adminStats,
    adminUsers,
    adminTasks,
    adminActivities,
    adminSettings,
    adminAuditLogs,
    leaderboards,
    loading,
    isAdmin,
    initialized: !loading.session,
    refreshUserProfile,
    refreshWallet,
    refreshStakes,
    refreshStakingPlans,
    refreshActivities,
    refreshReferrals,
    refreshTasks,
    refreshClaims,
    refreshRewardTransactions,
    refreshReferralCode,
    refreshAdminStats,
    refreshAdminUsers,
    refreshAdminTasks,
    refreshAdminActivities,
    refreshAdminSettings,
    refreshAdminAuditLogs,
    refreshLeaderboard,
    refreshAll,
    signOut,
  }), [
    activities,
    adminActivities,
    adminAuditLogs,
    adminSettings,
    adminStats,
    adminTasks,
    adminUsers,
    claims,
    isAdmin,
    leaderboards,
    loading,
    profile,
    referralCode,
    referrals,
    refreshActivities,
    refreshAdminActivities,
    refreshAdminAuditLogs,
    refreshAdminSettings,
    refreshAdminStats,
    refreshAdminTasks,
    refreshAdminUsers,
    refreshAll,
    refreshClaims,
    refreshLeaderboard,
    refreshReferralCode,
    refreshReferrals,
    refreshRewardTransactions,
    refreshStakes,
    refreshStakingPlans,
    refreshTasks,
    refreshUserProfile,
    refreshWallet,
    rewardTransactions,
    session,
    signOut,
    stakes,
    stakingPlans,
    tasks,
    user,
    wallet,
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
