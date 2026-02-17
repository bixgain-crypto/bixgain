import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useAdmin() {
  const { session } = useAuth();

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_users")
        .select("id, role_id")
        .eq("user_id", session!.user.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
  });

  return { isAdmin: !!isAdmin, isLoading };
}
