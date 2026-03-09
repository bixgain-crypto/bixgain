import { Link, useLocation } from "react-router-dom";
import {
  Gamepad2,
  LayoutDashboard,
  Target,
  Trophy,
  Wallet,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/missions", label: "Missions", icon: Target },
  { href: "/boosts", label: "Mini Games", icon: Gamepad2 },
  { href: "/leaderboard", label: "Rank", icon: Trophy },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-sidebar/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 min-w-[56px] rounded-lg transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

