import { AppLayout } from "@/components/AppLayout";
import { BixLogo } from "@/components/BixLogo";
import {
  formatBix,
  formatBixAmount,
} from "@/lib/currency";
import { BixCounter } from "@/components/BixCounter";
import {
  BixSnakeArenaGame,
  type BixSnakeArenaFinishResult,
} from "@/components/mini-games/BixSnakeArenaGame";
import { PlumberPuzzleGame } from "@/components/mini-games/PlumberPuzzleGame";
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
  longestLength: number | null;
  submitted: boolean;
  submitting: boolean;
  verified: MiniGameSubmitResult | null;
};

type GameFinishPayload = {
  rawScore: number;
  longestLength?: number;
  estimatedXp?: number;
};

type GamePanelProps = {
  onFinish: (payload: GameFinishPayload) => void;
};

const MINI_GAME_LEVEL_REQUIRED = 4;
const BIX_TAP_DURATION_SECONDS = 10;
const BIX_TAP_XP_PER_TAP = 2;

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

const categoryBySlug: Record<string, string> = {
  bixsnake: "Arcade",
  bixtap: "Arcade",
  bixmemory: "Puzzle",
};

function estimateGameReward(game: MiniGameCatalogItem, rawScore: number): { xp: number; bix: number } {
  const normalizedScore = Math.max(0, Math.min(Math.floor(rawScore), game.max_score));
  const baseXp = Math.min(normalizedScore * game.xp_per_unit, game.max_xp);
  const bix = Number((baseXp / 10000).toFixed(8));
  return { xp: baseXp, bix };
}

