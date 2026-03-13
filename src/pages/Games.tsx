import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { arcadeGames } from "@/lib/gamesCatalog";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Games() {
  return (
    <AppLayout>
      <section className="space-y-6">
        <div className="rounded-3xl border border-primary/25 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.28),rgba(22,163,74,0.15),rgba(2,6,23,0.95))] p-5 sm:p-7">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary/80">
            <Sparkles className="h-4 w-4" />
            BixGain Arcade
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold">Game Hub</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
            Discover tap-to-earn mini-games, chase high scores, and collect BIX in a neon Web3 arcade.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {arcadeGames.map((game) => (
            <Card
              key={game.slug}
              className={`group overflow-hidden border bg-gradient-to-br ${game.themeClass} backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-45px_rgba(59,130,246,0.9)]`}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-xl border border-primary/30 bg-background/50 p-2.5">
                    <game.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-xs text-primary/90">{game.rewardRate}</p>
                </div>
                <CardTitle className="text-xl">{game.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground min-h-[2.6rem]">{game.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild className="w-full font-semibold">
                  <Link to={game.path}>Play</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
