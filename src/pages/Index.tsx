import { BixLogo } from "@/components/BixLogo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Rocket, Target, Trophy, Wallet } from "lucide-react";

const features = [
  {
    icon: Rocket,
    title: "XP Progression Engine",
    desc: "Push Total XP, unlock levels, and increase your competitive ceiling.",
  },
  {
    icon: Trophy,
    title: "Season Competition",
    desc: "Climb Weekly and Season ranks in a live competitive ecosystem.",
  },
  {
    icon: Target,
    title: "Mission Pressure",
    desc: "Daily, weekly, referral, and challenge missions keep progression active.",
  },
  {
    icon: Wallet,
    title: "Bix Utility Layer",
    desc: "Progress isn’t given it’s unlocked. Use BIX to access higher tiers, enhanced rewards, and long-term earning boosts. The deeper you engage, the more the ecosystem works in your favor. Stay active. Stay strategic. Stay ahead.",
  },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <BixLogo size="sm" />
        <Link to="/auth">
          <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
            Sign In
          </Button>
        </Link>
      </header>

      <section className="flex flex-col items-center justify-center px-6 pt-20 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl space-y-6"
        >
          <div className="inline-block rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Competitive Crypto Progression Platform
          </div>
          <h1 className="text-5xl font-bold leading-tight md:text-7xl">
            Climb Levels.
            <br />
            <span className="text-gradient-gold">Dominate Seasons.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            XP drives progression, rank defines status, and Bix unlocks power. Build your edge through missions, daily boosts, and leaderboard pressure.
          </p>
          <div className="flex items-center justify-center gap-4 pt-3">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-gold font-semibold text-lg px-8 glow-gold">
                Enter Arena <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="px-6 pb-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + index * 0.08 }}
              className="glass rounded-xl p-6 text-left hover:glow-gold-sm transition-shadow"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
