import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatXp } from "@/lib/progression";
import type { MiniGameSubmitResult } from "@/lib/miniGamesApi";

type GameResultState = {
  rawScore: number;
  estimatedXp: number;
  estimatedBix: number;
  longestLength: number | null;
  submitted: boolean;
  submitting: boolean;
  verified: MiniGameSubmitResult | null;
};

type Props = {
  gameResult: GameResultState;
  displayXp: number;
  displayBix: number;
  onSubmitScore: () => void;
  onPlayAgain: () => void;
  onReturnToList: () => void;
};

export function GameResultPanel({ gameResult, displayXp, displayBix, onSubmitScore, onPlayAgain, onReturnToList }: Props) {
  const verified = gameResult.verified;
  const dragonLevel = Math.max(1, Math.floor(displayXp / 300) + 1);
  const unlockText = dragonLevel >= 10
    ? "Golden dragon skin unlocked"
    : dragonLevel >= 5
    ? "Wing animation unlocked"
    : dragonLevel >= 3
    ? "Fire effect unlocked"
    : "Keep playing to unlock dragon upgrades";

  return (
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
          <p className="mt-1 text-xl font-bold">{displayBix.toFixed(4)}</p>
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
          <p>{`Lucky BIX: +${verified.bonuses.lucky_bonus_bix.toFixed(4)} BIX`}</p>
          <p className="mt-2 text-xs text-muted-foreground">Daily cap, anti-bot, and score validation checks passed.</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Submit score to verify anti-abuse checks, bonuses, and lucky drop.</p>
      )}

      <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 text-sm">
        <p className="font-semibold mb-1">Dragon progression</p>
        <p>{`Dragon Level: ${dragonLevel}`}</p>
        <p className="text-xs text-muted-foreground">{unlockText}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSubmitScore} disabled={gameResult.submitting || gameResult.submitted} className="bg-gradient-gold text-primary-foreground font-semibold">
          {gameResult.submitting ? "Submitting..." : gameResult.submitted ? "Score Submitted" : "Submit Score"}
        </Button>
        <Button variant="outline" onClick={onPlayAgain}>Play Again</Button>
        <Button variant="outline" onClick={onReturnToList}>Return to Mini Games</Button>
      </div>
    </div>
  );
}

export type { GameResultState };
