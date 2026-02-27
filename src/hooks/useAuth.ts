import { useAppData, type CoreUser } from "@/context/AppDataContext";

export function useAuth() {
  const { session, user, profile, wallet, signOut, loading } = useAppData();
  return { session, user: user as CoreUser | null, profile, wallet, isLoading: loading.session, signOut };
}
