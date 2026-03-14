import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  AdminActivity,
  AdminAuditItem,
  AdminDashboardStats,
  AdminTask,
  AdminUser,
  PlatformSetting,
} from "@/lib/adminApi";
import type { LeaderboardPeriod, LeaderboardResponse } from "@/lib/leaderboardApi";
import type { RewardNotification } from "@/lib/rewardNotificationApi";

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type WalletRow = Database["public"]["Tables"]["wallets"]["Row"];
export type StakeRow = Database["public"]["Tables"]["stakes"]["Row"] & {
  staking_plans?: Database["public"]["Tables"]["staking_plans"]["Row"] | null;
};
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type RewardTransactionRow = Database["public"]["Tables"]["reward_transactions"]["Row"];
export type ClaimRow = Database["public"]["Tables"]["claims"]["Row"];
export type StakingPlanRow = Database["public"]["Tables"]["staking_plans"]["Row"];

export type AdminStatsRpcRow = {
  total_users: number | null;
  tvl_locked: number | null;
  rewards_distributed: number | null;
  active_stakes: number | null;
  pending_claims?: number | null;
};

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
  is_active: boolean;
  is_frozen: boolean;
  streak_count: number | null;
  weekly_xp: number | null;
  season_xp: number | null;
  xp_multiplier: number | null;
};

export type NormalizedWallet = WalletRow & {
  balance: number;
};

export type LoadingState = {
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
  rewardNotifications: boolean;
  referralCode: boolean;
  adminStats: boolean;
  adminUsers: boolean;
  adminTasks: boolean;
  adminActivities: boolean;
  adminSettings: boolean;
  adminAuditLogs: boolean;
  leaderboard: boolean;
};

export type AppDataContextValue = {
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
  rewardNotifications: RewardNotification[];
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
  refreshRewardNotifications: () => Promise<void>;
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

export const DEFAULT_LOADING: LoadingState = {
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
  rewardNotifications: false,
  referralCode: false,
  adminStats: false,
  adminUsers: false,
  adminTasks: false,
  adminActivities: false,
  adminSettings: false,
  adminAuditLogs: false,
  leaderboard: false,
};
