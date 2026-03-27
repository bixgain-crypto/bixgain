import { AppLayout } from "@/components/AppLayout";
import { ArcadeGameInterface } from "@/components/games/ArcadeGameInterface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { arcadeGameBySlug } from "@/lib/gamesCatalog";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function GameDetail() {
  const { slug = "" } = useParams();
  const game = arcadeGameBySlug[slug];
  const [, setRewardCounter] = useState(0);

  if (!game) {
    return (
      <AppLayout>
        <Card className="max-w-xl mx-auto mt-10 shadow-lg border-border/60">
          <CardHeader>
            <CardTitle>Game not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">{game.title}</h1>
          <Button asChild variant="outline">
            <Link to="/games">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <ArcadeGameInterface game={game} onReward={(amount) => setRewardCounter((value) => value + amount)} />
      </section>
    </AppLayout>
  );
}
