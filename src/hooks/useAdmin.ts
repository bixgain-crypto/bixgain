import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, isLoading } = useAuth();
  return { isAdmin: !!user?.is_admin, isLoading };
}
