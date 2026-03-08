import { Navigate } from "react-router-dom";
import { useAppData } from "@/context/AppDataContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAppData();

  if (loading.session) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
