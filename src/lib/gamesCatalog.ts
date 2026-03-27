import { Brain, Coins, Crown, Puzzle, Gamepad2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ArcadeGame = {
  slug: string;
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  energyLabel: string;
  rewardRate: string;
  highScoreLabel: string;
  xp_per_unit: number;
  themeClass: string;
};

export const arcadeGames: ArcadeGame[] = [
  {
    slug: "bixtap",
    path: "/games/bixtap",
    title: "BixTap",
    description: "Tap the coin or dragon to earn BIX rewards.",
    icon: Coins,
    energyLabel: "Energy 86/100",
    rewardRate: "2 BIX / tap",
    highScoreLabel: "Top Tapper: 1,204",
    xp_per_unit: 2,
    themeClass:
      "from-amber-400/20 via-orange-500/15 to-fuchsia-500/20 border-amber-300/40",
  },
  {
    slug: "bixsnake-arena",
    path: "/games/bixsnake-arena",
    title: "BixSnake Arena",
    description: "Classic snake gameplay with competitive scoring and BIX rewards.",
    icon: Gamepad2,
    energyLabel: "Energy 5/7",
    rewardRate: "18 BIX / streak",
    highScoreLabel: "Arena King: 9,820",
    xp_per_unit: 10, // Assuming 10 XP per raw score unit for estimation
    themeClass:
      "from-emerald-400/20 via-teal-500/15 to-cyan-500/20 border-emerald-300/40",
  },
  {
    slug: "bixmemory",
    path: "/games/bixmemory",
    title: "BixMemory",
    description: "A memory matching game that rewards BIX for correct matches.",
    icon: Brain,
    energyLabel: "Attempts 4/6",
    rewardRate: "12 BIX / match",
    highScoreLabel: "Mind Master: 44 matches",
    xp_per_unit: 10, // Assuming 10 XP per match for estimation
    themeClass:
      "from-indigo-500/20 via-violet-500/15 to-fuchsia-500/20 border-violet-300/40",
  },
  {
    slug: "plumber-puzzle",
    path: "/games/plumber-puzzle",
    title: "Plumber Puzzle",
    description: "Solve pipe puzzles to earn BIX tokens.",
    icon: Puzzle,
    energyLabel: "Pipes 3/5",
    rewardRate: "15 BIX / board",
    highScoreLabel: "Pipe Pro: 31 boards",
    xp_per_unit: 10, // Assuming 10 XP per board for estimation
    themeClass:
      "from-sky-500/20 via-blue-500/15 to-indigo-500/20 border-sky-300/40",
  },
  {
    slug: "dragonquest",
    path: "/games/dragonquest",
    title: "Dragon Quest",
    description: "Send your dragon on quests to collect treasure and BIX rewards.",
    icon: Crown,
    energyLabel: "Stamina 2/4",
    rewardRate: "25 BIX / quest",
    highScoreLabel: "Wyrm Lord: 128 quests",
    xp_per_unit: 10, // Assuming 10 XP per quest for estimation
    themeClass:
      "from-rose-500/20 via-orange-500/15 to-yellow-500/20 border-rose-300/40",
  },
];

export const arcadeGameBySlug: Record<string, ArcadeGame> = Object.fromEntries(
  arcadeGames.map((game) => [game.slug, game]),
);
