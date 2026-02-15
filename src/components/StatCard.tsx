import { Coins, TrendingUp, Wallet, Gift } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: "coins" | "trending" | "wallet" | "gift";
  delay?: number;
}

const iconMap = {
  coins: Coins,
  trending: TrendingUp,
  wallet: Wallet,
  gift: Gift,
};

export function StatCard({ title, value, subtitle, icon, delay = 0 }: StatCardProps) {
  const Icon = iconMap[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass rounded-lg p-6 hover:glow-gold-sm transition-shadow duration-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold font-mono text-gradient-gold animate-count-up">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}
