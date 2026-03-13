import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type RealtimeCallbacks = {
  refreshUserProfile: () => Promise<unknown>;
  refreshWallet: () => Promise<void>;
  refreshStakes: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  refreshReferrals: () => Promise<void>;
  refreshClaims: () => Promise<void>;
  refreshRewardTransactions: () => Promise<void>;
  refreshRewardNotifications: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshLeaderboard: (period: string) => Promise<void>;
  refreshAdminUsers: () => Promise<void>;
  refreshAdminStats: () => Promise<void>;
  refreshAdminActivities: () => Promise<void>;
  refreshAdminTasks: () => Promise<void>;
  refreshAdminSettings: () => Promise<void>;
  refreshAdminAuditLogs: () => Promise<void>;
};

export function useRealtimeSubscriptions(
  sessionUserId: string | null,
  isAdmin: boolean,
  callbacks: RealtimeCallbacks,
) {
  useEffect(() => {
    if (!sessionUserId) return;

    const channelName = `app-data-${sessionUserId}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    const onUsers = () => {
      void callbacks.refreshUserProfile();
      void callbacks.refreshWallet();
      if (isAdmin) {
        void callbacks.refreshAdminUsers();
        void callbacks.refreshAdminStats();
      }
    };

    const onProfiles = () => {
      void callbacks.refreshUserProfile();
      if (isAdmin) {
        void callbacks.refreshAdminUsers();
      }
    };

    const onWallets = () => {
      void callbacks.refreshWallet();
      if (isAdmin) {
        void callbacks.refreshAdminStats();
      }
    };

    const onStakes = () => {
      void callbacks.refreshStakes();
      if (isAdmin) {
        void callbacks.refreshAdminStats();
      }
    };

    const onActivities = () => {
      void callbacks.refreshActivities();
      void callbacks.refreshLeaderboard("weekly");
      void callbacks.refreshLeaderboard("season");
      if (isAdmin) {
        void callbacks.refreshAdminActivities();
        void callbacks.refreshAdminStats();
      }
    };

    const onReferrals = () => {
      void callbacks.refreshReferrals();
      if (isAdmin) {
        void callbacks.refreshAdminStats();
      }
    };

    const onClaims = () => {
      void callbacks.refreshClaims();
      if (isAdmin) {
        void callbacks.refreshAdminStats();
      }
    };

    const onRewardTransactions = () => {
      void callbacks.refreshRewardTransactions();
      if (isAdmin) {
        void callbacks.refreshAdminStats();
      }
    };

    const onUserRewardNotifications = () => {
      void callbacks.refreshRewardNotifications();
    };

    if (isAdmin) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "users" }, onUsers)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, onProfiles)
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, onWallets)
        .on("postgres_changes", { event: "*", schema: "public", table: "stakes" }, onStakes)
        .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, onActivities)
        .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, onReferrals)
        .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, onClaims)
        .on("postgres_changes", { event: "*", schema: "public", table: "reward_transactions" }, onRewardTransactions)
        .on("postgres_changes", { event: "*", schema: "public", table: "user_reward_notifications" }, onUserRewardNotifications)
        .on("postgres_changes", { event: "*", schema: "public", table: "task_attempts" }, () => {
          void callbacks.refreshAdminStats();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
          void callbacks.refreshTasks();
          void callbacks.refreshAdminTasks();
          void callbacks.refreshAdminStats();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, () => {
          void callbacks.refreshAdminSettings();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "admin_audit_log" }, () => {
          void callbacks.refreshAdminAuditLogs();
        });
    } else {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "users", filter: `id=eq.${sessionUserId}` }, onUsers)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${sessionUserId}` }, onProfiles)
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${sessionUserId}` }, onWallets)
        .on("postgres_changes", { event: "*", schema: "public", table: "stakes", filter: `user_id=eq.${sessionUserId}` }, onStakes)
        .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `user_id=eq.${sessionUserId}` }, onActivities)
        .on("postgres_changes", { event: "*", schema: "public", table: "referrals", filter: `referrer_id=eq.${sessionUserId}` }, onReferrals)
        .on("postgres_changes", { event: "*", schema: "public", table: "claims", filter: `user_id=eq.${sessionUserId}` }, onClaims)
        .on("postgres_changes", { event: "*", schema: "public", table: "reward_transactions", filter: `user_id=eq.${sessionUserId}` }, onRewardTransactions)
        .on("postgres_changes", { event: "*", schema: "public", table: "user_reward_notifications", filter: `user_id=eq.${sessionUserId}` }, onUserRewardNotifications)
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
          void callbacks.refreshTasks();
        });
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    isAdmin,
    callbacks.refreshActivities,
    callbacks.refreshAdminAuditLogs,
    callbacks.refreshAdminSettings,
    callbacks.refreshAdminActivities,
    callbacks.refreshAdminStats,
    callbacks.refreshAdminTasks,
    callbacks.refreshAdminUsers,
    callbacks.refreshClaims,
    callbacks.refreshLeaderboard,
    callbacks.refreshReferrals,
    callbacks.refreshRewardNotifications,
    callbacks.refreshRewardTransactions,
    callbacks.refreshStakes,
    callbacks.refreshTasks,
    callbacks.refreshUserProfile,
    callbacks.refreshWallet,
    sessionUserId,
  ]);
}
