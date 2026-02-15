import { BixLogo } from "@/components/BixLogo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Coins, Zap, Users } from "lucide-react";

const features = [
  { icon: Coins, title: "Earn BIX Tokens", desc: "Complete tasks and activities to earn rewards" },
  { icon: Shield, title: "Secure Ledger", desc: "Financial-safe append-only transaction ledger" },
  { icon: Zap, title: "Instant Rewards", desc: "Get rewarded immediately for your contributions" },
  { icon: Users, title: "Referral Bonuses", desc: "Invite friends and earn bonus BIX tokens" },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5">
        <BixLogo size="sm" />
        <Link to="/auth">
          <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
            Sign In
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl space-y-6"
        >
          <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Crypto Reward Platform
          </div>
          <h1 className="text-5xl font-bold leading-tight md:text-7xl">
            Earn <span className="text-gradient-gold">BIX</span> Rewards
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Complete tasks, refer friends, and stake tokens to earn BIX rewards on the most transparent crypto reward platform.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-gold font-semibold text-lg px-8 glow-gold">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 pb-32">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass rounded-lg p-6 text-center hover:glow-gold-sm transition-shadow"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-6 text-center text-sm text-muted-foreground">
        © 2026 Bixgain Rewards. All rights reserved.
      </footer>
    </div>
  );
}
