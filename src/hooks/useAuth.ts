import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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

export function useAuth() {
  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: user } = useQuery({
    queryKey: ["user-core", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("users" as never)
        .select("id, username, created_at, bix_balance, total_bix, total_xp, converted_xp, current_level, level_name, is_admin, admin_role")
        .eq("id", session!.user.id)
        .maybeSingle();
      return (data ?? null) as CoreUser | null;
    },
  });

  const normalizedUser = user
    ? {
        ...user,
        username:
          user.username && user.username.trim().length > 0
            ? user.username.trim()
            : session?.user?.email?.split("@")[0] || `user-${user.id.slice(0, 6)}`,
      }
    : null;

  // Legacy compatibility for existing components still expecting profile.
  const profile = normalizedUser
    ? {
        user_id: normalizedUser.id,
        display_name: normalizedUser.username,
        created_at: normalizedUser.created_at,
      }
    : null;

  // Legacy compatibility for existing components still expecting wallet.
  const { data: wallet } = useQuery({
    queryKey: ["wallet", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", session!.user.id)
        .eq("wallet_type", "bix")
        .maybeSingle();
      return data;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return { session, user: normalizedUser, profile, wallet, isLoading, signOut };
}
