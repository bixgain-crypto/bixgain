import { AppLayout } from "@/components/AppLayout";
import { useAppData } from "@/context/AppDataContext";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Gamepad2, Brain, HelpCircle, Dices, Lock, Zap } from "lucide-react";

const GAMES = [
  {
    id: "tap-rush",
    name: "Tap Rush",
    description: "Fast-tapping game for BIX rewards",
    icon: Gamepad2,
    colorClass: "text-sky-400",
    bgClass: "from-sky-500/10 to-sky-500/5",
    borderClass: "border-sky-500/20",
  },
  {
    id: "memory-match",
    name: "Memory Match",
    description: "Card matching game for XP",
    icon: Brain,
    colorClass: "text-violet-400",
    bgClass: "from-violet-500/10 to-violet-500/5",
    borderClass: "border-violet-500/20",
  },
  {
    id: "quiz-challenge",
    name: "Quiz Challenge",
    description: "Trivia questions for rewards",
    icon: HelpCircle,
    colorClass: "text-emerald-400",
    bgClass: "from-emerald-500/10 to-emerald-500/5",
    borderClass: "border-emerald-500/20",
  },
  {
    id: "lucky-dice",
    name: "Lucky Dice",
    description: "Roll dice for random prizes",
    icon: Dices,
    colorClass: "text-amber-400",
    bgClass: "from-amber-500/10 to-amber-500/5",
    borderClass: "border-amber-500/20",
  },
];

export default function Boosts() {
  const { user } = useAppData();
  const currentLevel = Number(user?.current_level || 1);
  const isUnlocked = currentLevel >= 4;

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-primary" />
            Mini Games
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Exclusive games to earn rewards. Unlocks at Level 4 (Elite).
          </p>
        </motion.div>

        {!isUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6 flex flex-col items-center gap-3 text-center border border-warning/20"
          >
            <Lock className="h-10 w-10 text-warning" />
            <div>
              <p className="font-semibold text-lg">Level 4 Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                You are currently <span className="text-foreground font-medium">Level {currentLevel}</span>. Reach{" "}
                <span className="text-foreground font-medium">Level 4 (Elite)</span> by earning{" "}
                <span className="text-primary font-medium">35,000 XP</span> to unlock Mini Games.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Complete missions to earn XP faster
            </div>
          </motion.div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {GAMES.map((game, index) => {
            const Icon = game.icon;
            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.07 }}
                className={`relative glass rounded-xl p-5 border bg-gradient-to-br ${game.bgClass} ${game.borderClass} ${
                  isUnlocked
                    ? "hover:scale-[1.02] transition-transform cursor-pointer"
                    : "opacity-50"
                }`}
              >
                {!isUnlocked && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2.5 bg-background/50 ${game.colorClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">{game.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{game.description}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-muted-foreground/30 text-muted-foreground text-xs"
                  >
                    Coming Soon
                  </Badge>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
