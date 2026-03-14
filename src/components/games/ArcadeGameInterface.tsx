import { BixSnakeArenaGame } from "@/components/mini-games/BixSnakeArenaGame";
import { BixTapGame } from "@/components/mini-games/BixTapGame";
import { PlumberPuzzleGame } from "@/components/mini-games/PlumberPuzzleGame";
import { Button } from "@/components/ui/button";
import type { ArcadeGame } from "@/lib/gamesCatalog";

type Props = {
  game: ArcadeGame;
  onReward: (amount: number) => void;
};

export function ArcadeGameInterface({ game, onReward }: Props) {
  if (game.slug === "bixtap") {
    return <BixTapGame onFinish={() => undefined} />;
  }

  if (game.slug === "bixsnake-arena") {
    return <BixSnakeArenaGame onFinish={({ rawScore }) => onReward(Math.max(2, Math.round(rawScore / 6)))} />;
  }

  if (game.slug === "plumber-puzzle") {
    return <PlumberPuzzleGame />;
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-secondary/25 p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {Array.from({ length: 12 }).map((_, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            className="aspect-square rounded-2xl border-primary/30 bg-background/60 text-lg"
            onClick={() => onReward(index + 1)}
          >
            {game.slug === "bixmemory" ? "🃏" : "🐉"}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {game.slug === "bixmemory"
          ? "Flip and match cards to increase your BIX payout per streak."
          : "Tap dragon tiles to complete quests and collect treasure rewards."}
      </p>
    </div>
  );
}
