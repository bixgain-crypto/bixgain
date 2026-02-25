import { AppLayout } from "@/components/AppLayout";
import StakingTab from "@/components/StakingTab";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export default function Boosts() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary" />
            Boosts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Activate staking boosts to grow your Bix engine.
          </p>
        </motion.div>

        <StakingTab />
      </div>
    </AppLayout>
  );
}
