import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Crown, Medal, Sparkles, Timer, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

const comingSoonTracks = [
  {
    icon: Trophy,
    title: "Weekly Arena",
    description: "Fast-paced XP race with rapid resets and fresh winners every week.",
    accentClass: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  },
  {
    icon: Crown,
    title: "Season Ladder",
    description: "Long-form competition designed for consistency and strategic progression.",
    accentClass: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  },
  {
    icon: Medal,
    title: "All Time Hall",
    description: "Permanent ranking layer tracking legacy performance across the platform.",
    accentClass: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  },
];

export default function Leaderboard() {
  return (
    <AppLayout>
      <div className="space-y-6 lg:space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_45%)]" />

          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Coming Soon
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                Leaderboard is on the way
              </h1>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
                We are polishing the competitive ranking experience to match the rest of the app.
                Weekly, Seasonal, and All-Time boards will be released together.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="mt-1 font-semibold">In Development</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Focus</p>
                <p className="mt-1 font-semibold">Fair Ranking Logic</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Mode</p>
                <p className="mt-1 font-semibold flex items-center gap-1.5">
                  <Timer className="h-4 w-4 text-primary" />
                  Real-time Ready
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {comingSoonTracks.map((track, index) => (
            <motion.div
              key={track.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
              className="glass rounded-2xl p-5 space-y-3 border border-border/70"
            >
              <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${track.accentClass}`}>
                <track.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">{track.title}</h2>
              <p className="text-sm text-muted-foreground">{track.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            Keep stacking XP through missions and daily boosts while rankings are being finalized.
          </p>
          <Link to="/missions">
            <Button className="bg-gradient-gold text-primary-foreground font-semibold">Go to Missions</Button>
          </Link>
        </motion.div>
      </div>
    </AppLayout>
  );
}
