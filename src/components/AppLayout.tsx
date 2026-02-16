import { AppSidebar } from "./AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-dark">
      <AppSidebar />
      {/* pt-14 on mobile for top bar, lg:pt-0 and lg:ml-64 for desktop sidebar */}
      <main className="min-h-screen p-4 pt-18 sm:p-6 sm:pt-20 lg:ml-64 lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
