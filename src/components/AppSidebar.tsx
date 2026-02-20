import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListTodo,
  Wallet,
  ArrowUpRight,
  Shield,
  LogOut,
  Sparkles,
  Users,
  Menu,
  X,
  Rocket,
} from "lucide-react";
import { BixLogo } from "./BixLogo";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/spin", label: "Spin & Earn", icon: Sparkles },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/wallet#staking", label: "Staking", icon: Rocket },
  { href: "/referrals", label: "Referrals", icon: Users },
  { href: "/about", label: "About", icon: Shield },
  { href: "/claims", label: "Coming Soon", icon: ArrowUpRight },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 sm:h-16">
        <Link to="/dashboard">
          <BixLogo size="sm" />
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-1">
        {isAdmin && (
          <Link
            to="/admin"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              location.pathname === "/admin"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-sidebar border-b border-border">
        <Link to="/dashboard">
          <BixLogo size="sm" />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-muted-foreground hover:text-foreground p-2"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`lg:hidden fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col border-r border-border bg-sidebar">
        {sidebarContent}
      </aside>
    </>
  );
}
