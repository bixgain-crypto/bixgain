import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import {
  type MiniGameCatalogItem,
  type MiniGameOverview,
  type MiniGameSessionStartResult,
  type MiniGameSubmitResult,
  claimMiniGamesDailyLoginBonus,
  getMiniGamesOverview,
  startMiniGameSession,
  submitMiniGameScore,
} from "@/lib/miniGamesApi";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import {
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Gamepad2,
  Gem,
  Sparkles,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type GameResultState = {
  rawScore: number;
  estimatedXp: number;
  estimatedBix: number;
  submitted: boolean;
  submitting: boolean;
  verified: MiniGameSubmitResult | null;
};

type GamePanelProps = {
  onFinish: (score: number) => void;
};

type GridCell = {
  x: number;
  y: number;
};

const MINI_GAME_LEVEL_REQUIRED = 4;
const BIX_TAP_DURATION_SECONDS = 10;
const BIX_SNAKE_SIZE = 14;
const BIX_SNAKE_TICK_MS = 170;

const statusLabel: Record<MiniGameCatalogItem["status"], string> = {
  active: "Active",
  beta: "Beta",
  coming_soon: "Coming Soon",
};

const statusBadgeClass: Record<MiniGameCatalogItem["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  beta: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  coming_soon: "bg-secondary text-muted-foreground border-border",
};

const iconBySlug: Record<string, ComponentType<{ className?: string }>> = {
  bixsnake: Gamepad2,
  bixtap: Timer,
  bixmemory: Brain,
};

function estimateGameReward(game: MiniGameCatalogItem, rawScore: number): { xp: number; bix: number } {
  const normalizedScore = Math.max(0, Math.min(Math.floor(rawScore), game.max_score));
  const baseXp = Math.min(normalizedScore * game.xp_per_unit, game.max_xp);
  const bix = Number((baseXp / 10000).toFixed(8));
  return { xp: baseXp, bix };
}

function randomFood(snake: GridCell[]): GridCell {
  const occupied = new Set(snake.map((part) => `${part.x}:${part.y}`));
  const freeCells: GridCell[] = [];

  for (let y = 0; y < BIX_SNAKE_SIZE; y += 1) {
    for (let x = 0; x < BIX_SNAKE_SIZE; x += 1) {
      const key = `${x}:${y}`;
      if (!occupied.has(key)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (freeCells.length === 0) return { x: 0, y: 0 };
  return freeCells[Math.floor(Math.random() * freeCells.length)];
}

function sameCell(a: GridCell, b: GridCell): boolean {
  return a.x === b.x && a.y === b.y;
}

function nextCellByDirection(head: GridCell, direction: "up" | "down" | "left" | "right"): GridCell {
  if (direction === "up") return { x: head.x, y: head.y - 1 };
  if (direction === "down") return { x: head.x, y: head.y + 1 };
  if (direction === "left") return { x: head.x - 1, y: head.y };
  return { x: head.x + 1, y: head.y };
}

function isOppositeDirection(
  current: "up" | "down" | "left" | "right",
  next: "up" | "down" | "left" | "right",
): boolean {
  return (
    (current === "up" && next === "down") ||
    (current === "down" && next === "up") ||
    (current === "left" && next === "right") ||
    (current === "right" && next === "left")
  );
}

function BixTapGame({ onFinish }: GamePanelProps) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [timeLeft, setTimeLeft] = useState(BIX_TAP_DURATION_SECONDS);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (phase !== "running") return;

    if (timeLeft <= 0) {
      setPhase("finished");
      onFinish(score);
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [phase, timeLeft, score, onFinish]);

  const startRound = () => {
    setScore(0);
    setTimeLeft(BIX_TAP_DURATION_SECONDS);
    setPhase("running");
  };

  const handleTap = () => {
    if (phase !== "running") return;
    setScore((current) => current + 1);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Time Left</p>
          <p className="mt-1 text-2xl font-bold">{`${timeLeft}s`}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Taps</p>
          <p className="mt-1 text-2xl font-bold">{score}</p>
        </div>
      </div>

      <Button
        onClick={phase === "idle" ? startRound : handleTap}
        className="w-full h-16 text-lg font-semibold bg-gradient-gold text-primary-foreground"
      >
        {phase === "idle" ? "Start BixTap" : phase === "running" ? "Tap +1" : "Round Finished"}
      </Button>

      {phase === "finished" ? (
        <p className="text-sm text-muted-foreground text-center">
          Round complete. Submit score to verify reward.
        </p>
      ) : null}
    </div>
  );
}

function BixSnakeGame({ onFinish }: GamePanelProps) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [snake, setSnake] = useState<GridCell[]>([
    { x: 4, y: 7 },
    { x: 3, y: 7 },
    { x: 2, y: 7 },
  ]);
  const [direction, setDirection] = useState<"up" | "down" | "left" | "right">("right");
  const [pendingDirection, setPendingDirection] = useState<"up" | "down" | "left" | "right">("right");
  const [food, setFood] = useState<GridCell>({ x: 9, y: 7 });
  const [score, setScore] = useState(0);

  const startRound = useCallback(() => {
    const initialSnake: GridCell[] = [
      { x: 4, y: 7 },
      { x: 3, y: 7 },
      { x: 2, y: 7 },
    ];
    setSnake(initialSnake);
    setDirection("right");
    setPendingDirection("right");
    setFood(randomFood(initialSnake));
    setScore(0);
    setPhase("running");
  }, []);

  const finishRound = useCallback(
    (finalScore: number) => {
      if (phase === "finished") return;
      setPhase("finished");
      onFinish(finalScore);
    },
    [onFinish, phase],
  );

  const queueDirection = useCallback(
    (next: "up" | "down" | "left" | "right") => {
      if (phase !== "running") return;
      if (isOppositeDirection(direction, next) || isOppositeDirection(pendingDirection, next)) return;
      setPendingDirection(next);
    },
    [direction, pendingDirection, phase],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") queueDirection("up");
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") queueDirection("down");
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") queueDirection("left");
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") queueDirection("right");
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [queueDirection]);

  useEffect(() => {
    if (phase !== "running") return;

    const timer = window.setTimeout(() => {
      const activeDirection = pendingDirection;
      const head = snake[0];
      const nextHead = nextCellByDirection(head, activeDirection);

      const hitsWall =
        nextHead.x < 0 ||
        nextHead.y < 0 ||
        nextHead.x >= BIX_SNAKE_SIZE ||
        nextHead.y >= BIX_SNAKE_SIZE;

      const hitsBody = snake.some((part) => sameCell(part, nextHead));

      if (hitsWall || hitsBody) {
        finishRound(score);
        return;
      }

      const didEat = sameCell(nextHead, food);

      if (didEat) {
        const grownSnake = [nextHead, ...snake];
        setSnake(grownSnake);
        setDirection(activeDirection);
        setPendingDirection(activeDirection);
        setScore((current) => current + 1);
        setFood(randomFood(grownSnake));
        return;
      }

      const movedSnake = [nextHead, ...snake.slice(0, snake.length - 1)];
      setSnake(movedSnake);
      setDirection(activeDirection);
      setPendingDirection(activeDirection);
    }, BIX_SNAKE_TICK_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [phase, snake, direction, pendingDirection, food, score, finishRound]);

  const head = snake[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Food Eaten</p>
          <p className="mt-1 text-2xl font-bold">{score}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Snake Length</p>
          <p className="mt-1 text-2xl font-bold">{snake.length}</p>
        </div>
      </div>

      {phase === "idle" ? (
        <Button onClick={startRound} className="w-full bg-gradient-gold text-primary-foreground font-semibold">
          Start BixSnake
        </Button>
      ) : null}

      <div className="mx-auto w-full max-w-[26rem] aspect-square rounded-2xl border border-border/70 bg-secondary/25 p-1.5">
        <div
          className="grid h-full w-full gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${BIX_SNAKE_SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: BIX_SNAKE_SIZE * BIX_SNAKE_SIZE }).map((_, index) => {
            const x = index % BIX_SNAKE_SIZE;
            const y = Math.floor(index / BIX_SNAKE_SIZE);
            const isFood = food.x === x && food.y === y;
            const isSnake = snake.some((part) => part.x === x && part.y === y);
            const isHead = head.x === x && head.y === y;

            let className = "rounded-[3px] bg-background/40";
            if (isFood) className = "rounded-[3px] bg-rose-400/90";
            if (isSnake) className = "rounded-[3px] bg-primary/85";
            if (isHead) className = "rounded-[3px] bg-gradient-gold";

            return <div key={`${x}-${y}`} className={className} />;
          })}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[14rem] grid-cols-3 gap-2">
        <div />
        <Button size="icon" variant="outline" onClick={() => queueDirection("up")}>
          <ChevronUp className="h-4 w-4" />
        </Button>
        <div />
        <Button size="icon" variant="outline" onClick={() => queueDirection("left")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => queueDirection("down")}>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => queueDirection("right")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {phase === "finished" ? (
        <p className="text-sm text-muted-foreground text-center">
          Run ended. Submit score to verify reward.
        </p>
      ) : null}
    </div>
  );
}

export default function Boosts() {
  const { user } = useAuth();
  const { refreshActivities, refreshUserProfile, refreshWallet } = useAppData();

  const [overview, setOverview] = useState<MiniGameOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [activeGameSlug, setActiveGameSlug] = useState<string | null>(null);
  const [gameSession, setGameSession] = useState<MiniGameSessionStartResult | null>(null);
  const [gameResult, setGameResult] = useState<GameResultState | null>(null);
  const [startingGame, setStartingGame] = useState<string | null>(null);

  const currentLevel = Number(user?.current_level || 1);
  const levelUnlocked = currentLevel >= MINI_GAME_LEVEL_REQUIRED;

  const activeGame = useMemo(
    () => overview?.games.find((game) => game.slug === activeGameSlug) || null,
    [overview?.games, activeGameSlug],
  );

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const bonusResult = await claimMiniGamesDailyLoginBonus();
      if (!bonusResult.already_claimed && bonusResult.bonus_xp > 0) {
        toast.success(
          `Daily login bonus: +${formatXp(bonusResult.bonus_xp)} XP (Day ${bonusResult.streak_count})`,
        );
      }
      const next = await getMiniGamesOverview();
      setOverview(next);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load mini games";
      toast.error(message);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const beginSession = async (slug: string) => {
    if (!levelUnlocked) {
      toast.error(`Mini games unlock at Level ${MINI_GAME_LEVEL_REQUIRED}.`);
      return;
    }

    const selected = overview?.games.find((game) => game.slug === slug);
    if (!selected) return;

    if (!selected.playable) {
      toast.message(`${selected.name} is currently ${statusLabel[selected.status]}.`);
      return;
    }

    setStartingGame(slug);
    try {
      const session = await startMiniGameSession(slug, {
        source: "mini-games-page",
        started_at: new Date().toISOString(),
      });
      setGameSession(session);
      setActiveGameSlug(slug);
      setGameResult(null);
      setOverview((current) =>
        current
          ? {
              ...current,
              energy: session.energy_remaining,
            }
          : current,
      );
      toast.success(`${session.game_name} started. Energy left: ${session.energy_remaining}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to start game";
      toast.error(message);
      await loadOverview();
    } finally {
      setStartingGame(null);
    }
  };

  const handleGameFinished = (rawScore: number) => {
    if (!activeGame) return;
    const estimated = estimateGameReward(activeGame, rawScore);
    setGameResult({
      rawScore,
      estimatedXp: estimated.xp,
      estimatedBix: estimated.bix,
      submitted: false,
      submitting: false,
      verified: null,
    });
  };

  const handleSubmitScore = async () => {
    if (!gameSession || !gameResult || gameResult.submitted) return;

    setGameResult((current) => (current ? { ...current, submitting: true } : current));
    try {
      const result = await submitMiniGameScore(gameSession.session_id, gameResult.rawScore, {
        submitted_at: new Date().toISOString(),
      });
      setGameResult((current) =>
        current
          ? {
              ...current,
              submitting: false,
              submitted: true,
              verified: result,
            }
          : current,
      );
      setOverview((current) =>
        current
          ? {
              ...current,
              energy: result.energy_remaining,
              today_games_played: result.games_played_today,
            }
          : current,
      );
      await Promise.all([refreshUserProfile(), refreshWallet(), refreshActivities(), loadOverview()]);
      toast.success(`Score submitted: +${formatXp(result.xp_earned)} XP (${result.bix_earned.toFixed(4)} BIX)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to submit score";
      setGameResult((current) => (current ? { ...current, submitting: false } : current));
      toast.error(message);
    }
  };

  const handleReturnToList = () => {
    setActiveGameSlug(null);
    setGameSession(null);
    setGameResult(null);
  };

  const handlePlayAgain = async () => {
    if (!activeGameSlug) return;
    await beginSession(activeGameSlug);
  };

  const verified = gameResult?.verified;
  const displayXp = verified ? verified.xp_earned : gameResult?.estimatedXp || 0;
  const displayBix = verified ? verified.bix_earned : gameResult?.estimatedBix || 0;

  return (
    <AppLayout>
      <div className="space-y-6 lg:space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_45%)]" />
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-2.5">
                  <Gamepad2 className="h-8 w-8 text-primary" />
                  Mini Games
                </h1>
                <p className="mt-1 text-sm sm:text-base text-muted-foreground max-w-2xl">
                  Play arcade games, earn XP, and track BIX conversion with secure score verification.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {overview?.conversion_rate || "10000 XP = 1 BIX"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Energy</p>
                <p className="mt-1 text-2xl font-bold">
                  {loadingOverview ? "--" : `${overview?.energy ?? 0}/${overview?.max_energy ?? 5}`}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Streak</p>
                <p className="mt-1 text-2xl font-bold">{loadingOverview ? "--" : `${overview?.streak_count ?? 0}d`}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Games</p>
                <p className="mt-1 text-2xl font-bold">
                  {loadingOverview ? "--" : Number(overview?.stats.total_games_played || 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">XP from Games</p>
                <p className="mt-1 text-2xl font-bold text-gradient-gold">
                  {loadingOverview ? "--" : formatXp(overview?.stats.total_xp_from_games || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">BIX from Games</p>
                <p className="mt-1 text-2xl font-bold">
                  {loadingOverview ? "--" : Number(overview?.stats.total_bix_earned_from_games || 0).toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {!levelUnlocked ? (
          <div className="glass rounded-xl p-4 border border-border/70">
            <p className="font-semibold">{`Mini games unlock at Level ${MINI_GAME_LEVEL_REQUIRED}`}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {`Current level: ${currentLevel}. Keep progressing through missions to unlock gameplay.`}
            </p>
          </div>
        ) : null}

        {activeGame && gameSession ? (
          <motion.section
            key={gameSession.session_id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{activeGame.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{activeGame.description}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Session</p>
                <p className="text-sm font-mono">{gameSession.session_id.slice(0, 8)}...</p>
                <p className="text-xs text-muted-foreground mt-1">{`Energy left: ${gameSession.energy_remaining}`}</p>
              </div>
            </div>

            {activeGame.slug === "bixtap" ? <BixTapGame onFinish={handleGameFinished} /> : null}
            {activeGame.slug === "bixsnake" ? <BixSnakeGame onFinish={handleGameFinished} /> : null}
            {activeGame.slug !== "bixtap" && activeGame.slug !== "bixsnake" ? (
              <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-sm text-muted-foreground">
                This game is connected to the reward system, but an in-app gameplay renderer is not available yet.
              </div>
            ) : null}

            {gameResult ? (
              <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Game Result</h3>
                  <Badge variant={verified ? "default" : "secondary"}>
                    {verified ? "Verified" : "Estimated"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase">Raw Score</p>
                    <p className="mt-1 text-xl font-bold">{gameResult.rawScore}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase">Final XP</p>
                    <p className="mt-1 text-xl font-bold text-gradient-gold">{formatXp(displayXp)}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase">BIX Earned</p>
                    <p className="mt-1 text-xl font-bold">{displayBix.toFixed(4)}</p>
                  </div>
                </div>

                {verified ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                    <p className="font-semibold mb-1">Verified bonuses</p>
                    <p>{`First Game: +${formatXp(verified.bonuses.first_game_bonus_xp)} XP`}</p>
                    <p>{`Combo: +${formatXp(verified.bonuses.combo_bonus_xp)} XP`}</p>
                    <p>{`Lucky XP: +${formatXp(verified.bonuses.lucky_bonus_xp)} XP`}</p>
                    <p>{`Lucky BIX: +${verified.bonuses.lucky_bonus_bix.toFixed(4)} BIX`}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Submit score to verify anti-abuse checks, bonuses, and lucky drop.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleSubmitScore()}
                    disabled={gameResult.submitting || gameResult.submitted}
                    className="bg-gradient-gold text-primary-foreground font-semibold"
                  >
                    {gameResult.submitting ? "Submitting..." : gameResult.submitted ? "Score Submitted" : "Submit Score"}
                  </Button>
                  <Button variant="outline" onClick={() => void handlePlayAgain()}>
                    Play Again
                  </Button>
                  <Button variant="outline" onClick={handleReturnToList}>
                    Return to Mini Games
                  </Button>
                </div>
              </div>
            ) : null}
          </motion.section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loadingOverview ? (
              <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading mini games...</div>
            ) : null}
            {overview?.games.map((game, index) => {
              const Icon = iconBySlug[game.slug] || Gamepad2;
              return (
                <motion.div
                  key={game.slug}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="glass rounded-2xl p-5 space-y-4 border border-border/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-11 w-11 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass[game.status]}`}>
                      {statusLabel[game.status]}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold">{game.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{game.description}</p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <span>{`Reward Rate: ${game.reward_rate}`}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Gem className="h-3.5 w-3.5 text-primary" />
                      <span>Conversion: 10,000 XP = 1 BIX</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-primary" />
                      <span>Max plays/day per game: 5</span>
                    </p>
                  </div>

                  <Button
                    onClick={() => void beginSession(game.slug)}
                    disabled={startingGame === game.slug || !game.playable || !levelUnlocked}
                    className="w-full"
                    variant={game.playable ? "default" : "outline"}
                  >
                    {!levelUnlocked
                      ? `Unlock at L${MINI_GAME_LEVEL_REQUIRED}`
                      : startingGame === game.slug
                        ? "Starting..."
                        : game.playable
                          ? "Play"
                          : "Coming Soon"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="glass rounded-2xl p-5 border border-border/70">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Leaderboard
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Leaderboard Coming Soon - Competition begins when more players join.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 border border-border/70">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            First game of the day gives +100 XP bonus. Combo bonuses apply at 3 games (+50 XP) and 5 games (+100 XP).
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
