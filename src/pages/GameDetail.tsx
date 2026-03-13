import { AppLayout } from "@/components/AppLayout";
import { ArcadeGameInterface } from "@/components/games/ArcadeGameInterface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { arcadeGameBySlug } from "@/lib/gamesCatalog";
import { ArrowLeft, Flame, Trophy, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

const fallbackLeaderboard = [
  { name: "Astra", score: "9,820" },
  { name: "Orion", score: "8,115" },
  { name: "Nova", score: "7,302" },
];

export default function GameDetail() {
  const { slug = "" } = useParams();
  const game = arcadeGameBySlug[slug];
  const [rewardCounter, setRewardCounter] = useState(0);

  const topScores = useMemo(() => fallbackLeaderboard, []);

  if (!game) {
    return (
      <AppLayout>
        <Card className="max-w-xl mx-auto mt-10">
          <CardHeader>
            <CardTitle>Game not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/games">Back to Games</Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <section className="space-y-5">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{game.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{game.description}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/games">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Games
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <ArcadeGameInterface game={game} onReward={(amount) => setRewardCounter((value) => value + amount)} />

          <div className="space-y-4">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/20 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Reward Counter</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gradient-gold">{rewardCounter} BIX</p>
                <p className="text-xs text-muted-foreground mt-1">Earned this session</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-primary" />Energy / Play Limit</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-sm">{game.energyLabel}</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Leaderboard</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topScores.map((entry, index) => (
                  <div key={entry.name} className="rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 flex items-center justify-between text-sm">
                    <span>#{index + 1} {entry.name}</span>
                    <span className="text-primary">{entry.score}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
