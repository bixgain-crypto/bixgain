import { BixLogo } from "@/components/BixLogo";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Coins,
  Orbit,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

const earningChannels = [
  {
    icon: Target,
    title: "Missions",
    description:
      "Complete daily, weekly, referral, challenge, and seasonal missions to earn XP and progress your account.",
  },
  {
    icon: Orbit,
    title: "Daily Boost",
    description:
      "Claim your daily boost from the spin flow to secure extra XP and keep your momentum active.",
  },
  {
    icon: Users,
    title: "Referrals",
    description:
      "Share your referral link. When invited users qualify, you unlock referral progress and rewards.",
  },
  {
    icon: Zap,
    title: "Staking",
    description:
      "Stake BIX in available plans, accrue rewards over time, and claim or withdraw based on plan conditions.",
  },
];

const participateSteps = [
  "Create an account and sign in.",
  "Open Missions and complete active tasks.",
  "Claim Daily Boost consistently to stack XP.",
  "Share your referral code and grow qualified invites.",
  "Track progress on Dashboard, Leaderboard, and Wallet.",
];

const rewardUtility = [
  {
    icon: Trophy,
    title: "XP and Leveling",
    description: "XP increases your level and helps you compete in weekly and seasonal leaderboard races.",
  },
  {
    icon: Coins,
    title: "BIX Balance",
    description: "BIX is tracked in Wallet and can be earned through platform activity and reward systems.",
  },
  {
    icon: Wallet,
    title: "Spend and Claim",
    description:
      "Use BIX in the Store for unlocks, or submit wallet claims where approval and tax rules apply.",
  },
];

const importantNotes = [
  "Some missions require a minimum level before reward claim is enabled.",
  "Missions with external links can include a claim delay before completion is valid.",
  "Referral rewards depend on invite qualification, not only invite count.",
  "Wallet claims pass through approval flow and may include platform tax deductions.",
];

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-dark">
      <div className="mx-auto w-full max-w-[1240px] px-6 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/">
            <BixLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Home
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
                Get Started
              </Button>
            </Link>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mt-8 rounded-2xl p-6 sm:p-8"
        >
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            About Bixgain
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            How The App Works
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Bixgain is a competitive reward ecosystem built around progression and strategy.
            <br />
            Complete missions, stack XP, earn BIX, and climb the leaderboard.
            <br />
            Every action strengthens your position, unlocks higher tiers, and expands your earning potential.
            <br />
            Stay active, stay strategic, and outpace the competition.
          </p>
        </motion.section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {earningChannels.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.05 }}
              className="glass rounded-2xl p-5"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </motion.article>
          ))}
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <motion.article
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="glass rounded-2xl p-5 sm:p-6"
          >
            <h2 className="text-xl font-semibold">How Users Participate And Earn</h2>
            <ol className="mt-4 space-y-2">
              {participateSteps.map((step, index) => (
                <li
                  key={step}
                  className="rounded-xl border border-border/70 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground"
                >
                  <span className="font-mono text-primary mr-2">{String(index + 1).padStart(2, "0")}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="glass rounded-2xl p-5 sm:p-6"
          >
            <h2 className="text-xl font-semibold">Important Notes</h2>
            <ul className="mt-4 space-y-2">
              {importantNotes.map((note) => (
                <li key={note} className="rounded-xl border border-border/70 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
                  {note}
                </li>
              ))}
            </ul>
          </motion.article>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {rewardUtility.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 + index * 0.05 }}
              className="glass rounded-2xl p-5"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </motion.article>
          ))}
        </section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="glass mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-7"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Ready To Start?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your account, complete missions, and build your XP + BIX engine.
              </p>
            </div>
            <Link to="/auth">
              <Button className="bg-gradient-gold text-primary-foreground font-semibold">
                Start Earning <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
