import { AppSidebar } from "./AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-dark">
      <AppSidebar />
      <main className="ml-64 min-h-screen p-8">{children}</main>
    </div>
  );
}
