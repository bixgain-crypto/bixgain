import { BixLogo } from "@/components/BixLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type GameFinishPayload = {
  rawScore: number;
  longestLength?: number;
  estimatedXp?: number;
};

type Props = {
  onFinish: (payload: GameFinishPayload) => void;
};

const BIX_TAP_DURATION_SECONDS = 10;
const BIX_TAP_XP_PER_TAP = 2;

export function BixTapGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [timeLeft, setTimeLeft] = useState(BIX_TAP_DURATION_SECONDS);
  const [score, setScore] = useState(0);
  const [pulseSeed, setPulseSeed] = useState(0);

  const elapsedSeconds = useMemo(() => Math.max(0, BIX_TAP_DURATION_SECONDS - timeLeft), [timeLeft]);
  const progressPct = useMemo(() => Math.max(0, Math.min(100, (timeLeft / BIX_TAP_DURATION_SECONDS) * 100)), [timeLeft]);
  const tapsPerSecond = useMemo(() => (elapsedSeconds > 0 ? score / elapsedSeconds : 0), [score, elapsedSeconds]);
  const estimatedBaseXp = score * BIX_TAP_XP_PER_TAP;

  useEffect(() => {
    if (phase !== "running") return;
    if (timeLeft <= 0) { setPhase("finished"); onFinish({ rawScore: score }); return; }
    const timer = window.setTimeout(() => setTimeLeft((c) => Math.max(0, c - 1)), 1000);
    return () => { window.clearTimeout(timer); };
  }, [phase, timeLeft, score, onFinish]);

  const startRound = () => { setScore(0); setTimeLeft(BIX_TAP_DURATION_SECONDS); setPhase("running"); };
  const handleTap = () => { if (phase !== "running") return; setScore((c) => c + 1); setPulseSeed((c) => c + 1); };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">BixTap Sprint</p>
            <p className="text-xs text-muted-foreground">Tap the BixGain logo as fast as possible in 10 seconds.</p>
          </div>
          <Badge variant="secondary" className="text-xs">{`${BIX_TAP_XP_PER_TAP} XP / tap`}</Badge>
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
          <motion.div className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300" animate={{ width: `${progressPct}%` }} transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.5 }} />
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
          <motion.div key={pulseSeed} initial={{ scale: 1 }} animate={{ scale: phase === "running" ? [1, 1.06, 1] : 1 }} transition={{ duration: 0.16, ease: "easeOut" }} className="pointer-events-none">
            <BixLogo size="lg" />
          </motion.div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-[18rem]">
            {phase === "running" ? "Tap anywhere on this card to score." : phase === "idle" ? "Press Start, then tap this area rapidly." : "Round complete."}
          </p>
        </div>
      </motion.button>

      <div className="flex flex-wrap gap-2">
        <Button onClick={startRound} className="bg-gradient-gold text-primary-foreground font-semibold">
          {phase === "running" ? "Restart Round" : phase === "finished" ? "Play Again" : "Start BixTap"}
        </Button>
        <Button variant="outline" onClick={handleTap} disabled={phase !== "running"}>+1 Tap</Button>
      </div>

      {phase === "finished" ? <p className="text-sm text-muted-foreground text-center">Round complete. Submit score to verify reward.</p> : null}
    </div>
  );
}
