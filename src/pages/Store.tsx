import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { spendBix } from "@/lib/progressionApi";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BadgePlus, ShoppingBag, Sparkles, Unlock, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type StoreItem = {
  id: string;
  name: string;
  cost: number;
  description: string;
  icon: typeof Zap;
};

const STORE_ITEMS: StoreItem[] = [
  {
    id: "xp-multiplier",
    name: "XP Multiplier",
    cost: 5,
    description: "Earn 20% more XP.",
    icon: Zap,
  },
  {
    id: "mission-unlock",
    name: "Mission Unlock",
    cost: 8,
    description: "Open one additional elite mission slot.",
    icon: Unlock,
  },
  {
    id: "profile-badge",
    name: "Profile Badge",
    cost: 4,
    description: "Unlock an exclusive profile badge.",
    icon: BadgePlus,
  },
  {
    id: "season-pass",
    name: "Season Pass",
    cost: 15,
    description: "Access premium season missions and status cosmetics.",
    icon: Sparkles,
  },
];

export default function Store() {
  const { wallet } = useAuth();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const bixBalance = Number(wallet?.balance || 0);

  const handlePurchase = async (item: StoreItem) => {
    if (purchasing) return;
    if (bixBalance < item.cost) {
      toast.error("Insufficient Bix Balance");
      return;
    }

    setPurchasing(item.id);
    try {
      await spendBix(item.cost);
      toast.success(`${item.name} unlocked`);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Purchase failed";
      toast.error(message);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" />
            Bix Store
          </h1>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 sm:p-8"
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Bix Balance</p>
          <p className="mt-2 text-4xl font-bold text-gradient-gold">{bixBalance.toLocaleString()} Bix</p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {STORE_ITEMS.map((item) => (
            <div key={item.id} className="glass rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-primary/15 border border-primary/25 p-2.5">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs">{item.cost} Bix</span>
                </div>
                <h2 className="mt-4 text-lg font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button
                onClick={() => handlePurchase(item)}
                disabled={purchasing === item.id}
                className="mt-5 bg-gradient-gold text-primary-foreground font-semibold"
              >
                {purchasing === item.id ? "Processing..." : "Unlock"}
              </Button>
            </div>
          ))}
        </motion.section>
      </div>
    </AppLayout>
  );
}
