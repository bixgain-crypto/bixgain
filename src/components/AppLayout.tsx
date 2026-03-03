import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const accountInactive = user?.is_active === false;
  const accountFrozen = user?.is_frozen === true;

  if (accountInactive || accountFrozen) {
    return (
      <div className="min-h-screen bg-gradient-dark">
        <AppSidebar />
        <main className="min-h-screen px-3 pt-16 pb-20 sm:px-5 sm:pt-20 lg:ml-64 lg:px-8 lg:pt-8 lg:pb-8">
          <div className="glass rounded-2xl p-8 text-center max-w-xl mx-auto mt-8">
            <ShieldAlert className="h-8 w-8 text-warning mx-auto mb-3" />
            <p className="font-semibold">{accountInactive ? "Account Inactive" : "Account Frozen"}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {accountInactive
                ? "This account has been deactivated by an administrator."
                : "This account is currently frozen by an administrator."}
            </p>
            <Button className="mt-4" variant="outline" onClick={() => void signOut()}>
              Sign Out
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <AppSidebar />
      {/* pt-14 on mobile for top bar, pb-20 for bottom nav, lg:pt-0 and lg:ml-64 for desktop sidebar */}
      <main className="min-h-screen px-3 pt-16 pb-20 sm:px-5 sm:pt-20 lg:ml-64 lg:px-8 lg:pt-8 lg:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
