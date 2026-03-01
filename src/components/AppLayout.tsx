import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
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
