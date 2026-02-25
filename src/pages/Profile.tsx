import { AppLayout } from "@/components/AppLayout";
import { LevelBadge } from "@/components/LevelBadge";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useProgression } from "@/hooks/useProgression";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { Award, Crown, Medal, ShieldCheck } from "lucide-react";

const PROFILE_BADGES = [
  { title: "Level Achievements", icon: Medal, tone: "text-sky-300 border-sky-400/30 bg-sky-500/10" },
  { title: "Season Champion", icon: Crown, tone: "text-amber-300 border-amber-400/30 bg-amber-500/10" },
  { title: "Top Weekly", icon: Award, tone: "text-violet-300 border-violet-400/30 bg-violet-500/10" },
  { title: "Referral Master", icon: ShieldCheck, tone: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" },
];

function initialsFromName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Profile() {
  const { profile, session } = useAuth();
  const { progressionQuery, weeklyRankQuery, seasonRankQuery } = useProgression(session?.user?.id);

  const progression = progressionQuery.data;
  const levelProgress = progression?.levelProgress;
  const displayName = profile?.display_name || "Player";
  const totalXp = progression?.totalXp ?? 0;
  const seasonRank = seasonRankQuery.data?.current_user?.rank;
  const weeklyRank = weeklyRankQuery.data?.current_user?.rank;

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_45%)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-border/60 ring-2 ring-primary/25">
                <AvatarImage src={profile?.avatar_url ?? ""} alt={displayName} />
                <AvatarFallback className="text-base font-semibold">{initialsFromName(displayName)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <p className="text-sm text-muted-foreground">
                  {levelProgress
                    ? `Level ${levelProgress.current.level} - ${levelProgress.current.name}`
                    : "Level 1 - Explorer"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <LevelBadge totalXp={totalXp} />
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-secondary/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total XP</p>
              <p className="mt-1 text-2xl font-bold text-gradient-gold">{formatXp(totalXp)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Season Rank</p>
              <p className="mt-1 text-2xl font-bold">{seasonRank ? `#${seasonRank}` : "-"}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Weekly Rank</p>
              <p className="mt-1 text-2xl font-bold">{weeklyRank ? `#${weeklyRank}` : "-"}</p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-semibold">Profile Progression</h2>
          {levelProgress ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{`Level ${levelProgress.current.level} - ${levelProgress.current.name}`}</p>
                <p className="text-sm mt-1">
                  Total XP: <span className="font-mono text-primary">{formatXp(totalXp)} XP</span>
                </p>
              </div>

              <XpProgressBar value={levelProgress.progressPercent} />

              <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                <p className="text-sm text-muted-foreground">Level Unlock Description</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {levelProgress.current.unlocks.map((unlock) => (
                    <li key={unlock} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{unlock}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Progression data is loading.</p>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-semibold">Profile Badges</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PROFILE_BADGES.map((badge) => (
              <div key={badge.title} className={`rounded-xl border px-4 py-4 ${badge.tone}`}>
                <badge.icon className="h-6 w-6 mb-3" />
                <p className="font-medium">{badge.title}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </AppLayout>
  );
}
