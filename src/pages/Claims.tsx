import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Rocket, Sparkles, Store, Send, ArrowDownLeft } from "lucide-react";

export default function Claims() {
  const comingSoonFeatures = [
    { icon: Store, title: "BIX Store", desc: "Spend your BIX on exclusive upgrades and merchandise" },
    { icon: Send, title: "Send BIX", desc: "Transfer BIX to other users instantly" },
    { icon: ArrowDownLeft, title: "Receive BIX", desc: "Accept BIX from anyone with your wallet address" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Rocket className="h-20 w-20 text-primary mx-auto" />
          </motion.div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
            <span className="text-gradient-gold">Coming Soon</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto">
            We're building something amazing! These features are in active development and will be available soon.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 max-w-6xl w-full">
          {comingSoonFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 80 }}
              className="glass rounded-xl p-6 text-center relative overflow-hidden group"
            >
              <motion.div
                className="absolute inset-0 bg-primary/5"
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
              />
              <div className="relative z-10">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Sparkles className="h-4 w-4 text-primary animate-pulse-gold" />
          Stay tuned for updates
          <Sparkles className="h-4 w-4 text-primary animate-pulse-gold" />
        </motion.div>
      </div>
    </AppLayout>
  );
}