function BixTapGame({ onFinish }: GamePanelProps) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [timeLeft, setTimeLeft] = useState(BIX_TAP_DURATION_SECONDS);
  const [score, setScore] = useState(0);
  const [pulseSeed, setPulseSeed] = useState(0);

  const elapsedSeconds = useMemo(
    () => Math.max(0, BIX_TAP_DURATION_SECONDS - timeLeft),
    [timeLeft],
  );
  const progressPct = useMemo(
    () => Math.max(0, Math.min(100, (timeLeft / BIX_TAP_DURATION_SECONDS) * 100)),
    [timeLeft],
  );
  const tapsPerSecond = useMemo(
    () => (elapsedSeconds > 0 ? score / elapsedSeconds : 0),
    [score, elapsedSeconds],
  );
  const estimatedBaseXp = score * BIX_TAP_XP_PER_TAP;

  useEffect(() => {
    if (phase !== "running") return;

    if (timeLeft <= 0) {
      setPhase("finished");
      onFinish({ rawScore: score });
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
    setPulseSeed((current) => current + 1);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">BixTap Sprint</p>
            <p className="text-xs text-muted-foreground">Tap the BixGain logo as fast as possible in 10 seconds.</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {`${BIX_TAP_XP_PER_TAP} XP / tap`}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Time Left</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{`${timeLeft}s`}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Taps</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{score}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tap Speed</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold">{`${tapsPerSecond.toFixed(1)}/s`}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Est. Base XP</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-gradient-gold">{formatXp(estimatedBaseXp)}</p>
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-background/50 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300"
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.5 }}
          />
        </div>
      </div>

      <motion.button
        type="button"
        onPointerDown={handleTap}
        disabled={phase !== "running"}
        whileTap={phase === "running" ? { scale: 0.98 } : undefined}
        style={{ touchAction: "manipulation" }}
        className={`relative w-full min-h-[220px] sm:min-h-[260px] rounded-3xl border transition-colors ${
          phase === "running"
            ? "border-primary/40 bg-[radial-gradient(circle_at_50%_40%,rgba(251,191,36,0.22),rgba(56,189,248,0.12),rgba(15,23,42,0.9))]"
            : "border-border/60 bg-secondary/20"
        }`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
          <motion.div
            key={pulseSeed}
            initial={{ scale: 1 }}
            animate={{ scale: phase === "running" ? [1, 1.06, 1] : 1 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="pointer-events-none"
          >
            <BixLogo size="lg" />
          </motion.div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-[18rem]">
            {phase === "running"
              ? "Tap anywhere on this card to score."
              : phase === "idle"
                ? "Press Start, then tap this area rapidly."
                : "Round complete."}
          </p>
        </div>
      </motion.button>

      <div className="flex flex-wrap gap-2">
        <Button onClick={startRound} className="bg-gradient-gold text-primary-foreground font-semibold">
          {phase === "running" ? "Restart Round" : phase === "finished" ? "Play Again" : "Start BixTap"}
        </Button>
        <Button variant="outline" onClick={handleTap} disabled={phase !== "running"}>
          +1 Tap
        </Button>
      </div>

      {phase === "finished" ? (
        <p className="text-sm text-muted-foreground text-center">
          Round complete. Submit score to verify reward.
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
      const next = await getMiniGamesOverview();
      setOverview(next);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load mini games";
      toast.error(message);
    } finally {
      setLoadingOverview(false);
    }

    try {
      const bonusResult = await claimMiniGamesDailyLoginBonus();
      if (!bonusResult.already_claimed && bonusResult.bonus_xp > 0) {
        toast.success(
          `Daily login bonus: +${formatXp(bonusResult.bonus_xp)} XP (Day ${bonusResult.streak_count})`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const missingBonusFn =
        message.includes("mini_game_claim_daily_login_bonus") ||
        message.includes("schema cache") ||
        message.includes("could not find the function") ||
        message.includes("backend is not deployed");
      if (!missingBonusFn) {
        toast.error(error instanceof Error ? error.message : "Unable to claim daily login bonus");
      }
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Handler for games that submit their own scores internally (like Plumber Puzzle)
  const handleExternalGameSuccess = useCallback(async () => {
    await Promise.all([
      refreshUserProfile(),
      refreshWallet(),
      refreshActivities(),
      loadOverview()
    ]);
  }, [refreshUserProfile, refreshWallet, refreshActivities, loadOverview]);

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

  const handleGameFinished = ({ rawScore, longestLength, estimatedXp }: GameFinishPayload) => {
    if (!activeGame) return;
    const estimated = typeof estimatedXp === "number"
      ? (() => {
          const clampedXp = Math.max(0, Math.min(Math.floor(estimatedXp), activeGame.max_xp));
          return {
            xp: clampedXp,
            bix: Number((clampedXp / 10000).toFixed(8)),
          };
        })()
      : estimateGameReward(activeGame, rawScore);
    setGameResult({
      rawScore,
      estimatedXp: estimated.xp,
      estimatedBix: estimated.bix,
      longestLength: typeof longestLength === "number" ? Math.max(0, Math.floor(longestLength)) : null,
      submitted: false,
      submitting: false,
      verified: null,
    });
  };

  const handleArenaFinished = (result: BixSnakeArenaFinishResult) => {
    handleGameFinished({
      rawScore: result.rawScore,
      longestLength: result.longestLength,
      estimatedXp: result.xp,
    });

    if (!activeGame || !gameSession) return;

    const clampedEstimatedXp = Math.max(0, Math.min(Math.floor(result.xp), activeGame.max_xp));
    const estimatedBix = Number((clampedEstimatedXp / 10000).toFixed(8));

    setGameResult({
      rawScore: result.rawScore,
      estimatedXp: clampedEstimatedXp,
      estimatedBix,
      longestLength: Math.max(0, Math.floor(result.longestLength)),
      submitted: false,
      submitting: true,
      verified: null,
    });

    void (async () => {
      try {
        const verifiedResult = await submitMiniGameScore(gameSession.session_id, result.rawScore, {
          submitted_at: new Date().toISOString(),
          source: "bixsnake-arena-autosubmit",
        });
        setGameResult((current) =>
          current
            ? {
                ...current,
                submitting: false,
                submitted: true,
                verified: verifiedResult,
              }
            : current,
        );
        setOverview((current) =>
          current
            ? {
                ...current,
                energy: verifiedResult.energy_remaining,
                today_games_played: verifiedResult.games_played_today,
              }
            : current,
        );
        await Promise.all([refreshUserProfile(), refreshWallet(), refreshActivities(), loadOverview()]);
        toast.success(
          `Score submitted: +${formatXp(verifiedResult.xp_earned)} XP (${formatBixAmount(verifiedResult.bix_earned)} BIX)`,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to submit score";
        setGameResult((current) => (current ? { ...current, submitting: false } : current));
        toast.error(message);
      }
    })();
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
      toast.success(`Score submitted: +${formatXp(result.xp_earned)} XP (${formatBixAmount(result.bix_earned)} BIX)`);
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
                <p className="mt-1 text-2xl font-bold text-amber-400">
                  {loadingOverview ? "--" : (
                    <BixCounter 
                      value={Number(overview?.stats.total_bix_earned_from_games || 0)} 
                    />
                  )}
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
            {activeGame.slug === "bixsnake" ? (
              <BixSnakeArenaGame onFinish={handleArenaFinished} playerName={user?.username || "Player"} />
            ) : null}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    <p className="mt-1 text-xl font-bold text-amber-400">{formatBixAmount(displayBix)}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase">Longest Length</p>
                    <p className="mt-1 text-xl font-bold">{gameResult.longestLength ?? "--"}</p>
                  </div>
                </div>

                {verified ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                    <p className="font-semibold mb-1">Verified bonuses</p>
                    <p>{`First Game: +${formatXp(verified.bonuses.first_game_bonus_xp)} XP`}</p>
                    <p>{`Combo: +${formatXp(verified.bonuses.combo_bonus_xp)} XP`}</p>
                    <p>{`Lucky XP: +${formatXp(verified.bonuses.lucky_bonus_xp)} XP`}</p>
                    <p>{`Lucky BIX: +${formatBixAmount(verified.bonuses.lucky_bonus_bix)} BIX`}</p>
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
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Gamepad2 className="h-3.5 w-3.5 text-primary" />
                      <span>{`Category: ${categoryBySlug[game.slug] || "Arcade"}`}</span>
                    </p>
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

        {/* Plumber Puzzle Game */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Plumber Puzzle</h2>
              <p className="text-sm text-muted-foreground mt-1">Connect pipes to create a continuous water flow path.</p>
            </div>
            <Badge variant="outline" className="text-xs">
              Level 3 Required
            </Badge>
          </div>
          <PlumberPuzzleGame onSuccess={handleExternalGameSuccess} />
        </motion.section>

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
